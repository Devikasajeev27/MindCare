import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";

const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
  status: String,
});
const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function testProfile() {
  const uri = "mongodb://127.0.0.1:27018/mindcare";
  try {
    await mongoose.connect(uri);
    console.log("Connected to DB successfully");
    const user = await User.findOne({ email: "alex@mindcare.com" });
    if (!user) {
      console.error("User alex@mindcare.com not found!");
      process.exit(1);
    }
    console.log("Found user:", user._id);
    
    // Generate JWT token
    const token = jwt.sign({ id: user._id.toString() }, "supersecretjwtkey123_dev_only", { expiresIn: "30d" });
    console.log("Generated token:", token);
    
    // Request profile
    const res = await fetch("http://127.0.0.1:5000/api/auth/profile", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    console.log("Status code:", res.status);
    const body = await res.text();
    console.log("Response body:", body);
    
    process.exit(0);
  } catch (err) {
    console.error("Error in script:", err);
    process.exit(1);
  }
}

testProfile();
