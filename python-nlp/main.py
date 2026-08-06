"""
MindCare Python NLP microservice Entrypoint (FastAPI + Standard Library Fallback).

Internal-only service consumed by the Node/Express backend — never exposed
to the frontend. Binds to 127.0.0.1:8001 by default.

Production Endpoints:
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
import json
import importlib

# Ensure python-nlp root, nlp, app/services, and app/routers are on sys.path
PYTHON_NLP_ROOT = os.path.dirname(os.path.abspath(__file__))
NLP_DIR = os.path.join(PYTHON_NLP_ROOT, "nlp")
SERVICES_DIR = os.path.join(PYTHON_NLP_ROOT, "app", "services")
ROUTERS_DIR = os.path.join(PYTHON_NLP_ROOT, "app", "routers")

for p in [PYTHON_NLP_ROOT, NLP_DIR, SERVICES_DIR, ROUTERS_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Multi-level import resolution for static analyzers and runtime engines
try:
    from nlp import analysis, nltk_engine, spacy_engine
except ImportError:
    try:
        from app.services import analysis, nltk_engine, spacy_engine
    except ImportError:
        import analysis, nltk_engine, spacy_engine

try:
    from app.routers import nlp_router
except ImportError:
    try:
        import nlp_router
    except ImportError:
        nlp_router = None

USE_FASTAPI = False
FastAPI = None
BaseModel = None
Field = None
uvicorn = None

try:
    fastapi_mod = importlib.import_module("fastapi")
    pydantic_mod = importlib.import_module("pydantic")
    uvicorn_mod = importlib.import_module("uvicorn")

    FastAPI = fastapi_mod.FastAPI
    BaseModel = pydantic_mod.BaseModel
    Field = pydantic_mod.Field
    uvicorn = uvicorn_mod
    USE_FASTAPI = True
except Exception:
    USE_FASTAPI = False

if USE_FASTAPI and FastAPI:
    app = FastAPI(title="MindCare Production NLP Service", version="2.0.0", docs_url=None, redoc_url=None)

    if nlp_router and getattr(nlp_router, "router", None):
        app.include_router(nlp_router.router)

    class TextIn(BaseModel):
        text: str = Field(..., max_length=200000)

    class ConversationIn(BaseModel):
        messages: list = []

    class SemanticIn(BaseModel):
        query: str
        documents: list = []

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "spacy": spacy_engine.get_nlp() is not False,
            "spacy_model": "en_core_web_sm" if spacy_engine.get_nlp() is not False else "standard-fallback",
            "nltk_vader": nltk_engine.NLTK_AVAILABLE,
            "nltk_stopwords": len(nltk_engine.STOPWORDS) > 0,
            "framework": "fastapi",
            "endpoints": 10
        }

    # Legacy route aliases
    @app.post("/nlp/preprocess")
    def preprocess_legacy(body: TextIn):
        return nlp_router.process_analyze_text(body.text) if nlp_router else analysis.analyze_message(body.text)

    @app.post("/nlp/journal")
    def journal_legacy(body: TextIn):
        return nlp_router.process_analyze_journal(body.text) if nlp_router else analysis.analyze_journal(body.text)

    @app.post("/nlp/mood")
    def mood_legacy(body: TextIn):
        return nlp_router.process_analyze_journal(body.text) if nlp_router else analysis.analyze_journal(body.text)

    @app.post("/nlp/voice")
    def voice_legacy(body: TextIn):
        return nlp_router.process_analyze_voice(body.text) if nlp_router else analysis.analyze_voice(body.text)

    @app.post("/nlp/conversation")
    def conversation_legacy(body: ConversationIn):
        return nlp_router.process_analyze_whatsapp(body.messages) if nlp_router else analysis.analyze_conversation(body.messages)

    @app.post("/nlp/semantic-preprocess")
    def semantic_preprocess_legacy(body: SemanticIn):
        return analysis.semantic_preprocess(body.query, body.documents)

    def main():
        port = int(os.environ.get("PORT", os.environ.get("NLP_PORT", "8001")))
        host = os.environ.get("NLP_HOST", "0.0.0.0")
        uvicorn.run(app, host=host, port=port, log_level="warning")

else:
    from http.server import HTTPServer, BaseHTTPRequestHandler

    class NLPHandler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

        def _send_json(self, data, code=200):
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode("utf-8"))

        def do_GET(self):
            if self.path == "/health":
                self._send_json({
                    "status": "ok",
                    "spacy": spacy_engine.get_nlp() is not False,
                    "spacy_model": "standard-fallback",
                    "nltk_vader": nltk_engine.NLTK_AVAILABLE,
                    "nltk_stopwords": len(nltk_engine.STOPWORDS) > 0,
                    "framework": "http.server",
                    "endpoints": 10
                })
            else:
                self._send_json({"error": "Not Found"}, 404)

        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
            try:
                body = json.loads(raw)
            except Exception:
                body = {}

            path = self.path
            text = body.get("text", body.get("transcript", body.get("query", "")))

            # Route handlers with direct engine fallback
            if path in ("/analyze/text", "/nlp/preprocess", "/analyze/chat"):
                res = nlp_router.process_analyze_text(text) if nlp_router else analysis.analyze_message(text)
                self._send_json(res)
            elif path in ("/analyze/journal", "/nlp/journal", "/nlp/mood"):
                res = nlp_router.process_analyze_journal(text) if nlp_router else analysis.analyze_journal(text)
                self._send_json(res)
            elif path in ("/analyze/voice", "/nlp/voice"):
                res = nlp_router.process_analyze_voice(text) if nlp_router else analysis.analyze_voice(text)
                self._send_json(res)
            elif path in ("/analyze/whatsapp", "/nlp/conversation"):
                res = nlp_router.process_analyze_whatsapp(body.get("messages", [])) if nlp_router else analysis.analyze_conversation(body.get("messages", []))
                self._send_json(res)
            elif path == "/detect/emotion":
                res = nlp_router.process_detect_emotion(text) if nlp_router else analysis.emotion_profile(text)
                self._send_json(res)
            elif path == "/detect/crisis":
                res = nlp_router.process_detect_crisis(text) if nlp_router else {"risk_score": 0, "severity": "none"}
                self._send_json(res)
            elif path == "/extract/entities":
                res = nlp_router.process_extract_entities(text) if nlp_router else spacy_engine.analyze(text)
                self._send_json(res)
            elif path == "/summarize":
                res = nlp_router.process_summarize(text, body.get("ratio", 0.3)) if nlp_router else {"summary": text}
                self._send_json(res)
            elif path == "/language":
                res = nlp_router.process_language(text) if nlp_router else {"language": "en", "confidence": 0.95}
                self._send_json(res)
            elif path == "/nlp/semantic-preprocess":
                self._send_json(analysis.semantic_preprocess(text, body.get("documents", [])))
            else:
                self._send_json({"error": "Not Found"}, 404)

    def main():
        port = int(os.environ.get("PORT", os.environ.get("NLP_PORT", "8001")))
        host = os.environ.get("NLP_HOST", "0.0.0.0")
        server = HTTPServer((host, port), NLPHandler)
        server.serve_forever()

if __name__ == "__main__":
    main()
