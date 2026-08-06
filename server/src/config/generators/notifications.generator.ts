import { User } from "../../models/User.ts";
import { Notification } from "../../models/Notification.ts";

export async function generateNotifications(targetCount = 1200) {
  console.log("Checking Notifications collection...");
  const clients = await User.find({ role: "user", verifiedCompanion: false });
  
  if (clients.length === 0) {
    console.log("No client users found. Skipping notifications generation.");
    return;
  }

  const existingCount = await Notification.countDocuments();

  if (existingCount >= targetCount) {
    console.log(`Notifications collection satisfies target count (${existingCount}/${targetCount}).`);
    return;
  }

  const notificationsPayload = [];
  const types = ["appointments", "emergency", "payments", "mood_reminder", "journal_reminder", "companion_match", "therapist_approved", "subscription"];
  const titles = [
    "Appointment Confirmed", "Emergency Emergency Case Alert", "Payment Received Successfully",
    "Time to update your Mood Log", "Write your daily Journal entry", "Matched with Peer Companion",
    "Therapist Profile Approved", "Subscription Renewed"
  ];
  const messages = [
    "Your upcoming therapy slot has been successfully scheduled and booked.",
    "A crisis trigger was detected from your chat; your counselor has been notified.",
    "Your payment was received and your invoice is available in payments.",
    "Taking 30 seconds to reflect on your state helps build wellness habits.",
    "Write down your reflections, gratitude elements, and emotional markers.",
    "You have been connected with a verified companion listener in the public room.",
    "Your medical registration and certificates were reviewed and approved.",
    "Thank you for renewing your Premium subscription plan. Enjoy all features!"
  ];

  // Enforce at least 5 notifications per active user client
  for (const client of clients) {
    const userNotifs = await Notification.countDocuments({ userId: client._id });
    const needed = Math.max(0, 5 - userNotifs);

    for (let j = 0; j < needed; j++) {
      notificationsPayload.push({
        userId: client._id,
        title: titles[j % titles.length],
        message: messages[j % messages.length],
        type: iToType(j),
        read: j % 3 === 0,
        createdAt: new Date(Date.now() - j * 24 * 60 * 60 * 1000 - Math.random() * 8 * 60 * 60 * 1000)
      });
    }
  }

  function iToType(idx: number) {
    if (idx % 8 === 0) return "system";
    if (idx % 5 === 0) return "alert";
    return "message";
  }

  if (notificationsPayload.length > 0) {
    await Notification.insertMany(notificationsPayload);
  }

  // Pad to reach 1200
  let currentCount = await Notification.countDocuments();
  if (currentCount < targetCount) {
    const padNeeded = targetCount - currentCount;
    console.log(`Padding Notifications collection with ${padNeeded}...`);
    const padPayloads = [];
    for (let i = 0; i < padNeeded; i++) {
      const client = clients[i % clients.length];
      const idx = i % titles.length;
      padPayloads.push({
        userId: client._id,
        title: titles[idx],
        message: messages[idx],
        type: iToType(i),
        read: i % 4 === 0,
        createdAt: new Date(Date.now() - (10 + i % 90) * 24 * 60 * 60 * 1000)
      });
    }
    await Notification.insertMany(padPayloads);
  }

  console.log(`Seeding complete. Notifications count: ${await Notification.countDocuments()}`);
}
