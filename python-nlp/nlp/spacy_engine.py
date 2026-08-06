"""
MindCare NLP — spaCy engine.

Wraps a single shared spaCy pipeline (en_core_web_sm) and exposes
tokenization, sentence segmentation, NER, POS tagging, dependency parsing,
noun-chunk/topic extraction and text normalization.
Includes a standard-library fallback if spaCy is not installed.
"""

import re
import threading

_nlp = None
_nlp_lock = threading.Lock()


def get_nlp():
    """Lazily load the spaCy model once per process (thread-safe)."""
    global _nlp
    if _nlp is None:
        with _nlp_lock:
            if _nlp is None:
                try:
                    import spacy
                    try:
                        _nlp = spacy.load("en_core_web_sm")
                    except OSError:
                        _nlp = spacy.blank("en")
                        _nlp.add_pipe("sentencizer")
                except ImportError:
                    _nlp = False
    return _nlp


def normalize_text(text: str) -> str:
    """Collapse whitespace, strip control chars; keep casing and punctuation."""
    text = re.sub(r"[​-‏﻿]", "", text or "")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def analyze(text: str, max_chars: int = 20000) -> dict:
    """Full spaCy pass (with standard library fallback if spaCy is not installed)."""
    clean = normalize_text(text)[:max_chars]
    nlp = get_nlp()

    if nlp and nlp is not False:
        doc = nlp(clean)

        tokens = []
        for tok in doc:
            if tok.is_space:
                continue
            tokens.append({
                "text": tok.text,
                "lemma": tok.lemma_ if tok.lemma_ else tok.text.lower(),
                "pos": tok.pos_ or "",
                "tag": tok.tag_ or "",
                "dep": tok.dep_ or "",
                "head": tok.head.text if tok.head is not None else "",
                "is_stop": bool(tok.is_stop),
                "is_alpha": bool(tok.is_alpha),
            })

        sentences = [s.text.strip() for s in doc.sents if s.text.strip()]

        entities = [
            {"text": ent.text, "label": ent.label_, "start": ent.start_char, "end": ent.end_char}
            for ent in doc.ents
        ]

        noun_chunks = []
        try:
            noun_chunks = [
                nc.text.lower().strip()
                for nc in doc.noun_chunks
                if len(nc.text.strip()) > 2
            ]
        except (ValueError, Exception):
            pass

        content_lemmas = [
            t["lemma"].lower()
            for t in tokens
            if t["is_alpha"] and not t["is_stop"] and t["pos"] in ("NOUN", "PROPN", "VERB", "ADJ")
        ]

        return {
            "normalized_text": clean,
            "tokens": tokens,
            "token_count": len(tokens),
            "sentences": sentences,
            "sentence_count": len(sentences),
            "entities": entities,
            "noun_chunks": noun_chunks[:40],
            "content_lemmas": content_lemmas,
        }

    # Standard library fallback
    words = clean.split()
    tokens = [
        {
            "text": w,
            "lemma": re.sub(r"[^\w]", "", w).lower(),
            "pos": "NOUN",
            "tag": "",
            "dep": "",
            "head": "",
            "is_stop": len(w) <= 3,
            "is_alpha": w.isalpha(),
        }
        for w in words
    ]
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", clean) if s.strip()] or [clean]
    
    return {
        "normalized_text": clean,
        "tokens": tokens,
        "token_count": len(tokens),
        "sentences": sentences,
        "sentence_count": len(sentences),
        "entities": [],
        "noun_chunks": [re.sub(r"[^\w]", "", w).lower() for w in words if len(w) > 4][:20],
        "content_lemmas": [re.sub(r"[^\w]", "", w).lower() for w in words if len(w) > 3],
    }
