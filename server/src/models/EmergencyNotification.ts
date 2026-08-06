import { Schema, model } from "mongoose";

const EmergencyNotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: "emergency" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const EmergencyNotification = model("EmergencyNotification", EmergencyNotificationSchema);
