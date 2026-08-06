import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "./db.ts";
import { User } from "../models/User.ts";

async function run() {
  await connectDB();
  console.log("Seeding streaks...");
  
  // User 1: Streak broken (last activity 2 days ago)
  let testUser1 = await User.findOne({ email: "user1@example.com" });
  if (!testUser1) {
    testUser1 = await User.create({
      name: "Test Streak User 1",
      email: "user1@example.com",
      password: "password123",
      role: "user",
      streak: 5,
      lastActivityDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    });
  } else {
    testUser1.streak = 5;
    testUser1.lastActivityDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await testUser1.save();
  }

  // User 2: Streak alert warning (last activity yesterday)
  let testUser2 = await User.findOne({ email: "user2@example.com" });
  if (!testUser2) {
    testUser2 = await User.create({
      name: "Test Streak User 2",
      email: "user2@example.com",
      password: "password123",
      role: "user",
      streak: 10,
      lastActivityDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    });
  } else {
    testUser2.streak = 10;
    testUser2.lastActivityDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    await testUser2.save();
  }

  console.log("Streaks seeded successfully.");
  await mongoose.disconnect();
}

run().catch(console.error);
