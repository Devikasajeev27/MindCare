import { Schema, model } from "mongoose";

const AppointmentMessageSchema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: "AppointmentConversation", required: true, index: true },
  appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true, trim: true, maxlength: 4000 },
  deliveredAt: { type: Date, default: Date.now },
  readAt: { type: Date },
  riskLevel: { type: String, enum: ["none", "low", "medium", "high", "imminent"], default: "none" },
  distressFlagged: { type: Boolean, default: false },
  distressScore: { type: Number, default: 0 },
}, { timestamps: true });

AppointmentMessageSchema.index({ conversationId: 1, createdAt: 1 });
export const AppointmentMessage = model("AppointmentMessage", AppointmentMessageSchema);
