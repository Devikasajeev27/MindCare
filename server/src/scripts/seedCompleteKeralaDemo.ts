import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/User.ts";
import { Therapist } from "../models/Therapist.ts";
import { Mood } from "../models/Mood.ts";
import { MoodAnalytics } from "../models/MoodAnalytics.ts";
import { Journal } from "../models/Journal.ts";
import { Chat } from "../models/Chat.ts";
import { Appointment } from "../models/Appointment.ts";
import { AuditLog } from "../models/AuditLog.ts";
import { BillingPlan } from "../models/BillingPlan.ts";
import { BlockedUsers } from "../models/BlockedUsers.ts";
import { CompanionEarnings } from "../models/CompanionEarnings.ts";
import { CompanionMatching } from "../models/CompanionMatching.ts";
import { CompanionMilestone } from "../models/CompanionMilestone.ts";
import { CompanionSession } from "../models/CompanionSession.ts";
import { EmergencyAlert } from "../models/EmergencyAlert.ts";
import { EmergencyCase } from "../models/EmergencyCase.ts";
import { EmergencyContact } from "../models/EmergencyContact.ts";
import { EmergencyNotification } from "../models/EmergencyNotification.ts";
import { EmergencySession } from "../models/EmergencySession.ts";
import { Favorites } from "../models/Favorites.ts";
import { LifeEvent } from "../models/LifeEvent.ts";
import { MasterReference } from "../models/MasterReference.ts";
import { Notification } from "../models/Notification.ts";
import { PaymentHistory } from "../models/PaymentHistory.ts";
import { Reports } from "../models/Reports.ts";
import { Resource } from "../models/Resource.ts";
import { RiskAssessment } from "../models/RiskAssessment.ts";
import { SystemSettings } from "../models/SystemSettings.ts";
import { WeeklyAssessment } from "../models/WeeklyAssessment.ts";
import { AiCompanionProfile } from "../models/AiCompanionProfile.ts";

async function seedCompleteKeralaData() {
  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27018/mindcare";
  console.log(`[KERALA-DEMO-SEEDER] Connecting to MongoDB at ${mongoUri}...`);
  await mongoose.connect(mongoUri);

  console.log("=========================================================================");
  console.log("  MINDCARE KERALA DEMO USER & COMPLETE DATABASE SEEDER");
  console.log("=========================================================================\n");

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash("password123", salt);

  // 1. Primary Demo User: Anjali Nair (Kochi / Kozhikode, Kerala)
  let demoUser = await User.findOne({ email: "alex@mindcare.com" });
  if (!demoUser) {
    demoUser = await User.create({
      name: "Anjali Nair",
      email: "alex@mindcare.com",
      password: hashedPassword,
      role: "user",
      status: "approved",
      age: 26,
      gender: "female",
      phone: "+919847012345",
      phoneNumber: "+919847012345",
      city: "Kochi",
      state: "Kerala",
      address: "Marine Drive, Kochi, Kerala - 682031",
      country: "India",
      countryCode: "IN",
      dialCode: "+91",
      currency: "Indian Rupee",
      currencyCode: "INR",
      timezone: "Asia/Kolkata",
      preferredLocale: "ml-IN",
      wellnessScore: 85,
      streak: 12,
      level: 3,
      xp: 240,
      walletBalance: 3500,
      onboardingCompleted: true,
      bio: "Software developer from Kerala passionate about mindfulness, yoga, and mental health.",
      avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300"
    });
  } else {
    demoUser.name = "Anjali Nair";
    demoUser.age = 26;
    demoUser.gender = "female";
    demoUser.city = "Kochi";
    demoUser.state = "Kerala";
    demoUser.address = "Marine Drive, Kochi, Kerala - 682031";
    demoUser.country = "India";
    demoUser.countryCode = "IN";
    demoUser.currency = "Indian Rupee";
    demoUser.currencyCode = "INR";
    demoUser.timezone = "Asia/Kolkata";
    demoUser.preferredLocale = "ml-IN";
    demoUser.wellnessScore = 85;
    demoUser.streak = 12;
    demoUser.level = 3;
    demoUser.xp = 240;
    demoUser.walletBalance = 3500;
    demoUser.onboardingCompleted = true;
    demoUser.bio = "Software developer from Kerala passionate about mindfulness, yoga, and mental health.";
    demoUser.avatar = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300";
    await demoUser.save();
  }
  console.log(`✓ Primary Demo User verified: ${demoUser.name} (${demoUser.email})`);

  // 2. Demo Therapist User: Dr. Devika Pillai (Clinical Psychologist, Thiruvananthapuram)
  let therapistUser = await User.findOne({ email: "sarah@mindcare.com" });
  if (!therapistUser) {
    therapistUser = await User.create({
      name: "Dr. Devika Pillai",
      email: "sarah@mindcare.com",
      password: hashedPassword,
      role: "therapist",
      status: "approved",
      city: "Thiruvananthapuram",
      state: "Kerala",
      country: "India",
      currency: "Indian Rupee",
      currencyCode: "INR",
      timezone: "Asia/Kolkata",
      bio: "Senior Clinical Psychologist with 12+ years of experience in CBT, mindfulness, and anxiety disorders in Kerala."
    });
  } else {
    therapistUser.password = hashedPassword;
    therapistUser.role = "therapist";
    therapistUser.status = "approved";
    therapistUser.name = "Dr. Devika Pillai";
    therapistUser.city = "Thiruvananthapuram";
    therapistUser.state = "Kerala";
    await therapistUser.save();
  }

  // Alias devika@mindcare.com as well
  let devikaUser = await User.findOne({ email: "devika@mindcare.com" });
  if (!devikaUser) {
    devikaUser = await User.create({
      name: "Dr. Devika Pillai",
      email: "devika@mindcare.com",
      password: hashedPassword,
      role: "therapist",
      status: "approved",
      city: "Thiruvananthapuram",
      state: "Kerala",
      country: "India",
      currency: "Indian Rupee",
      currencyCode: "INR",
      timezone: "Asia/Kolkata",
      bio: "Senior Clinical Psychologist with 12+ years of experience in CBT, mindfulness, and anxiety disorders in Kerala."
    });
  } else {
    devikaUser.password = hashedPassword;
    devikaUser.role = "therapist";
    devikaUser.status = "approved";
    await devikaUser.save();
  }

  let therapistProfile = await Therapist.findOne({ userId: therapistUser._id });
  if (!therapistProfile) {
    therapistProfile = await Therapist.create({
      userId: therapistUser._id,
      name: "Dr. Devika Pillai",
      title: "Senior Clinical Psychologist (M.Phil, Ph.D)",
      specializations: ["Anxiety", "Depression", "CBT", "Stress Management", "Mindfulness"],
      rating: 4.9,
      reviewCount: 42,
      yearsExperience: 12,
      consultationFee: 1200, // ₹1200/hr
      availability: "Available Today",
      qualification: "M.Phil Clinical Psychology (NIMHANS), Ph.D",
      registrationNumber: "RCI-KER-2012-094",
      licenseNumber: "LIC-MH-KL-4091",
      languages: ["Malayalam", "English", "Hindi"],
      patientsCount: 180,
      avatar: "https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=300"
    });
  } else {
    therapistProfile.name = "Dr. Devika Pillai";
    therapistProfile.title = "Senior Clinical Psychologist (M.Phil, Ph.D)";
    therapistProfile.consultationFee = 1200;
    therapistProfile.languages = ["Malayalam", "English", "Hindi"];
    await therapistProfile.save();
  }

  // 3. Demo Peer Companion User: Akhil Krishna (Peer Companion, Kozhikode)
  let companionUser = await User.findOne({ email: "kindsoul@mindcare.com" });
  if (!companionUser) {
    companionUser = await User.create({
      name: "Akhil Krishna",
      email: "kindsoul@mindcare.com",
      password: hashedPassword,
      role: "user",
      status: "approved",
      verifiedCompanion: true,
      companionVerificationStatus: "verified",
      isAvailableAsCompanion: true,
      city: "Kozhikode",
      state: "Kerala",
      country: "India",
      currency: "Indian Rupee",
      currencyCode: "INR",
      timezone: "Asia/Kolkata",
      bio: "Empathic peer listener trained in supportive counseling and active listening."
    });
  } else {
    companionUser.name = "Akhil Krishna";
    companionUser.city = "Kozhikode";
    companionUser.state = "Kerala";
    await companionUser.save();
  }

  // 4. Generate 25 Chronological Mood Logs (Past 25 days)
  console.log("Seeding 25+ Mood Logs for Anjali Nair...");
  await Mood.deleteMany({ userId: demoUser._id });
  const moodSamples = [
    { rating: 4, emotion: "Calm", note: "Started the morning with quiet yoga and filter coffee in Kochi." },
    { rating: 5, emotion: "Happy", note: "Successfully deployed project release at work today! Team was thrilled." },
    { rating: 3, emotion: "Neutral", note: "Busy workday with back-to-back client calls. Feeling balanced." },
    { rating: 2, emotion: "Stressed", note: "Heavy work deadlines and traffic on MG Road made me feel tense." },
    { rating: 2, emotion: "Anxious", note: "Overthinking upcoming career milestones and presentation tomorrow." },
    { rating: 4, emotion: "Hopeful", note: "Evening walk along Marine Drive helped clear my mind." },
    { rating: 5, emotion: "Excited", note: "Weekend family trip to Munnar planned with cousins!" },
    { rating: 4, emotion: "Calm", note: "Practiced 4-7-8 Pranayama breathing session during break." },
    { rating: 3, emotion: "Neutral", note: "Quiet day working from home. Enjoyed homemade Sadya." },
    { rating: 1, emotion: "Overwhelmed", note: "Multiple tasks piling up simultaneously. Feeling exhausted." },
    { rating: 4, emotion: "Hopeful", note: "Good chat with peer companion Akhil brought back positive perspective." },
    { rating: 5, emotion: "Happy", note: "Achieved 10-day active wellness streak on MindCare!" }
  ];

  const now = Date.now();
  const moodDocs = [];
  for (let i = 24; i >= 0; i--) {
    const sample = moodSamples[i % moodSamples.length];
    const logDate = new Date(now - i * 24 * 60 * 60 * 1000);
    moodDocs.push({
      userId: demoUser._id,
      rating: sample.rating,
      emotion: sample.emotion,
      note: sample.note,
      date: logDate,
      createdAt: logDate
    });
  }
  await Mood.insertMany(moodDocs);
  console.log("✓ 25 Mood Logs created.");

  // 5. Generate 20 Journal Entries
  console.log("Seeding 20+ Journal Entries for Anjali Nair...");
  await Journal.deleteMany({ userId: demoUser._id });
  const journalSamples = [
    { title: "Reflections on Work Boundaries", content: "Today I decided to turn off work notifications after 7 PM. Protecting my personal headspace in the evenings is essential for my mental health.", tags: ["boundaries", "work", "mindfulness"] },
    { title: "Gratitude for Family Connections", content: "Had tea with my parents today. We spoke about childhood memories in Kozhikode. Grateful for these grounding conversations.", tags: ["gratitude", "family", "peace"] },
    { title: "Managing Anxiety Before Presentations", content: "Felt a spike of nervous energy before the executive review. Used the 5-4-3-2-1 grounding technique and deep breathing. It worked!", tags: ["anxiety", "cbt", "growth"] },
    { title: "Evening Walk at Kochi Promenade", content: "Listening to acoustic Malayalam music while walking near the sea breeze always brings a deep sense of stillness.", tags: ["nature", "walk", "calm"] },
    { title: "Learning to Accept Imperfection", content: "Not every task has to be perfect. Progress over perfection is my new motto for the month.", tags: ["self-care", "reframing"] }
  ];

  const journalDocs = [];
  for (let i = 19; i >= 0; i--) {
    const sample = journalSamples[i % journalSamples.length];
    const logDate = new Date(now - i * 30 * 60 * 60 * 1000);
    journalDocs.push({
      userId: demoUser._id,
      title: `${sample.title} #${20 - i}`,
      content: sample.content,
      tags: sample.tags,
      moodRating: 3 + (i % 3),
      date: logDate,
      createdAt: logDate
    });
  }
  await Journal.insertMany(journalDocs);
  console.log("✓ 20 Journal Entries created.");

  // 6. Generate 25 AI Chat Conversations
  console.log("Seeding 25+ AI Chat Conversations for Anjali Nair...");
  await Chat.deleteMany({ userId: demoUser._id });
  const chatPairs = [
    { u: "Enikk office-il nalla pressure und, aake confused aanu.", a: "Nalla pressure-um stress-um thonnunnu undalloo. Oru cheriya break edukkoo. Ippo entha ee stress-inte main reason?" },
    { u: "I am feeling so overwhelmed with work deadlines and stress.", a: "When everything piles up at once, it’s completely understandable to feel overwhelmed. Let’s take it one step at a time. What’s taking up the most space right now?" },
    { u: "എനിക്ക് ഇന്ന് വളരെ സങ്കടം തോന്നുന്നു, ആരും എന്നെ മനസ്സിലാക്കുന്നില്ല.", a: "ഇത് നിങ്ങൾക്ക് വളരെ കഠിനമായിരിക്കുമെന്ന് തോന്നുന്നു. ഇപ്പോൾ നിങ്ങളെ ഏറ്റവും കൂടുതൽ വേദനിപ്പിക്കുന്ന കാര്യം ഏതാണ്?" },
    { u: "Can you suggest a quick 2-minute breathing exercise for desk stress?", a: "Let's try the 4-7-8 Pranayama exercise together: Inhale slowly through your nose for 4 seconds, hold your breath for 7 seconds, and exhale completely through your mouth for 8 seconds. Shall we do 3 cycles together?" },
    { u: "I completed a 20-minute morning walk today after days of feeling low!", a: "That is worth noticing! What do you think helped make that positive moment possible today?" }
  ];

  const chatDocs = [];
  for (let i = 24; i >= 0; i--) {
    const pair = chatPairs[i % chatPairs.length];
    const logDate = new Date(now - i * 18 * 60 * 60 * 1000);
    chatDocs.push({
      userId: demoUser._id,
      sender: "user",
      recipient: "ai",
      text: pair.u,
      time: logDate,
      createdAt: logDate
    });
    chatDocs.push({
      userId: demoUser._id,
      sender: "ai",
      recipient: "user",
      text: pair.a,
      time: new Date(logDate.getTime() + 2000),
      createdAt: new Date(logDate.getTime() + 2000)
    });
  }
  await Chat.insertMany(chatDocs);
  console.log("✓ 50 Chat messages (25 conversation turns) created.");

  // 7. Generate 20 Appointments (Therapist Consultations)
  console.log("Seeding 20 Appointments for Anjali Nair...");
  await Appointment.deleteMany({ userId: demoUser._id });
  const apptStatuses = ["COMPLETED", "APPROVED", "COMPLETED", "COMPLETED", "CANCELLED"];
  const apptDocs = [];
  for (let i = 19; i >= 0; i--) {
    const status = apptStatuses[i % apptStatuses.length];
    const apptDate = new Date(now + (i < 5 ? (i + 1) * 24 : -i * 3) * 60 * 60 * 1000);
    apptDocs.push({
      userId: demoUser._id,
      therapistId: therapistProfile._id,
      date: apptDate,
      timeSlot: "10:00 AM - 11:00 AM",
      status,
      type: "voice",
      consultationFee: 1200, // ₹1200
      amountPaid: status === "CANCELLED" ? 0 : 1200,
      notes: `Consultation session with ${therapistProfile.name} on CBT and stress management.`,
      createdAt: new Date(now - (i + 5) * 24 * 60 * 60 * 1000)
    });
  }
  await Appointment.insertMany(apptDocs);
  console.log("✓ 20 Appointments created.");

  // 8. Generate 20 Peer Companion Sessions
  console.log("Seeding 20 Companion Sessions...");
  await CompanionSession.deleteMany({ userId: demoUser._id });
  const sessionDocs = [];
  for (let i = 19; i >= 0; i--) {
    const sessDate = new Date(now - i * 36 * 60 * 60 * 1000);
    sessionDocs.push({
      userId: demoUser._id,
      companionId: companionUser._id,
      companionAlias: "KindSoul_23",
      status: "ended",
      startTime: sessDate,
      endTime: new Date(sessDate.getTime() + 30 * 60 * 1000),
      durationMinutes: 30,
      totalCost: 150, // ₹150
      paymentCompleted: true,
      rating: 5,
      createdAt: sessDate
    });
  }
  await CompanionSession.insertMany(sessionDocs);
  console.log("✓ 20 Companion Sessions created.");

  // 9. Generate 20 Payment History Records (INR)
  console.log("Seeding 20 Payment History Records...");
  await PaymentHistory.deleteMany({ userId: demoUser._id });
  const paymentTypes = ["subscription", "therapist_consultation", "companion_session", "wallet_deposit"];
  const paymentDocs = [];
  for (let i = 19; i >= 0; i--) {
    const pType = paymentTypes[i % paymentTypes.length];
    const pDate = new Date(now - i * 28 * 60 * 60 * 1000);
    const amt = pType === "subscription" ? 999 : pType === "therapist_consultation" ? 1200 : pType === "wallet_deposit" ? 1000 : 150;
    paymentDocs.push({
      userId: demoUser._id,
      amount: amt,
      type: pType,
      description: pType === "subscription" ? "Premium Subscription Tiers" : pType === "therapist_consultation" ? "Therapist Consultation - Dr. Devika Pillai" : pType === "wallet_deposit" ? "Wallet Deposit via Razorpay UPI" : "Peer Companion Chat Session",
      invoiceNumber: `pay_demo_inr_${10000 + i}`,
      razorpayOrderId: `order_demo_${20000 + i}`,
      razorpaySignature: `sig_demo_${30000 + i}`,
      paymentMethod: "Razorpay Checkout (UPI / INR)",
      platformCommission: Number((amt * 0.15).toFixed(2)),
      companionEarnings: Number((amt * 0.70).toFixed(2)),
      gst: Number((amt * 0.18).toFixed(2)),
      status: "success",
      createdAt: pDate
    });
  }
  await PaymentHistory.insertMany(paymentDocs);
  console.log("✓ 20 Payment History records created.");

  // 10. Generate 20 Notifications
  console.log("Seeding 20 Notifications...");
  await Notification.deleteMany({ userId: demoUser._id });
  const notifTypes = ["mood", "journal", "appointment", "companion", "achievement", "report"];
  const notifDocs = [];
  for (let i = 19; i >= 0; i--) {
    const nType = notifTypes[i % notifTypes.length];
    const nDate = new Date(now - i * 20 * 60 * 60 * 1000);
    notifDocs.push({
      userId: demoUser._id,
      title: nType === "mood" ? "Daily Mood Check-in 🌿" : nType === "journal" ? "Reflection Time 📖" : nType === "appointment" ? "Upcoming Session with Dr. Devika Pillai 🩺" : nType === "companion" ? "Peer Companion Available 🤝" : nType === "achievement" ? "Achievement Unlocked! 🏆" : "Weekly Wellness Summary Ready 📊",
      message: nType === "mood" ? "How are you feeling this evening? Record your mood to keep your 12-day streak alive." : "Take a quick 2-minute reflection on your day.",
      type: nType === "achievement" ? "achievement" : "info",
      read: i > 5,
      createdAt: nDate
    });
  }
  await Notification.insertMany(notifDocs);
  console.log("✓ 20 Notifications created.");

  // 11. Generate 20 Activity Audit Logs
  console.log("Seeding 20 Activity Audit Logs...");
  await AuditLog.deleteMany({ userId: demoUser._id });
  const auditDocs = [];
  for (let i = 19; i >= 0; i--) {
    const aDate = new Date(now - i * 22 * 60 * 60 * 1000);
    auditDocs.push({
      userId: demoUser._id.toString(),
      userName: demoUser.name,
      userEmail: demoUser.email,
      role: demoUser.role,
      action: i % 3 === 0 ? "MOOD_CHECKIN_LOGGED" : i % 3 === 1 ? "JOURNAL_ENTRY_CREATED" : "AI_COMPANION_CHAT",
      status: "success",
      details: `User completed activity check-in successfully on ${aDate.toLocaleDateString('en-IN')}`,
      createdAt: aDate
    });
  }
  await AuditLog.insertMany(auditDocs);
  console.log("✓ 20 Activity Audit Logs created.");

  // 12. Generate 20 Risk Assessments & Weekly Assessments
  console.log("Seeding Risk Assessments & Weekly Assessments...");
  await RiskAssessment.deleteMany({ userId: demoUser._id });
  await WeeklyAssessment.deleteMany({ userId: demoUser._id });

  const riskDocs = [];
  const weeklyDocs = [];
  for (let i = 19; i >= 0; i--) {
    const date = new Date(now - i * 48 * 60 * 60 * 1000);
    riskDocs.push({
      userId: demoUser._id,
      score: 15 + (i % 10),
      level: "low",
      triggers: ["work_stress"],
      recommendations: ["Maintain 7-8 hours sleep", "Daily 15 min walk"],
      createdAt: date
    });

    weeklyDocs.push({
      userId: demoUser._id,
      weekStartDate: new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000),
      weekEndDate: date,
      averageMoodRating: 4.2,
      totalJournalEntries: 4,
      totalChatSessions: 8,
      wellnessProgressPct: 85,
      createdAt: date
    });
  }
  await RiskAssessment.insertMany(riskDocs);
  await WeeklyAssessment.insertMany(weeklyDocs);
  console.log("✓ 20 Risk Assessments and 20 Weekly Assessments created.");

  // 13. Ensure MasterReferences, BillingPlans, Resources, SystemSettings, and AiCompanionProfile exist
  const { MoodAnalyticsEngine } = await import("../services/moodAnalyticsEngine.ts");
  await MoodAnalyticsEngine.seedMoodHistory(demoUser._id);

  let aiProfile = await AiCompanionProfile.findOne({ userId: demoUser._id });
  if (!aiProfile) {
    await AiCompanionProfile.create({
      userId: demoUser._id,
      primaryLanguage: "ml",
      scriptPreference: "latin",
      escalationConsent: true,
      memories: [
        { id: "mem_1", content: "Prefers morning filter coffee and yoga in Kochi", category: "routine", createdAt: new Date() },
        { id: "mem_2", content: "Working as a software developer with tight project deadlines", category: "work", createdAt: new Date() }
      ]
    });
  }

  console.log("\n=========================================================================");
  console.log("  KERALA DEMO DATA SEEDING COMPLETE FOR ANJALI NAIR");
  console.log("=========================================================================");

  await mongoose.disconnect();
}

seedCompleteKeralaData().catch((err) => {
  console.error("Seeding crash:", err);
  process.exit(1);
});
