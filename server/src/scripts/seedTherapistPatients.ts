import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.ts";
import { User } from "../models/User.ts";
import { Therapist } from "../models/Therapist.ts";
import { Appointment } from "../models/Appointment.ts";

dotenv.config();

async function seedTherapistPatients() {
  await connectDB();
  const therapist = await Therapist.findOne({ userId: { $exists: true } }).sort({ createdAt: 1 });
  if (!therapist?.userId) throw new Error("No therapist account is available to receive patients.");

  const users = await User.find({ role: "user", _id: { $ne: therapist.userId } }).sort({ createdAt: 1 }).limit(12);
  const timeSlots = ["09:00 AM - 09:45 AM", "10:00 AM - 10:45 AM", "11:00 AM - 11:45 AM", "02:00 PM - 02:45 PM"];
  let created = 0;

  for (const [index, user] of users.entries()) {
    const exists = await Appointment.exists({ userId: user._id, therapistId: therapist.userId });
    if (exists) continue;
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 1 + Math.floor(index / timeSlots.length));
    await Appointment.create({
      userId: user._id,
      therapistId: therapist.userId,
      date,
      timeSlot: timeSlots[index % timeSlots.length],
      status: "APPROVED",
      paymentStatus: "SUCCESS",
      amountPaid: therapist.consultationFee,
      consultationFee: therapist.consultationFee,
      type: index % 2 === 0 ? "voice" : "chat",
      messagingEnabled: true,
      approvalTimestamp: new Date(),
      reason: "Scheduled consultation",
    });
    created++;
  }
  console.log(JSON.stringify({ therapistId: therapist.userId.toString(), patientsConsidered: users.length, appointmentsCreated: created }, null, 2));
}

seedTherapistPatients().finally(() => mongoose.disconnect());
