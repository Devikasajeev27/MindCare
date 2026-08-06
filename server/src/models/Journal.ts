import { Schema, model } from "mongoose";

const JournalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, trim: true },
    content: { type: String, required: true },
    mood: { type: Number },
    date: { type: Date, default: Date.now },
    // Optional Python NLP (spaCy + NLTK) analytics — absent on legacy entries
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
        topics: { type: [String], default: undefined },
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

JournalSchema.index({ userId: 1, date: -1 });

export const Journal = model("Journal", JournalSchema);
