import { User } from "../../models/User.ts";
import { Therapist } from "../../models/Therapist.ts";
import { Appointment } from "../../models/Appointment.ts";

export async function generateAppointments(targetCount = 300) {
  console.log("Checking Appointments collection...");
  const clients = await User.find({ role: "user", verifiedCompanion: false });
  const therapists = await User.find({ role: "therapist" });
  
  if (clients.length === 0 || therapists.length === 0) {
    console.log("No clients or therapists found. Skipping appointments generation.");
    return;
  }

  const therapistListings = await Therapist.find({});
  const existingCount = await Appointment.countDocuments();

  if (existingCount >= targetCount) {
    console.log(`Appointments collection satisfies target count (${existingCount}/${targetCount}).`);
    return;
  }

  const needed = targetCount - existingCount;
  console.log(`Seeding ${needed} additional Appointments...`);
  const appointmentLogs = [];

  const slots = ["09:00 AM - 10:00 AM", "11:00 AM - 12:00 PM", "02:00 PM - 03:00 PM", "04:00 PM - 05:00 PM"];
  const statuses = ["COMPLETED", "COMPLETED", "APPROVED", "CANCELLED", "COMPLETED"];

  for (let i = 0; i < needed; i++) {
    const client = clients[i % clients.length];
    const therapist = therapists[i % therapists.length];
    const listing = therapistListings.find(t => t.userId?.toString() === therapist._id.toString());
    const fee = listing ? listing.consultationFee : 75000; // default 750 INR

    appointmentLogs.push({
      userId: client._id,
      therapistId: therapist._id,
      date: new Date(Date.now() - (i % 60) * 24 * 60 * 60 * 1000 - Math.random() * 10 * 60 * 60 * 1000),
      timeSlot: slots[i % slots.length],
      status: statuses[i % statuses.length],
      paymentStatus: statuses[i % statuses.length] === "CANCELLED" ? "REFUNDED" : "SUCCESS",
      notes: "Routine counseling session addressing career stress and anxiety management.",
      meetingLink: `https://meet.mindcare.in/consult-${1000 + i}`,
      amountPaid: fee,
      consultationFee: fee
    });
  }

  if (appointmentLogs.length > 0) {
    await Appointment.insertMany(appointmentLogs);
  }

  console.log(`Seeding complete. Appointments count: ${await Appointment.countDocuments()}`);
}
