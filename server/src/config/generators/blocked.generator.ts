import { User } from "../../models/User.ts";
import { BlockedUsers } from "../../models/BlockedUsers.ts";

export async function generateBlockedUsers(targetCount = 50) {
  console.log("Checking BlockedUsers collection...");
  const clients = await User.find({ role: "user", verifiedCompanion: false });
  const companions = await User.find({ verifiedCompanion: true });

  if (clients.length === 0 || companions.length === 0) {
    console.log("No clients or companions found. Skipping blocked users generation.");
    return;
  }

  const existingCount = await BlockedUsers.countDocuments();
  if (existingCount >= targetCount) {
    console.log(`BlockedUsers collection satisfies target count (${existingCount}/${targetCount}).`);
    return;
  }

  const needed = targetCount - existingCount;
  console.log(`Seeding ${needed} additional BlockedUsers...`);
  const blocks: any[] = [];

  for (let i = 0; i < needed; i++) {
    const client = clients[i % clients.length];
    const target = companions[i % companions.length];

    const isBlocked = blocks.some(b => b.userId.toString() === client._id.toString() &&
                                       b.blockedUserId.toString() === target._id.toString());
    if (!isBlocked) {
      blocks.push({
        userId: client._id,
        blockedUserId: target._id,
        reason: "Repeated spam and inappropriate communication inside peer discussion rooms."
      });
    }
  }

  if (blocks.length > 0) {
    await BlockedUsers.insertMany(blocks);
  }

  console.log(`Seeding complete. BlockedUsers count: ${await BlockedUsers.countDocuments()}`);
}
