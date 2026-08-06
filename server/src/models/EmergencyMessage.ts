import { Schema, model } from "mongoose";

const EmergencyMessageSchema = new Schema({
  emergencySessionId: { type: Schema.Types.ObjectId, ref: "EmergencySession", required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true, trim: true, maxlength: 4000 },
  riskLevel: { type: String, enum: ["none", "low", "medium", "high", "imminent"], default: "none" },
  distressFlagged: { type: Boolean, default: false },
  distressScore: { type: Number, default: 0 },
}, { timestamps: true });

EmergencyMessageSchema.index({ emergencySessionId: 1, createdAt: 1 });

export const EmergencyMessage = model("EmergencyMessage", EmergencyMessageSchema);
