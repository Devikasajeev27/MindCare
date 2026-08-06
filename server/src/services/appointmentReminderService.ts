import { Appointment } from "../models/Appointment.ts";
import { Notification } from "../models/Notification.ts";
import { User } from "../models/User.ts";

export async function processAppointmentRemindersAndCompletion() {
  try {
    const now = new Date();
    const confirmedAppointments = await Appointment.find({
      status: { $in: ["confirmed", "approved"] }
    });

    for (const appt of confirmedAppointments) {
      const apptDate = new Date(appt.date);
      const timeDiffMs = apptDate.getTime() - now.getTime();
      const hoursDiff = timeDiffMs / (1000 * 60 * 60);

      const therapist = await User.findById(appt.therapistId);
      const therapistName = therapist?.name || "Therapist";

      // 1. 24-Hour Reminder (between 23 and 25 hours away)
      if (hoursDiff >= 23 && hoursDiff <= 25) {
        const existing24hNotif = await Notification.findOne({
          userId: appt.userId,
          type: "appointment",
          message: { $regex: "24-Hour Reminder" }
        });

        if (!existing24hNotif) {
          await Notification.create({
            userId: appt.userId,
            title: "Upcoming Appointment Reminder (24 Hours) ⏰",
            message: `24-Hour Reminder: You have a scheduled consultation with ${therapistName} on ${apptDate.toLocaleDateString()} at ${appt.timeSlot}.`,
            type: "appointment",
            isRead: false
          });

          await Notification.create({
            userId: appt.therapistId,
            title: "Upcoming Patient Session (24 Hours) ⏰",
            message: `24-Hour Reminder: You have a scheduled session on ${apptDate.toLocaleDateString()} at ${appt.timeSlot}.`,
            type: "appointment",
            isRead: false
          });
        }
      }

      // 2. 1-Hour Reminder (between 0.5 and 1.5 hours away)
      if (hoursDiff >= 0.5 && hoursDiff <= 1.5) {
        const existing1hNotif = await Notification.findOne({
          userId: appt.userId,
          type: "appointment",
          message: { $regex: "1-Hour Reminder" }
        });

        if (!existing1hNotif) {
          await Notification.create({
            userId: appt.userId,
            title: "Appointment Starting Soon (1 Hour) 🔔",
            message: `1-Hour Reminder: Your consultation with ${therapistName} starts in 1 hour at ${appt.timeSlot}.`,
            type: "appointment",
            isRead: false
          });

          await Notification.create({
            userId: appt.therapistId,
            title: "Patient Session Starting Soon (1 Hour) 🔔",
            message: `1-Hour Reminder: Your patient session starts in 1 hour at ${appt.timeSlot}.`,
            type: "appointment",
            isRead: false
          });
        }
      }

      // 3. Auto-Completion (If scheduled date/time has passed by over 1 hour)
      if (hoursDiff < -1.0 && appt.status === "APPROVED") {
        appt.status = "COMPLETED";
        await appt.save();

        await Notification.create({
          userId: appt.userId,
          title: "Session Completed 🏁",
          message: `Your consultation with ${therapistName} on ${apptDate.toLocaleDateString()} has been marked as completed. Please feel free to leave a review.`,
          type: "appointment",
          isRead: false
        });
      }
    }
  } catch (error) {
    console.error("[AppointmentReminderService] Error processing reminders:", error);
  }
}

let intervalId: NodeJS.Timeout | null = null;

export function startAppointmentReminderCron() {
  if (intervalId) return;
  // Run every 60 seconds
  intervalId = setInterval(processAppointmentRemindersAndCompletion, 60 * 1000);
  // Also run immediately on server startup
  processAppointmentRemindersAndCompletion().catch(() => {});
  console.log("✓ Appointment reminder & auto-completion scheduler started (runs every 60s).");
}
