import { Schema, model } from "mongoose";

// ─── Individual Risk Signal ─────────────────────────────────────────────────
const RiskSignalSchema = new Schema({
  type: {
    type: String,
    enum: [
      "direct_suicidal_statement",
      "self_harm_reference",
      "hopelessness",
      "social_isolation",
      "severe_mood_crash",
      "journal_distress",
      "peer_chat_crisis",
      "voice_distress",
      "behavioral_pattern",
      "repeated_crisis_signal",
      "academic_pressure_severe",
      "work_pressure_severe",
      "relationship_crisis",
      "sleep_crisis",
      "family_crisis",
      "panic_expression",
      "worthlessness",
    ],
    required: true,
  },
  score: { type: Number, required: true, min: 0, max: 100 },
  detail: { type: String },
  source: {
    type: String,
    enum: ["ai_chat", "peer_chat", "journal", "mood", "voice_message", "voice_call", "imported_chat", "manual"],
  },
  detectedAt: { type: Date, default: Date.now },
}, { _id: false });

// ─── Main Risk Assessment Schema ────────────────────────────────────────────
const RiskAssessmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    // Rolling confidence score (0-100)
    confidenceScore: { type: Number, default: 0, min: 0, max: 100 },

    // Derived level from score
    riskLevel: {
      type: String,
      enum: ["none", "low", "elevated", "high", "critical"],
      default: "none",
    },

    // Active signals contributing to the current score
    activeSignals: { type: [RiskSignalSchema], default: [] },

    // Which data sources have been analyzed
    sources: {
      type: [String],
      enum: ["ai_chat", "peer_chat", "journal", "mood", "voice_message", "voice_call", "imported_chat"],
      default: [],
    },

    // 24-hour rolling window start
    windowStart: { type: Date, default: Date.now },

    // Deduplication: when last emergency workflow was fired
    lastEmergencyAt: { type: Date, default: null },

    // Cooldown: suppress new workflows until this time
    suppressUntil: { type: Date, default: null },

    // Last user-reported location
    lastKnownLocation: {
      lat: { type: Number },
      lng: { type: Number },
      accuracy: { type: Number },
      capturedAt: { type: Date },
    },

    // Signal count in current window (for repeat detection)
    signalCountInWindow: { type: Number, default: 0 },

    // Historical stats
    totalEmergenciesTriggered: { type: Number, default: 0 },
    lastAnalyzedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index for fast lookup
RiskAssessmentSchema.index({ userId: 1 });
RiskAssessmentSchema.index({ riskLevel: 1, lastEmergencyAt: 1 });

export const RiskAssessment = model("RiskAssessment", RiskAssessmentSchema);
