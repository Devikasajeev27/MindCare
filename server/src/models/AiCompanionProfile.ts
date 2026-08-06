import { Schema, model } from "mongoose";

const AiCompanionProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    consentToAnalysis: { type: Boolean, default: false },
    enableMemory: { type: Boolean, default: true },
    temporaryChat: { type: Boolean, default: false },
    
    // Internal AI Trust engine score (0-100)
    trustScore: { type: Number, default: 50 },

    // Configurable AI settings
    aiPreferences: {
      aiName: { type: String, default: "MindCare Companion" },
      aiAvatar: { type: String, default: "" },
      voice: { type: String, default: "default" },
      voiceSpeed: { type: Number, default: 1.0 }
    },

    // Conversation preferences (personalization controls)
    personalization: {
      replyLength: { type: String, enum: ["short", "detailed", "auto"], default: "auto" },
      humorPreference: { type: String, enum: ["likes_jokes", "prefers_serious", "auto"], default: "auto" },
      supportStyle: { type: String, enum: ["emotional_support", "direct_advice", "balanced"], default: "balanced" }
    },

    // Learned communication style profile
    talkingStyle: {
      writingStyle: { type: String, default: "" },
      tone: { type: String, default: "" },
      emojiUsage: { type: String, default: "" },
      sentenceLength: { type: String, default: "" },
      greetingStyle: { type: String, default: "" },
      favoriteWords: [{ type: String }],
      humorLevel: { type: String, default: "" },
      emotionalExpression: { type: String, default: "" }
    },

    // Advanced Memory Engine schema
    memories: [
      {
        id: { type: String, required: true },
        type: { type: String, enum: ["semantic", "preference", "episodic"], default: "semantic" },
        category: { type: String, default: "other" }, // e.g. "favorite_food", "movie", "goal", "important_person", "career", "education", "event", "therapy_preference", "other"
        content: { type: String, required: true },
        importance: { type: String, enum: ["high", "medium", "low"], default: "medium" },
        confidence: { type: Number, default: 50 }, // 1-100 confidence
        createdTime: { type: Date, default: Date.now },
        updatedTime: { type: Date, default: Date.now },
        lastUsed: { type: Date },
        expiration: { type: Date },
        editable: { type: Boolean, default: true },
        source: { type: String, enum: ["user_created", "ai_learned"], default: "ai_learned" },
        disabled: { type: Boolean, default: false }
      }
    ],

    // Learned behavioral analysis metrics
    behaviorAnalysis: {
      communicationPattern: { type: String, default: "" },
      dailyRoutine: { type: String, default: "" },
      stressTriggers: [{ type: String }],
      favoriteTopics: [{ type: String }],
      sleepDiscussions: { type: String, default: "" },
      relationshipIssues: { type: String, default: "" },
      workPressure: { type: String, default: "" },
      studyPressure: { type: String, default: "" },
      familyIssues: { type: String, default: "" },
      socialIsolation: { type: String, default: "" },
      confidenceChanges: { type: String, default: "" },
      motivationLevel: { type: String, default: "" },
      energyLevel: { type: String, default: "" },
      emotionChanges: { type: String, default: "" },
      moodChanges: { type: String, default: "" },
      conversationFrequency: { type: String, default: "" },
      responseDelays: { type: String, default: "" },
      behaviorChanges: { type: String, default: "" },
      moodIndicators: { type: String, default: "" },
      stressLevel: { type: String, default: "" },
      depressionIndicators: { type: String, default: "" },
      anxietyLevel: { type: String, default: "" },
      relationshipBehaviour: { type: String, default: "" },
      sleepPatterns: { type: String, default: "" },
      loneliness: { type: String, default: "" },
      selfHarmRisk: { type: String, default: "" },
      conversationPatterns: { type: String, default: "" }
    },

    // Wellness observation & distress engine output
    activeSessionId: { type: String, default: "" },
    insights: {
      weeklyInsights: { type: String, default: "" },
      monthlyInsights: { type: String, default: "" },
      behaviorTimeline: [{ type: String }],
      emotionalTrend: [{ type: String }],
      stressTrend: [{ type: String }],
      wellnessScore: { type: Number, default: 70 },
      distressScore: { type: Number, default: 10 }, // Dynamic Distress Score (0-100)
      distressCount: { type: Number, default: 0 }, // Track number of distress signals detected (threshold = 5)
      distressTrend: { type: String, enum: ["stable", "rising", "improving"], default: "stable" },
      rollingSummary: { type: String, default: "" },
      // Optional Python NLP (spaCy + NLTK) conversation analytics from chat imports
      nlpImportAnalysis: { type: Schema.Types.Mixed, default: undefined }
    },

    // Historical Relationship Timeline
    relationshipTimeline: [
      {
        month: { type: String, required: true }, // e.g. "January", "March 2026"
        event: { type: String, required: true }, // e.g. "Started MCA Project"
        details: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ],

    // Meta conversation statistics
    conversationStats: {
      totalMessages: { type: Number, default: 0 },
      lastChatDate: { type: Date }
    },

    lastProcessedMessageId: { type: Schema.Types.ObjectId, ref: "Chat" }
  },
  { timestamps: true }
);

export const AiCompanionProfile = model("AiCompanionProfile", AiCompanionProfileSchema);
