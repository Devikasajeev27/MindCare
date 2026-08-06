import { Schema, model } from "mongoose";

// Tracks every alert sent (SMS/Email/WhatsApp) for a single event
const AlertDeliverySchema = new Schema({
  channel: { type: String, enum: ["sms", "email", "whatsapp", "push", "socket"], required: true },
  to: { type: String, required: true },           // phone/email address
  status: { type: String, enum: ["sent", "delivered", "failed", "pending"], default: "pending" },
  provider: { type: String },                      // "twilio", "nodemailer", etc.
  providerMessageId: { type: String },             // Twilio SID or email msgId
  sentAt: { type: Date, default: Date.now },
  errorMessage: { type: String },
}, { _id: false });

// Nearby facilities attached to emergency event
const NearbyFacilitySchema = new Schema({
  name: { type: String },
  type: { type: String, enum: ["therapist", "hospital", "helpline", "mental_health_centre"] },
  distance: { type: String },                      // "2.3 km"
  phone: { type: String },
  address: { type: String },
  mapsUrl: { type: String },
}, { _id: false });

// ─── Emergency Event — Full Audit Log ──────────────────────────────────────
const EmergencyEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String },
    userEmail: { type: String },
    userPhone: { type: String },

    // What triggered this event
    triggerSource: {
      type: String,
      enum: ["ai_chat", "peer_chat", "journal", "mood", "voice_message", "voice_call", "manual", "cron"],
      required: true,
    },

    // The exact text/content that triggered it
    triggerText: { type: String },

    // Multi-factor confidence score at time of trigger
    confidenceScore: { type: Number, required: true, min: 0, max: 100 },

    // Risk factors that contributed
    riskFactors: [
      {
        type: { type: String },
        score: { type: Number },
        detail: { type: String },
        source: { type: String },
      }
    ],

    // Location at time of trigger
    locationSnapshot: {
      lat: { type: Number },
      lng: { type: Number },
      accuracy: { type: Number },
      mapsUrl: { type: String },
      address: { type: String },
    },

    // Nearby facilities found
    nearbyFacilities: { type: [NearbyFacilitySchema], default: [] },

    // All alerts dispatched
    alertsSent: { type: [AlertDeliverySchema], default: [] },

    // Assigned therapist (if any)
    assignedTherapistId: { type: Schema.Types.ObjectId, ref: "User" },
    assignedTherapistName: { type: String },

    // Emergency case created
    emergencyCaseId: { type: Schema.Types.ObjectId, ref: "EmergencyCase" },

    // Overall status
    workflowStatus: {
      type: String,
      enum: ["active", "resolved", "false_positive", "escalated"],
      default: "active",
    },

    // Resolution info
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    resolutionNotes: { type: String },

    // Timing metrics
    workflowStartedAt: { type: Date, default: Date.now },
    workflowCompletedAt: { type: Date },
    responseTimeMs: { type: Number },

    // SLA (15 minutes to first response)
    slaMinutes: { type: Number, default: 15 },
    slaBreach: { type: Boolean, default: false },

    // AI-generated conversation summary sent with alert
    conversationSummary: { type: String },
  },
  { timestamps: true }
);

EmergencyEventSchema.index({ userId: 1, createdAt: -1 });
EmergencyEventSchema.index({ workflowStatus: 1 });

export const EmergencyEvent = model("EmergencyEvent", EmergencyEventSchema);
