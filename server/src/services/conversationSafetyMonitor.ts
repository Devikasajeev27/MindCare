import { DistressEngine } from "./distressEngine.ts";
import { SafetyGateway } from "./safetyGateway.ts";

const levelToScore: Record<string, number> = { none: 0, low: 1, medium: 2, high: 3, imminent: 4 };

/** Shared server-side monitor for peer and therapist conversations. */
export async function monitorConversationMessage(input: {
  userId: string; sessionId: string; messageId?: string; text: string;
  channel: "peer" | "therapist"; recentMessages?: Array<{ sender: string; text: string }>;
}) {
  const safety = await SafetyGateway.assess({ message: input.text, recentMessages: input.recentMessages || [] });
  const distressLevel = levelToScore[safety.risk.risk_level] || 0;
  const distressWindow = await DistressEngine.recordEvent({
    userId: input.userId, sessionId: input.sessionId, messageId: input.messageId,
    distressLevel, severityScore: distressLevel * 25, emotions: {}, riskFlags: safety.risk.signals, channel: input.channel,
  });
  return { riskLevel: safety.risk.risk_level, distressFlagged: distressLevel >= 2, distressScore: distressLevel * 25, distressWindow };
}
