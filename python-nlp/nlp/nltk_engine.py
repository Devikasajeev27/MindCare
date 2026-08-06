"""
MindCare NLP — NLTK engine.

Stopword removal, tokenization, lemmatization, stemming, VADER sentiment,
keyword extraction and text cleaning.
Includes standard library fallback if nltk is missing.
"""

import os
import re
from collections import Counter

try:
    import nltk
    NLTK_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "nltk_data")
    os.makedirs(NLTK_DATA_DIR, exist_ok=True)
    if NLTK_DATA_DIR not in nltk.data.path:
        nltk.data.path.insert(0, NLTK_DATA_DIR)

    _REQUIRED = [
        ("tokenizers/punkt", "punkt"),
        ("corpora/stopwords", "stopwords"),
        ("corpora/wordnet", "wordnet"),
        ("corpora/omw-1.4", "omw-1.4"),
        ("sentiment/vader_lexicon", "vader_lexicon"),
    ]

    for resource_path, package in _REQUIRED:
        try:
            nltk.data.find(resource_path)
        except LookupError:
            try:
                nltk.download(package, download_dir=NLTK_DATA_DIR, quiet=True)
            except Exception:
                pass

    from nltk.tokenize import word_tokenize, sent_tokenize
    from nltk.stem import WordNetLemmatizer, PorterStemmer
    from nltk.corpus import stopwords
    from nltk.sentiment import SentimentIntensityAnalyzer

    STOPWORDS = set(stopwords.words("english"))
    _sia = SentimentIntensityAnalyzer()
    _lemmatizer = WordNetLemmatizer()
    _stemmer = PorterStemmer()
    NLTK_AVAILABLE = True
except Exception:
    NLTK_AVAILABLE = False
    STOPWORDS = {"the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "with", "by", "about", "against", "between", "into", "through", "during", "before", "after", "above", "below", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now"}
    _sia = None
    _lemmatizer = None
    _stemmer = None


def clean_text(text: str) -> str:
    text = (text or "").lower()
    text = re.sub(r"https?://\S+|www\.\S+", " ", text)
    text = re.sub(r"\S+@\S+", " ", text)
    text = re.sub(r"[^a-z0-9\s']", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def tokenize(text: str):
    if NLTK_AVAILABLE:
        try:
            return word_tokenize(text)
        except Exception:
            pass
    return text.split()


def sentences(text: str):
    if NLTK_AVAILABLE:
        try:
            return sent_tokenize(text)
        except Exception:
            pass
    return [s for s in re.split(r"(?<=[.!?])\s+", text) if s]


def remove_stopwords(tokens):
    return [t for t in tokens if t.lower() not in STOPWORDS and len(t) > 1]


def lemmatize(tokens):
    if NLTK_AVAILABLE and _lemmatizer:
        return [_lemmatizer.lemmatize(t) for t in tokens]
    return [t.lower() for t in tokens]


def stem(tokens):
    if NLTK_AVAILABLE and _stemmer:
        return [_stemmer.stem(t) for t in tokens]
    return [t.lower() for t in tokens]


def sentiment(text: str) -> dict:
    if NLTK_AVAILABLE and _sia is not None and text:
        scores = _sia.polarity_scores(text)
        compound = scores["compound"]
        if compound >= 0.05:
            label = "positive"
        elif compound <= -0.05:
            label = "negative"
        else:
            label = "neutral"
        return {**scores, "label": label}
    
    # Heuristic VADER approximation
    pos_words = {"good", "great", "happy", "joy", "love", "wonderful", "amazing", "pleasant", "calm", "hope", "peace", "better", "excellent"}
    neg_words = {"bad", "sad", "angry", "hate", "terrible", "awful", "horrible", "stress", "anxious", "fear", "pain", "hurt", "depressed", "worthless", "hopeless"}
    
    words = clean_text(text).split()
    pos_count = sum(1 for w in words if w in pos_words)
    neg_count = sum(1 for w in words if w in neg_words)
    
    total = max(len(words), 1)
    pos_score = pos_count / total
    neg_score = neg_count / total
    neu_score = max(0.0, 1.0 - pos_score - neg_score)
    compound = round(pos_score - neg_score, 2)
    
    label = "positive" if compound >= 0.05 else ("negative" if compound <= -0.05 else "neutral")
    return {"neg": neg_score, "neu": neu_score, "pos": pos_score, "compound": compound, "label": label}


def keywords(text: str, top_n: int = 12):
    toks = remove_stopwords(tokenize(clean_text(text)))
    lemmas = lemmatize(toks)
    counts = Counter(l for l in lemmas if l.isalpha() and len(l) > 2)
    return [{"keyword": w, "count": c} for w, c in counts.most_common(top_n)]


def preprocess(text: str) -> dict:
    cleaned = clean_text(text)
    toks = tokenize(cleaned)
    no_stop = remove_stopwords(toks)
    lemmas = lemmatize(no_stop)
    return {
        "cleaned_text": cleaned,
        "tokens": toks,
        "tokens_no_stopwords": no_stop,
        "lemmas": lemmas,
        "stems": stem(no_stop),
    }
