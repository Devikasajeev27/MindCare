import { User } from "../../models/User.ts";
import { Chat } from "../../models/Chat.ts";
import { CHAT_CONVERSATIONS } from "./constants.ts";

export async function generateChats(targetCount = 2000) {
  console.log("Checking Chats collection...");
  const clients = await User.find({ role: "user", verifiedCompanion: false });
  
  if (clients.length === 0) {
    console.log("No client users found. Skipping chats generation.");
    return;
  }

  const existingCount = await Chat.countDocuments();

  if (existingCount >= targetCount) {
    console.log(`Chats collection satisfies target count (${existingCount}/${targetCount}).`);
    return;
  }

  console.log("Generating Chat messages...");
  const payloads = [];

  // Enforce 10-30 chats per user client (each chat is user msg + ai response = 2 documents)
  for (const client of clients) {
    const existingUserChats = await Chat.countDocuments({ userId: client._id });
    const targetForUser = 10 + (Math.floor(client._id.getTimestamp().getTime()) % 11) * 2; // 10 to 30
    const neededForUser = Math.max(0, targetForUser - existingUserChats);

    for (let j = 0; j < neededForUser / 2; j++) {
      const convo = CHAT_CONVERSATIONS[j % CHAT_CONVERSATIONS.length];
      const baseTime = new Date(Date.now() - j * 24 * 60 * 60 * 1000 - Math.random() * 8 * 60 * 60 * 1000);
      
      payloads.push(
        {
          userId: client._id,
          sender: "user",
          recipient: "ai",
          text: convo.user,
          time: baseTime
        },
        {
          userId: client._id,
          sender: "ai",
          recipient: "user",
          text: convo.ai,
          time: new Date(baseTime.getTime() + 5000)
        }
      );
    }
  }

  if (payloads.length > 0) {
    await Chat.insertMany(payloads);
  }

  // Pad to reach 2000
  let currentCount = await Chat.countDocuments();
  if (currentCount < targetCount) {
    const needed = targetCount - currentCount;
    console.log(`Padding Chats collection with ${needed} messages...`);
    const padPayloads = [];
    for (let i = 0; i < needed / 2; i++) {
      const client = clients[i % clients.length];
      const convo = CHAT_CONVERSATIONS[i % CHAT_CONVERSATIONS.length];
      const baseTime = new Date(Date.now() - (15 + i % 90) * 24 * 60 * 60 * 1000);
      
      padPayloads.push(
        {
          userId: client._id,
          sender: "user",
          recipient: "ai",
          text: convo.user,
          time: baseTime
        },
        {
          userId: client._id,
          sender: "ai",
          recipient: "user",
          text: convo.ai,
          time: new Date(baseTime.getTime() + 5000)
        }
      );
    }
    await Chat.insertMany(padPayloads);
  }

  console.log(`Seeding complete. Chat logs count: ${await Chat.countDocuments()}`);
}
