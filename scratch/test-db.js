import mongoose from "mongoose";

const uri = "mongodb://127.0.0.1:27017/mindcare";

async function run() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB successfully!");
    
    const db = mongoose.connection.db;
    const count = await db.collection("users").countDocuments();
    console.log(`Raw count in "users" collection: ${count}`);
    
    const rawUsers = await db.collection("users").find().toArray();
    for (const u of rawUsers) {
      console.log(`- Email: ${u.email}, Password hash length: ${u.password?.length}`);
    }
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
