import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.ts";
import { Appointment } from "../models/Appointment.ts";

dotenv.config();
async function repairPaymentStatuses() {
  await connectDB();
  const result = await Appointment.updateMany({ paymentStatus: { $in: ["PENDING", "pending"] } }, { $set: { paymentStatus: "PAYMENT_PENDING" } });
  console.log(JSON.stringify({ normalizedPaymentPending: result.modifiedCount }, null, 2));
}
repairPaymentStatuses().finally(() => mongoose.disconnect());
