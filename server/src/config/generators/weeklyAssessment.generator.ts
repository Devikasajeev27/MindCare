import { User } from "../../models/User.ts";
import { WeeklyAssessment } from "../../models/WeeklyAssessment.ts";

export async function generateWeeklyAssessments(targetCount = 600) {
  console.log("Checking Weekly Assessments collection...");
  const companions = await User.find({ verifiedCompanion: true });
  const existingCount = await WeeklyAssessment.countDocuments();

  if (existingCount >= targetCount) {
    console.log(`Weekly Assessments collection satisfies target count (${existingCount}/${targetCount}).`);
    return;
  }

  if (companions.length === 0) {
    console.log("No companion users found! Skipping weekly assessments.");
    return;
  }

  const assessments = [];
  const adjustmentTiers = ["retained", "increased", "decreased"];

  // Enforce at least 5 weekly assessments per active companion
  for (const companion of companions) {
    const companionNotifs = await WeeklyAssessment.countDocuments({ userId: companion._id });
    const needed = Math.max(0, 5 - companionNotifs);

    for (let j = 0; j < needed; j++) {
      assessments.push({
        userId: companion._id,
        sessionsCompleted: 4 + j * 2,
        avgRating: 4.2 + (j % 9) * 0.1,
        responseRate: 90 + (j % 11),
        reportsReceived: j % 6 === 0 ? 1 : 0,
        earningTierAdjusted: adjustmentTiers[j % adjustmentTiers.length],
        assessmentDate: new Date(Date.now() - j * 7 * 24 * 60 * 60 * 1000 - Math.random() * 8 * 60 * 60 * 1000)
      });
    }
  }

  if (assessments.length > 0) {
    await WeeklyAssessment.insertMany(assessments);
  }

  // Pad to reach 600
  let currentCount = await WeeklyAssessment.countDocuments();
  if (currentCount < targetCount) {
    const padNeeded = targetCount - currentCount;
    console.log(`Padding WeeklyAssessments with ${padNeeded} logs...`);
    const padPayloads = [];
    for (let i = 0; i < padNeeded; i++) {
      const companion = companions[i % companions.length];
      padPayloads.push({
        userId: companion._id,
        sessionsCompleted: 5 + (i % 10),
        avgRating: 4.4 + (i % 7) * 0.1,
        responseRate: 94 + (i % 7),
        reportsReceived: i % 8 === 0 ? 1 : 0,
        earningTierAdjusted: adjustmentTiers[i % adjustmentTiers.length],
        assessmentDate: new Date(Date.now() - (5 + i % 30) * 7 * 24 * 60 * 60 * 1000)
      });
    }
    await WeeklyAssessment.insertMany(padPayloads);
  }

  console.log(`Seeding complete. Weekly assessments count: ${await WeeklyAssessment.countDocuments()}`);
}
