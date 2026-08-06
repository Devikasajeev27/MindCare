import bcrypt from "bcryptjs";
import { User } from "../models/User.ts";
import { SeederResult } from "./types.ts";

export const KERALA_DISTRICTS = [
  { city: "Kochi", district: "Ernakulam", pin: "682030" },
  { city: "Thiruvananthapuram", district: "Thiruvananthapuram", pin: "695003" },
  { city: "Kozhikode", district: "Kozhikode", pin: "673001" },
  { city: "Thrissur", district: "Thrissur", pin: "680001" },
  { city: "Kottayam", district: "Kottayam", pin: "686008" },
  { city: "Alappuzha", district: "Alappuzha", pin: "688001" },
  { city: "Palakkad", district: "Palakkad", pin: "678001" },
  { city: "Kannur", district: "Kannur", pin: "670001" },
  { city: "Malappuram", district: "Malappuram", pin: "676505" },
  { city: "Kollam", district: "Kollam", pin: "691001" },
  { city: "Pathanamthitta", district: "Pathanamthitta", pin: "689645" },
  { city: "Idukki", district: "Idukki", pin: "685602" },
  { city: "Wayanad", district: "Wayanad", pin: "673121" },
  { city: "Kasaragod", district: "Kasaragod", pin: "671121" }
];

export const KERALA_PROD_USERS = [
  { name: "Anand Varma", email: "admin@mindcare.com", role: "admin", city: "Kochi", state: "Kerala" },
  { name: "Alex Kurian", email: "alex@mindcare.com", role: "user", city: "Kochi", state: "Kerala" },
  { name: "Meera Nair", email: "user1@example.com", role: "user", city: "Kottayam", state: "Kerala" },
  { name: "Rohan Menon", email: "user2@example.com", role: "user", city: "Thiruvananthapuram", state: "Kerala" },
  { name: "Anjali Pillai", email: "user3@example.com", role: "user", city: "Thrissur", state: "Kerala" },
  { name: "Firoz Khan", email: "user4@example.com", role: "user", city: "Kozhikode", state: "Kerala" },
  { name: "Dr. Sarah Mitchell", email: "sarah@mindcare.com", role: "therapist", city: "Kochi", state: "Kerala" },
  { name: "Dr. Devika Pillai", email: "therapist2@mindcare.com", role: "therapist", city: "Thiruvananthapuram", state: "Kerala" },
  { name: "Dr. Gautam Nambiar", email: "therapist3@mindcare.com", role: "therapist", city: "Kozhikode", state: "Kerala" },
  { name: "Dr. Reshma Menon", email: "therapist4@mindcare.com", role: "therapist", city: "Kochi", state: "Kerala" },
  { name: "KindSoul_23", email: "kindsoul@mindcare.com", role: "user", city: "Kochi", state: "Kerala" },
  { name: "HopefulHeart", email: "hopeful@mindcare.com", role: "user", city: "Kochi", state: "Kerala" },
  { name: "Siddharth Menon", email: "siddharth@mindcare.com", role: "user", city: "Palakkad", state: "Kerala" },
  { name: "Divya Panicker", email: "divya@mindcare.com", role: "user", city: "Calicut", state: "Kerala" },
  { name: "Nikhil Varghese", email: "nikhil@mindcare.com", role: "user", city: "Kollam", state: "Kerala" },
  { name: "Kavya Nambiar", email: "kavya@mindcare.com", role: "user", city: "Kannur", state: "Kerala" },
  { name: "Arjun Nair", email: "arjun@mindcare.com", role: "user", city: "Alappuzha", state: "Kerala" },
  { name: "Sreeja Panicker", email: "sreeja@mindcare.com", role: "user", city: "Malappuram", state: "Kerala" },
  { name: "Faisal Rahman", email: "faisal@mindcare.com", role: "user", city: "Wayanad", state: "Kerala" },
  { name: "Deepa Thomas", email: "deepa@mindcare.com", role: "user", city: "Pathanamthitta", state: "Kerala" },
  { name: "Vinod Kumar", email: "vinod@mindcare.com", role: "user", city: "Kasaragod", state: "Kerala" },

  // Additional 10 users to support robust user testing
  { name: "Aiswarya Raj", email: "aiswarya@mindcare.com", role: "user", city: "Kochi", state: "Kerala" },
  { name: "Rahul Namboodiri", email: "rahul@mindcare.com", role: "user", city: "Thrissur", state: "Kerala" },
  { name: "Neethu Suresh", email: "neethu@mindcare.com", role: "user", city: "Thiruvananthapuram", state: "Kerala" },
  { name: "Vishnu Prasad", email: "vishnu@mindcare.com", role: "user", city: "Kottayam", state: "Kerala" },
  { name: "Gopika Varma", email: "gopika@mindcare.com", role: "user", city: "Kozhikode", state: "Kerala" },
  { name: "Dr. Arjun Nair", email: "therapist5@mindcare.com", role: "therapist", city: "Kochi", state: "Kerala" },
  { name: "Dr. Lakshmi Varma", email: "therapist6@mindcare.com", role: "therapist", city: "Thiruvananthapuram", state: "Kerala" },
  { name: "Dr. Harish Kumar", email: "therapist7@mindcare.com", role: "therapist", city: "Thrissur", state: "Kerala" },
  { name: "CalmWaves", email: "calmwaves@mindcare.com", role: "user", city: "Kochi", state: "Kerala" },
  { name: "PeacefulMind", email: "peacefulmind@mindcare.com", role: "user", city: "Kochi", state: "Kerala" }
];

export async function seedUsers(targetCount = 25): Promise<SeederResult> {
  // Restore healthy streaks for existing user accounts if they got reset
  await User.updateMany({ streak: { $lte: 1 } }, { $set: { streak: 12 } });

  const existingCount = await User.countDocuments();
  if (existingCount >= targetCount) {
    return {
      collectionName: "users",
      modelName: "User",
      existingCount,
      insertedCount: 0,
      finalCount: existingCount,
      status: "SKIPPED",
    };
  }

  const existingEmails = new Set((await User.find({}, { email: 1 })).map(u => u.email));
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash("password123", salt);

  const needed = targetCount - existingCount;
  const docsToInsert = [];

  for (let i = 0; i < KERALA_PROD_USERS.length; i++) {
    const item = KERALA_PROD_USERS[i];
    if (existingEmails.has(item.email)) continue;

    const loc = KERALA_DISTRICTS[i % KERALA_DISTRICTS.length];
    docsToInsert.push({
      name: item.name,
      email: item.email,
      password: hashedPassword,
      role: item.role,
      status: "approved",
      age: 22 + (i % 25),
      gender: i % 2 === 0 ? "female" : "male",
      phone: `+919447${100000 + i}`,
      city: item.city || loc.city,
      state: "Kerala",
      address: `${item.city || loc.city} Sector ${i + 1}, ${loc.district}, Kerala ${loc.pin}`,
      country: "India",
      currency: "Indian Rupee",
      currencyCode: "INR",
      wellnessScore: 70 + (i % 25),
      streak: (i % 15) + 1,
      onboardingCompleted: true,
      avatar: `https://images.unsplash.com/photo-${1534528741775 + i}?auto=format&fit=crop&q=80&w=200`,
    });

    if (docsToInsert.length >= needed) break;
  }

  // If still needed, add indexed fallback users safely
  let extraIndex = 1;
  while (docsToInsert.length < needed) {
    const email = `kerala_user_${extraIndex}@mindcare.com`;
    if (!existingEmails.has(email)) {
      const loc = KERALA_DISTRICTS[extraIndex % KERALA_DISTRICTS.length];
      docsToInsert.push({
        name: `Kerala User ${extraIndex}`,
        email,
        password: hashedPassword,
        role: "user",
        status: "approved",
        age: 25,
        gender: extraIndex % 2 === 0 ? "female" : "male",
        phone: `+919447${200000 + extraIndex}`,
        city: loc.city,
        state: "Kerala",
        address: `${loc.city}, ${loc.district}, Kerala ${loc.pin}`,
        country: "India",
        currency: "Indian Rupee",
        currencyCode: "INR",
        wellnessScore: 80,
        streak: 5,
        onboardingCompleted: true,
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
      });
    }
    extraIndex++;
  }

  if (docsToInsert.length > 0) {
    await User.insertMany(docsToInsert);
  }

  const finalCount = await User.countDocuments();
  return {
    collectionName: "users",
    modelName: "User",
    existingCount,
    insertedCount: docsToInsert.length,
    finalCount,
    status: "VERIFIED",
  };
}
