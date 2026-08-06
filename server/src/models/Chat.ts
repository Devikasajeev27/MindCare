import { Schema, model } from "mongoose";

const ChatSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    conversationId: { type: String },
    sender: { type: String, enum: ["user", "ai", "companion"], required: true },
    recipient: { type: String, default: "ai" }, // "ai", or companion ID
    text: { type: String, required: true },
    riskLevel: { type: String, enum: ["none", "moderate", "high", "critical"], default: "none" },
    distressFlagged: { type: Boolean, default: false },
    distressScore: { type: Number, default: 0 },
    emotion: { type: String, default: "neutral" },
    strategy: { type: String, default: "active_listening" },
    intent: { type: String, default: "general_query" },
    time: { type: Date, default: Date.now },
    sessionId: { type: Schema.Types.Mixed },
    detectedLanguage: { type: String },
    isVoice: { type: Boolean, default: false },
    voiceDuration: { type: String },
    audioUrl: { type: String },
  },
  { timestamps: true }
);

ChatSchema.index({ userId: 1 });
ChatSchema.index({ sessionId: 1 });
ChatSchema.index({ userId: 1, conversationId: 1, time: 1 });
ChatSchema.index({ userId: 1, sessionId: 1, time: 1 });

export const Chat = model("Chat", ChatSchema);
