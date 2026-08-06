import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
  status: String,
});
const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function inspect() {
  const uri = "mongodb://127.0.0.1:27017/mindcare";
  console.log("Connecting to:", uri);
  try {
    await mongoose.connect(uri);
    console.log("Connected successfully!");
    const count = await User.countDocuments();
    console.log("Total users in database:", count);
    const users = await User.find({}).limit(5);
    console.log("Sample users:", JSON.stringify(users, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Error inspecting database:", err);
    process.exit(1);
  }
}

inspect();
