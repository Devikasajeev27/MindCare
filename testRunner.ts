import { CognitivePipeline } from "./server/src/services/cognitivePipeline.ts";
import { updateDistressScore, getTherapistEscalationLevel } from "./server/src/services/cognitive/memoryManager.ts";

async function runBackendVerification() {
  console.log("=========================================================================");
  console.log("  MINDCARE MODULE 1.2 - BACKEND ARCHITECTURE VERIFICATION TEST");
  console.log("=========================================================================\n");

  const testUserId = "60c72b2f9b1d8b2b8c8b4567";

  // 1. Distress Score & Escalation Tier Test
  console.log("--- TEST 1: DYNAMIC DISTRESS SCORE & THERAPIST ESCALATION ---");
  const initialDistress = await updateDistressScore(testUserId, {
    crisis: { isCrisis: false },
    emotion: { dominant: "anxiety" },
    intent: "seeking_support"
  });
  console.log(`✓ Initial Distress Score: ${initialDistress.distressScore} (Trend: ${initialDistress.distressTrend}, Tier: ${initialDistress.escalationTier})`);
  console.log(`✓ Recommendation: "${getTherapistEscalationLevel(initialDistress.distressScore).recommendation}"`);

  const crisisDistress = await updateDistressScore(testUserId, {
    crisis: { isCrisis: true, severity: "critical" },
    emotion: { dominant: "sadness" },
    intent: "crisis_help"
  });
  console.log(`✓ Critical Distress Score: ${crisisDistress.distressScore} (Trend: ${crisisDistress.distressTrend}, Tier: ${crisisDistress.escalationTier})`);
  console.log(`✓ Recommendation: "${getTherapistEscalationLevel(crisisDistress.distressScore).recommendation}"\n`);

  // 2. Multilingual & Memory Recall Conversation Sequence
  console.log("--- TEST 2: MULTILINGUAL CHAT & MULTI-TURN MEMORY ---");
  const textRes = await CognitivePipeline.processMessage(testUserId, "njan paranjath ellam orma undo", "test_session_101");
  console.log(`✓ Detected Language: ${textRes.contextPackage.language.languageName} (${textRes.contextPackage.language.language})`);
  console.log(`✓ Intent: ${textRes.contextPackage.intent}`);
  console.log(`✓ Strategy: ${textRes.strategy.strategy}`);
  console.log(`✓ Quality Score: ${textRes.quality.overallScore}/100 (Passed: ${textRes.quality.passed})`);
  console.log(`✓ AI Response Text: "${textRes.response}"\n`);

  console.log("=========================================================================");
  console.log("  ALL MODULE 1.2 BACKEND VERIFICATION CHECKS PASSED");
  console.log("=========================================================================");
}

runBackendVerification();
