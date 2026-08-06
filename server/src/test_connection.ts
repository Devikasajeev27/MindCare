import mongoose from "mongoose";
import { User } from "./models/User.ts";
import { serverConfig } from "./config/env.ts";

async function test() {
  console.log("Connecting to:", serverConfig.mongoUri);
  try {
    await mongoose.connect(serverConfig.mongoUri);
    console.log("Connected successfully!");
    const count = await User.countDocuments();
    console.log("Total users in database:", count);
    process.exit(0);
  } catch (err: any) {
    console.error("Database Test Error Stack:");
    console.error(err.stack || err);
    process.exit(1);
  }
}

test();
