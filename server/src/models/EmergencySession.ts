import { Schema, model } from "mongoose";

const EmergencySessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    therapistId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emergencyCaseId: { type: Schema.Types.ObjectId, ref: "EmergencyCase", required: true },
    price: { type: Number, default: 0 },
    billingStatus: { type: String, default: "Waived" },
    sessionType: { type: String, default: "Emergency Session" },
  },
  { timestamps: true }
);

export const EmergencySession = model("EmergencySession", EmergencySessionSchema);
