import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.ts";
import { Appointment } from "../models/Appointment.ts";

dotenv.config();

async function repairAppointmentStatuses() {
  await connectDB();
  const legacy: Record<string, string> = { pending: "PENDING_APPROVAL", approved: "APPROVED", confirmed: "APPROVED", completed: "COMPLETED", cancelled: "CANCELLED", rejected: "REJECTED", auto_cancelled: "CANCELLED", AUTO_CANCELLED: "CANCELLED", IN_CONSULTATION: "IN_PROGRESS" };
  let normalized = 0;
  for (const [from, to] of Object.entries(legacy)) {
    const result = await Appointment.updateMany({ status: from }, { $set: { status: to } });
    normalized += result.modifiedCount;
  }
  // Only repair suspicious cancellations: a real cancellation/refund has a recorded reason or refund event.
  const repaired = await Appointment.updateMany({ status: "CANCELLED", cancellationReason: { $in: [null, ""] }, refundId: "", paymentStatus: "SUCCESS" }, { $set: { status: "PENDING_APPROVAL", messagingEnabled: false } });
  console.log(JSON.stringify({ normalized, repairedCancelledBookings: repaired.modifiedCount }, null, 2));
}

repairAppointmentStatuses().finally(() => mongoose.disconnect());
