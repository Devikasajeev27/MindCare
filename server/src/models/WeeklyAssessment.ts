import { Schema, model } from "mongoose";

const WeeklyAssessmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sessionsCompleted: { type: Number, default: 0 },
    avgRating: { type: Number, default: 5 },
    responseRate: { type: Number, default: 100 },
    reportsReceived: { type: Number, default: 0 },
    earningTierAdjusted: { type: String, enum: ["retained", "increased", "decreased"], default: "retained" },
    assessmentDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const WeeklyAssessment = model("WeeklyAssessment", WeeklyAssessmentSchema);
