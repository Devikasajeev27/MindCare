import { Schema, model, Document } from "mongoose";

export interface DistressEvent extends Document {
  userId: Schema.Types.ObjectId;
  sessionId: string;
  messageId?: string;
  timestamp: Date;
  distressLevel: number; // 0 = Normal, 1 = Low, 2 = Moderate, 3 = High, 4 = Critical
  severityScore: number; // 0-100
  emotions: Record<string, number>; // e.g., { stress: 78, anxiety: 45 }
  riskFlags: string[]; // e.g., ["suicidal_ideation", "self_harm"]
  channel: "ai" | "peer" | "therapist";
  contactAlertTriggered?: boolean;
}

const DistressEventSchema = new Schema<DistressEvent>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  sessionId: { type: String, required: true },
  messageId: { type: String },
  timestamp: { type: Date, default: Date.now },
  distressLevel: { type: Number, required: true, min: 0, max: 4 },
  severityScore: { type: Number, required: true, min: 0, max: 100 },
  emotions: { type: Map, of: Number },
  riskFlags: { type: [String], default: [] },
  channel: { type: String, enum: ["ai", "peer", "therapist"], default: "ai" },
  contactAlertTriggered: { type: Boolean, default: false },
});

DistressEventSchema.index({ userId: 1, sessionId: 1, channel: 1, timestamp: -1 });

export const DistressEventModel = model<DistressEvent>("DistressEvent", DistressEventSchema);
