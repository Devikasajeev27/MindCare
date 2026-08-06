import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.ts";
import { ensureFixedRoleDemoData } from "../seeders/fixedRoleDemoSeeder.ts";

dotenv.config();

async function run() {
  await connectDB();
  await ensureFixedRoleDemoData();
}

run().then(() => mongoose.disconnect()).catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
