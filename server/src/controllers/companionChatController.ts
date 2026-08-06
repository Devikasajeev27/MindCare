import { Response } from "express";
import { AuthRequest } from "../middleware/auth.ts";
import { Chat } from "../models/Chat.ts";
import { CompanionSession } from "../models/CompanionSession.ts";
import { monitorConversationMessage } from "../services/conversationSafetyMonitor.ts";
import { getIO } from "../services/socketService.ts";

async function participantSession(req: AuthRequest) {
  const session = await CompanionSession.findById(req.params.sessionId);
  if (!session || (String(session.userId) !== String(req.user._id) && String(session.companionId) !== String(req.user._id))) return null;
  return session;
}

export async function getCompanionMessages(req: AuthRequest, res: Response) {
  const session = await participantSession(req);
  if (!session) return res.status(404).json({ message: "Peer session not found or unauthorized." });
  const messages = await Chat.find({ sessionId: String(session._id), recipient: { $in: [String(session.userId), String(session.companionId)] } }).sort({ time: 1 });
  // Repair legacy peer messages created before the dedicated monitor existed.
  // Only the supported user's unassessed messages are re-evaluated once.
  for (const [index, message] of messages.entries()) {
    if (message.sender !== "user" || message.distressFlagged || message.riskLevel !== "none") continue;
    const recentMessages = messages.slice(Math.max(0, index - 10), index).map(item => ({ sender: item.sender === "user" ? "user" : "peer", text: item.text }));
    const safety = await monitorConversationMessage({ userId: String(session.userId), sessionId: String(session._id), messageId: String(message._id), text: message.text, channel: "peer", recentMessages });
    if (safety.distressFlagged) {
      message.riskLevel = safety.riskLevel === "imminent" ? "critical" : safety.riskLevel === "high" ? "high" : "moderate";
      message.distressFlagged = true;
      message.distressScore = safety.distressScore;
      await message.save();
    }
  }
  return res.json({ messages });
}

export async function sendCompanionMessage(req: AuthRequest, res: Response) {
  const session = await participantSession(req);
  if (!session || session.status !== "active") return res.status(403).json({ message: "This peer session is not active." });
  const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
  if (!text) return res.status(400).json({ message: "Message text is required." });
  const isSupportedUser = String(session.userId) === String(req.user._id);
  const recipientId = isSupportedUser ? session.companionId : session.userId;
  const recentMessages = isSupportedUser
    ? (await Chat.find({ sessionId: String(session._id) }).sort({ time: -1 }).limit(10)).reverse().map(item => ({ sender: item.sender === "user" ? "user" : "peer", text: item.text }))
    : [];
  const safety = isSupportedUser
    ? await monitorConversationMessage({ userId: String(session.userId), sessionId: String(session._id), text, channel: "peer", recentMessages })
    : { riskLevel: "none", distressFlagged: false, distressScore: 0, distressWindow: undefined };
  const message = await Chat.create({
    userId: session.userId, sessionId: String(session._id), sender: isSupportedUser ? "user" : "companion", recipient: String(recipientId), text,
    riskLevel: safety.riskLevel === "imminent" ? "critical" : safety.riskLevel === "high" ? "high" : safety.riskLevel === "medium" ? "moderate" : "none",
    distressFlagged: safety.distressFlagged, distressScore: safety.distressScore,
  });
  try { getIO().to(`session_${session._id}`).emit("receive_message", message); } catch {}
  return res.status(201).json({ message, safety });
}
