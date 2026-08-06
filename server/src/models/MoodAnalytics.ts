import { Schema, model } from "mongoose";

const MoodAnalyticsSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    overallMood: { type: String, required: true },
    moodScore: { type: Number, required: true, min: 0, max: 100 },
    sentimentScore: { type: Number, required: true, min: -1, max: 1 },
    emotion: { type: String, required: true },
    stressLevel: { type: Number, required: true, min: 0, max: 100 },
    anxietyLevel: { type: Number, required: true, min: 0, max: 100 },
    energyLevel: { type: Number, required: true, min: 0, max: 100 },
    sleepQuality: { type: Number, required: true, min: 0, max: 100 },
    journalContribution: { type: Number, default: 0 },
    aiChatContribution: { type: Number, default: 0 },
    voiceAnalysisContribution: { type: Number, default: 0 },
    confidenceScore: { type: Number, required: true, min: 0, max: 100 },
  },
  { timestamps: true }
);

// Compound index to guarantee uniqueness of daily records per user
MoodAnalyticsSchema.index({ userId: 1, date: 1 }, { unique: true });
MoodAnalyticsSchema.index({ userId: 1, date: -1 });

export const MoodAnalytics = model("MoodAnalytics", MoodAnalyticsSchema);
