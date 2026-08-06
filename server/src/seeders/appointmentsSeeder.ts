import { Appointment } from "../models/Appointment.ts";
import { User } from "../models/User.ts";
import { Therapist } from "../models/Therapist.ts";
import { SeederResult } from "./types.ts";

export async function seedAppointments(targetCount = 20): Promise<SeederResult> {
  const existingCount = await Appointment.countDocuments();
  if (existingCount >= targetCount) {
    return { collectionName: "appointments", modelName: "Appointment", existingCount, insertedCount: 0, finalCount: existingCount, status: "SKIPPED" };
  }

  const patients = await User.find({ role: "user" });
  const therapists = await Therapist.find();

  if (patients.length === 0 || therapists.length === 0) {
    throw new Error("Cannot seed appointments: Patients or Therapists missing.");
  }

  const needed = targetCount - existingCount;
  const timeSlots = ["09:00 AM - 10:00 AM", "10:30 AM - 11:30 AM", "02:00 PM - 03:00 PM", "04:30 PM - 05:30 PM", "06:00 PM - 07:00 PM"];
  const reasons = [
    "Work-life balance & stress consultation",
    "CBT anxiety management session",
    "Sleep hygiene & panic relief guidance",
    "Emotional resilience & mindfulness follow-up",
    "Couples & family communication counseling"
  ];

  const docsToInsert = [];
  for (let i = existingCount; i < targetCount; i++) {
    const patient = patients[i % patients.length];
    const therapist = therapists[i % therapists.length];
    const status = i % 3 === 0 ? "COMPLETED" : i % 3 === 1 ? "APPROVED" : "PENDING_APPROVAL";

    docsToInsert.push({
      userId: patient._id,
      therapistId: therapist.userId || therapist._id,
      date: new Date(Date.now() + (i - 10) * 86400000),
      timeSlot: timeSlots[i % timeSlots.length],
      status,
      paymentStatus: status === "PENDING_APPROVAL" ? "PAYMENT_PENDING" : "SUCCESS",
      type: i % 2 === 0 ? "voice" : "chat",
      reason: reasons[i % reasons.length],
      notes: "Patient is responding very well to cognitive restructuring and daily mood logging.",
      consultationFee: therapist.consultationFee || 1500,
      amountPaid: therapist.consultationFee || 1500,
      meetingLink: `https://mindcare.app/consultation/room-kl-${100 + i}`,
      bookingDate: new Date(Date.now() - 5 * 86400000),
      aiConversationSummary: "Discussed workplace stress in Kakkanad Infopark and techniques to maintain evening relaxation.",
      shareSummaryConsent: true
    });
  }

  if (docsToInsert.length > 0) {
    await Appointment.insertMany(docsToInsert);
  }

  const finalCount = await Appointment.countDocuments();
  return { collectionName: "appointments", modelName: "Appointment", existingCount, insertedCount: docsToInsert.length, finalCount, status: "VERIFIED" };
}
