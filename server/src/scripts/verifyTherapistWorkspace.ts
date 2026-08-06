import mongoose from "mongoose";
import { connectDB } from "../config/db.ts";
import { User } from "../models/User.ts";
import { Therapist } from "../models/Therapist.ts";
import { Appointment } from "../models/Appointment.ts";
import { AppointmentConversation } from "../models/AppointmentConversation.ts";
import { PaymentHistory } from "../models/PaymentHistory.ts";
import { Resource } from "../models/Resource.ts";

async function run() {
  const rawId = process.env.THERAPIST_USER_ID;
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw new Error("Set THERAPIST_USER_ID to a valid therapist User ObjectId.");
  }

  await connectDB();
  const user = await User.findById(rawId).select("role status").lean();
  if (!user || user.role !== "therapist") {
    throw new Error("The supplied id is not an active therapist user record.");
  }

  const therapist = await Therapist.findOne({ userId: rawId }).select("_id").lean();
  const therapistIds = therapist ? [new mongoose.Types.ObjectId(rawId), therapist._id] : [new mongoose.Types.ObjectId(rawId)];
  const appointmentScope = { therapistId: { $in: therapistIds } };
  const appointmentIds = await Appointment.distinct("_id", appointmentScope);
  const [appointments, paidCompleted, conversations, resources] = await Promise.all([
    Appointment.countDocuments(appointmentScope),
    Appointment.countDocuments({ ...appointmentScope, status: "COMPLETED", paymentStatus: "SUCCESS" }),
    AppointmentConversation.countDocuments({ therapistId: rawId }),
    Resource.countDocuments({ published: { $ne: false } }),
  ]);
  const payments = await PaymentHistory.countDocuments({
    appointmentId: { $in: appointmentIds },
    status: "success",
  });

  console.table([{ appointments, paidCompleted, conversations, publishedResources: resources, successfulAppointmentPayments: payments }]);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
