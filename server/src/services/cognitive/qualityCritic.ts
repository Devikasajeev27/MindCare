import { ensureCrisisSafety, hasRequiredSafetyGuidance } from "./fallbackResponder.ts";
import { CognitiveContextPackage, QualityEvaluation, ResponseStrategy } from "./types.ts";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function similarity(a: string, b: string): number {
  const aWords = new Set(normalize(a).split(" ").filter((word) => word.length > 2));
  const bWords = new Set(normalize(b).split(" ").filter((word) => word.length > 2));
  if (!aWords.size || !bWords.size) return 0;
  const intersection = [...aWords].filter((word) => bWords.has(word)).length;
  return intersection / Math.max(aWords.size, bWords.size);
}

function responseReferencesPriorUserMessage(response: string, context: CognitiveContextPackage): boolean {
  const current = normalize(context.userMessage);
  const priorUserMessages = context.recentMessages
    .filter((message) => message.sender === "user" && normalize(message.text) !== current)
    .map((message) => normalize(message.text));
  const normalizedResponse = normalize(response);

  return priorUserMessages.some((message) => {
    if (message.length >= 8 && normalizedResponse.includes(message)) return true;
    const meaningfulWords = message.split(" ").filter((word) => word.length >= 4);
    return meaningfulWords.filter((word) => normalizedResponse.includes(word)).length >= Math.min(2, meaningfulWords.length);
  });
}

function hasRelevantShape(response: string, context: CognitiveContextPackage, strategy: ResponseStrategy): boolean {
  const lower = normalize(response);
  if (strategy.strategy === "greeting") return /[?]/.test(response) || lower.includes("hello") || lower.includes("hi");
  if (strategy.strategy === "memory_reflection") return responseReferencesPriorUserMessage(response, context);
  if (context.crisis.isCrisis || strategy.strategy === "crisis_support") return hasRequiredSafetyGuidance(response, context);

  const meaningfulInputWords = normalize(context.userMessage)
    .split(" ")
    .filter((word) => word.length >= 4 && !["this", "that", "with", "feel", "feeling", "very"].includes(word));
  return response.includes("?") || meaningfulInputWords.some((word) => lower.includes(word));
}

function isLanguageMirrored(response: string, context: CognitiveContextPackage): boolean {
  if (context.language.language === "manglish") {
    const containsMalayalam = /[\u0D00-\u0D7F]/.test(response);
    const manglishMarker = /\b(nee|ninte|njan|enikk|undu|aano|paraya|ithu|ippol|namukku|illa|ennu)\b/i.test(response);
    return !containsMalayalam && manglishMarker;
  }
  if (context.language.language === "ml") return /[\u0D00-\u0D7F]/.test(response);
  if (context.language.language === "mixed_ml_en") {
    return !/[\u0D00-\u0D7F]/.test(response)
      && /\b(nee|ninte|njan|enikk|undu|aano|paraya|ithu|ippol|namukku|illa|ennu)\b/i.test(response);
  }
  return true;
}

// Module 16: Response Quality Critic
export function evaluateQuality(
  generatedResponse: string,
  context: CognitiveContextPackage,
  strategy: ResponseStrategy
): QualityEvaluation {
  const text = generatedResponse.trim();
  const lower = normalize(text);
  const isClear = text.length >= 10 && text.length <= 2500;
  const isRelevant = hasRelevantShape(text, context, strategy);
  const languageMirrored = isLanguageMirrored(text, context);

  const empathyMarkers = [
    "feel", "hear", "glad", "support", "care", "difficult", "hard", "weighing", "serious",
    "heavy", "budhimutt", "kashtam", "vedhana", "kelkkumbol", "valare", "important", "ottayalla",
  ];
  const isEmpathetic = empathyMarkers.some((marker) => lower.includes(marker))
    || ["greeting", "celebration", "memory_reflection"].includes(strategy.strategy);

  const priorAiMessages = context.recentMessages
    .filter((message) => message.sender === "ai")
    .map((message) => message.text);
  const isNonRepetitive = !priorAiMessages.some((prior) => {
    const normalizedPrior = normalize(prior);
    return normalizedPrior === lower || similarity(prior, text) >= 0.78;
  });

  const genericOpenings = [
    "thank you for sharing", "i understand", "im here to listen", "i am here to listen",
    "enikk manassilaayi", "enikk manassilayi", "njan kelkkunnund", "njan kelkkunnu",
  ];
  const startsGeneric = genericOpenings.some((opening) => lower.startsWith(opening));
  const usesGenericDefault = startsGeneric;

  const isNatural = !/\b(as an ai|as a large language model|language model)\b/i.test(text);
  const needsSafetyCheck = context.crisis.isCrisis || strategy.strategy === "crisis_support";
  const isCrisisResponsive = !needsSafetyCheck || hasRequiredSafetyGuidance(text, context);
  const isContextAware = isRelevant
    && isNonRepetitive
    && (strategy.strategy !== "memory_reflection" || responseReferencesPriorUserMessage(text, context))
    && isCrisisResponsive;

  let score = 20;
  if (isClear) score += 12;
  if (isRelevant) score += 18;
  if (isEmpathetic) score += 10;
  if (isNonRepetitive) score += 12;
  if (isNatural) score += 8;
  if (languageMirrored) score += 10;
  if (isContextAware) score += 10;
  if (isCrisisResponsive) score += 10;
  if (!usesGenericDefault) score += 10;

  const passed = isClear
    && isRelevant
    && isEmpathetic
    && isNonRepetitive
    && isNatural
    && languageMirrored
    && isContextAware
    && isCrisisResponsive
    && !usesGenericDefault
    && score >= 80;

  const failures = [
    !isRelevant && "does not address the current request",
    !isNonRepetitive && "repeats a recent AI response",
    !languageMirrored && "does not mirror the user's language style",
    !isCrisisResponsive && "does not satisfy the crisis protocol",
    usesGenericDefault && "uses a generic default opening",
    strategy.strategy === "memory_reflection" && !responseReferencesPriorUserMessage(text, context) && "does not cite actual conversation memory",
  ].filter(Boolean);

  return {
    isRelevant,
    isContextAware,
    isEmpathetic,
    isNonRepetitive,
    isClear,
    isNatural,
    isLanguageMirrored: languageMirrored,
    isCrisisResponsive,
    usesGenericDefault,
    overallScore: Math.min(100, score),
    passed,
    feedback: passed
      ? "Response passed language, memory, context, diversity, and safety checks."
      : `Response rejected: ${failures.join("; ") || "quality score below threshold"}.`,
  };
}

// Module 17: Safety Review
export function reviewSafety(
  response: string,
  context: CognitiveContextPackage
): { safe: boolean; sanitizedResponse: string; flag?: string } {
  let text = ensureCrisisSafety(response, context);

  if (/\b(diagnose|cured|prescribe|medication dose)\b/i.test(text)) {
    if (context.language.language === "ml") {
      text += "\n\n*(MindCare രോഗനിർണയമോ മരുന്ന് നിർദേശമോ നൽകുന്നില്ല.)*";
    } else if (context.language.language === "manglish" || context.language.language === "mixed_ml_en") {
      text += "\n\n*(MindCare diagnosis-um medicine dose-um nirdeshikkunnilla.)*";
    } else {
      text += "\n\n*(MindCare provides emotional support and wellness guidance, not medical diagnoses or prescriptions.)*";
    }
  }

  return { safe: true, sanitizedResponse: text };
}
