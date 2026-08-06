import { User } from "../../models/User.ts";
import { Journal } from "../../models/Journal.ts";
import { JOURNAL_ENTRIES } from "./constants.ts";

export async function generateJournals(targetCount = 600) {
  console.log("Checking Journals collection...");
  const clients = await User.find({ role: "user", verifiedCompanion: false });
  
  if (clients.length === 0) {
    console.log("No client users found. Skipping journals generation.");
    return;
  }

  const existingCount = await Journal.countDocuments();

  if (existingCount >= targetCount) {
    console.log(`Journals collection satisfies target count (${existingCount}/${targetCount}).`);
    return;
  }

  console.log("Generating Journal entries...");
  const payloads = [];

  // Enforce 5-10 journals per client
  for (const client of clients) {
    const existingUserJournals = await Journal.countDocuments({ userId: client._id });
    const targetForUser = 5 + (Math.floor(client._id.getTimestamp().getTime()) % 6); // 5 to 10
    const neededForUser = Math.max(0, targetForUser - existingUserJournals);

    for (let j = 0; j < neededForUser; j++) {
      const entry = JOURNAL_ENTRIES[j % JOURNAL_ENTRIES.length];
      payloads.push({
        userId: client._id,
        title: `${entry.title} - Pt ${j + 1}`,
        content: entry.content,
        tags: entry.tags,
        mood: 3 + (j % 3), // yields 3, 4, 5
        createdAt: new Date(Date.now() - j * 24 * 60 * 60 * 1000 - Math.random() * 12 * 60 * 60 * 1000)
      });
    }
  }

  if (payloads.length > 0) {
    await Journal.insertMany(payloads);
  }

  // Pad to reach 600
  let currentCount = await Journal.countDocuments();
  if (currentCount < targetCount) {
    const needed = targetCount - currentCount;
    console.log(`Padding Journals collection with ${needed} logs...`);
    const padPayloads = [];
    for (let i = 0; i < needed; i++) {
      const client = clients[i % clients.length];
      const entry = JOURNAL_ENTRIES[i % JOURNAL_ENTRIES.length];
      padPayloads.push({
        userId: client._id,
        title: `${entry.title} - Vol ${i + 1}`,
        content: entry.content,
        tags: entry.tags,
        mood: 3 + (i % 3), // yields 3, 4, 5
        createdAt: new Date(Date.now() - (10 + i % 90) * 24 * 60 * 60 * 1000)
      });
    }
    await Journal.insertMany(padPayloads);
  }

  console.log(`Seeding complete. Journal entries count: ${await Journal.countDocuments()}`);
}
