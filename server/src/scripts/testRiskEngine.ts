/**
 * MindCare Crisis System Testing Script
 *
 * Simulates multiple user inputs to test the multi-factor scoring mechanism,
 * false positive reduction, and emergency workflow execution.
 *
 * Run via terminal:
 *   npx tsx server/src/scripts/testRiskEngine.ts
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { User } from "../models/User.ts";
import { EmergencyContact } from "../models/EmergencyContact.ts";
import { RiskAssessment } from "../models/RiskAssessment.ts";
import { EmergencyEvent } from "../models/EmergencyEvent.ts";
import { MentalHealthRiskEngine } from "../services/riskEngine.ts";

// Load configuration
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27018/mindcare";

async function runTests() {
  console.log("====================================================");
  console.log("🧠 MINDCARE CRISIS ENGINE INTEGRATION TESTING TOOL");
  console.log("====================================================");

  try {
    console.log(`Connecting to database: ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected successfully.\n");

    // 1. Create a dummy test user
    console.log("Step 1: Creating a test user profile...");
    const testEmail = `crisis_tester_${Date.now()}@example.com`;
    const user = await User.create({
      name: "Sam Crisis Tester",
      email: testEmail,
      password: "password123",
      role: "user",
      wellnessScore: 70,
      emergencyContact: {
        name: "Embedded Family Friend",
        phone: "+919876543210",
        relation: "Friend"
      }
    });
    console.log(`Test user registered. ID: ${user._id} | Email: ${testEmail}`);

    // Create a real EmergencyContact database entry for the user
    const contact = await EmergencyContact.create({
      userId: user._id,
      name: "Guardian Contact",
      relationship: "Parent",
      countryCode: "+91",
      phone: "9999888877",
      email: "guardian@example.com",
      priority: 1
    });
    console.log(`Emergency Contact document mapped in DB. ID: ${contact._id}\n`);

    // Ensure clean risk state
    await RiskAssessment.deleteMany({ userId: user._id });
    await EmergencyEvent.deleteMany({ userId: user._id });

    // ─── Scenario A: False Positive Mitigation ───
    console.log("================ Scenarios A: False Positive Check ================");
    console.log("Test: User discusses normal daily stress factors (academic/work).");
    console.log("Engine should increase score slightly but NOT trigger emergency.");

    const stressMsg = "I am so overwhelmed with this final year project coding. I can't sleep and feel like giving up on my studies.";
    console.log(`User says: "${stressMsg}"`);
    let result = await MentalHealthRiskEngine.analyzeMessage(user._id.toString(), stressMsg, "ai_chat");
    
    console.log(`-> Signals Added: ${JSON.stringify(result.signals.map(s => s.type))}`);
    console.log(`-> Current Confidence Score: ${result.totalScore}/100`);
    console.log(`-> Risk Level: ${result.riskLevel}`);
    console.log(`-> Emergency Triggered: ${result.shouldTriggerEmergency ? "❌ FAILED (should not trigger)" : "✅ PASSED"}`);
    console.log("------------------------------------------------------------------");

    // ─── Scenario B: Multi-Factor Escalation ───
    console.log("================ Scenarios B: Multi-Factor Distress ================");
    console.log("Test: User continues expressing social isolation and hopelessness.");
    console.log("Engine should aggregate signals and elevate score closer to limit.");

    const isolateMsg = "I feel completely alone. Nobody cares about me. It's pointless to even try anymore.";
    console.log(`User says: "${isolateMsg}"`);
    result = await MentalHealthRiskEngine.analyzeMessage(user._id.toString(), isolateMsg, "ai_chat");

    console.log(`-> Signals Added: ${JSON.stringify(result.signals.map(s => s.type))}`);
    console.log(`-> Current Confidence Score: ${result.totalScore}/100`);
    console.log(`-> Risk Level: ${result.riskLevel}`);
    console.log(`-> Emergency Triggered: ${result.shouldTriggerEmergency ? "❌ FAILED (should not trigger yet)" : "✅ PASSED"}`);
    console.log("------------------------------------------------------------------");

    // ─── Scenario C: Threshold Breach & Verification ───
    console.log("================ Scenarios C: Severe Crisis Trigger ================");
    console.log("Test: User sends high-confidence critical signal.");
    console.log("Engine must trigger emergency workflow automatically.");

    const criticalMsg = "I want to end my life. I can't do this anymore. I'm going to take all my pills.";
    console.log(`User says: "${criticalMsg}"`);
    result = await MentalHealthRiskEngine.analyzeMessage(user._id.toString(), criticalMsg, "ai_chat");

    console.log(`-> Signals Added: ${JSON.stringify(result.signals.map(s => s.type))}`);
    console.log(`-> Current Confidence Score: ${result.totalScore}/100`);
    console.log(`-> Risk Level: ${result.riskLevel}`);
    console.log(`-> Emergency Triggered: ${result.shouldTriggerEmergency ? "✅ PASSED" : "❌ FAILED (should trigger)"}`);

    // Wait a brief moment to allow async background workflow tasks to write to database
    console.log("\nWaiting for async database tasks to compile...");
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Verify EmergencyEvent audit logs
    const event = await EmergencyEvent.findOne({ userId: user._id });
    if (event) {
      console.log("\n================ Emergency Event Log Verified ================");
      console.log(`Event ID: ${event._id}`);
      console.log(`Trigger Source: ${event.triggerSource}`);
      console.log(`Distress Level: ${event.confidenceScore}/100`);
      console.log(`Active Signals: ${event.riskFactors.map(f => f.type).join(", ")}`);
      console.log(`Contact Notified: ${contact.name} (${contact.phone})`);
      console.log(`Alert Channels Sent: ${JSON.stringify(event.alertsSent.map(a => `${a.channel}: ${a.status}`))}`);
      console.log(`Assigned Therapist: ${event.assignedTherapistName || "Sarah Jenkins (Mock)"}`);
      console.log("✅ Audit Trail Verification Successful.");
    } else {
      console.log("❌ Error: EmergencyEvent document not found in database.");
    }

    // Clean up test data
    console.log("\nCleaning up test logs...");
    await User.findByIdAndDelete(user._id);
    await EmergencyContact.findByIdAndDelete(contact._id);
    await RiskAssessment.deleteMany({ userId: user._id });
    await EmergencyEvent.deleteMany({ userId: user._id });
    console.log("Cleanup complete.");

  } catch (err: any) {
    console.error("Test execution failed with error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("\nTesting complete. Mongoose disconnected.");
  }
}

runTests();
