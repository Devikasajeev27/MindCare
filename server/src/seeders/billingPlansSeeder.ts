import { BillingPlan } from "../models/BillingPlan.ts";
import { SystemSettings } from "../models/SystemSettings.ts";
import { SeederResult } from "./types.ts";

export async function seedBillingPlans(targetCount = 20): Promise<SeederResult> {
  const existingCount = await BillingPlan.countDocuments();
  if (existingCount >= targetCount) {
    return { collectionName: "billingplans", modelName: "BillingPlan", existingCount, insertedCount: 0, finalCount: existingCount, status: "SKIPPED" };
  }

  const existingNames = new Set((await BillingPlan.find({}, { name: 1 })).map(p => p.name));
  const needed = targetCount - existingCount;

  const planTemplates = [
    "MindCare Premium Monthly", "MindCare Starter", "MindCare Enterprise Care", "CBT Intensive Care",
    "Student Mental Wellness", "Family Support Bundle", "Senior Care Plan", "Corporate Wellness Pro",
    "Executive Resilience Tier", "Mindfulness Plus", "Sleep Science Care", "Anxiety Management Pro",
    "Youth Support Tier", "Holistic Health Annual", "Group Therapy Bundle", "Post-Trauma Care",
    "Stress Relief Starter", "Burnout Recovery Plan", "Clinical CBT Pass", "Unlimited MindCare Access"
  ];

  const docsToInsert = [];
  for (let i = existingCount; i < targetCount; i++) {
    const name = planTemplates[i % planTemplates.length];
    const uniqueName = existingNames.has(name) ? `${name} Tier ${i + 1}` : name;
    existingNames.add(uniqueName);

    docsToInsert.push({
      name: uniqueName,
      price: 299 + i * 100,
      period: i % 2 === 0 ? "month" : "year",
      color: i % 3 === 0 ? "bg-primary" : i % 3 === 1 ? "bg-blue-600" : "bg-emerald-600",
      buttonClass: "bg-primary text-white",
      features: [
        "Unlimited AI Companion Voice & Text Chats",
        "2 Monthly Licensed Therapist Consultations",
        "24/7 Priority Peer Companion Matching",
        "Advanced Mood & Emotion Analytics Reports",
        "Emergency SOS Dispatch & DISHA Helpline Access"
      ],
      popular: i === 0,
      active: true,
      sortOrder: i + 1,
    });
  }

  if (docsToInsert.length > 0) {
    await BillingPlan.insertMany(docsToInsert);
  }

  const finalCount = await BillingPlan.countDocuments();
  return { collectionName: "billingplans", modelName: "BillingPlan", existingCount, insertedCount: docsToInsert.length, finalCount, status: "VERIFIED" };
}

export async function seedSystemSettings(): Promise<SeederResult> {
  const existingCount = await SystemSettings.countDocuments();
  if (existingCount >= 1) {
    return { collectionName: "systemsettings", modelName: "SystemSettings", existingCount, insertedCount: 0, finalCount: existingCount, status: "SKIPPED" };
  }

  await SystemSettings.create({
    companionCommissionRate: 0.20,
    therapistCommissionRate: 0.15,
    freeTrialMinutes: 10,
    allowAnonymousSessions: true,
    maintenanceMode: false,
    emergencyHotline: "1056 (DISHA Kerala Mental Health Helpline)",
  });

  const finalCount = await SystemSettings.countDocuments();
  return { collectionName: "systemsettings", modelName: "SystemSettings", existingCount: 0, insertedCount: 1, finalCount, status: "VERIFIED" };
}
