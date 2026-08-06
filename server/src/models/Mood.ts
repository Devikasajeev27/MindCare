import { Schema, model } from "mongoose";

const MoodSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    emotion: { type: String },
    note: { type: String },
    tags: [{ type: String }],
    date: { type: Date, default: Date.now },
    // Optional Python NLP (spaCy + NLTK) analytics on the note text
    nlpAnalysis: {
      type: {
        moodEstimate: { type: Number },
        sentiment: {
          compound: { type: Number },
          label: { type: String },
        },
        emotions: { type: Schema.Types.Mixed },
        dominantEmotion: { type: String },
        stress: { type: Number },
        riskLevel: { type: String },
        confidence: { type: Number },
        keywords: { type: [String], default: undefined },
        entities: { type: Schema.Types.Mixed },
        analyzedAt: { type: Date },
      },
      required: false,
      default: undefined,
    },
  },
  { timestamps: true }
);

MoodSchema.index({ userId: 1, date: -1 });

export const Mood = model("Mood", MoodSchema);
