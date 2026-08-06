import { Schema, model } from "mongoose";

const EmergencyContactSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    relationship: { type: String, required: true },
    countryCode: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    priority: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const EmergencyContact = model("EmergencyContact", EmergencyContactSchema);
