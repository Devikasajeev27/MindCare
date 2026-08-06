import { Schema, model } from "mongoose";

const CompanionMilestoneSchema = new Schema(
  {
    name: { type: String, required: true },
    minHours: { type: Number, required: true },
    maxHours: { type: Number, required: true },
    ratePerMinute: { type: Number, required: true },
  },
  { timestamps: true }
);

export const CompanionMilestone = model("CompanionMilestone", CompanionMilestoneSchema);
