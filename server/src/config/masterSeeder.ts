import { generateUsers } from "./generators/users.generator.ts";
import { generateTherapists } from "./generators/therapists.generator.ts";
import { generateMoods } from "./generators/moods.generator.ts";
import { generateJournals } from "./generators/journals.generator.ts";
import { generateChats } from "./generators/chat.generator.ts";
import { generateAppointments } from "./generators/appointments.generator.ts";
import { generateCompanion } from "./generators/companion.generator.ts";
import { generatePayments } from "./generators/payments.generator.ts";
import { generateNotifications } from "./generators/notifications.generator.ts";
import { generateReports } from "./generators/reports.generator.ts";
import { generateEmergency } from "./generators/emergency.generator.ts";
import { generateAuditLogs } from "./generators/audit.generator.ts";
import { generateRiskAssessments } from "./generators/risk.generator.ts";
import { generateWeeklyAssessments } from "./generators/weeklyAssessment.generator.ts";
import { generateWallet } from "./generators/wallet.generator.ts";
import { generateFavorites } from "./generators/favorites.generator.ts";
import { generateBlockedUsers } from "./generators/blocked.generator.ts";
import { generateMasterReferences } from "./generators/masterReference.generator.ts";

import { User } from "../models/User.ts";
import { Therapist } from "../models/Therapist.ts";
import { Resource } from "../models/Resource.ts";
import { BillingPlan } from "../models/BillingPlan.ts";
import { Mood } from "../models/Mood.ts";
import { Journal } from "../models/Journal.ts";
import { Chat } from "../models/Chat.ts";
import { Appointment } from "../models/Appointment.ts";
import { AuditLog } from "../models/AuditLog.ts";
import { BlockedUsers } from "../models/BlockedUsers.ts";
import { CompanionEarnings } from "../models/CompanionEarnings.ts";
import { CompanionMatching } from "../models/CompanionMatching.ts";
import { CompanionMilestone } from "../models/CompanionMilestone.ts";
import { CompanionSession } from "../models/CompanionSession.ts";
import { EmergencyAlert } from "../models/EmergencyAlert.ts";
import { EmergencyCase } from "../models/EmergencyCase.ts";
import { EmergencyContact } from "../models/EmergencyContact.ts";
import { EmergencyNotification } from "../models/EmergencyNotification.ts";
import { EmergencySession } from "../models/EmergencySession.ts";
import { Favorites } from "../models/Favorites.ts";
import { Notification } from "../models/Notification.ts";
import { PaymentHistory } from "../models/PaymentHistory.ts";
import { Reports } from "../models/Reports.ts";
import { RiskAssessment } from "../models/RiskAssessment.ts";
import { SystemSettings } from "../models/SystemSettings.ts";
import { WeeklyAssessment } from "../models/WeeklyAssessment.ts";

import fs from "fs";
import path from "path";

async function verifyAllCounts() {
  const counts = {
    users: await User.countDocuments(),
    therapists: await Therapist.countDocuments(),
    billingPlans: await BillingPlan.countDocuments(),
    resources: await Resource.countDocuments(),
    moods: await Mood.countDocuments(),
    journals: await Journal.countDocuments(),
    chats: await Chat.countDocuments(),
    appointments: await Appointment.countDocuments(),
    auditLogs: await AuditLog.countDocuments(),
    blockedUsers: await BlockedUsers.countDocuments(),
    companionEarnings: await CompanionEarnings.countDocuments(),
    companionMatching: await CompanionMatching.countDocuments(),
    companionMilestones: await CompanionMilestone.countDocuments(),
    companionSessions: await CompanionSession.countDocuments(),
    emergencyAlerts: await EmergencyAlert.countDocuments(),
    emergencyCases: await EmergencyCase.countDocuments(),
    emergencyNotifications: await EmergencyNotification.countDocuments(),
    emergencySessions: await EmergencySession.countDocuments(),
    favorites: await Favorites.countDocuments(),
    notifications: await Notification.countDocuments(),
    paymentHistory: await PaymentHistory.countDocuments(),
    reports: await Reports.countDocuments(),
    riskAssessments: await RiskAssessment.countDocuments(),
    systemSettings: await SystemSettings.countDocuments(),
    weeklyAssessments: await WeeklyAssessment.countDocuments(),
  };

  console.log("\n====== PRODUCTION DATASET VERIFICATION COUNTS ======");
  console.table(counts);

  const outputPath = path.join("/Users/ansysn/Desktop/MindCare", "db_seed_counts.json");
  fs.writeFileSync(outputPath, JSON.stringify(counts, null, 2));
  console.log(`Saved verified count report to ${outputPath}`);
}

export async function runMasterSeeder() {
  try {
    console.log("Master seeder initialized. Running generators sequentially in dependency-safe order...");

    // Stage 1: Core Configuration and Master lists
    await generateMasterReferences();
    // System settings and Billing plans are handled in main seed.ts or here. We keep them here too.
    const settingsCount = await SystemSettings.countDocuments();
    if (settingsCount === 0) {
      await SystemSettings.create({
        companionCommissionRate: 0.20,
        therapistCommissionRate: 0.15,
        freeTrialMinutes: 5,
        allowAnonymousSessions: true,
        maintenanceMode: false,
        emergencyHotline: "112"
      });
    }

    const plansCount = await BillingPlan.countDocuments();
    if (plansCount === 0) {
      console.log("Seeding BillingPlans...");
      await BillingPlan.create([
        {
          name: "Free", price: 0, period: "forever",
          description: "Suitable for new users.",
          color: "bg-slate-50 border-slate-200", buttonClass: "bg-slate-100 text-slate-700 hover:bg-slate-200",
          features: ["AI Chat (Limited daily messages)", "Daily Mood Tracking", "Journal Writing", "Basic Wellness Insights", "Community Resources", "Emergency Crisis Detection", "AI Risk Monitoring"],
          popular: false, active: true, sortOrder: 0
        },
        {
          name: "Essential", price: 299, period: "month",
          description: "Everything in Free +",
          color: "bg-blue-50/40 border-blue-300", buttonClass: "bg-blue-600 text-white hover:bg-blue-700",
          features: ["Everything in Free", "Unlimited AI Chat", "Advanced Mood Analytics", "Guided Meditation", "Journal Analytics", "Priority AI Responses"],
          popular: false, active: true, sortOrder: 1
        },
        {
          name: "Premium", price: 699, period: "month",
          description: "Everything in Essential +",
          color: "bg-emerald-50/50 border-emerald-300", buttonClass: "bg-emerald-600 text-white hover:bg-emerald-700",
          features: ["Everything in Essential", "Unlimited AI", "Voice Conversations", "Video Sessions", "Priority Therapist Support", "Weekly Mental Health Reports", "Family Sharing"],
          popular: true, active: true, sortOrder: 2
        },
        {
          name: "Professional", price: 1499, period: "month",
          description: "Everything in Premium +",
          color: "bg-violet-50/40 border-violet-300", buttonClass: "bg-violet-600 text-white hover:bg-violet-700",
          features: ["Everything in Premium", "Unlimited Therapist Chat", "Priority Emergency Support", "Dedicated Wellness Coach", "Advanced AI Monitoring", "Unlimited Reports", "Priority Crisis Escalation"],
          popular: false, active: true, sortOrder: 3
        }
      ]);
      console.log("✓ Billing plans seeded successfully.");
    }

    const milestoneCount = await CompanionMilestone.countDocuments();
    if (milestoneCount === 0) {
      await CompanionMilestone.create([
        { name: "New Companion", minHours: 0, maxHours: 100, ratePerMinute: 2 },
        { name: "Helpful Listener", minHours: 100, maxHours: 500, ratePerMinute: 3 },
        { name: "Trusted Companion", minHours: 500, maxHours: 1000, ratePerMinute: 4.5 },
        { name: "Senior Companion", minHours: 1000, maxHours: 1500, ratePerMinute: 6 },
        { name: "Expert Companion", minHours: 1500, maxHours: 2500, ratePerMinute: 8 }
      ]);
    }

    // Resources (at least 75)
    const resourceCount = await Resource.countDocuments();
    if (resourceCount < 75) {
      const needed = 75 - resourceCount;
      console.log(`Seeding ${needed} Resources to reach target 75...`);
      const resourceTypes = ["video", "article", "audio", "exercise"];
      const resourceCategories = ["Videos", "Articles", "Audio", "Exercises"];
      const resourceTags = ["Meditation", "Journaling", "Mindfulness", "CBT", "Sleep", "Self-care", "Stress"];
      
      const ACTIVE_UNSPLASH_URLS = [
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1508672019048-805c876b67e2?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1528715471579-d1bcf0ba5e83?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&q=80&w=400"
      ];
      
      const newResources = [];
      for (let i = 0; i < needed; i++) {
        const typeIndex = i % resourceTypes.length;
        const tag = resourceTags[i % resourceTags.length];
        newResources.push({
          type: resourceTypes[typeIndex],
          category: resourceCategories[typeIndex],
          image: ACTIVE_UNSPLASH_URLS[i % ACTIVE_UNSPLASH_URLS.length],
          tag: tag,
          title: `Production Guide to ${tag} - Section ${i + 1}`,
          meta: typeIndex === 1 ? "6 min read" : typeIndex === 2 ? "10 min listen" : "8 min · Beginner",
          rating: 4.5 + (i % 6) * 0.1,
          featured: i % 4 === 0
        });
      }
      await Resource.insertMany(newResources);
    }

    // Stage 2: Users and listings
    await generateUsers(100, 25, 3);
    await generateTherapists(25);

    // Stage 3: Clinical logs & User records
    await generateMoods(800);
    await generateJournals(600);
    await generateChats(2000);
    await generateAppointments(300);

    // Stage 4: Companion & session interactions
    await generateCompanion(500, 150);

    // Stage 5: Financial logs
    await generatePayments(600);
    await generateWallet(800); // Seeding 800 wallet transactions + balances sync

    // Stage 6: Administrative and safety checks
    await generateNotifications(1200);
    await generateReports(300);
    await generateEmergency(120, 120, 50, 120); // 120 alerts, 120 cases, 50 sessions, 120 notifs
    await generateAuditLogs(1000);
    await generateRiskAssessments(700);
    await generateWeeklyAssessments(600);
    await generateFavorites(400);
    await generateBlockedUsers(50);

    // Seed Mood Analytics timelines for all user clients
    console.log("Seeding Mood Analytics timelines for users...");
    const { User } = await import("../models/User.ts");
    const { MoodAnalyticsEngine } = await import("../services/moodAnalyticsEngine.ts");
    const clients = await User.find({ role: "user" });
    for (const client of clients) {
      await MoodAnalyticsEngine.seedMoodHistory(client._id);
    }

    console.log("Master dataset seeding process completed successfully!");
    await verifyAllCounts();
  } catch (error) {
    console.error("Master Seeder execution crash:", error);
  }
}
