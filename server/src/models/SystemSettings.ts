import mongoose from "mongoose";

const systemSettingsSchema = new mongoose.Schema(
  {
    companionCommissionRate: {
      type: Number,
      default: 0.2, // 20% commission
    },
    therapistCommissionRate: {
      type: Number,
      default: 0.15, // 15% commission
    },
    freeTrialMinutes: {
      type: Number,
      default: 5,
    },
    allowAnonymousSessions: {
      type: Boolean,
      default: true,
    },
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    emergencyHotline: {
      type: String,
      default: "911",
    },
  },
  { timestamps: true }
);

export const SystemSettings = mongoose.model("SystemSettings", systemSettingsSchema);
