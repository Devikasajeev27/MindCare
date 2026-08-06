import { Schema, model } from "mongoose";

const BlockedAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    panNumber: { type: String, trim: true, uppercase: true, index: true },
    email: { type: String, lowercase: true, trim: true, index: true },
    phone: { type: String, index: true },
    reason: { type: String, required: true },
    category: {
      type: String,
      enum: ["Fraud", "Abuse", "Policy Violation", "Spam", "Fake Identity", "Other"],
      default: "Policy Violation"
    },
    blockedBy: { type: Schema.Types.ObjectId, ref: "User" },
    blockedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const BlockedAccount = model("BlockedAccount", BlockedAccountSchema);
