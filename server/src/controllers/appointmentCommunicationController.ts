import { Response } from "express";
import { isValidObjectId } from "mongoose";
import { AuthRequest } from "../middleware/auth.ts";
import { Appointment } from "../models/Appointment.ts";
import { AppointmentConversation } from "../models/AppointmentConversation.ts";
import { AppointmentMessage } from "../models/AppointmentMessage.ts";
import { Notification } from "../models/Notification.ts";
import { Therapist } from "../models/Therapist.ts";
import { getIO } from "../services/socketService.ts";
import { monitorConversationMessage } from "../services/conversationSafetyMonitor.ts";

// Messaging remains opt-in at the appointment level. Completed paid sessions
// stay available for clinically appropriate follow-up, while cancelled and
// unpaid appointments never become message channels.
const MESSAGEABLE_STATUSES = ["APPROVED", "IN_PROGRESS", "COMPLETED"];

async function participantAppointment(req: AuthRequest) {
  const appointment = await Appointment.findById(req.params.appointmentId);
  if (!appointment) return null;
  const actor = req.user._id.toString();
  if (appointment.userId.toString() === actor || appointment.therapistId.toString() === actor) return appointment;

  // Older appointments stored Therapist profile ids. Authorize only when that
  // exact profile belongs to the authenticated therapist, never by a broad
  // therapist lookup.
  if (req.user.role === "therapist") {
    const ownsLegacyProfile = await Therapist.exists({ _id: appointment.therapistId, userId: req.user._id });
    if (ownsLegacyProfile) return appointment;
  }
  return null;
}

async function conversationFor(appointment: any) {
  const legacyProfile = await Therapist.findById(appointment.therapistId).select("userId").lean();
  const therapistUserId = legacyProfile?.userId || appointment.therapistId;
  const conversation = await AppointmentConversation.findOneAndUpdate(
    { appointmentId: appointment._id },
    { $setOnInsert: { appointmentId: appointment._id, userId: appointment.userId, therapistId: therapistUserId } },
    { upsert: true, new: true }
  );
  // Repair a legacy conversation reference once it is safely accessed by one
  // of its authenticated participants.
  if (conversation.therapistId.toString() !== therapistUserId.toString()) {
    conversation.therapistId = therapistUserId;
    await conversation.save();
  }
  return conversation;
}

function canMessage(appointment: any, conversation: any) {
  return MESSAGEABLE_STATUSES.includes(appointment.status) && appointment.paymentStatus === "SUCCESS" && appointment.messagingEnabled === true && !conversation.blockedByTherapist;
}

/**
 * Finds the current patient's latest appointment with this therapist that is
 * eligible for messaging. Therapist cards use profile ids, while appointments
 * created by older versions may contain either the profile id or user id.
 */
export async function getMessageableAppointmentForTherapist(req: AuthRequest, res: Response) {
  const { therapistId } = req.params;
  if (!isValidObjectId(therapistId)) {
    return res.status(404).json({ message: "Therapist not found" });
  }
  const therapist = await Therapist.findOne({
    $or: [{ _id: therapistId }, { userId: therapistId }],
  }).select("_id userId");

  if (!therapist?.userId) {
    return res.status(404).json({ message: "Therapist not found" });
  }

  const appointment = await Appointment.findOne({
    userId: req.user._id,
    therapistId: { $in: [therapist._id, therapist.userId] },
    status: { $in: MESSAGEABLE_STATUSES },
    paymentStatus: "SUCCESS",
    messagingEnabled: true,
  }).sort({ date: -1, createdAt: -1 });

  if (!appointment) {
    return res.status(404).json({
      message: "Messaging becomes available after the therapist approves your appointment and payment is successful.",
    });
  }

  return res.json({ appointment });
}

export async function getAppointmentConversation(req: AuthRequest, res: Response) {
  const appointment = await participantAppointment(req);
  if (!appointment) return res.status(404).json({ message: "Appointment not found or unauthorized" });
  const conversation = await conversationFor(appointment);
  const messages = await AppointmentMessage.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
  return res.json({ conversation, messages, messagingAllowed: canMessage(appointment, conversation) });
}

export async function sendAppointmentMessage(req: AuthRequest, res: Response) {
  const appointment = await participantAppointment(req);
  if (!appointment) return res.status(404).json({ message: "Appointment not found or unauthorized" });
  const conversation = await conversationFor(appointment);
  if (!canMessage(appointment, conversation)) return res.status(403).json({ message: "Messaging is available only for paid, message-enabled consultations." });
  const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
  if (!text) return res.status(400).json({ message: "Message text is required" });
  const senderId = req.user._id;
  const recipientId = appointment.userId.toString() === senderId.toString() ? conversation.therapistId : appointment.userId;
  const isPatientMessage = appointment.userId.toString() === senderId.toString();
  const recentMessages = isPatientMessage
    ? (await AppointmentMessage.find({ conversationId: conversation._id }).sort({ createdAt: -1 }).limit(10)).reverse().map((item: any) => ({ sender: String(item.senderId) === String(appointment.userId) ? "user" : "therapist", text: item.text }))
    : [];
  const safety = isPatientMessage
    ? await monitorConversationMessage({ userId: String(appointment.userId), sessionId: String(conversation._id), text, channel: "therapist", recentMessages })
    : { riskLevel: "none", distressFlagged: false, distressScore: 0, distressWindow: undefined };
  const message = await AppointmentMessage.create({
    conversationId: conversation._id, appointmentId: appointment._id, senderId, recipientId, text,
    riskLevel: safety.riskLevel, distressFlagged: safety.distressFlagged, distressScore: safety.distressScore,
  });
  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessagePreview = text.slice(0, 160);
  await conversation.save();
  const notification = await Notification.create({ userId: recipientId, title: "New appointment message", message: "You have a new message in an approved appointment.", type: "message" });
  try {
    const io = getIO();
    io.to(`appointment_${conversation._id}`).emit("message:receive", message);
    io.to(recipientId.toString()).emit("conversation:update", { conversationId: conversation._id, appointmentId: appointment._id, message });
    io.to(recipientId.toString()).emit("new_notification", notification);
  } catch { /* server may be initializing; persistence remains authoritative */ }
  return res.status(201).json({ message, safety: { ...safety, distressWindow: safety.distressWindow } });
}

export async function markAppointmentMessagesRead(req: AuthRequest, res: Response) {
  const appointment = await participantAppointment(req);
  if (!appointment) return res.status(404).json({ message: "Appointment not found or unauthorized" });
  const conversation = await conversationFor(appointment);
  const result = await AppointmentMessage.updateMany({ conversationId: conversation._id, recipientId: req.user._id, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  try { getIO().to(`appointment_${conversation._id}`).emit("message:read", { conversationId: conversation._id, readerId: req.user._id }); } catch {}
  return res.json({ updated: result.modifiedCount });
}

export async function setAppointmentUserBlock(req: AuthRequest, res: Response) {
  const appointment = await participantAppointment(req);
  if (!appointment || req.user.role !== "therapist") return res.status(404).json({ message: "Appointment not found or unauthorized" });
  const conversation = await conversationFor(appointment);
  const blocked = Boolean(req.body.blocked);
  conversation.blockedByTherapist = blocked;
  conversation.blockedAt = blocked ? new Date() : undefined;
  await conversation.save();
  await Notification.create({ userId: appointment.userId, title: blocked ? "Messaging access paused" : "Messaging access restored", message: blocked ? "Your therapist has paused appointment messaging and calls." : "Your therapist restored appointment messaging and calls.", type: "appointment" });
  try { getIO().to(`appointment_${conversation._id}`).emit(blocked ? "user:block" : "user:unblock", { appointmentId: appointment._id, conversationId: conversation._id }); } catch {}
  return res.json({ conversation });
}

export async function authorizeAppointmentCall(req: AuthRequest, res: Response) {
  const appointment = await participantAppointment(req);
  if (!appointment) return res.status(404).json({ message: "Appointment not found or unauthorized" });
  const conversation = await conversationFor(appointment);
  if (!canMessage(appointment, conversation)) return res.status(403).json({ message: "Calls are not permitted for this appointment." });
  const [start, end] = appointment.timeSlot.split("-").map((value: string) => value.trim());
  const date = new Date(appointment.date).toISOString().slice(0, 10);
  const startAt = new Date(`${date} ${start}`);
  const endAt = new Date(`${date} ${end}`);
  const now = new Date();
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || now < startAt || now > endAt) return res.status(403).json({ message: "Call will be available at your scheduled appointment time." });
  return res.json({ allowed: true, appointmentId: appointment._id, callWindow: { startAt, endAt } });
}
