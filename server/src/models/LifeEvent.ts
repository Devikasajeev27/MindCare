import { Schema, model } from "mongoose";

const LifeEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    date: { type: Date, required: true },
    importance: { type: String, enum: ["high", "medium", "low"], default: "medium" },
    confidence: { type: Number, default: 50 }, // 1-100
    source: { type: String, default: "ai_learned" } // E.g., "user_created" or "ai_learned"
  },
  { timestamps: true }
);

LifeEventSchema.index({ userId: 1 });
LifeEventSchema.index({ date: -1 });

export const LifeEvent = model("LifeEvent", LifeEventSchema);
