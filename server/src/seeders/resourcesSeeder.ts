import { Resource } from "../models/Resource.ts";
import { AuditLog } from "../models/AuditLog.ts";
import { EmergencyAlert } from "../models/EmergencyAlert.ts";
import { EmergencyCase } from "../models/EmergencyCase.ts";
import { EmergencyContact } from "../models/EmergencyContact.ts";
import { EmergencyEvent } from "../models/EmergencyEvent.ts";
import { EmergencyNotification } from "../models/EmergencyNotification.ts";
import { EmergencySession } from "../models/EmergencySession.ts";
import { CompanionSession } from "../models/CompanionSession.ts";
import { CompanionEarnings } from "../models/CompanionEarnings.ts";
import { CompanionMatching } from "../models/CompanionMatching.ts";
import { CompanionMilestone } from "../models/CompanionMilestone.ts";
import { User } from "../models/User.ts";
import { SeederResult } from "./types.ts";

export async function seedResources(targetCount = 20): Promise<SeederResult> {
  const existingCount = await Resource.countDocuments();
  if (existingCount >= targetCount) {
    return { collectionName: "resources", modelName: "Resource", existingCount, insertedCount: 0, finalCount: existingCount, status: "SKIPPED" };
  }

  const needed = targetCount - existingCount;
  const resourceTypes = ["video", "article", "audio", "exercise"];
  const resourceCategories = ["CBT & Stress", "Breathing", "Sleep Hygiene", "Meditation"];
  const tags = ["Mindfulness", "Breathing", "CBT", "Self-Care", "Sleep"];

  const ACTIVE_UNSPLASH_URLS = [
    "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=400",
    "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=400",
    "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&q=80&w=400",
    "https://images.unsplash.com/photo-1508672019048-805c876b67e2?auto=format&fit=crop&q=80&w=400"
  ];

  const docsToInsert = [];
  for (let i = existingCount; i < targetCount; i++) {
    docsToInsert.push({
      type: resourceTypes[i % resourceTypes.length],
      category: resourceCategories[i % resourceCategories.length],
      image: ACTIVE_UNSPLASH_URLS[i % ACTIVE_UNSPLASH_URLS.length],
      tag: tags[i % tags.length],
      title: `Kerala Mental Wellness & CBT Guide #${i + 1}`,
      meta: i % 2 === 0 ? "6 min read • Evidence-based CBT" : "4 min exercise • Interactive Audio Guide",
      rating: 4.8 + (i % 3) * 0.1,
      featured: i % 3 === 0,
      published: true
    });
  }

  if (docsToInsert.length > 0) {
    await Resource.insertMany(docsToInsert);
  }

  const finalCount = await Resource.countDocuments();
  return { collectionName: "resources", modelName: "Resource", existingCount, insertedCount: docsToInsert.length, finalCount, status: "VERIFIED" };
}

export async function seedAuditLogs(targetCount = 20): Promise<SeederResult> {
  const existingCount = await AuditLog.countDocuments();
  if (existingCount >= targetCount) {
    return { collectionName: "auditlogs", modelName: "AuditLog", existingCount, insertedCount: 0, finalCount: existingCount, status: "SKIPPED" };
  }

  const users = await User.find();
  const needed = targetCount - existingCount;

  const docsToInsert = [];
  for (let i = existingCount; i < targetCount; i++) {
    const user = users[i % users.length];
    const date = new Date(Date.now() - (targetCount - i) * 3600000 * 4);
    docsToInsert.push({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      role: user.role,
      action: i % 4 === 0 ? "LOGIN" : i % 4 === 1 ? "MOOD_LOGGED" : i % 4 === 2 ? "JOURNAL_CREATED" : "PAYMENT_SUCCESS",
      status: "success",
      ip: "122.174.192.10",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      details: `Successfully executed audit event #${i + 1} for user ${user.name}`,
      createdAt: date
    });
  }

  if (docsToInsert.length > 0) {
    await AuditLog.insertMany(docsToInsert);
  }

  const finalCount = await AuditLog.countDocuments();
  return { collectionName: "auditlogs", modelName: "AuditLog", existingCount, insertedCount: docsToInsert.length, finalCount, status: "VERIFIED" };
}

export async function seedEmergencySuite(targetCount = 20): Promise<SeederResult[]> {
  const users = await User.find();
  const adminUser = users.find(u => u.role === "admin") || users[0];
  const emergencyAssignees = users.filter(u => u.role === "therapist" || u.role === "admin");

  const results: SeederResult[] = [];

  // 1. Emergency Alerts
  const countAlerts = await EmergencyAlert.countDocuments();
  if (countAlerts < targetCount) {
    const docs = [];
    for (let i = countAlerts; i < targetCount; i++) {
      const u = users[i % users.length];
      docs.push({
        userId: u._id,
        userName: u.name,
        detectedTrigger: `Stress disclosure check-in #${i + 1}`,
        messageContent: "Seeking guidance to calm down during stressful situations.",
        riskLevel: i % 4 === 0 ? "high" : i % 4 === 1 ? "medium" : "low",
        confidenceScore: 80,
        source: "ai_chat",
        location: { lat: 9.9312 + i * 0.01, lng: 76.2673 + i * 0.01, mapsUrl: "https://maps.google.com/?q=9.9312,76.2673" },
        nearbyFacilities: [
          { name: "Aster Medcity Emergency Dept", type: "Multispecialty Hospital", distance: "3.2 km", phone: "+914846699999" },
          { name: "DISHA Kerala Helpline", type: "Government Helpline", distance: "Statewide", phone: "1056" }
        ],
        status: "resolved",
        resolvedBy: adminUser._id,
        resolutionNotes: "Dispatched DISHA contacts. Patient reassured.",
        respondedAt: new Date(),
        slaMinutes: 15,
        slaBreach: false
      });
    }
    await EmergencyAlert.insertMany(docs);
  }
  results.push({ collectionName: "emergencyalerts", modelName: "EmergencyAlert", existingCount: countAlerts, insertedCount: Math.max(0, targetCount - countAlerts), finalCount: await EmergencyAlert.countDocuments(), status: "VERIFIED" });

  // 2. Emergency Cases
  const countCases = await EmergencyCase.countDocuments();
  if (countCases < targetCount) {
    const docs = [];
    for (let i = countCases; i < targetCount; i++) {
      const u = users[i % users.length];
      const assignee = emergencyAssignees[i % emergencyAssignees.length] || adminUser;
      const isResolved = i % 3 === 0;
      docs.push({
        userId: u._id,
        therapistId: assignee._id,
        status: isResolved ? "resolved" : "active",
        riskScore: i % 2 === 0 ? "high" : "critical",
        assignedAt: new Date(Date.now() - i * 60 * 60 * 1000),
        resolvedAt: isResolved ? new Date() : undefined,
        resolutionNotes: isResolved ? `Clinical Crisis Case #${i + 1} stabilized and resolved.` : undefined,
      });
    }
    await EmergencyCase.insertMany(docs);
  }
  results.push({ collectionName: "emergencycases", modelName: "EmergencyCase", existingCount: countCases, insertedCount: Math.max(0, targetCount - countCases), finalCount: await EmergencyCase.countDocuments(), status: "VERIFIED" });

  // 3. Emergency Contacts
  const countContacts = await EmergencyContact.countDocuments();
  if (countContacts < targetCount) {
    const docs = [];
    for (let i = countContacts; i < targetCount; i++) {
      const u = users[i % users.length];
      docs.push({
        userId: u._id,
        name: `Kerala Emergency Contact ${i + 1}`,
        relationship: i % 2 === 0 ? "Parent" : "Spouse",
        countryCode: "+91",
        phone: `+919447${300000 + i}`,
        priority: (i % 3) + 1,
      });
    }
    await EmergencyContact.insertMany(docs);
  }
  results.push({ collectionName: "emergencycontacts", modelName: "EmergencyContact", existingCount: countContacts, insertedCount: Math.max(0, targetCount - countContacts), finalCount: await EmergencyContact.countDocuments(), status: "VERIFIED" });

  // 4. Emergency Events
  const countEvents = await EmergencyEvent.countDocuments();
  if (countEvents < targetCount) {
    const docs = [];
    for (let i = countEvents; i < targetCount; i++) {
      const u = users[i % users.length];
      docs.push({
        userId: u._id,
        userName: u.name,
        userEmail: u.email,
        userPhone: u.phone,
        triggerSource: "manual",
        triggerText: `SOS event trigger recorded #${i + 1}`,
        confidenceScore: 75,
        riskFactors: [{ type: "demo_seed", score: 75, detail: "Seeded emergency workflow audit event", source: "seeder" }],
        workflowStatus: i % 3 === 0 ? "resolved" : "active",
        resolvedBy: i % 3 === 0 ? adminUser._id : undefined,
        resolvedAt: i % 3 === 0 ? new Date() : undefined,
        resolutionNotes: i % 3 === 0 ? "Seeded event resolved after clinical follow-up." : undefined,
      });
    }
    await EmergencyEvent.insertMany(docs);
  }
  results.push({ collectionName: "emergencyevents", modelName: "EmergencyEvent", existingCount: countEvents, insertedCount: Math.max(0, targetCount - countEvents), finalCount: await EmergencyEvent.countDocuments(), status: "VERIFIED" });

  // 5. Emergency Notifications
  const countNotifs = await EmergencyNotification.countDocuments();
  if (countNotifs < targetCount) {
    const docs = [];
    for (let i = countNotifs; i < targetCount; i++) {
      const u = users[i % users.length];
      docs.push({
        userId: u._id,
        title: `Emergency workflow update #${i + 1}`,
        message: "A seeded emergency workflow notification was generated for dashboard validation.",
        type: "emergency",
        read: i % 2 === 0,
      });
    }
    await EmergencyNotification.insertMany(docs);
  }
  results.push({ collectionName: "emergencynotifications", modelName: "EmergencyNotification", existingCount: countNotifs, insertedCount: Math.max(0, targetCount - countNotifs), finalCount: await EmergencyNotification.countDocuments(), status: "VERIFIED" });

  // 6. Emergency Sessions
  const countSessions = await EmergencySession.countDocuments();
  if (countSessions < targetCount) {
    const emergencyCases = await EmergencyCase.find().sort({ createdAt: -1 }).limit(targetCount);
    const docs = [];
    for (let i = countSessions; i < targetCount; i++) {
      const u = users[i % users.length];
      const assignee = emergencyAssignees[i % emergencyAssignees.length] || adminUser;
      const emergencyCase = emergencyCases[i % emergencyCases.length];
      if (!emergencyCase) continue;
      docs.push({
        userId: emergencyCase.userId || u._id,
        therapistId: emergencyCase.therapistId || assignee._id,
        emergencyCaseId: emergencyCase._id,
        price: 0,
        billingStatus: "Waived",
        sessionType: "Emergency Session",
      });
    }
    if (docs.length > 0) await EmergencySession.insertMany(docs);
  }
  results.push({ collectionName: "emergencysessions", modelName: "EmergencySession", existingCount: countSessions, insertedCount: Math.max(0, targetCount - countSessions), finalCount: await EmergencySession.countDocuments(), status: "VERIFIED" });

  return results;
}

export async function seedCompanionSuite(targetCount = 20): Promise<SeederResult[]> {
  const users = await User.find();
  const results: SeederResult[] = [];

  // 1. Companion Sessions
  const countSessions = await CompanionSession.countDocuments();
  if (countSessions < targetCount) {
    const docs = [];
    for (let i = countSessions; i < targetCount; i++) {
      const u1 = users[i % users.length];
      const u2 = users[(i + 1) % users.length];
      docs.push({
        userId: u1._id,
        companionId: u2._id,
        duration: 30,
        status: "completed",
        isFreeTierActive: false,
        paymentCompleted: true,
        userAlias: `KeralaSeeker#${100 + i}`,
        companionAlias: `KindSoul_${i + 1}`,
        createdAt: new Date(Date.now() - (targetCount - i) * 86400000)
      });
    }
    await CompanionSession.insertMany(docs);
  }
  results.push({ collectionName: "companionsessions", modelName: "CompanionSession", existingCount: countSessions, insertedCount: Math.max(0, targetCount - countSessions), finalCount: await CompanionSession.countDocuments(), status: "VERIFIED" });

  // 2. Companion Earnings
  const countEarnings = await CompanionEarnings.countDocuments();
  let insertedEarnings = 0;
  if (countEarnings < targetCount) {
    const existingEarningUserIds = new Set(
      (await CompanionEarnings.find({}, "userId").lean()).map((earning: any) => earning.userId?.toString()).filter(Boolean)
    );
    const earningUsers = users.filter((user: any) => !existingEarningUserIds.has(user._id.toString()));
    const docs = [];
    const needed = Math.min(targetCount - countEarnings, earningUsers.length);
    for (let i = 0; i < needed; i++) {
      const u = earningUsers[i];
      const ordinal = countEarnings + i;
      const totalHours = 10 + ordinal;
      docs.push({
        userId: u._id,
        totalMinutes: totalHours * 60,
        totalHours,
        weeklyActiveHours: 2 + (ordinal % 8),
        lifetimeHours: totalHours,
        totalEarnings: 450 + ordinal * 10,
        performanceScore: 90 + (ordinal % 10),
      });
    }
    if (docs.length > 0) {
      await CompanionEarnings.insertMany(docs);
      insertedEarnings = docs.length;
    }
  }
  results.push({ collectionName: "companionearnings", modelName: "CompanionEarnings", existingCount: countEarnings, insertedCount: insertedEarnings, finalCount: await CompanionEarnings.countDocuments(), status: "VERIFIED" });

  // 3. Companion Matching
  const countMatching = await CompanionMatching.countDocuments();
  let insertedMatching = 0;
  if (countMatching < targetCount) {
    const existingMatchingUserIds = new Set(
      (await CompanionMatching.find({}, "userId").lean()).map((matching: any) => matching.userId?.toString()).filter(Boolean)
    );
    const matchingUsers = users.filter((user: any) => !existingMatchingUserIds.has(user._id.toString()));
    const docs = [];
    const needed = Math.min(targetCount - countMatching, matchingUsers.length);
    for (let i = 0; i < needed; i++) {
      const u1 = matchingUsers[i];
      docs.push({ userId: u1._id, isAvailable: i % 2 === 0 });
    }
    if (docs.length > 0) {
      await CompanionMatching.insertMany(docs);
      insertedMatching = docs.length;
    }
  }
  results.push({ collectionName: "companionmatchings", modelName: "CompanionMatching", existingCount: countMatching, insertedCount: insertedMatching, finalCount: await CompanionMatching.countDocuments(), status: "VERIFIED" });

  // 4. Companion Milestones
  const countMilestones = await CompanionMilestone.countDocuments();
  if (countMilestones < targetCount) {
    const docs = [];
    for (let i = countMilestones; i < targetCount; i++) {
      docs.push({ name: `Companion Milestone Tier ${i + 1}`, minHours: i * 50, maxHours: (i + 1) * 50, ratePerMinute: 2 + i * 0.5 });
    }
    await CompanionMilestone.insertMany(docs);
  }
  results.push({ collectionName: "companionmilestones", modelName: "CompanionMilestone", existingCount: countMilestones, insertedCount: Math.max(0, targetCount - countMilestones), finalCount: await CompanionMilestone.countDocuments(), status: "VERIFIED" });

  return results;
}
