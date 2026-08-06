import { Therapist } from "../models/Therapist.ts";
import { User } from "../models/User.ts";
import { SeederResult } from "./types.ts";

export async function seedTherapists(targetCount = 20): Promise<SeederResult> {
  const existingCount = await Therapist.countDocuments();
  if (existingCount >= targetCount) {
    return { collectionName: "therapists", modelName: "Therapist", existingCount, insertedCount: 0, finalCount: existingCount, status: "SKIPPED" };
  }

  const users = await User.find();
  if (users.length === 0) {
    throw new Error("Cannot seed therapists: No users exist. Run usersSeeder first.");
  }

  const existingUserIds = new Set((await Therapist.find({}, { userId: 1 })).map(t => t.userId?.toString()));
  const needed = targetCount - existingCount;

  const hospitals = [
    "Aster Medcity, Cheranalloor, Kochi",
    "KIMSHEALTH, Anayara, Thiruvananthapuram",
    "Baby Memorial Hospital, Kozhikode",
    "Amrita Institute of Medical Sciences, Kochi",
    "Jubilee Mission Hospital, Thrissur",
    "VPS Lakeshore Hospital, Ernakulam",
    "Government Medical College, Thiruvananthapuram",
    "Malabar Institute of Medical Sciences (MIMS), Calicut"
  ];

  const doctorAvatars = [
    "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400",
    "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400",
    "https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=400",
    "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=400",
    "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400",
    "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&q=80&w=400"
  ];

  // Update existing therapist documents in MongoDB that lack a profile avatar
  const existingDocsToUpdate = await Therapist.find({
    $or: [{ avatar: { $exists: false } }, { avatar: "" }, { avatar: null }]
  });
  for (let i = 0; i < existingDocsToUpdate.length; i++) {
    existingDocsToUpdate[i].avatar = doctorAvatars[i % doctorAvatars.length];
    await existingDocsToUpdate[i].save();
  }

  const docsToInsert = [];
  let userIdx = 0;

  while (docsToInsert.length < needed && userIdx < users.length * 3) {
    const user = users[userIdx % users.length];
    userIdx++;

    // Only create one therapist profile per user if not already linked
    if (existingUserIds.has(user._id.toString())) continue;
    existingUserIds.add(user._id.toString());

    const isDr = user.name.startsWith("Dr.");
    const name = isDr ? user.name : `Dr. ${user.name}`;
    const avatarUrl: string = user.avatar && user.avatar.trim() !== "" 
      ? user.avatar 
      : doctorAvatars[docsToInsert.length % doctorAvatars.length];

    docsToInsert.push({
      userId: user._id,
      name,
      title: docsToInsert.length % 2 === 0 ? "Senior Clinical Psychologist" : "Consultant Neuropsychiatrist & CBT Specialist",
      specializations: ["Anxiety & Panic", "Cognitive Behavioral Therapy (CBT)", "Depression", "Work Stress & Burnout"],
      yearsExperience: 8 + (docsToInsert.length % 14),
      consultationFee: 1200 + (docsToInsert.length % 6) * 100,
      availability: docsToInsert.length % 2 === 0 ? "Available Today" : "Available Tomorrow",
      avatar: avatarUrl,
      qualification: "M.Phil Clinical Psychology (NIMHANS), Ph.D",
      hospitalClinic: hospitals[docsToInsert.length % hospitals.length],
      registrationNumber: `KMC-PSY-${4000 + docsToInsert.length}`,
      languages: ["Malayalam", "English", "Hindi"],
      about: `${name} is a licensed clinical professional providing evidence-based mental health treatment across Kerala.`,
      rating: 4.8 + (docsToInsert.length % 3) * 0.1,
      reviewCount: 20 + docsToInsert.length * 2,
      patientsCount: 150 + docsToInsert.length * 15,
      verificationStatus: "Verified",
      panNumber: `KLPSY${1000 + docsToInsert.length}Z`,
      panVerified: true
    });
  }

  if (docsToInsert.length > 0) {
    await Therapist.insertMany(docsToInsert);
  }

  const finalCount = await Therapist.countDocuments();
  return { collectionName: "therapists", modelName: "Therapist", existingCount, insertedCount: docsToInsert.length, finalCount, status: "VERIFIED" };
}
