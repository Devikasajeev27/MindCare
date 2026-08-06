"""
MindCare Python NLP microservice — Production Router (10 Endpoints).

Implements:
  1. POST /analyze/text
  2. POST /analyze/journal
  3. POST /analyze/chat
  4. POST /analyze/voice
  5. POST /analyze/whatsapp
  6. POST /detect/emotion
  7. POST /detect/crisis
  8. POST /extract/entities
  9. POST /summarize
 10. POST /language
"""

import sys
import os
import re

# Support both package imports and local module fallback
try:
    from app.services import analysis, nltk_engine, spacy_engine
except ImportError:
    try:
        from nlp import analysis, nltk_engine, spacy_engine
    except ImportError:
        import analysis, nltk_engine, spacy_engine

try:
    from fastapi import APIRouter
    HAS_FASTAPI = True
except (ImportError, ModuleNotFoundError):
    HAS_FASTAPI = False
    APIRouter = None


def process_analyze_text(text: str) -> dict:
    return analysis.analyze_message(text)

def process_analyze_journal(text: str) -> dict:
    return analysis.analyze_journal(text)

def process_analyze_chat(text: str) -> dict:
    return analysis.analyze_message(text)

def process_analyze_voice(transcript: str) -> dict:
    return analysis.analyze_voice(transcript)

def process_analyze_whatsapp(messages: list) -> dict:
    return analysis.analyze_conversation(messages)

def process_detect_emotion(text: str) -> dict:
    base = analysis.emotion_profile(text)
    spa = spacy_engine.analyze(text)
    nltk_sent = nltk_engine.sentiment(text)
    
    # Expand 14 emotion dimensions
    scores = base.get("scores", {})
    lower = text.lower()
    
    sadness = scores.get("sadness", 0.0)
    anxiety = scores.get("anxiety", 0.0)
    anger = scores.get("anger", 0.0)
    happiness = scores.get("joy", 0.0)
    
    loneliness = round(min(sadness * 0.8 + (0.5 if "alone" in lower or "lonely" in lower else 0.0), 1.0), 2)
    fear = round(min(anxiety * 0.9 + (0.4 if "afraid" in lower or "scared" in lower else 0.0), 1.0), 2)
    hopelessness = round(min(sadness * 0.7 + (0.6 if "hopeless" in lower or "given up" in lower else 0.0), 1.0), 2)
    burnout = round(min(analysis.stress_score(text) * 0.85 + (0.5 if "burnout" in lower or "exhausted" in lower else 0.0), 1.0), 2)
    excitement = round(min(happiness * 0.8 + (0.4 if "excited" in lower or "amazing" in lower else 0.0), 1.0), 2)
    confusion = round(0.5 if "?" in text or "don't know" in lower or "confused" in lower else 0.1, 2)
    guilt = round(0.6 if "my fault" in lower or "guilty" in lower or "regret" in lower else 0.0, 2)
    shame = round(0.6 if "ashamed" in lower or "embarrassed" in lower else 0.0, 2)
    grief = round(min(sadness * 0.9 + (0.5 if "loss" in lower or "died" in lower or "passed away" in lower else 0.0), 1.0), 2)
    stress = analysis.stress_score(text)
    
    full_scores = {
        "sadness": sadness,
        "stress": stress,
        "loneliness": loneliness,
        "anxiety": anxiety,
        "fear": fear,
        "hopelessness": hopelessness,
        "burnout": burnout,
        "anger": anger,
        "happiness": happiness,
        "excitement": excitement,
        "confusion": confusion,
        "guilt": guilt,
        "shame": shame,
        "grief": grief,
    }
    
    dominant = max(full_scores, key=full_scores.get) if any(full_scores.values()) else "neutral"
    confidence = round(min(0.4 + len(text.split()) / 50.0, 0.95), 2)

    return {
        "dominant_emotion": dominant,
        "confidence_score": confidence,
        "emotion_scores": full_scores,
        "sentiment": nltk_sent,
    }

def process_detect_crisis(text: str) -> dict:
    risk_markers = analysis.risk_hits(text)
    stress = analysis.stress_score(text)
    sent = nltk_engine.sentiment(text)
    
    score = 0
    if "suicide" in risk_markers or "kill" in risk_markers:
        score += 65
    if "harm" in risk_markers or "hurt" in risk_markers:
        score += 45
    if "hopeless" in risk_markers or "worthless" in risk_markers:
        score += 30
    if stress > 0.6:
        score += 20
    if sent["compound"] < -0.5:
        score += 15
        
    score = min(100, score)
    
    if score >= 75:
        level = "critical"
        action = "Activate Immediate Crisis Intervention Workflow & Notify Helpline"
    elif score >= 45:
        level = "high"
        action = "Switch AI to Crisis Support Mode & Offer Emergency Helplines"
    elif score >= 20:
        level = "elevated"
        action = "Provide Deep Empathetic Listening & Support"
    else:
        level = "none"
        action = "Standard Supportive Chat"
        
    return {
        "risk_score": score,
        "severity": level,
        "confidence": round(min(0.5 + len(risk_markers) * 0.2, 0.98), 2),
        "risk_markers": risk_markers,
        "recommended_action": action,
    }

def process_extract_entities(text: str) -> dict:
    spa = spacy_engine.analyze(text)
    return {
        "entities": spa["entities"],
        "noun_chunks": spa["noun_chunks"],
        "token_count": spa["token_count"],
    }

def process_summarize(text: str, ratio: float = 0.3) -> dict:
    spa = spacy_engine.analyze(text)
    sents = spa["sentences"]
    if not sents:
        return {"summary": text, "sentence_count": 0, "original_count": 0}
        
    count = max(1, int(len(sents) * ratio))
    summary_sents = sents[:count]
    return {
        "summary": " ".join(summary_sents),
        "sentence_count": len(summary_sents),
        "original_count": len(sents),
    }

def process_language(text: str) -> dict:
    lower = text.lower()
    
    # Check script
    if re.search(r"[\u0D00-\u0D7F]", text):
        return {"language": "ml", "language_name": "Malayalam", "script": "Malayalam", "confidence": 0.99}
    if re.search(r"[\u0B80-\u0BFF]", text):
        return {"language": "ta", "language_name": "Tamil", "script": "Tamil", "confidence": 0.99}
    if re.search(r"[\u0900-\u097F]", text):
        return {"language": "hi", "language_name": "Hindi", "script": "Devanagari", "confidence": 0.99}
        
    # Check Manglish / Tanglish / Hinglish
    manglish_words = ["enikk", "vayya", "sugam", "njan", "enth", "cheyya", "aano", "aanu"]
    tanglish_words = ["naan", "romba", "enaku", "iruku", "epadi", "saptiya"]
    hinglish_words = ["mujhe", "yaar", "kya", "karu", "hai", "ho", "raha"]
    
    words = lower.split()
    mang_hits = sum(1 for w in words if w in manglish_words)
    tang_hits = sum(1 for w in words if w in tanglish_words)
    hing_hits = sum(1 for w in words if w in hinglish_words)
    
    if mang_hits > 0:
        return {"language": "manglish", "language_name": "Manglish", "script": "Latin", "confidence": 0.92}
    if tang_hits > 0:
        return {"language": "tanglish", "language_name": "Tanglish", "script": "Latin", "confidence": 0.92}
    if hing_hits > 0:
        return {"language": "hinglish", "language_name": "Hinglish", "script": "Latin", "confidence": 0.92}
        
    return {"language": "en", "language_name": "English", "script": "Latin", "confidence": 0.95}


# FastAPI router definition if FastAPI is available
if HAS_FASTAPI:
    router = APIRouter()

    @router.post("/analyze/text")
    def analyze_text_route(body: dict):
        return process_analyze_text(body.get("text", ""))

    @router.post("/analyze/journal")
    def analyze_journal_route(body: dict):
        return process_analyze_journal(body.get("text", ""))

    @router.post("/analyze/chat")
    def analyze_chat_route(body: dict):
        return process_analyze_chat(body.get("text", ""))

    @router.post("/analyze/voice")
    def analyze_voice_route(body: dict):
        return process_analyze_voice(body.get("text", body.get("transcript", "")))

    @router.post("/analyze/whatsapp")
    def analyze_whatsapp_route(body: dict):
        return process_analyze_whatsapp(body.get("messages", []))

    @router.post("/detect/emotion")
    def detect_emotion_route(body: dict):
        return process_detect_emotion(body.get("text", ""))

    @router.post("/detect/crisis")
    def detect_crisis_route(body: dict):
        return process_detect_crisis(body.get("text", ""))

    @router.post("/extract/entities")
    def extract_entities_route(body: dict):
        return process_extract_entities(body.get("text", ""))

    @router.post("/summarize")
    def summarize_route(body: dict):
        return process_summarize(body.get("text", ""), body.get("ratio", 0.3))

    @router.post("/language")
    def language_route(body: dict):
        return process_language(body.get("text", ""))
else:
    router = None
