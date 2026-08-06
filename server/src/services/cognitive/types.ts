export type RiskLevel = "none" | "moderate" | "high" | "critical";

export type UserIntent =
  | "seeking_support"
  | "journal_reflection"
  | "venting"
  | "crisis_help"
  | "memory_recall"
  | "coping_request"
  | "small_talk"
  | "progress_check"
  | "general_query";

export type ResponseStrategyType =
  | "active_listening"
  | "emotional_validation"
  | "clarification"
  | "coaching"
  | "education"
  | "celebration"
  | "gentle_motivation"
  | "problem_solving"
  | "greeting"
  | "follow_up"
  | "memory_reflection"
  | "crisis_support";

export interface LanguageInfo {
  language: "ml" | "manglish" | "mixed_ml_en" | "en" | "es" | "fr" | "hi" | "ta" | string;
  languageName: string;
  script: "Malayalam" | "Latin" | "Devanagari" | "Tamil" | "Arabic" | string;
  confidence: number;
}

export interface EmotionInfo {
  dominant: string;
  confidence: number;
  scores: Record<string, number>;
  sentimentLabel: "positive" | "negative" | "neutral";
  sentimentScore: number;
}

export interface CrisisInfo {
  isCrisis: boolean;
  riskScore: number;
  severity: RiskLevel;
  triggers: string[];
  recommendedAction: string;
  /** Whether the risk came from this message or an unresolved recent disclosure. */
  source?: "current_message" | "recent_conversation" | "none";
}

export interface KnowledgeItem {
  id: string;
  category: "cbt" | "mindfulness" | "journaling" | "stress" | "sleep" | "motivation" | "crisis" | "policy";
  title: string;
  content: string;
  tags: string[];
}

export interface CognitiveContextPackage {
  userMessage: string;
  language: LanguageInfo;
  intent: UserIntent;
  emotion: EmotionInfo;
  crisis: CrisisInfo;
  profileSummary: {
    name: string;
    role: string;
    wellnessScore: number;
    streak: number;
    trustScore: number;
    talkingStyle: any;
    behaviorSummary: any;
  };
  longTermMemories: Array<{ category: string; content: string; importance: string }>;
  recentMessages: Array<{
    sender: string;
    text: string;
    riskLevel?: string;
    time?: Date;
  }>;
  /** A compact, factual summary generated from real persisted chat messages. */
  conversationSummary: string;
  journalSummary: {
    recentCount: number;
    topTopics: string[];
    moodEstimate: number;
  };
  moodAnalytics: {
    averageRating: number;
    recentTrend: string;
    volatility: string;
  };
  distressScore?: number;
  escalationTier?: "low" | "moderate" | "high" | "critical" | string;
  retrievedKnowledge: KnowledgeItem[];
}

export interface ResponseStrategy {
  strategy: ResponseStrategyType;
  instructions: string;
  tone: string;
  targetLength: "short" | "medium" | "long";
  includeCopingExercise: boolean;
  exerciseType?: string;
  followUpQuestion?: string;
}

export interface QualityEvaluation {
  isRelevant: boolean;
  isContextAware: boolean;
  isEmpathetic: boolean;
  isNonRepetitive: boolean;
  isClear: boolean;
  isNatural: boolean;
  isLanguageMirrored: boolean;
  isCrisisResponsive: boolean;
  usesGenericDefault: boolean;
  overallScore: number; // 0 - 100
  passed: boolean;
  feedback: string;
}

export interface CognitivePipelineResult {
  response: string;
  strategy: ResponseStrategy;
  quality: QualityEvaluation;
  extractedMemoriesCount: number;
  executionTimeMs: number;
  contextPackage: CognitiveContextPackage;
  wasRevised: boolean;
  distressWindow?: {
    count: number;
    threshold: number;
    windowMinutes: number;
    therapistConnection?: {
      connected: boolean;
      emergencySessionId?: string;
      therapist?: { id: string; name: string };
    };
  };
}

export interface VoicePipelineResult extends CognitivePipelineResult {
  sttTranscript: string;
  sttConfidence: number;
  audioResponseUrl?: string;
}
