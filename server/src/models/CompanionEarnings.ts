import { Schema, model } from "mongoose";

const CompanionEarningsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    totalMinutes: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    weeklyActiveHours: { type: Number, default: 0 },
    lifetimeHours: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    performanceScore: { type: Number, default: 95 },
  },
  { timestamps: true }
);

export const CompanionEarnings = model("CompanionEarnings", CompanionEarningsSchema);
