import { Schema, model } from "mongoose";

const ReportsSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reportedId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true },
    evidence: { type: String },
    actionTaken: { type: String, default: "pending" },
  },
  { timestamps: true }
);

export const Reports = model("Reports", ReportsSchema);
