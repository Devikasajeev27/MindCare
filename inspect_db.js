import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mindcare";

async function run() {
  try {
    console.log("Connecting to MongoDB at:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully!");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections.`);

    const report = [];
    for (const coll of collections) {
      const name = coll.name;
      const count = await db.collection(name).countDocuments();
      report.push({ name, count });
    }

    console.log("\n--- COLLECTION COUNTS ---");
    console.table(report);

    // Analyze users by role
    if (collections.some(c => c.name === "users")) {
      const usersColl = db.collection("users");
      const totalUsers = await usersColl.countDocuments();
      const admins = await usersColl.countDocuments({ role: "admin" });
      const therapists = await usersColl.countDocuments({ role: "therapist" });
      const clients = await usersColl.countDocuments({ role: "user" });
      const companions = await usersColl.countDocuments({ verifiedCompanion: true });
      const phoneUnverified = await usersColl.countDocuments({ phoneVerified: false });

      console.log("\n--- USER BREAKDOWN ---");
      console.log(`Total Users: ${totalUsers}`);
      console.log(`Admins: ${admins}`);
      console.log(`Therapists: ${therapists}`);
      console.log(`Clients (role=user): ${clients}`);
      console.log(`Verified Companions: ${companions}`);
      console.log(`Unverified Phones: ${phoneUnverified}`);

      // List all existing users
      const allUsers = await usersColl.find({}, { projection: { name: 1, email: 1, role: 1, phone: 1, verifiedCompanion: 1 } }).toArray();
      console.log("\n--- EXISTING USER LIST ---");
      console.table(allUsers);
    } else {
      console.log("\n'users' collection not found.");
    }

    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  } catch (err) {
    console.error("Error inspecting database:", err);
  }
}

run();
