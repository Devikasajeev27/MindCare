/**
 * Node → Python NLP microservice bridge.
 *
 * Internal AI processing layer: spaCy (tokenization, sentences, NER, POS, dependencies)
 * and NLTK (stopwords, lemmatization, VADER sentiment, keywords, emotion lexicons).
 *
 * Every call here is BEST-EFFORT: short timeout, null on any failure.
 * Callers treat a null result as "NLP unavailable" and degrade gracefully.
 */

const NLP_BASE_URL = process.env.NLP_SERVICE_URL || "http://127.0.0.1:8001";
const NLP_TIMEOUT_MS = Number(process.env.NLP_TIMEOUT_MS || 4000);

let lastHealthOk: boolean | null = null;
let lastHealthCheck = 0;
const HEALTH_CACHE_MS = 30_000;

async function post<T>(endpoint: string, body: unknown, timeoutMs = NLP_TIMEOUT_MS): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${NLP_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface NlpSentiment {
  neg: number;
  neu: number;
  pos: number;
  compound: number;
  label: "positive" | "negative" | "neutral";
}

export interface NlpEntity {
  text: string;
  label: string;
  start: number;
  end: number;
}

export interface NlpMessageAnalysis {
  normalized_text: string;
  sentences: string[];
  entities: NlpEntity[];
  noun_chunks: string[];
  content_lemmas: string[];
  keywords: { keyword: string; count: number }[];
  sentiment: NlpSentiment;
  emotions: { scores: Record<string, number>; dominant: string };
  stress: number;
  risk_markers: string[];
  token_count: number;
}

export interface NlpJournalAnalysis extends NlpMessageAnalysis {
  mood_estimate: number;
  risk_level: "none" | "elevated" | "high";
  confidence: number;
  topics: string[];
}

export interface NlpVoiceAnalysis {
  transcript: string;
  emotions: {
    despair: number;
    panic: number;
    anger: number;
    crying: boolean;
    longPauses: boolean;
  };
  sentiment: NlpSentiment;
  keywords: { keyword: string; count: number }[];
  risk_markers: string[];
}

export interface NlpConversationAnalysis {
  message_count: number;
  relationships: { name: string; mentions: number }[];
  entities: NlpEntity[];
  topics: string[];
  keywords: { keyword: string; count: number }[];
  sentiment: NlpSentiment;
  sentiment_trend: number[];
  negative_ratio: number;
  emotions: { scores: Record<string, number>; dominant: string };
  stress: number;
  risk_markers: string[];
  communication_patterns: {
    avg_message_words: number;
    short_message_ratio: number;
  };
}

export interface NlpSemanticRanking {
  query_terms: string[];
  query_entities: string[];
  ranked: { index: number; id: string | null; score: number; matched_terms: string[] }[];
}

export interface NlpEmotionDetection {
  dominant_emotion: string;
  confidence_score: number;
  emotion_scores: Record<string, number>;
  sentiment: NlpSentiment;
}

export interface NlpCrisisDetection {
  risk_score: number;
  severity: "none" | "elevated" | "high" | "critical";
  confidence: number;
  risk_markers: string[];
  recommended_action: string;
}

export interface NlpLanguageDetection {
  language: string;
  language_name: string;
  script: string;
  confidence: number;
}

export const NlpService = {
  /** Cached health probe */
  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (lastHealthOk !== null && now - lastHealthCheck < HEALTH_CACHE_MS) {
      return lastHealthOk;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const res = await fetch(`${NLP_BASE_URL}/health`, { signal: controller.signal });
      lastHealthOk = res.ok;
    } catch {
      lastHealthOk = false;
    } finally {
      clearTimeout(timer);
      lastHealthCheck = now;
    }
    return lastHealthOk;
  },

  /** 1. POST /analyze/text */
  analyzeText(text: string): Promise<NlpMessageAnalysis | null> {
    return post<NlpMessageAnalysis>("/analyze/text", { text });
  },

  /** 2. POST /analyze/journal */
  analyzeJournal(text: string): Promise<NlpJournalAnalysis | null> {
    return post<NlpJournalAnalysis>("/analyze/journal", { text });
  },

  /** 3. POST /analyze/chat */
  analyzeChat(text: string): Promise<NlpMessageAnalysis | null> {
    return post<NlpMessageAnalysis>("/analyze/chat", { text });
  },

  /** 4. POST /analyze/voice */
  analyzeVoice(transcript: string): Promise<NlpVoiceAnalysis | null> {
    return post<NlpVoiceAnalysis>("/analyze/voice", { transcript });
  },

  /** 5. POST /analyze/whatsapp */
  analyzeWhatsApp(messages: { sender?: string; text: string }[]): Promise<NlpConversationAnalysis | null> {
    return post<NlpConversationAnalysis>("/analyze/whatsapp", { messages }, 15_000);
  },

  /** 6. POST /detect/emotion */
  detectEmotion(text: string): Promise<NlpEmotionDetection | null> {
    return post<NlpEmotionDetection>("/detect/emotion", { text });
  },

  /** 7. POST /detect/crisis */
  detectCrisis(text: string): Promise<NlpCrisisDetection | null> {
    return post<NlpCrisisDetection>("/detect/crisis", { text });
  },

  /** 8. POST /extract/entities */
  extractEntities(text: string): Promise<{ entities: NlpEntity[]; noun_chunks: string[] } | null> {
    return post("/extract/entities", { text });
  },

  /** 9. POST /summarize */
  summarizeText(text: string, ratio = 0.3): Promise<{ summary: string; sentence_count: number } | null> {
    return post("/summarize", { text, ratio });
  },

  /** 10. POST /language */
  detectLanguage(text: string): Promise<NlpLanguageDetection | null> {
    return post<NlpLanguageDetection>("/language", { text });
  },

  // Legacy route aliases for backward compatibility
  preprocessMessage(text: string): Promise<NlpMessageAnalysis | null> {
    return this.analyzeText(text);
  },

  analyzeMoodNote(text: string): Promise<NlpJournalAnalysis | null> {
    return this.analyzeJournal(text);
  },

  analyzeVoiceTranscript(transcript: string): Promise<NlpVoiceAnalysis | null> {
    return this.analyzeVoice(transcript);
  },

  analyzeConversation(messages: { sender?: string; text: string }[]): Promise<NlpConversationAnalysis | null> {
    return this.analyzeWhatsApp(messages);
  },

  semanticPreprocess(query: string, documents: { id?: string; content: string }[]): Promise<NlpSemanticRanking | null> {
    return post<NlpSemanticRanking>("/nlp/semantic-preprocess", { query, documents });
  },
};
