import { NlpService } from "../nlpService.ts";
import { CrisisInfo, EmotionInfo, LanguageInfo, UserIntent } from "./types.ts";

/**
 * These phrases are deliberately local and synchronous. A safety-critical
 * disclosure must not depend on the NLP sidecar being reachable.
 */
const CRISIS_KEYWORDS = [
  "kill myself", "end my life", "want to die", "i don't want to live", "i dont want to live",
  "suicide", "suicidal", "self harm", "self-harm", "hurt myself", "cut myself",
  "no reason to live", "better off dead", "end it all", "can't go on", "cannot go on",
  "goodbye forever", "don't want to wake up", "life is meaningless", "life has no meaning",
  "not worth living",
  // Malayalam written in Latin script (Manglish)
  "enikk jeevikkan thonnunnilla", "enikku jeevikkan thonnunnilla", "jeevikkan thonnunnilla",
  "jeevikkan thonunnilla", "jeevikkan thonnilla", "jeevikkan venda", "jeevikkan ishtam illa",
  "enik ini jeevikenda", "enikk ini jeevikenda", "jeevikenda", "jeevikkandann", "jeevikkanda",
  "jeevikkan vayya", "jeevikkan vayyaa",
  "marikkanam", "marikkan thonnunnu", "marikkan thonunnu", "aathmahatya", "aathmahathya",
  "njan marikkunnatha nallath", "marikkunnatha nallath", "marikkanatha nallath", "chavunnatha nallath",
  "marichalo", "chathalo", "chavanam", "chavan thonnunnu", "chatha", "marichu pokan",
  "life venda", "enikk e life venda", "ee life venda", "enik life venda",
  "suicide cheyyanam", "suicide thonnunnu", "aathma hatha",
  "jeevitham artham illa", "jeevithathinu artham illa", "life meaning illa",
  // Malayalam script
  "ജീവിക്കാൻ തോന്നുന്നില്ല", "ജീവിക്കണം എന്ന് തോന്നുന്നില്ല", "എനിക്ക് ഇനി ജീവിക്കണ്ട", "ജീവിതം വേണ്ട",
  "ജീവിക്കാൻ വയ്യ", "ജീവിക്കാൻ വയ്യാ", "മരിക്കണം", "മരിച്ചാലോ", "ചത്താലോ", "മരിക്കാൻ തോന്നുന്നു", "ആത്മഹത്യ",
  "ജീവിതത്തിന് അർത്ഥമില്ല",
];

const DISTRESS_KEYWORDS = {
  high: [
    "hopeless", "worthless", "nobody cares", "no one cares", "hate myself", "give up",
    "can't take it anymore", "cannot take it anymore", "falling apart", "breaking down",
    "losing my mind", "i'm done", "im done", "nothing matters", "dead inside",
    "maduthu", "maduth", "life maduthu", "life maduth", "jeevitham thanne maduthu",
    "jeevitham maduthu", "jeevitham maduth", "thalarunnu", "vedhana", "sangadam", "katta vishamam",
    "sankatam", "kashtam", "ജീവിതം മടുത്തു", "മടുത്തു", "തളർന്നു", "വേദന", "സങ്കടം",
  ],
  moderate: [
    "really depressed", "very anxious", "overwhelmed", "can't cope", "cannot cope",
    "feeling empty", "numb", "trapped", "exhausted", "struggling", "scared",
    "desperate", "feel alone", "distress", "depressed", "sad", "crying",
    "vishamam", "pediyund", "pediyaa", "pediyaan", "sahikkan pattunnilla",
    "depress", "vayya", "vayyaa", "sukham illa", "sukhamilla",
    "വിഷമം", "പേടിയുണ്ട്", "സഹിക്കാൻ പറ്റുന്നില്ല",
  ],
};

const MANGLISH_KEYWORDS = [
  "enikk", "enikku", "ningal", "sugham", "sukham", "vishamam", "sheri", "illa", "und",
  "poyi", "varam", "samsarikkam", "thonnunnu", "thonnunnilla", "thonunnu", "thonunnilla",
  "pedikkunnu", "aanu", "cheyyanam", "entha", "engane", "karyam", "parayoo", "parayu",
  "nalla", "pinne", "manassilaayi", "manassilakunnu", "valare", "innu", "ippol", "aano",
  "allo", "alle", "veettil", "officeil", "vayya", "vayyaa", "jeevikkan", "marikkan",
  "njan", "njaan", "paranjath", "ellam", "orma", "undo", "munpe", "kurich",
  "budhimutt", "bandham", "thonnunne", "maduthu", "maduth", "jeevitham",
  "thalarunnu", "vedhana", "sangadam", "sankatam", "kashtam",
];

const ENGLISH_FUNCTION_WORDS = new Set([
  "i", "im", "i'm", "am", "the", "and", "that", "this", "with", "for", "about", "of",
  "to", "in", "on", "at", "not", "feeling", "well", "please", "can", "you", "do", "remember",
]);

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordMatches(lower: string, keyword: string): boolean {
  const normalizedKeyword = normalise(keyword);
  if (!normalizedKeyword) return false;
  if (/[^\x00-\x7F]/.test(normalizedKeyword) || normalizedKeyword.includes(" ")) {
    return lower.includes(normalizedKeyword);
  }
  return new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, "i").test(lower);
}

function findDistressTriggers(text: string, severity: "high" | "moderate"): string[] {
  const lower = normalise(text);
  return DISTRESS_KEYWORDS[severity].filter((keyword) => keywordMatches(lower, keyword));
}

function manglishMatches(lower: string): string[] {
  return MANGLISH_KEYWORDS.filter((keyword) => new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(lower));
}

export function findCrisisTriggers(text: string): string[] {
  const lower = normalise(text);
  return CRISIS_KEYWORDS.filter((keyword) => lower.includes(keyword));
}

/** Used by the controller before persistence and by the cognitive pipeline. */
export function isImmediateCrisisMessage(text: string): boolean {
  return findCrisisTriggers(text).length > 0;
}

function noCrisis(): CrisisInfo {
  return {
    isCrisis: false,
    riskScore: 0.1,
    severity: "none",
    triggers: [],
    recommendedAction: "Standard supportive response.",
    source: "none",
  };
}

function hasSafetyConfirmation(text: string): boolean {
  const lower = normalise(text);
  return /\b(i(?:'m| am)? safe|safe now|i am okay|i'm okay|njan safe aanu|njan surakshithan aanu|njan surakshithayaanu)\b/.test(lower);
}

/**
 * A direct disclosure is critical. A very recent unresolved disclosure remains
 * high priority on the next turn, so “I'm not feeling well” does not fall back
 * to normal small-talk immediately after a suicide-related message.
 */
export function resolveConversationCrisis(
  current: CrisisInfo,
  currentText: string,
  recentMessages: Array<{ sender: string; text: string; time?: Date }>
): CrisisInfo {
  if (current.isCrisis) return { ...current, source: "current_message" };
  if (hasSafetyConfirmation(currentText)) return noCrisis();

  const now = Date.now();
  const recentRisk = recentMessages
    .filter((message) => message.sender === "user" && normalise(message.text) !== normalise(currentText))
    .slice(-6)
    .find((message) => {
      const messageTime = message.time ? new Date(message.time).getTime() : now;
      const isRecent = Number.isNaN(messageTime) || now - messageTime <= 90 * 60 * 1000;
      return isRecent && isImmediateCrisisMessage(message.text);
    });

  if (!recentRisk) return current;

  return {
    isCrisis: true,
    riskScore: 0.8,
    severity: "high",
    triggers: findCrisisTriggers(recentRisk.text),
    recommendedAction: "Keep the conversation in high-priority safety support until the user confirms they are safe.",
    source: "recent_conversation",
  };
}

async function quickNlp<T>(request: Promise<T | null>, timeoutMs = 350): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

// Module 1: Multilingual Language Engine
export async function detectLanguage(text: string): Promise<LanguageInfo> {
  if (/[\u0D00-\u0D7F]/.test(text)) {
    return { language: "ml", languageName: "Malayalam", script: "Malayalam", confidence: 0.99 };
  }
  if (text.includes("🎙️ Voice Message") || /\b(voice|audio|message)\b/i.test(text)) {
    return { language: "manglish", languageName: "Manglish", script: "Latin", confidence: 0.95 };
  }
  if (/[\u0600-\u06FF]/.test(text)) return { language: "ar", languageName: "Arabic", script: "Arabic", confidence: 0.95 };
  if (/[\u0900-\u097F]/.test(text)) return { language: "hi", languageName: "Hindi", script: "Devanagari", confidence: 0.95 };
  if (/[\u0B80-\u0BFF]/.test(text)) return { language: "ta", languageName: "Tamil", script: "Tamil", confidence: 0.95 };

  const lower = normalise(text);
  const matchedManglishWords = manglishMatches(lower);
  if (matchedManglishWords.length > 0) {
    const words = lower.match(/[a-z]+/g) || [];
    const englishFunctionWordCount = words.filter((word) => ENGLISH_FUNCTION_WORDS.has(word)).length;
    const lexicalEnglishWords = words.filter((word) => !matchedManglishWords.includes(word) && !ENGLISH_FUNCTION_WORDS.has(word));
    const isClearlyMixed = matchedManglishWords.length === 1 && (englishFunctionWordCount >= 2 || lexicalEnglishWords.length >= 2);

    return isClearlyMixed
      ? { language: "mixed_ml_en", languageName: "Mixed Malayalam & English", script: "Latin", confidence: 0.9 }
      : { language: "manglish", languageName: "Manglish", script: "Latin", confidence: 0.96 };
  }

  if (/\b(hola|gracias|por favor|ayuda|estoy|triste|bien)\b/.test(lower)) return { language: "es", languageName: "Spanish", script: "Latin", confidence: 0.85 };
  if (/\b(bonjour|merci|triste|aide|suis)\b/.test(lower)) return { language: "fr", languageName: "French", script: "Latin", confidence: 0.85 };

  // Deterministic English fallback keeps normal conversation latency independent
  // of the optional NLP process.
  return { language: "en", languageName: "English", script: "Latin", confidence: 0.99 };
}

// Module 2: Intent Detection
export function detectIntent(text: string, crisis: CrisisInfo): UserIntent {
  if (crisis.isCrisis) return "crisis_help";

  const lower = normalise(text);
  if (/\b(do you remember|remember what|what did i say|memory|orma undo|orma und|njan paranjath|njaan paranjath|paranjath ellam|munpe paranjath)\b/.test(lower)) return "memory_recall";
  if (/\b(journal|wrote|entry|reflect|dear diary)\b/.test(lower)) return "journal_reflection";
  if (/\b(exercise|breathing|cbt|meditate|technique|calm down|help me relax|tips|how to deal)\b/.test(lower)) return "coping_request";
  if (/\b(struggling|sad|anxious|tired|overwhelmed|depressed|stress|scared|lonely|pain|vishamam|pedi|anxiety aanu|vayya|sukham illa|sukhamilla|not feeling well|not well|unwell)\b/.test(lower)) return "seeking_support";
  if (/\b(angry|hate|frustrated|annoyed|unfair|boss|work|office|pressure|relationship|vent|katta deshyam)\b/.test(lower)) return "venting";
  if (/\b(progress|score|wellness|level|streak|stats)\b/.test(lower)) return "progress_check";
  if (/\b(hi|hello|hey|good morning|good evening|how are you|sheri|sukhamaano)\b/.test(lower)) return "small_talk";

  return "general_query";
}

function localEmotion(text: string): EmotionInfo {
  const lower = normalise(text);
  let dominant = "neutral";
  let sentimentLabel: "positive" | "negative" | "neutral" = "neutral";
  let sentimentScore = 0;

  if (/\b(lonely|alone|isolated|nobody|no one|ottakk|ottaykk|ottayaanu|ottayky|single)\b/.test(lower)) {
    dominant = "lonely";
    sentimentLabel = "negative";
    sentimentScore = -0.65;
  } else if (/\b(burnout|exhausted|drained|no energy|tired of everything|katta tired|zero energy|completely spent)\b/.test(lower)) {
    dominant = "burnout";
    sentimentLabel = "negative";
    sentimentScore = -0.7;
  } else if (/\b(overwhelmed|too much|can't handle|cannot handle|heavy|burden|thaanan pattunnilla|too many things|suffocating)\b/.test(lower)) {
    dominant = "overwhelmed";
    sentimentLabel = "negative";
    sentimentScore = -0.75;
  } else if (/\b(stress|stressed|pressure|tension|workload|deadline|office pressure|study pressure)\b/.test(lower)) {
    dominant = "stressed";
    sentimentLabel = "negative";
    sentimentScore = -0.6;
  } else if (/\b(anxious|anxiety|panic|terrified|nervous|worry|worried|pedi|anxiety aanu|pedikkunnu)\b/.test(lower)) {
    dominant = "anxiety";
    sentimentLabel = "negative";
    sentimentScore = -0.6;
  } else if (/\b(depressed|depression|hopeless|empty|despair|dead inside|nothing matters|worthless)\b/.test(lower)) {
    dominant = "depressed";
    sentimentLabel = "negative";
    sentimentScore = -0.8;
  } else if (/\b(fearful|afraid|scared|fear|pediyaanu)\b/.test(lower)) {
    dominant = "fearful";
    sentimentLabel = "negative";
    sentimentScore = -0.65;
  } else if (/\b(confused|clueless|uncertain|doubt|don't know what to do|confused aanu|aake confused)\b/.test(lower)) {
    dominant = "confused";
    sentimentLabel = "neutral";
    sentimentScore = -0.2;
  } else if (/\b(hopeful|optimistic|looking forward|better days|feeling better|getting better|hope)\b/.test(lower)) {
    dominant = "hopeful";
    sentimentLabel = "positive";
    sentimentScore = 0.7;
  } else if (/\b(sad|crying|heartbroken|grief|vishamam|sukham illa|sukhamilla|sankatam|vayya|vayyaa|not feeling well|not well|unwell)\b/.test(lower)) {
    dominant = "sadness";
    sentimentLabel = "negative";
    sentimentScore = -0.7;
  } else if (/\b(angry|furious|mad|hate|annoyed|rage|deshyam|katta deshyam)\b/.test(lower)) {
    dominant = "anger";
    sentimentLabel = "negative";
    sentimentScore = -0.65;
  } else if (/\b(happy|great|excited|wonderful|grateful|glad|joy|awesome|nallath|santhosham|sugham)\b/.test(lower)) {
    dominant = "joy";
    sentimentLabel = "positive";
    sentimentScore = 0.8;
  }

  return {
    dominant,
    confidence: 0.85,
    scores: { [dominant]: 0.85 },
    sentimentLabel,
    sentimentScore,
  };
}

// Module 3: Emotion Detection
export async function detectEmotion(text: string): Promise<EmotionInfo> {
  const local = localEmotion(text);
  if (local.dominant !== "neutral") return local;

  const nlpRes = await quickNlp(NlpService.detectEmotion(text));
  if (nlpRes?.dominant_emotion) {
    return {
      dominant: nlpRes.dominant_emotion,
      confidence: nlpRes.confidence_score || 0.85,
      scores: nlpRes.emotion_scores || {},
      sentimentLabel: nlpRes.sentiment?.label || "neutral",
      sentimentScore: nlpRes.sentiment?.compound || 0,
    };
  }

  return local;
}

// Module 4: Crisis Detection
export async function detectCrisis(text: string): Promise<CrisisInfo> {
  const matchedKeywords = findCrisisTriggers(text);
  if (matchedKeywords.length > 0) {
    return {
      isCrisis: true,
      riskScore: 0.95,
      severity: "critical",
      triggers: matchedKeywords,
      recommendedAction: "Immediate crisis intervention. Provide local emergency guidance and ask whether the user is safe right now.",
      source: "current_message",
    };
  }

  const highDistress = findDistressTriggers(text, "high");
  if (highDistress.length > 0) {
    return {
      isCrisis: true,
      riskScore: 0.75,
      severity: "high",
      triggers: highDistress,
      recommendedAction: "High distress detected. Keep the conversation in safety-aware support and offer therapist escalation.",
      source: "current_message",
    };
  }

  const moderateDistress = findDistressTriggers(text, "moderate");
  if (moderateDistress.length > 0) {
    return {
      isCrisis: false,
      riskScore: 0.45,
      severity: "moderate",
      triggers: moderateDistress,
      recommendedAction: "Moderate distress detected. Validate emotions, monitor closely, and continue supportive guidance.",
      source: "current_message",
    };
  }

  const nlpRes = await quickNlp(NlpService.detectCrisis(text));
  const isCrisis = nlpRes?.severity === "high" || nlpRes?.severity === "critical";
  if (isCrisis) {
    return {
      isCrisis: true,
      riskScore: nlpRes?.risk_score || 0.8,
      severity: nlpRes?.severity === "critical" ? "critical" : "high",
      triggers: nlpRes?.risk_markers || [],
      recommendedAction: nlpRes?.recommended_action || "Immediate crisis intervention. Ask whether the user is safe right now.",
      source: "current_message",
      };
  }

  if (nlpRes?.severity === "elevated") {
    return {
      isCrisis: false,
      riskScore: nlpRes.risk_score || 0.45,
      severity: "moderate",
      triggers: nlpRes.risk_markers || [],
      recommendedAction: nlpRes.recommended_action || "Moderate distress detected. Continue supportive monitoring.",
      source: "current_message",
    };
  }

  return noCrisis();
}
