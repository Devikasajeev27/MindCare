import { AiCompanionProfile } from "../../models/AiCompanionProfile.ts";
import { User } from "../../models/User.ts";
import { CognitiveContextPackage, CognitivePipelineResult } from "./types.ts";

function normalized(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function memoryCandidates(userMessage: string, context?: CognitiveContextPackage): Array<{
  category: string;
  content: string;
  importance: "high" | "medium";
}> {
  const lower = normalized(userMessage);
  const candidates: Array<{ category: string; content: string; importance: "high" | "medium" }> = [];

  if (context?.crisis.source === "current_message") {
    candidates.push({
      category: "wellbeing",
      content: `User shared a high-priority safety concern: ${userMessage.trim().slice(0, 280)}`,
      importance: "high",
    });
  } else if (/\b(vayya|vayyaa|sukham illa|sukhamilla|not feeling well|not well|unwell|sad|hopeless|vishamam)\b/.test(lower)) {
    candidates.push({
      category: "wellbeing",
      content: `User reported significant emotional or physical distress: ${userMessage.trim().slice(0, 280)}`,
      importance: "high",
    });
  }

  if (/\b(office|work|boss|deadline|job|pressure)\b/.test(lower)) {
    candidates.push({ category: "stress_trigger", content: "User is experiencing office or work pressure.", importance: "medium" });
  }
  if (/\b(relationship|partner|breakup|bandham)\b/.test(lower)) {
    candidates.push({ category: "relationship", content: "User is experiencing relationship difficulties.", importance: "medium" });
  }
  if (/\b(sleep|insomnia|urakkam)\b/.test(lower)) {
    candidates.push({ category: "wellbeing", content: "User has discussed difficulty with sleep.", importance: "medium" });
  }

  return candidates;
}

function rollingSummary(context: CognitiveContextPackage): string {
  const recentUserMessages = context.recentMessages
    .filter((message) => message.sender === "user")
    .slice(-5)
    .map((message) => `“${message.text.trim().replace(/\s+/g, " ").slice(0, 140)}”`);
  const risk = context.crisis.isCrisis ? ` Current safety status: ${context.crisis.severity} risk (${context.crisis.source}).` : "";
  return `Recent user conversation: ${recentUserMessages.join("; ") || "No recent user messages."}.${risk}`.slice(0, 1400);
}

// Module 18: Memory Extraction
export async function extractAndStoreMemories(
  userId: string,
  userMessage: string,
  context?: CognitiveContextPackage
): Promise<number> {
  const profile = await AiCompanionProfile.findOne({ userId });
  if (!profile || !profile.enableMemory || profile.temporaryChat) return 0;

  const candidates = memoryCandidates(userMessage, context);
  let addedCount = 0;
  const existingMemories = profile.memories || [];

  for (const candidate of candidates) {
    const duplicate = existingMemories.some((memory: any) => normalized(memory.content) === normalized(candidate.content));
    if (duplicate) continue;

    profile.memories.push({
      id: Math.random().toString(36).substring(2, 15),
      type: "episodic",
      category: candidate.category,
      content: candidate.content,
      importance: candidate.importance,
      confidence: 90,
      createdTime: new Date(),
      updatedTime: new Date(),
      source: "ai_learned",
      disabled: false,
    } as any);
    addedCount += 1;
  }

  if (context) {
    const insights = profile.insights || (profile.insights = {} as any);
    insights.rollingSummary = rollingSummary(context);
    const conversationStats = profile.conversationStats || (profile.conversationStats = {} as any);
    conversationStats.totalMessages = (conversationStats.totalMessages || 0) + 1;
    conversationStats.lastChatDate = new Date();

    const behaviorAnalysis = profile.behaviorAnalysis || (profile.behaviorAnalysis = {} as any);
    if (context.emotion.sentimentLabel === "negative") {
      behaviorAnalysis.moodChanges = `Recent ${context.emotion.dominant} detected on ${new Date().toISOString().slice(0, 10)}.`;
    }
    if (context.crisis.isCrisis) {
      behaviorAnalysis.selfHarmRisk = context.crisis.severity === "critical" ? "Critical" : "High";
    }
  }

  if (addedCount > 0 || context) await profile.save();
  return addedCount;
}

// Module 19: Analytics Engine
export async function recordCognitiveAnalytics(
  userId: string,
  result: CognitivePipelineResult
): Promise<void> {
  try {
    const user = await User.findById(userId);
    if (user) {
      user.lastActivityDate = new Date();
      await user.save();
    }
  } catch (err) {
    console.error("Cognitive analytics recording error:", err);
  }
}
