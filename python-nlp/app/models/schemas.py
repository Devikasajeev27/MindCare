"""
MindCare Python NLP microservice — Request & Response Schemas.

Pydantic models with safe import trapping for missing environment packages.
"""

from typing import List, Optional, Any

try:
    from pydantic import BaseModel, Field
    HAS_PYDANTIC = True
except (ImportError, ModuleNotFoundError):
    HAS_PYDANTIC = False
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def model_dump(self):
            return {k: getattr(self, k) for k in dir(self) if not k.startswith("_")}
    
    def Field(default=..., **kwargs):
        return default


if HAS_PYDANTIC:
    class TextIn(BaseModel):
        text: str = Field(..., max_length=200000)

    class JournalIn(BaseModel):
        text: str = Field(..., max_length=200000)
        title: Optional[str] = None

    class MessageIn(BaseModel):
        sender: Optional[str] = ""
        text: str = ""

    class ConversationIn(BaseModel):
        messages: List[MessageIn] = []

    class DocumentIn(BaseModel):
        id: Optional[str] = None
        content: str = ""

    class SemanticIn(BaseModel):
        query: str
        documents: List[DocumentIn] = []

    class SummarizeIn(BaseModel):
        text: str
        ratio: Optional[float] = 0.3
else:
    class TextIn(BaseModel):
        pass
    class JournalIn(BaseModel):
        pass
    class MessageIn(BaseModel):
        pass
    class ConversationIn(BaseModel):
        pass
    class DocumentIn(BaseModel):
        pass
    class SemanticIn(BaseModel):
        pass
    class SummarizeIn(BaseModel):
        pass
