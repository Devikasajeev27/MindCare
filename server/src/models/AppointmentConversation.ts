import { Schema, model } from "mongoose";

const AppointmentConversationSchema = new Schema({
  appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  therapistId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  blockedByTherapist: { type: Boolean, default: false },
  blockedAt: { type: Date },
  lastMessageAt: { type: Date },
  lastMessagePreview: { type: String, default: "" },
}, { timestamps: true });

AppointmentConversationSchema.index({ userId: 1, therapistId: 1, lastMessageAt: -1 });
export const AppointmentConversation = model("AppointmentConversation", AppointmentConversationSchema);
