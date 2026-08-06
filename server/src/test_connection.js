import mongoose from "mongoose";

async function test() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27018/mindcare";
  console.log("Connecting to:", mongoUri);
  try {
    await mongoose.connect(mongoUri);
    console.log("Connected successfully!");
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Collections in DB:", collections.map(c => c.name));
    
    process.exit(0);
  } catch (err) {
    console.error("Database Test Error Stack:");
    console.error(err.stack || err);
    process.exit(1);
  }
}

test();
