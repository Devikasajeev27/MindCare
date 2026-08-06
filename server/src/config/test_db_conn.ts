import mongoose from "mongoose";

async function test() {
  console.log("Connecting to MongoDB...");
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/mindcare", { serverSelectionTimeoutMS: 5000 });
    console.log("✓ SUCCESS: MongoDB connected to 27017!");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error("✗ FAILURE: Could not connect to MongoDB:", err.message);
    process.exit(1);
  }
}

test();
