import { User } from "../../models/User.ts";
import { CompanionSession } from "../../models/CompanionSession.ts";
import { CompanionEarnings } from "../../models/CompanionEarnings.ts";
import { CompanionMatching } from "../../models/CompanionMatching.ts";

export async function generateCompanion(
  targetSessions = 500,
  targetMatching = 150
) {
  console.log("Checking Companion collections...");
  const clients = await User.find({ role: "user", verifiedCompanion: false });
  const companions = await User.find({ verifiedCompanion: true });

  if (clients.length === 0 || companions.length === 0) {
    console.log("No clients or companions found! Skipping companion seeding.");
    return;
  }

  // 1. Generate Companion Sessions
  const existingSessionCount = await CompanionSession.countDocuments();
  let sessions = [];
  if (existingSessionCount < targetSessions) {
    const needed = targetSessions - existingSessionCount;
    console.log(`Seeding ${needed} Companion Sessions...`);
    const newSessions = [];
    const durations = [5, 10, 15, 25, 40, 60];
    const feedbacks = [
      "Very calm listener. Thank you for your support.",
      "Felt heard and understood. Grounding conversation.",
      "Comforting chat, helped ease my evening anxieties.",
      "Highly professional listener, shared useful breathing tips."
    ];

    for (let i = 0; i < needed; i++) {
      const client = clients[i % clients.length];
      const companion = companions[i % companions.length];
      const isCompleted = i > 2;

      newSessions.push({
        userId: client._id,
        companionId: companion._id,
        duration: durations[i % durations.length],
        status: isCompleted ? "completed" : "active",
        isFreeTierActive: i % 3 === 0,
        paymentCompleted: i % 3 !== 0,
        userAlias: `AnonymousUser_${100 + i}`,
        companionAlias: companion.name,
        rating: isCompleted ? 4 + (i % 2) : undefined,
        feedback: isCompleted ? feedbacks[i % feedbacks.length] : undefined,
        createdAt: new Date(Date.now() - (i % 60) * 24 * 60 * 60 * 1000)
      });
    }
    sessions = await CompanionSession.insertMany(newSessions);
  } else {
    sessions = await CompanionSession.find({});
  }

  // 2. Generate Companion Earnings (every verified companion)
  console.log("Generating CompanionEarnings...");
  for (const companion of companions) {
    const matchingSessions = sessions.filter(s => s.companionId.toString() === companion._id.toString());
    const totalMins = matchingSessions.reduce((acc, curr) => acc + curr.duration, 0);
    const totalHours = Math.floor(totalMins / 60);

    const rate = 3; // INR/min
    const earnings = totalMins * rate;
    const platformComm = Math.floor(earnings * 0.20);
    const netEarnings = earnings - platformComm;

    await CompanionEarnings.findOneAndUpdate(
      { userId: companion._id },
      {
        userId: companion._id,
        totalMinutes: totalMins,
        totalHours: totalHours,
        weeklyActiveHours: Math.min(6, totalHours),
        lifetimeHours: totalHours,
        totalEarnings: netEarnings,
        performanceScore: 94 + (totalHours % 6)
      },
      { upsert: true, new: true }
    );
  }

  // 3. Generate CompanionMatching queue (Minimum 150 logs)
  const existingMatchingCount = await CompanionMatching.countDocuments();
  if (existingMatchingCount < targetMatching) {
    const needed = targetMatching - existingMatchingCount;
    console.log(`Seeding ${needed} CompanionMatching queue logs...`);
    const queue = [];

    // Ensure we do not insert duplicate userIds (unique index constraint on userId)
    const existingMatchingUserIds = new Set(
      (await CompanionMatching.find({}, "userId").lean()).map((matching: any) => matching.userId?.toString()).filter(Boolean)
    );
    const unmatchedClients = clients.filter((client: any) => !existingMatchingUserIds.has(client._id.toString()));
    const limit = Math.min(needed, unmatchedClients.length);
    for (let i = 0; i < limit; i++) {
      const client = unmatchedClients[i];
      const session = sessions[i % sessions.length];
      queue.push({
        userId: client._id,
        isAvailable: i % 3 !== 0,
        matchedSessionId: i % 3 === 0 && session ? session._id : undefined
      });
    }
    if (queue.length > 0) {
      await CompanionMatching.insertMany(queue);
    }
  }

  console.log("Companion seeding complete.");
}
