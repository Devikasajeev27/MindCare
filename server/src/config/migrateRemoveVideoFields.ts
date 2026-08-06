import { connectDB } from "./db.ts";
import { Appointment } from "../models/Appointment.ts";
import mongoose from "mongoose";

async function runMigration() {
  console.log("⚡ Starting database migration: Clean Video Features...");
  try {
    await connectDB();
    
    // Update all appointments to clear or set the reserved meetingLink to null
    const result = await Appointment.updateMany(
      {},
      { $set: { meetingLink: null } }
    );
    
    console.log(`✓ Database migration complete. Updated ${result.modifiedCount} appointments.`);
    console.log("✓ All meetingLink fields nullified (Reserved for Future Video Consultation).");
  } catch (err: any) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

runMigration();
