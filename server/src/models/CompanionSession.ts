import { Schema, model } from "mongoose";

const CompanionSessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    companionId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    duration: { type: Number, default: 0 },
    status: { type: String, enum: ["searching", "active", "completed"], default: "active" },
    isFreeTierActive: { type: Boolean, default: true },
    paymentCompleted: { type: Boolean, default: false },
    userAlias: { type: String, required: true },
    companionAlias: { type: String, required: true },
  },
  { timestamps: true }
);

export const CompanionSession = model("CompanionSession", CompanionSessionSchema);
