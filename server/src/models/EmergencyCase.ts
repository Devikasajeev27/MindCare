import { Schema, model } from "mongoose";

const EmergencyCaseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // A case may be temporarily unassigned when no verified on-call clinician
    // can accept it. Requiring a therapist here used to force a fake assignment.
    therapistId: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["pending", "active", "resolved", "unassigned"], default: "pending" },
    riskScore: { type: String, enum: ["low", "medium", "high", "critical"], default: "critical" },
    assignedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date },
    offerExpiresAt: { type: Date },
    assignmentAttempts: { type: Number, default: 0 },
    attemptedTherapistIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    resolvedAt: { type: Date },
    resolutionNotes: { type: String },
  },
  { timestamps: true }
);

export const EmergencyCase = model("EmergencyCase", EmergencyCaseSchema);
