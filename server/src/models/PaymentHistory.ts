import { Schema, model } from "mongoose";

const PaymentHistorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
    sessionId: { type: Schema.Types.ObjectId, ref: "CompanionSession" },
    planId: { type: Schema.Types.ObjectId, ref: "BillingPlan" },
    type: { type: String, enum: ['companion_session', 'subscription', 'therapist_consultation', 'wallet_deposit', 'wallet_withdrawal'], required: true, default: 'companion_session' },
    description: { type: String },
    invoiceNumber: { type: String },      // Razorpay Payment ID (pay_...)
    razorpayOrderId: { type: String },    // Razorpay Order ID (order_...)
    razorpaySignature: { type: String },  // HMAC signature stored for audit
    paymentMethod: { type: String, default: "Razorpay Checkout" },
    amount: { type: Number, required: true },
    platformCommission: { type: Number, required: true },
    companionEarnings: { type: Number, required: true },
    gst: { type: Number, required: true },
    status: {
      type: String,
      enum: ["success", "failed", "pending", "refunded"],
      default: "success",
      set: (value: string) => String(value || "pending").toLowerCase(),
    },
    refundId: { type: String },
    refundReference: { type: String },
    refundDate: { type: Date },
    refundAmount: { type: Number, default: 0 },
    cancellationReason: { type: String },
  },
  { timestamps: true }
);

PaymentHistorySchema.index({ appointmentId: 1, status: 1, createdAt: -1 });
PaymentHistorySchema.index({ status: 1, createdAt: -1 });
PaymentHistorySchema.index({ type: 1, status: 1, createdAt: -1 });

export const PaymentHistory = model("PaymentHistory", PaymentHistorySchema);
