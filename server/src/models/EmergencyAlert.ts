import { Schema, model } from "mongoose";

const EmergencyAlertSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    detectedTrigger: { type: String, required: true },
    messageContent: { type: String, required: true },

    // Risk classification
    riskLevel: { type: String, enum: ["low", "medium", "high", "critical"], default: "critical" },
    confidenceScore: { type: Number, default: 0, min: 0, max: 100 },

    // Risk factors that contributed
    riskFactors: [
      {
        type: { type: String },
        score: { type: Number },
        detail: { type: String },
        source: { type: String },
      }
    ],

    // Trigger source
    source: {
      type: String,
      enum: ["ai_chat", "peer_chat", "journal", "mood", "voice_message", "manual"],
      default: "ai_chat",
    },

    // Location at time of alert
    location: {
      lat: { type: Number },
      lng: { type: Number },
      mapsUrl: { type: String },
    },

    // Nearby facilities
    nearbyFacilities: [
      {
        name: { type: String },
        type: { type: String },
        distance: { type: String },
        phone: { type: String },
      }
    ],

    // Alerts dispatched
    alertsSent: [
      {
        channel: { type: String },
        to: { type: String },
        status: { type: String },
        sentAt: { type: Date },
      }
    ],

    // Linked EmergencyEvent
    emergencyEventId: { type: Schema.Types.ObjectId, ref: "EmergencyEvent" },

    // Resolution
    status: { type: String, enum: ["active", "resolved"], default: "active" },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolutionNotes: { type: String },
    respondedAt: { type: Date },
    slaMinutes: { type: Number, default: 15 },
    slaBreach: { type: Boolean, default: false },
  },
  { timestamps: true }
);

EmergencyAlertSchema.index({ userId: 1, status: 1 });

export const EmergencyAlert = model("EmergencyAlert", EmergencyAlertSchema);
