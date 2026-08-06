import { Schema, model } from "mongoose";

const AppointmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    therapistId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    timeSlot: { type: String, required: true }, // e.g. "10:00 AM - 11:00 AM"
    status: {
      type: String,
      enum: [
        "PENDING_APPROVAL",
        "APPROVED",
        "REJECTED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "EXPIRED",
      ],
      default: "PENDING_APPROVAL"
    },
    paymentStatus: {
      type: String,
      enum: ["PAYMENT_PENDING", "PROCESSING", "SUCCESS", "FAILED", "REFUNDED"],
      default: "PAYMENT_PENDING"
    },
    refundStatus: {
      type: String,
      enum: ["NOT_REQUIRED", "PENDING", "PROCESSING", "COMPLETED", "FAILED", "not_required", "completed", "failed"],
      default: "NOT_REQUIRED"
    },
    type: { type: String, enum: ["voice", "chat"], default: "voice" },
    notes: { type: String },
    reason: { type: String },
    rejectionReason: { type: String },
    cancellationReason: { type: String },
    meetingLink: { type: String },
    amountPaid: { type: Number, default: 0 },
    consultationFee: { type: Number, required: true },
    bookingDate: { type: Date, default: Date.now },
    approvalTimestamp: { type: Date },
    rejectionTimestamp: { type: Date },
    autoCancellationTimestamp: { type: Date },
    paymentId: { type: String, default: "" },               // Razorpay Payment ID / Transaction ID
    orderId: { type: String, default: "" },                 // Razorpay Order ID
    gatewayTransactionId: { type: String, default: "" },   // Gateway Transaction ID
    refundId: { type: String, default: "" },                // Refund ID
    refundReference: { type: String, default: "" },         // Refund Reference Number
    refundDate: { type: Date },                             // Refund Timestamp
    refundAmount: { type: Number, default: 0 },             // Refund Amount
    reminderTimes: [{ type: Date }],
    review: { type: String },
    messagingEnabled: { type: Boolean, default: false },
    aiConversationSummary: { type: String, default: "" },
    shareSummaryConsent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AppointmentSchema.index({ userId: 1 });
AppointmentSchema.index({ therapistId: 1 });
AppointmentSchema.index({ date: -1 });
AppointmentSchema.index({ status: 1 });
AppointmentSchema.index({ paymentStatus: 1 });
AppointmentSchema.index({ refundStatus: 1 });
AppointmentSchema.index({ therapistId: 1, date: 1, timeSlot: 1 });
AppointmentSchema.index({ therapistId: 1, status: 1, paymentStatus: 1, updatedAt: -1 });
AppointmentSchema.index({ messagingEnabled: 1 });

export const Appointment = model("Appointment", AppointmentSchema);
