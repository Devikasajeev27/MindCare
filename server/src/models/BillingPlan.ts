import { Schema, model } from "mongoose";

const BillingPlanSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    yearlyPrice: { type: Number, default: 0 },
    period: { type: String, default: "month" },
    currency: { type: String, default: "INR" },
    description: { type: String, default: "" },
    color: { type: String, default: "bg-slate-50 border-slate-200" },
    buttonClass: { type: String, default: "bg-primary text-white" },
    buttonText: { type: String, default: "Upgrade Now" },
    features: [{ type: String }],
    limitations: [{ type: String }],
    badge: { type: String, default: "" },
    recommended: { type: Boolean, default: false },
    popular: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const BillingPlan = model("BillingPlan", BillingPlanSchema);
