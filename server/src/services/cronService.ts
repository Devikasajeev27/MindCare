import cron from "node-cron";
import { EmergencyAlert } from "../models/EmergencyAlert.ts";
import { EmergencyAssignmentService } from "./emergencyAssignmentService.ts";

export function initCronJobs() {
  console.log("Initializing background cron jobs...");

  // Enforce daily streak validations at midnight
  cron.schedule("0 0 * * *", async () => {
    console.log("Running daily midnight cron job...");
    try {
      const { User } = await import("../models/User.ts");
      const { Notification } = await import("../models/Notification.ts");
      const users = await User.find({ role: "user" });
      const now = new Date();
      
      for (const u of users) {
        if (!u.lastActivityDate) {
          u.streak = 0;
          await u.save();
          continue;
        }
        
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const lastDay = new Date(u.lastActivityDate);
        lastDay.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(today.getTime() - lastDay.getTime());
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 1) {
          const oldStreak = u.streak;
          u.streak = 0;
          await u.save();
          
          if (oldStreak > 0) {
            await Notification.create({
              userId: u._id,
              title: "Oh no! Your streak has reset",
              message: `Your ${oldStreak}-day wellness streak has broken. Start a new journal or log your mood today to begin a new streak!`,
              type: "alert",
            });
          }
        } else if (diffDays === 1) {
          await Notification.create({
            userId: u._id,
            title: "Keep your streak going!",
            message: "You haven't recorded any activity today. Log your mood or write a quick journal to preserve your daily streak!",
            type: "info",
          });
        }
      }
      console.log("Daily streak verification completed.");
    } catch (err) {
      console.error("Failed to run daily streak cron check:", err);
    }
  });

  // Example Job: Runs every Sunday at midnight
  cron.schedule("0 0 * * 0", async () => {
    console.log("Running weekly assessment cron job...");
    // TODO: Implement companion weekly performance assessment
  });

  // SLA breach checks: Runs every minute for higher accuracy in response SLA tracking
  cron.schedule("* * * * *", async () => {
    try {
      await EmergencyAssignmentService.reassignExpiredOffers();
      const activeAlerts = await EmergencyAlert.find({ status: "active", slaBreach: false });
      const now = new Date();
      
      for (const alert of activeAlerts) {
        const elapsedMins = (now.getTime() - new Date(alert.createdAt).getTime()) / (1000 * 60);
        if (elapsedMins > (alert.slaMinutes || 15)) {
          alert.slaBreach = true;
          await alert.save();
          console.log(`[SLA BREACH] Alert ${alert._id} has breached SLA.`);
          
          try {
            const { getIO } = await import("./socketService.ts");
            getIO().to("admin_room").emit("emergency_alert_updated", alert);
          } catch (wsErr) {
            console.error("Failed to broadcast SLA breach via WebSockets:", wsErr);
          }
        }
      }
    } catch (err) {
      console.error("Error executing SLA breach check cron:", err);
    }
  });
}
