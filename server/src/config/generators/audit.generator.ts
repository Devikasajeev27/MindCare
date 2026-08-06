import { User } from "../../models/User.ts";
import { AuditLog } from "../../models/AuditLog.ts";

export async function generateAuditLogs(targetCount = 1000) {
  console.log("Checking Audit Logs collection...");
  const allUsers = await User.find({});
  
  if (allUsers.length === 0) {
    console.log("No users found. Skipping audit log generation.");
    return;
  }

  const existingCount = await AuditLog.countDocuments();

  if (existingCount >= targetCount) {
    console.log(`Audit Logs collection satisfies target count (${existingCount}/${targetCount}).`);
    return;
  }

  const needed = targetCount - existingCount;
  console.log(`Seeding ${needed} additional AuditLogs...`);
  const logs = [];

  const actions = ["LOGIN", "LOGOUT", "PASSWORD_RESET", "PROFILE_UPDATED", "SESSION_STARTED", "THERAPIST_APPROVED", "COMPANION_SUSPENDED"];
  const details = [
    "User successfully logged in via credentials verification.",
    "User closed session and logged out successfully.",
    "User verified identity via OTP and reset account password.",
    "User saved updated profile info.",
    "User opened a new peer discussion chat room.",
    "Admin reviewed licenses and approved therapist directory lookup.",
    "Admin flag review triggered suspension on user companion role."
  ];

  // Enforce at least 5 audit logs per active user
  for (const user of allUsers) {
    const userAuditCount = await AuditLog.countDocuments({ userId: user._id });
    const userNeeded = Math.max(0, 5 - userAuditCount);

    for (let j = 0; j < userNeeded; j++) {
      const idx = j % actions.length;
      logs.push({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        role: user.role,
        action: actions[idx],
        status: "success",
        ip: `192.168.1.${50 + (j % 50)}`,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        details: details[idx],
        createdAt: new Date(Date.now() - j * 24 * 60 * 60 * 1000)
      });
    }
  }

  if (logs.length > 0) {
    await AuditLog.insertMany(logs);
  }

  // Pad to reach 1000
  let currentCount = await AuditLog.countDocuments();
  if (currentCount < targetCount) {
    const padNeeded = targetCount - currentCount;
    console.log(`Padding AuditLogs with ${padNeeded} logs...`);
    const padPayloads = [];
    for (let i = 0; i < padNeeded; i++) {
      const user = allUsers[i % allUsers.length];
      const idx = i % actions.length;
      padPayloads.push({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        role: user.role,
        action: actions[idx],
        status: "success",
        ip: `10.0.0.${20 + (i % 80)}`,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        details: details[idx],
        createdAt: new Date(Date.now() - (10 + i % 90) * 24 * 60 * 60 * 1000)
      });
    }
    await AuditLog.insertMany(padPayloads);
  }

  console.log(`Seeding complete. Audit logs count: ${await AuditLog.countDocuments()}`);
}
