import { Schema, model } from "mongoose";

const CompanionMatchingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    isAvailable: { type: Boolean, default: true },
    matchedSessionId: { type: Schema.Types.ObjectId, ref: "CompanionSession" },
  },
  { timestamps: true }
);

export const CompanionMatching = model("CompanionMatching", CompanionMatchingSchema);
