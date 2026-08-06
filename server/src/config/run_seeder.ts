import { connectDB } from "./db.ts";
import { seedDB } from "./seed.ts";
import mongoose from "mongoose";

async function run() {
  try {
    console.log("Connecting to Database...");
    await connectDB();
    console.log("Running Seeder...");
    await seedDB();
    console.log("Disconnecting...");
    await mongoose.disconnect();
    console.log("Seeding process completed!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding runner error:", err);
    process.exit(1);
  }
}

run();
