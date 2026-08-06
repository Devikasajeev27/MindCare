import { User } from "../../models/User.ts";
import { Reports } from "../../models/Reports.ts";

export async function generateReports(targetCount = 300) {
  console.log("Checking Reports collection...");
  const clients = await User.find({ role: "user", verifiedCompanion: false });
  const companions = await User.find({ verifiedCompanion: true });

  if (clients.length === 0 || companions.length === 0) {
    console.log("No clients or companions found. Skipping reports generation.");
    return;
  }

  const existingCount = await Reports.countDocuments();

  if (existingCount >= targetCount) {
    console.log(`Reports collection satisfies target count (${existingCount}/${targetCount}).`);
    return;
  }

  const needed = targetCount - existingCount;
  console.log(`Seeding ${needed} additional Reports logs...`);
  const reportsPayload = [];

  const reasons = [
    "Used inappropriate and offensive language during the companion discussion room session.",
    "Bypassing room protocols to share spam external advertising link blocks.",
    "Repeated clinical distress indicators detected by safety filters.",
    "Disruptive behavior during group audio session, refusing to let others speak."
  ];

  const actions = ["pending", "reviewed", "suspended", "warned"];

  for (let i = 0; i < needed; i++) {
    const reporter = clients[i % clients.length];
    const reported = companions[i % companions.length];

    reportsPayload.push({
      reporterId: reporter._id,
      reportedId: reported._id,
      reason: reasons[i % reasons.length],
      evidence: "Saved transcript screenshots from active session log indexes.",
      actionTaken: actions[i % actions.length],
      createdAt: new Date(Date.now() - (i % 45) * 24 * 60 * 60 * 1000 - Math.random() * 8 * 60 * 60 * 1000)
    });
  }

  if (reportsPayload.length > 0) {
    await Reports.insertMany(reportsPayload);
  }

  console.log(`Seeding complete. Reports count: ${await Reports.countDocuments()}`);
}
