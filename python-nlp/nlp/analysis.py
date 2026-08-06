"""
MindCare NLP — combined analysis built on spaCy + NLTK.

Produces the domain-level outputs the Node backend consumes:
emotion/stress/mood scoring, journal analysis, voice-transcript emotion
signals, conversation (chat-import) analysis and semantic preprocessing.
"""

from collections import Counter

from . import spacy_engine, nltk_engine

# Lexicons tuned for mental-wellness text. Scores are heuristic weights
# applied on lemmatized tokens (so "worrying" matches "worry").
EMOTION_LEXICON = {
    "sadness": {"sad", "unhappy", "depressed", "depression", "cry", "crying", "tear",
                "grief", "miserable", "down", "heartbroken", "lonely", "alone", "empty",
                "hopeless", "worthless", "numb"},
    "anxiety": {"anxious", "anxiety", "worry", "worried", "nervous", "panic", "fear",
                "afraid", "scared", "overwhelmed", "stress", "stressed", "tense",
                "restless", "dread", "uneasy"},
    "anger": {"angry", "anger", "mad", "furious", "hate", "rage", "annoyed",
              "frustrated", "irritated", "resent"},
    "joy": {"happy", "joy", "glad", "excited", "great", "wonderful", "amazing",
            "love", "grateful", "thankful", "proud", "hopeful", "calm", "peaceful",
            "relaxed", "better"},
}

STRESS_MARKERS = {"stress", "stressed", "pressure", "deadline", "exam", "overwork",
                  "exhausted", "burnout", "burnt", "overwhelmed", "sleepless",
                  "insomnia", "tired", "fatigue", "workload"}

RISK_MARKERS = {"suicide", "suicidal", "die", "death", "kill", "harm", "hurt",
                "cutting", "overdose", "hopeless", "worthless", "burden"}


def _lemma_set(text: str):
    pre = nltk_engine.preprocess(text)
    return pre, set(pre["lemmas"])


def emotion_profile(text: str) -> dict:
    """Score each emotion 0..1 by lexicon hits over content length."""
    pre, lemmas = _lemma_set(text)
    content_len = max(len(pre["tokens_no_stopwords"]), 1)
    scores = {}
    for emotion, lexicon in EMOTION_LEXICON.items():
        hits = sum(1 for l in pre["lemmas"] if l in lexicon)
        scores[emotion] = round(min(hits / max(content_len * 0.25, 1), 1.0), 3)
    dominant = max(scores, key=scores.get) if any(scores.values()) else "neutral"
    return {"scores": scores, "dominant": dominant if scores.get(dominant, 0) > 0 else "neutral"}


def stress_score(text: str) -> float:
    pre, lemmas = _lemma_set(text)
    hits = sum(1 for l in pre["lemmas"] if l in STRESS_MARKERS)
    return round(min(hits / max(len(pre["tokens_no_stopwords"]) * 0.2, 1), 1.0), 3)


def risk_hits(text: str):
    _, lemmas = _lemma_set(text)
    return sorted(lemmas & RISK_MARKERS)


def analyze_message(text: str) -> dict:
    """Chat-message preprocessing: everything the prompt/context builder needs."""
    spa = spacy_engine.analyze(text)
    sent = nltk_engine.sentiment(text)
    emotions = emotion_profile(text)
    return {
        "normalized_text": spa["normalized_text"],
        "sentences": spa["sentences"],
        "entities": spa["entities"],
        "noun_chunks": spa["noun_chunks"],
        "content_lemmas": spa["content_lemmas"],
        "keywords": nltk_engine.keywords(text),
        "sentiment": sent,
        "emotions": emotions,
        "stress": stress_score(text),
        "risk_markers": risk_hits(text),
        "token_count": spa["token_count"],
    }


def analyze_journal(text: str) -> dict:
    """Journal entry → mood/emotion/stress/topics/entities/sentiment/keywords."""
    base = analyze_message(text)
    compound = base["sentiment"]["compound"]
    # Map VADER compound (-1..1) onto the app's 1..5 mood scale
    mood_estimate = round((compound + 1) * 2 + 1, 1)
    stress = base["stress"]
    risk = base["risk_markers"]
    risk_level = "high" if risk else ("elevated" if stress > 0.5 or compound < -0.6 else "none")
    confidence = round(min(0.35 + base["token_count"] / 200.0, 0.9), 2)
    return {
        **base,
        "mood_estimate": max(1.0, min(5.0, mood_estimate)),
        "risk_level": risk_level,
        "confidence": confidence,
        "topics": base["noun_chunks"][:10],
    }


def analyze_voice(transcript: str) -> dict:
    """Voice transcript → emotion structure matching the Node VoiceAnalyzer shape."""
    base = analyze_message(transcript)
    scores = base["emotions"]["scores"]
    neg = base["sentiment"]["neg"]
    despair = round(min(scores.get("sadness", 0) * 0.7 + neg * 0.5, 1.0), 3)
    panic = round(min(scores.get("anxiety", 0) * 0.8 + neg * 0.3, 1.0), 3)
    anger = round(min(scores.get("anger", 0) * 0.9 + neg * 0.2, 1.0), 3)
    lowered = transcript.lower()
    crying = any(m in lowered for m in ("crying", "sobbing", "in tears", "can't stop crying"))
    long_pauses = "..." in transcript or bool(base["sentences"]) and any(
        len(s.split()) <= 2 for s in base["sentences"][:6]
    )
    return {
        "transcript": transcript,
        "emotions": {
            "despair": despair,
            "panic": panic,
            "anger": anger,
            "crying": crying,
            "longPauses": long_pauses,
        },
        "sentiment": base["sentiment"],
        "keywords": base["keywords"],
        "risk_markers": base["risk_markers"],
    }


def analyze_conversation(messages) -> dict:
    """WhatsApp/import analysis: relationships, emotion, sentiment, stress,
    topics and communication patterns across a message list."""
    texts = [m.get("text", "") for m in messages if m.get("text")]
    joined = "\n".join(texts)

    spa = spacy_engine.analyze(joined, max_chars=60000)
    overall_sentiment = nltk_engine.sentiment(joined[:15000])
    emotions = emotion_profile(joined)
    stress = stress_score(joined)

    # Relationship signals: PERSON entities ranked by mention count
    person_counts = Counter(
        e["text"] for e in spa["entities"] if e["label"] == "PERSON"
    )
    relationships = [
        {"name": name, "mentions": count} for name, count in person_counts.most_common(10)
    ]

    # Topics from noun chunks
    topic_counts = Counter(spa["noun_chunks"])
    topics = [t for t, _ in topic_counts.most_common(12)]

    # Per-message sentiment trend (sampled to bound cost)
    sample = texts[-60:]
    trend = [nltk_engine.sentiment(t)["compound"] for t in sample]
    avg_len = sum(len(t.split()) for t in sample) / max(len(sample), 1)

    negative_ratio = (
        sum(1 for c in trend if c < -0.05) / max(len(trend), 1)
    )

    return {
        "message_count": len(texts),
        "relationships": relationships,
        "entities": spa["entities"][:50],
        "topics": topics,
        "keywords": nltk_engine.keywords(joined, top_n=20),
        "sentiment": overall_sentiment,
        "sentiment_trend": trend,
        "negative_ratio": round(negative_ratio, 3),
        "emotions": emotions,
        "stress": stress,
        "risk_markers": risk_hits(joined[:15000]),
        "communication_patterns": {
            "avg_message_words": round(avg_len, 1),
            "short_message_ratio": round(
                sum(1 for t in sample if len(t.split()) <= 4) / max(len(sample), 1), 3
            ),
        },
    }


def semantic_preprocess(query: str, documents) -> dict:
    """Preprocess a query + documents for memory retrieval: returns lemmatized
    terms and an NLP relevance score per document (lemma overlap, entity boost)."""
    q = nltk_engine.preprocess(query)
    q_terms = set(q["lemmas"])
    q_spa = spacy_engine.analyze(query, max_chars=2000)
    q_entities = {e["text"].lower() for e in q_spa["entities"]}

    scored = []
    for i, doc in enumerate(documents):
        d = nltk_engine.preprocess(doc.get("content", ""))
        d_terms = set(d["lemmas"])
        overlap = len(q_terms & d_terms)
        entity_boost = sum(1 for e in q_entities if e in doc.get("content", "").lower())
        scored.append({
            "index": i,
            "id": doc.get("id"),
            "score": overlap + entity_boost * 2,
            "matched_terms": sorted(q_terms & d_terms)[:8],
        })

    scored.sort(key=lambda s: s["score"], reverse=True)
    return {"query_terms": sorted(q_terms), "query_entities": sorted(q_entities), "ranked": scored}
