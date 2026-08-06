import { detectCrisis, detectEmotion, detectLanguage, detectIntent, resolveConversationCrisis } from "./detectors.ts";
import {
  getJournalIntelligence,
  getLongTermMemories,
  getMoodAnalytics,
  getProfileSummary,
  getShortTermSessionMessages,
  summarizeConversation,
  updateDistressScore,
} from "./memoryManager.ts";
import { searchKnowledgeBase } from "./semanticSearch.ts";
import { CognitiveContextPackage } from "./types.ts";
import { SafetyGateway } from "../safetyGateway.ts";

const safetyRank: Record<string, number> = { none: 0, moderate: 1, high: 2, critical: 3 };

function mergeSafetyRisk(current: any, assessment: any) {
  const mappedSeverity = assessment.risk_level === "imminent" ? "critical" : assessment.risk_level === "high" ? "high" : assessment.risk_level === "medium" || assessment.risk_level === "low" ? "moderate" : "none";
  if ((safetyRank[mappedSeverity] || 0) <= (safetyRank[current.severity] || 0)) return current;
  return {
    ...current,
    isCrisis: mappedSeverity === "high" || mappedSeverity === "critical",
    severity: mappedSeverity,
    riskScore: mappedSeverity === "critical" ? 1 : mappedSeverity === "high" ? 0.8 : 0.45,
    triggers: assessment.signals || [],
    recommendedAction: assessment.recommended_flow === "crisis" ? "Use the dedicated crisis-safe response." : "Ask a direct safety check-in.",
    source: "current_message",
  };
}

// Module 13: Context Builder
export async function buildCognitiveContext(
  userId: string,
  userMessage: string,
  sessionId?: string
): Promise<CognitiveContextPackage> {
  // 1. Run Detectors concurrently
  const [detectedLanguage, directCrisis] = await Promise.all([
    detectLanguage(userMessage),
    detectCrisis(userMessage),
  ]);

  const emotion = await detectEmotion(userMessage);
  // Detect the user's requested intent before adding an unresolved prior risk.
  // This lets a memory question be answered truthfully while still carrying a
  // safety follow-up in the response.
  const intent = detectIntent(userMessage, directCrisis);

  // 2. Fetch User Profile & Memories
  const [{ profile, summary: profileSummary }, longTermMemories, recentMessages] = await Promise.all([
    getProfileSummary(userId),
    getLongTermMemories(userId),
    getShortTermSessionMessages(userId, sessionId, 12),
  ]);

  const safety = await SafetyGateway.assess({
    message: userMessage,
    recentMessages: recentMessages.map(({ sender, text }) => ({ sender, text })),
    country: (profile as any).country || (profile as any).countryCode,
  });
  const language = safety.language.confidence >= 0.8 ? {
    language: safety.language.preferred_reply_language.toLowerCase() === "malayalam" ? "ml" : safety.language.preferred_reply_language.toLowerCase(),
    languageName: safety.language.preferred_reply_language,
    script: safety.language.scripts[0] || detectedLanguage.script,
    confidence: safety.language.confidence,
  } : detectedLanguage;
  const crisis = resolveConversationCrisis(mergeSafetyRisk(directCrisis, safety.risk), userMessage, recentMessages);
  const conversationSummary = summarizeConversation(recentMessages, profile.insights?.rollingSummary);

  // 3. Fetch Mood & Journal Intelligence & Compute Distress Score
  const [journalSummary, moodAnalytics, distressState] = await Promise.all([
    getJournalIntelligence(userId),
    getMoodAnalytics(userId),
    updateDistressScore(userId, { crisis, emotion, intent }),
  ]);

  // 4. Retrieve RAG Knowledge Base items
  const retrievedKnowledge = await searchKnowledgeBase(userMessage, undefined, 3);

  return {
    userMessage,
    language,
    intent,
    emotion,
    crisis,
    profileSummary,
    longTermMemories,
    recentMessages,
    conversationSummary,
    journalSummary,
    moodAnalytics,
    distressScore: distressState.distressScore,
    escalationTier: distressState.escalationTier,
    retrievedKnowledge,
  };
}
