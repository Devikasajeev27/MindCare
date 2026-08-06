import { connectDB } from "./db.ts";
import { Appointment } from "../models/Appointment.ts";
import { User } from "../models/User.ts";
import mongoose from "mongoose";

async function runCheck() {
  console.log("⚡ Starting database diagnostics...");
  try {
    await connectDB();
    
    // Check users
    const usersCount = await User.countDocuments();
    const users = await User.find({}, "name email role");
    console.log(`✓ Total Users: ${usersCount}`);
    console.log("Users:", JSON.stringify(users, null, 2));

    // Check appointments
    const apptsCount = await Appointment.countDocuments();
    const appointments = await Appointment.find({})
      .populate("userId", "name role")
      .populate("therapistId", "name role");
    console.log(`\n✓ Total Appointments: ${apptsCount}`);
    console.log("Appointments:", JSON.stringify(appointments, null, 2));
    
  } catch (err: any) {
    console.error("❌ Diagnostics failed:", err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

runCheck();
