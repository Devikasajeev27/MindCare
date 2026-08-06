import mongoose from "mongoose";
import { User } from "./server/src/models/User.ts";

async function checkDemoAccounts() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27018/mindcare";
  await mongoose.connect(mongoUri);

  const alex = await User.findOne({ email: "alex@mindcare.com" });
  console.log("alex@mindcare.com exists:", !!alex);

  const sarah = await User.findOne({ email: "sarah@mindcare.com" });
  console.log("sarah@mindcare.com exists:", !!sarah);

  const admin = await User.findOne({ email: "admin@mindcare.com" });
  console.log("admin@mindcare.com exists:", !!admin);

  const devika = await User.findOne({ email: "devika@mindcare.com" });
  console.log("devika@mindcare.com exists:", !!devika);

  const therapists = await User.find({ role: "therapist" });
  console.log("Therapist emails in DB:", therapists.map(t => t.email));

  await mongoose.disconnect();
}

checkDemoAccounts().catch(console.error);
