import { User } from "../../models/User.ts";
import { Mood } from "../../models/Mood.ts";
import { MOODS_LIST } from "./constants.ts";

export async function generateMoods(targetCount = 800) {
  console.log("Checking Moods collection...");
  const clients = await User.find({ role: "user", verifiedCompanion: false });
  
  if (clients.length === 0) {
    console.log("No client users found. Skipping moods generation.");
    return;
  }

  const existingCount = await Mood.countDocuments();
  if (existingCount >= targetCount) {
    console.log(`Moods collection satisfies target count (${existingCount}/${targetCount}).`);
    return;
  }

  console.log("Generating Mood logs...");
  const payloads = [];

  // Enforce 5-15 moods for every client user
  for (const client of clients) {
    const existingUserMoods = await Mood.countDocuments({ userId: client._id });
    const targetForUser = 6 + (Math.floor(client._id.getTimestamp().getTime()) % 10); // 6 to 15
    const neededForUser = Math.max(0, targetForUser - existingUserMoods);

    for (let j = 0; j < neededForUser; j++) {
      const moodPattern = MOODS_LIST[j % MOODS_LIST.length];
      payloads.push({
        userId: client._id,
        rating: moodPattern.rating,
        note: moodPattern.note,
        date: new Date(Date.now() - j * 24 * 60 * 60 * 1000 - Math.random() * 12 * 60 * 60 * 1000)
      });
    }
  }

  // Insert client moods first
  if (payloads.length > 0) {
    await Mood.insertMany(payloads);
  }

  // Pad to reach 800
  let currentCount = await Mood.countDocuments();
  if (currentCount < targetCount) {
    const needed = targetCount - currentCount;
    console.log(`Padding Moods collection with ${needed} logs...`);
    const padPayloads = [];
    for (let i = 0; i < needed; i++) {
      const client = clients[i % clients.length];
      const moodPattern = MOODS_LIST[i % MOODS_LIST.length];
      padPayloads.push({
        userId: client._id,
        rating: moodPattern.rating,
        note: moodPattern.note,
        date: new Date(Date.now() - (15 + i % 90) * 24 * 60 * 60 * 1000)
      });
    }
    await Mood.insertMany(padPayloads);
  }

  console.log(`Seeding complete. Mood logs count: ${await Mood.countDocuments()}`);
}
