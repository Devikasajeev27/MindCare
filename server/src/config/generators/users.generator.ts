import { User } from "../../models/User.ts";
import { BillingPlan } from "../../models/BillingPlan.ts";
import bcrypt from "bcryptjs";
import {
  INDIAN_FEMALE_NAMES,
  INDIAN_MALE_NAMES,
  BIOS,
  ADDRESSES,
  RELATIONS
} from "./constants.ts";

export async function generateUsers(targetCount = 100, targetTherapists = 25, targetAdmins = 3) {
  console.log("Checking Users collection...");
  const existingUsers = await User.find({});
  const existingCount = existingUsers.length;

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash("password123", salt);

  // Default login demo accounts mapping
  // IMPORTANT: All demo accounts must have status "approved" — including therapists —
  // so the demo login buttons work immediately after seeding.
  const demoAccounts = [
    { email: "admin@mindcare.com", name: "MindCare Admin", role: "admin", status: "approved" },
    { email: "alex@mindcare.com", name: "Alex Johnson", role: "user", status: "approved" },
    { email: "sarah@mindcare.com", name: "Dr. Sarah Mitchell", role: "therapist", status: "approved" },
    { email: "kindsoul@mindcare.com", name: "KindSoul_23", role: "user", status: "approved", verifiedCompanion: true, companionVerificationStatus: "verified" },
    { email: "hopeful@mindcare.com", name: "HopefulHeart", role: "user", status: "approved", verifiedCompanion: true, companionVerificationStatus: "verified" },
    { email: "calmwaves@mindcare.com", name: "CalmWaves", role: "user", status: "approved", verifiedCompanion: true, companionVerificationStatus: "verified" },
  ];

  for (const d of demoAccounts) {
    const exists = existingUsers.find(u => u.email === d.email);
    if (!exists) {
      await User.create({
        ...d,
        password: hashedPassword,
        age: 28,
        gender: "other",
        phone: "+91990000000" + demoAccounts.indexOf(d),
        wellnessScore: 80,
        streak: 3,
        level: 1,
        xp: 10,
        onboardingCompleted: true,
        country: "India",
        countryCode: "IN",
        dialCode: "+91",
        phoneNumber: "+91990000000" + demoAccounts.indexOf(d),
        currency: "Indian Rupee",
        currencyCode: "INR",
        phoneVerified: true,
        preferredLocale: "en-IN",
        bio: BIOS[demoAccounts.indexOf(d) % BIOS.length],
        address: ADDRESSES[demoAccounts.indexOf(d) % ADDRESSES.length]
      });
    } else {
      // Always refresh password and ensure status is approved for demo accounts
      exists.password = hashedPassword;
      exists.status = "approved";
      await exists.save();
    }
  }

  const updatedUsers = await User.find({});
  const totalCount = updatedUsers.length;

  if (totalCount >= targetCount) {
    console.log(`User collection satisfies target size (${totalCount}/${targetCount}).`);
    return updatedUsers;
  }

  const needed = targetCount - totalCount;
  console.log(`Seeding ${needed} additional users to reach target ${targetCount}...`);
  const plans = await BillingPlan.find({});

  const userPayloads = [];
  for (let i = 0; i < needed; i++) {
    const relativeIndex = totalCount + i;
    // 20 Female, 20 Male, rest mixed
    let gender = "other";
    let name = "";
    if (i < 25) {
      gender = "female";
      name = INDIAN_FEMALE_NAMES[i % INDIAN_FEMALE_NAMES.length];
    } else if (i < 50) {
      gender = "male";
      name = INDIAN_MALE_NAMES[i % INDIAN_MALE_NAMES.length];
    } else {
      gender = i % 2 === 0 ? "male" : "female";
      name = gender === "male"
        ? INDIAN_MALE_NAMES[i % INDIAN_MALE_NAMES.length]
        : INDIAN_FEMALE_NAMES[i % INDIAN_FEMALE_NAMES.length];
    }

    name = `${name} ${relativeIndex}`;
    const firstName = name.split(" ")[0].toLowerCase();
    const email = `${firstName}.${relativeIndex}@mindcare.in`;
    const phone = `+91${7700000000 + i}`;

    // Role assignment logic
    let role = "user";
    let verifiedCompanion = false;
    let companionVerificationStatus = "none";

    const currentTherapistCount = updatedUsers.filter(u => u.role === "therapist").length + userPayloads.filter(u => u.role === "therapist").length;
    const currentAdminCount = updatedUsers.filter(u => u.role === "admin").length + userPayloads.filter(u => u.role === "admin").length;

    if (currentTherapistCount < targetTherapists) {
      role = "therapist";
    } else if (currentAdminCount < targetAdmins) {
      role = "admin";
    } else if (i % 3 === 0) {
      // 1/3 of clients are companions
      role = "user";
      verifiedCompanion = i % 4 !== 0;
      companionVerificationStatus = i % 4 === 0 ? "pending" : i % 5 === 0 ? "rejected" : "verified";
    }

    const relation = RELATIONS[i % RELATIONS.length];
    const contactName = gender === "female"
      ? INDIAN_MALE_NAMES[(i + 4) % INDIAN_MALE_NAMES.length]
      : INDIAN_FEMALE_NAMES[(i + 4) % INDIAN_FEMALE_NAMES.length];

    userPayloads.push({
      name,
      email,
      password: hashedPassword,
      role,
      verifiedCompanion,
      companionVerificationStatus,
      status: "approved",
      age: 21 + (i % 35),
      gender,
      phone,
      wellnessScore: 60 + (i % 35),
      streak: i % 12,
      level: 1 + (i % 5),
      xp: (i % 5) * 80,
      onboardingCompleted: true,
      country: "India",
      countryCode: "IN",
      dialCode: "+91",
      phoneNumber: `+91${7700000000 + i}`,
      currency: "Indian Rupee",
      currencyCode: "INR",
      phoneVerified: true,
      preferredLocale: "en-IN",
      bio: BIOS[i % BIOS.length],
      address: ADDRESSES[i % ADDRESSES.length],
      emergencyContact: {
        name: contactName,
        phone: `+91${9100000000 + i}`,
        relation
      },
      activePlan: {
        planId: plans[i % plans.length]?._id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
  }

  await User.insertMany(userPayloads);
  console.log(`Seeding complete. New User count: ${await User.countDocuments()}`);
  return await User.find({});
}
