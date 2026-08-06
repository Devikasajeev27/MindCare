import { User } from "../../models/User.ts";
import { RiskAssessment } from "../../models/RiskAssessment.ts";

export async function generateRiskAssessments(targetCount = 700) {
  console.log("Checking Risk Assessments collection...");
  const clients = await User.find({ role: "user", verifiedCompanion: false });
  
  if (clients.length === 0) {
    console.log("No client users found. Skipping risk assessments.");
    return;
  }

  const existingCount = await RiskAssessment.countDocuments();

  if (existingCount >= targetCount) {
    console.log(`Risk Assessments collection satisfies target count (${existingCount}/${targetCount}).`);
    return;
  }

  const existingRiskUserIds = new Set(
    (await RiskAssessment.find({}, "userId").lean()).map((risk: any) => risk.userId?.toString()).filter(Boolean)
  );
  const availableClients = clients.filter((client: any) => !existingRiskUserIds.has(client._id.toString()));
  const needed = Math.min(targetCount - existingCount, availableClients.length);
  console.log(`Seeding ${needed} additional RiskAssessments...`);
  const assessments = [];
  
  const levels = ["low", "elevated", "high", "critical"];
  const signalTypes = ["sleep_crisis", "behavioral_pattern", "panic_expression", "repeated_crisis_signal"];
  const triggers = [
    "User mentioned chronic sleep disturbances and persistent low energy.",
    "Repeated clinical distress keyphrases identified in counselor conversation.",
    "Somatic anxiety markers flagged during onboarding survey screening.",
    "Anxiety rating index remains high for 7 consecutive days."
  ];

  for (let i = 0; i < needed; i++) {
    const client = availableClients[i];
    const confidenceScore = 25 + (i % 70);
    assessments.push({
      userId: client._id,
      confidenceScore,
      riskLevel: levels[i % levels.length],
      activeSignals: [{
        type: signalTypes[i % signalTypes.length],
        score: confidenceScore,
        detail: triggers[i % triggers.length],
        source: "manual",
      }],
      sources: ["ai_chat", "mood"],
      signalCountInWindow: 1 + (i % 4),
      lastAnalyzedAt: new Date(),
      createdAt: new Date(Date.now() - (i % 60) * 24 * 60 * 60 * 1000 - Math.random() * 8 * 60 * 60 * 1000)
    });
  }

  if (assessments.length > 0) {
    await RiskAssessment.insertMany(assessments);
  }

  console.log(`Seeding complete. RiskAssessments count: ${await RiskAssessment.countDocuments()}`);
}
