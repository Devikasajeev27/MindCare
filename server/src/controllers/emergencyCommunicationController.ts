import { Response } from "express";
import { AuthRequest } from "../middleware/auth.ts";
import { EmergencyMessage } from "../models/EmergencyMessage.ts";
import { EmergencySession } from "../models/EmergencySession.ts";
import { Notification } from "../models/Notification.ts";
import { monitorConversationMessage } from "../services/conversationSafetyMonitor.ts";

async function participantSession(req: AuthRequest) {
  const session = await EmergencySession.findById(req.params.sessionId);
  if (!session) return null;
  const actor = String(req.user._id);
  return String(session.userId) === actor || String(session.therapistId) === actor ? session : null;
}

export async function getEmergencyMessages(req: AuthRequest, res: Response) {
  const session = await participantSession(req);
  if (!session) return res.status(404).json({ message: "Emergency session not found or unauthorized" });
  const messages = await EmergencyMessage.find({ emergencySessionId: session._id }).sort({ createdAt: 1 });
  return res.json({ session, messages });
}

export async function sendEmergencyMessage(req: AuthRequest, res: Response) {
  const session = await participantSession(req);
  if (!session) return res.status(404).json({ message: "Emergency session not found or unauthorized" });
  const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
  if (!text) return res.status(400).json({ message: "Message text is required" });

  const isPatientMessage = String(session.userId) === String(req.user._id);
  const recentMessages = isPatientMessage
    ? (await EmergencyMessage.find({ emergencySessionId: session._id }).sort({ createdAt: -1 }).limit(10)).reverse()
      .map((message: any) => ({ sender: String(message.senderId) === String(session.userId) ? "user" : "therapist", text: message.text }))
    : [];
  const safety = isPatientMessage
    ? await monitorConversationMessage({ userId: String(session.userId), sessionId: String(session._id), text, channel: "therapist", recentMessages })
    : { riskLevel: "none", distressFlagged: false, distressScore: 0, distressWindow: undefined };
  const recipientId = isPatientMessage ? session.therapistId : session.userId;
  const message = await EmergencyMessage.create({
    emergencySessionId: session._id, senderId: req.user._id, recipientId, text,
    riskLevel: safety.riskLevel, distressFlagged: safety.distressFlagged, distressScore: safety.distressScore,
  });
  await Notification.create({ userId: recipientId, title: "Emergency session message", message: "You have a new message in an active emergency support session.", type: "alert" });
  return res.status(201).json({ message, safety });
}
