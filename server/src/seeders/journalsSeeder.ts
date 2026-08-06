import { Journal } from "../models/Journal.ts";
import { Mood } from "../models/Mood.ts";
import { Notification } from "../models/Notification.ts";
import { PaymentHistory } from "../models/PaymentHistory.ts";
import { Chat } from "../models/Chat.ts";
import { User } from "../models/User.ts";
import { BillingPlan } from "../models/BillingPlan.ts";
import { SeederResult } from "./types.ts";

export async function seedJournals(targetCount = 20): Promise<SeederResult> {
  const existingCount = await Journal.countDocuments();
  if (existingCount >= targetCount) {
    return { collectionName: "journals", modelName: "Journal", existingCount, insertedCount: 0, finalCount: existingCount, status: "SKIPPED" };
  }

  const users = await User.find({ role: "user" });
  const targetUsers = users.length > 0 ? users : await User.find();
  const needed = targetCount - existingCount;

  const titles = [
    "Finding Peace in Daily Routine", "Overcoming Kakkanad Work Stress", "Reflections on Mindfulness",
    "Gratitude Journal: Small Joys", "Balancing Ambition & Mental Rest", "A Calm Evening by the Backwaters",
    "Learning to Set Healthier Boundaries", "Progress on Sleep Hygiene", "Handling Unexpected Work Challenges",
    "Weekend Unwinding in Fort Kochi", "Mindful Breathing Exercises", "Embracing Emotional Resilience",
    "Mid-Week Check-in & Self-Care", "Reflecting on Personal Growth", "Overcoming Morning Anxiety",
    "The Power of Active Listening", "Building Stronger Peer Connections", "My Wellness Journey Milestone",
    "Lessons Learned This Month", "Looking Forward to a Balanced Tomorrow"
  ];

  const docsToInsert = [];
  for (let i = existingCount; i < targetCount; i++) {
    const user = targetUsers[i % targetUsers.length];
    const date = new Date(Date.now() - (targetCount - i) * 86400000);
    docsToInsert.push({
      userId: user._id,
      title: `${titles[i % titles.length]} #${i + 1}`,
      content: `Today in ${user.city || 'Kochi'}, I spent 20 minutes recording my thoughts and prioritizing mental wellbeing. MindCare platform has been instrumental in keeping my daily streak alive.`,
      mood: (i % 5) + 1,
      tags: ["Reflection", "Gratitude", "Mindfulness", "Kerala"],
      createdAt: date,
      updatedAt: date,
    });
  }

  if (docsToInsert.length > 0) {
    await Journal.insertMany(docsToInsert);
  }

  const finalCount = await Journal.countDocuments();
  return { collectionName: "journals", modelName: "Journal", existingCount, insertedCount: docsToInsert.length, finalCount, status: "VERIFIED" };
}

export async function seedMoods(targetCount = 20): Promise<SeederResult> {
  const existingCount = await Mood.countDocuments();
  if (existingCount >= targetCount) {
    return { collectionName: "moods", modelName: "Mood", existingCount, insertedCount: 0, finalCount: existingCount, status: "SKIPPED" };
  }

  const users = await User.find({ role: "user" });
  const targetUsers = users.length > 0 ? users : await User.find();
  const needed = targetCount - existingCount;

  const moodNotes = [
    "Had a serene morning walk around Marine Drive Kochi. Feeling refreshed.",
    "Work pressure at Kakkanad office was intense today, but handled it with 4-7-8 breathing.",
    "Enjoyed tea with family in the evening. Mood is very stable.",
    "Slight anxiety regarding upcoming project milestone. Practiced grounding exercises.",
    "Had a great session with MindCare AI Companion. Gained clarity on sleep routines.",
    "Productive day at work! Completed all pending tasks ahead of time.",
    "Felt a bit low due to rainy weather, but listening to calming music helped.",
    "Attended an online CBT workshop. Highly motivated!"
  ];

  const docsToInsert = [];
  for (let i = existingCount; i < targetCount; i++) {
    const user = targetUsers[i % targetUsers.length];
    const date = new Date(Date.now() - (targetCount - i) * 86400000);
    const rating = (i % 5) + 1;
    const emotionMap: Record<number, string> = { 1: "Very Low", 2: "Low", 3: "Neutral", 4: "Good", 5: "Great" };
    docsToInsert.push({
      userId: user._id,
      rating,
      emotion: emotionMap[rating],
      note: moodNotes[i % moodNotes.length],
      tags: ["Mental Wellness", "Kerala Life", "Routine"],
      date,
    });
  }

  if (docsToInsert.length > 0) {
    await Mood.insertMany(docsToInsert);
  }

  const finalCount = await Mood.countDocuments();
  return { collectionName: "moods", modelName: "Mood", existingCount, insertedCount: docsToInsert.length, finalCount, status: "VERIFIED" };
}

export async function seedNotifications(targetCount = 20): Promise<SeederResult> {
  const existingCount = await Notification.countDocuments();
  if (existingCount >= targetCount) {
    return { collectionName: "notifications", modelName: "Notification", existingCount, insertedCount: 0, finalCount: existingCount, status: "SKIPPED" };
  }

  const users = await User.find();
  const needed = targetCount - existingCount;

  const docsToInsert = [];
  for (let i = existingCount; i < targetCount; i++) {
    const user = users[i % users.length];
    const date = new Date(Date.now() - (targetCount - i) * 7200000);
    docsToInsert.push({
      userId: user._id,
      title: i % 3 === 0 ? "Daily Mood Check-in" : i % 3 === 1 ? "Streak Milestone Achieved!" : "Appointment Scheduled",
      message: `Your wellness check-in for day ${i + 1} is recorded successfully. Keep up your amazing daily habit!`,
      type: i % 3 === 0 ? "mood" : i % 3 === 1 ? "achievement" : "session",
      read: i < 15,
      createdAt: date,
    });
  }

  if (docsToInsert.length > 0) {
    await Notification.insertMany(docsToInsert);
  }

  const finalCount = await Notification.countDocuments();
  return { collectionName: "notifications", modelName: "Notification", existingCount, insertedCount: docsToInsert.length, finalCount, status: "VERIFIED" };
}

export async function seedPayments(targetCount = 20): Promise<SeederResult> {
  const existingCount = await PaymentHistory.countDocuments();
  if (existingCount >= targetCount) {
    return { collectionName: "paymenthistories", modelName: "PaymentHistory", existingCount, insertedCount: 0, finalCount: existingCount, status: "SKIPPED" };
  }

  const users = await User.find();
  const plans = await BillingPlan.find();
  const needed = targetCount - existingCount;

  const docsToInsert = [];
  for (let i = existingCount; i < targetCount; i++) {
    const user = users[i % users.length];
    const plan = plans[i % plans.length];
    const amt = (i % 2 === 0) ? 1500 : 499;
    const comm = Math.round(amt * 0.15);
    const earn = amt - comm;
    const gst = Math.round(amt * 0.18);
    const date = new Date(Date.now() - (targetCount - i) * 86400000);

    docsToInsert.push({
      userId: user._id,
      planId: plan?._id,
      type: (i % 2 === 0) ? "therapist_consultation" : "subscription",
      description: (i % 2 === 0) ? "Consultation with Dr. Sarah Mitchell (Aster Medcity Kochi)" : `Subscription: ${plan?.name || 'MindCare Starter'}`,
      invoiceNumber: `pay_KL_${100000 + i}`,
      razorpayOrderId: `order_KL_${500000 + i}`,
      razorpaySignature: `sig_kl_hmac_${Date.now()}_${i}`,
      paymentMethod: "Razorpay Checkout (UPI/Netbanking)",
      amount: amt,
      platformCommission: comm,
      companionEarnings: earn,
      gst,
      status: "success",
      createdAt: date,
    });
  }

  if (docsToInsert.length > 0) {
    await PaymentHistory.insertMany(docsToInsert);
  }

  const finalCount = await PaymentHistory.countDocuments();
  return { collectionName: "paymenthistories", modelName: "PaymentHistory", existingCount, insertedCount: docsToInsert.length, finalCount, status: "VERIFIED" };
}

export async function seedChats(targetCount = 20): Promise<SeederResult> {
  const existingCount = await Chat.countDocuments();
  if (existingCount >= targetCount) {
    return { collectionName: "chats", modelName: "Chat", existingCount, insertedCount: 0, finalCount: existingCount, status: "SKIPPED" };
  }

  const users = await User.find();
  const needed = targetCount - existingCount;

  const docsToInsert = [];
  for (let i = existingCount; i < targetCount; i++) {
    const user = users[i % users.length];
    const isUser = i % 2 === 0;
    const date = new Date(Date.now() - (targetCount - i) * 3600000);

    docsToInsert.push({
      userId: user._id,
      conversationId: `conv_${user._id.toString().slice(-6)}_session`,
      sender: isUser ? "user" : "ai",
      recipient: "ai",
      text: isUser
        ? `Hello MindCare AI, I am feeling a bit ${i % 2 === 0 ? "anxious about work" : "tired"} today. What exercise do you recommend?`
        : `I hear you, ${user.name}. Take a slow deep breath in for 4 seconds, hold for 7 seconds, and exhale for 8 seconds.`,
      riskLevel: "none",
      distressScore: 10 + (i % 5),
      emotion: isUser ? "anxious" : "calm",
      strategy: "active_listening",
      intent: "general_support",
      time: date,
      sessionId: `session_kerala_${i}`,
      detectedLanguage: "en",
    });
  }

  if (docsToInsert.length > 0) {
    await Chat.insertMany(docsToInsert);
  }

  const finalCount = await Chat.countDocuments();
  return { collectionName: "chats", modelName: "Chat", existingCount, insertedCount: docsToInsert.length, finalCount, status: "VERIFIED" };
}
