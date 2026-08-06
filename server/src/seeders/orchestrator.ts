import mongoose from "mongoose";
import { seedSystemSettings, seedBillingPlans } from "./billingPlansSeeder.ts";
import { seedUsers } from "./usersSeeder.ts";
import { seedTherapists } from "./therapistsSeeder.ts";
import { seedAiCompanionProfiles } from "./aiCompanionSeeder.ts";
import { seedAppointments } from "./appointmentsSeeder.ts";
import { seedJournals, seedMoods, seedNotifications, seedPayments, seedChats } from "./journalsSeeder.ts";
import { seedResources, seedAuditLogs, seedEmergencySuite, seedCompanionSuite } from "./resourcesSeeder.ts";
import { seedMiscCollections } from "./miscSeeders.ts";
import { SeederResult } from "./types.ts";

export async function runEnterpriseSeederV2(): Promise<SeederResult[]> {
  console.log("==========================================================================");
  console.log("   🚀 MINDCARE ENTERPRISE SEEDER V2 (MODULAR, IDEMPOTENT, PORT 27017)");
  console.log("==========================================================================");

  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mindcare";
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`✓ Connected to MongoDB at ${mongoUri}`);
  }

  const results: SeederResult[] = [];

  try {
    // Stage 1: Base Configuration & Subscriptions
    results.push(await seedSystemSettings());
    results.push(await seedBillingPlans(20));

    // Stage 2: Users & Core Profiles
    results.push(await seedUsers(25));
    results.push(await seedTherapists(20));
    results.push(await seedAiCompanionProfiles(20));

    // Stage 3: Clinical & Patient Records
    results.push(await seedAppointments(20));
    results.push(await seedJournals(20));
    results.push(await seedMoods(20));
    results.push(await seedNotifications(20));
    results.push(await seedPayments(20));
    results.push(await seedChats(20));

    // Stage 4: Resources, Audit Logs, Emergency & Companion Suites
    results.push(await seedResources(20));
    results.push(await seedAuditLogs(20));

    const emergencyRes = await seedEmergencySuite(20);
    results.push(...emergencyRes);

    const companionRes = await seedCompanionSuite(20);
    results.push(...companionRes);

    // Stage 5: Remaining Collections
    const miscRes = await seedMiscCollections(20);
    results.push(...miscRes);

    console.log("==========================================================================");
    console.log("   ✅ SUCCESS: ENTERPRISE SEEDER V2 COMPLETED ALL 34 COLLECTIONS!");
    console.log("==========================================================================");
    console.table(results);

  } catch (error) {
    console.error("❌ Seeder Orchestrator Error:", error);
    throw error;
  }

  return results;
}
