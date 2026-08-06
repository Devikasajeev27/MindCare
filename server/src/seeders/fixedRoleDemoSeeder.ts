import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.ts";
import { AppointmentConversation } from "../models/AppointmentConversation.ts";
import { AppointmentMessage } from "../models/AppointmentMessage.ts";
import { AuditLog } from "../models/AuditLog.ts";
import { Chat } from "../models/Chat.ts";
import { EmergencyAlert } from "../models/EmergencyAlert.ts";
import { Journal } from "../models/Journal.ts";
import { Mood } from "../models/Mood.ts";
import { Notification } from "../models/Notification.ts";
import { PaymentHistory } from "../models/PaymentHistory.ts";
import { Reports } from "../models/Reports.ts";
import { Resource } from "../models/Resource.ts";
import { Therapist } from "../models/Therapist.ts";
import { User } from "../models/User.ts";

export const FIXED_DEMO_IDS = {
  admin: "6a5651d150636bede457ccfa",
  user: "6a5651d150636bede457ccfc",
  therapist: "6a5651d150636bede457ccfe",
} as const;

const DEMO_PASSWORD = "password123";
const objectId = (value: string) => new mongoose.Types.ObjectId(value);
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

type DemoUser = {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "therapist";
  city: string;
  phone: string;
  verifiedCompanion?: boolean;
};

const PATIENTS: DemoUser[] = [
  ["7a5651d150636bede457cd01", "Aparna Menon", "aparna.menon@mindcare.demo", "Kochi", "+919846100101"],
  ["7a5651d150636bede457cd02", "Nikhil Varma", "nikhil.varma@mindcare.demo", "Thrissur", "+919846100102"],
  ["7a5651d150636bede457cd03", "Fathima Rahman", "fathima.rahman@mindcare.demo", "Kozhikode", "+919846100103"],
  ["7a5651d150636bede457cd04", "Arjun Sreedhar", "arjun.sreedhar@mindcare.demo", "Kottayam", "+919846100104"],
  ["7a5651d150636bede457cd05", "Meera Nandakumar", "meera.nandakumar@mindcare.demo", "Kannur", "+919846100105"],
  ["7a5651d150636bede457cd06", "Riya Joseph", "riya.joseph@mindcare.demo", "Alappuzha", "+919846100106"],
  ["7a5651d150636bede457cd07", "Sandeep Krishnan", "sandeep.krishnan@mindcare.demo", "Palakkad", "+919846100107"],
  ["7a5651d150636bede457cd08", "Anu Mathew", "anu.mathew@mindcare.demo", "Kollam", "+919846100108"],
  ["7a5651d150636bede457cd09", "Naveen Babu", "naveen.babu@mindcare.demo", "Malappuram", "+919846100109"],
  ["7a5651d150636bede457cd10", "Lakshmi Prasad", "lakshmi.prasad@mindcare.demo", "Thiruvananthapuram", "+919846100110"],
].map(([id, name, email, city, phone], index) => ({ _id: id, name, email, role: "user" as const, city, phone, verifiedCompanion: index < 10 }));

const THERAPISTS: DemoUser[] = [
  ["7b5651d150636bede457cd01", "Dr. Anoop Nair", "anoop.nair@mindcare.demo", "Kochi", "+919846200101"],
  ["7b5651d150636bede457cd02", "Dr. Radhika Pillai", "radhika.pillai@mindcare.demo", "Kozhikode", "+919846200102"],
  ["7b5651d150636bede457cd03", "Dr. Neethu George", "neethu.george@mindcare.demo", "Kottayam", "+919846200103"],
  ["7b5651d150636bede457cd04", "Dr. Vishnu Mohan", "vishnu.mohan@mindcare.demo", "Thrissur", "+919846200104"],
  ["7b5651d150636bede457cd05", "Dr. Shalini Das", "shalini.das@mindcare.demo", "Kannur", "+919846200105"],
  ["7b5651d150636bede457cd06", "Dr. Arun Raj", "arun.raj@mindcare.demo", "Kollam", "+919846200106"],
  ["7b5651d150636bede457cd07", "Dr. Geetha S", "geetha.s@mindcare.demo", "Alappuzha", "+919846200107"],
  ["7b5651d150636bede457cd08", "Dr. Thomas Kurian", "thomas.kurian@mindcare.demo", "Palakkad", "+919846200108"],
  ["7b5651d150636bede457cd09", "Dr. Sreelekha R", "sreelekha.r@mindcare.demo", "Malappuram", "+919846200109"],
].map(([id, name, email, city, phone]) => ({ _id: id, name, email, role: "therapist" as const, city, phone }));

async function ensureUser(spec: DemoUser, passwordHash: string) {
  const existing = await User.findById(spec._id).select("+password");
  if (existing) {
    if (existing.email !== spec.email || existing.role !== spec.role) {
      throw new Error(`Fixed demo account ${spec._id} has a different email or role and will not be modified.`);
    }
    return existing;
  }

  const emailOwner = await User.findOne({ email: spec.email });
  if (emailOwner) {
    throw new Error(`Email ${spec.email} belongs to ${emailOwner._id}; refusing to change its ObjectId.`);
  }

  return User.create({
    _id: objectId(spec._id), name: spec.name, email: spec.email, password: passwordHash, role: spec.role,
    status: "approved", phone: spec.phone, phoneNumber: spec.phone, city: spec.city, state: "Kerala",
    address: `${spec.city}, Kerala`, country: "India", countryCode: "IN", dialCode: "+91",
    currency: "Indian Rupee", currencyCode: "INR", timezone: "Asia/Kolkata", preferredLocale: "en-IN",
    phoneVerified: true, onboardingCompleted: true, wellnessScore: 74, streak: 3, level: 1, xp: 20,
    verifiedCompanion: Boolean(spec.verifiedCompanion),
    companionVerificationStatus: spec.verifiedCompanion ? "verified" : "none",
    isAvailableAsCompanion: Boolean(spec.verifiedCompanion),
  });
}

async function ensureTherapistProfile(user: any, index: number, primary = false) {
  await Therapist.updateOne(
    { userId: user._id },
    {
      $setOnInsert: {
        name: user.name, userId: user._id, title: primary ? "Clinical Psychologist" : "Counselling Psychologist",
        qualification: primary ? "M.Phil Clinical Psychology" : "M.Sc Clinical Psychology",
        specializations: primary ? ["Anxiety", "Stress Management", "CBT", "Mindfulness"] : ["Anxiety", "CBT", "Wellness"],
        yearsExperience: primary ? 10 : 5 + (index % 8), consultationFee: primary ? 1200 : 900 + index * 50,
        availability: JSON.stringify({ Monday: { active: true, hours: "09:00 AM - 05:00 PM" }, Tuesday: { active: true, hours: "09:00 AM - 05:00 PM" }, Wednesday: { active: true, hours: "09:00 AM - 05:00 PM" }, Thursday: { active: true, hours: "09:00 AM - 05:00 PM" }, Friday: { active: true, hours: "09:00 AM - 05:00 PM" }, Saturday: { active: false, hours: "" }, Sunday: { active: false, hours: "" } }),
        verificationStatus: "Verified", verifiedAt: daysAgo(180), rating: 0, reviewCount: 0,
        languages: ["Malayalam", "English"], hospitalClinic: `${user.city} Wellness Centre`, emergencyOnCall: false, emergencyStatus: "offline",
      },
    },
    { upsert: true },
  );
}

export async function ensureFixedRoleDemoData() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const admin = await ensureUser({ _id: FIXED_DEMO_IDS.admin, name: "MindCare Admin", email: "admin@mindcare.com", role: "admin", city: "Kochi", phone: "+919846000001" }, passwordHash);
  const user = await ensureUser({ _id: FIXED_DEMO_IDS.user, name: "Anjali Nair", email: "alex@mindcare.com", role: "user", city: "Kochi", phone: "+919846000002" }, passwordHash);
  const therapistUser = await ensureUser({ _id: FIXED_DEMO_IDS.therapist, name: "Dr. Devika Pillai", email: "sarah@mindcare.com", role: "therapist", city: "Thiruvananthapuram", phone: "+919846000003" }, passwordHash);
  const patients = await Promise.all(PATIENTS.map((patient) => ensureUser(patient, passwordHash)));
  const therapistUsers = await Promise.all(THERAPISTS.map((therapist) => ensureUser(therapist, passwordHash)));
  await ensureTherapistProfile(therapistUser, 0, true);
  await Promise.all(therapistUsers.map((therapist, index) => ensureTherapistProfile(therapist, index + 1)));

  const primaryProfile = await Therapist.findOne({ userId: therapistUser._id }).lean();
  const consultationFee = primaryProfile?.consultationFee || 1200;
  const appointmentIds = PATIENTS.map((_, index) => `7c5651d150636bede457cd${String(index + 1).padStart(2, "0")}`);

  for (let index = 0; index < patients.length; index++) {
    const appointmentId = objectId(appointmentIds[index]);
    const date = daysAgo(14 + index * 18);
    await Appointment.updateOne({ _id: appointmentId }, { $setOnInsert: {
      userId: patients[index]._id, therapistId: therapistUser._id, date, timeSlot: `${String(9 + (index % 5)).padStart(2, "0")}:00 AM - ${String(10 + (index % 5)).padStart(2, "0")}:00 AM`,
      status: "COMPLETED", paymentStatus: "SUCCESS", refundStatus: "NOT_REQUIRED", type: index % 2 ? "chat" : "voice", reason: ["Work-life balance", "Sleep routine", "Stress management", "Mindfulness practice"][index % 4],
      consultationFee, amountPaid: consultationFee, paymentId: `pay_demo_therapist_${index + 1}`, orderId: `order_demo_therapist_${index + 1}`, messagingEnabled: true,
      approvalTimestamp: date, bookingDate: date, createdAt: date, updatedAt: date,
    } }, { upsert: true, timestamps: false });
    await PaymentHistory.updateOne({ _id: objectId(`7d5651d150636bede457cd${String(index + 1).padStart(2, "0")}`) }, { $setOnInsert: {
      userId: patients[index]._id, appointmentId, type: "therapist_consultation", description: `Completed consultation with ${therapistUser.name}`,
      invoiceNumber: `pay_demo_therapist_${index + 1}`, razorpayOrderId: `order_demo_therapist_${index + 1}`, paymentMethod: "Demo Razorpay", amount: consultationFee,
      platformCommission: Math.round(consultationFee * 0.15), companionEarnings: Math.round(consultationFee * 0.85), gst: 0, status: "success", createdAt: date, updatedAt: date,
    } }, { upsert: true, timestamps: false });
    const conversationId = objectId(`7e5651d150636bede457cd${String(index + 1).padStart(2, "0")}`);
    await AppointmentConversation.updateOne({ appointmentId }, { $setOnInsert: { _id: conversationId, appointmentId, userId: patients[index]._id, therapistId: therapistUser._id, lastMessageAt: date, lastMessagePreview: "Thank you for today's consultation.", createdAt: date, updatedAt: date } }, { upsert: true, timestamps: false });
    for (let messageIndex = 0; messageIndex < 2; messageIndex++) {
      const sentByTherapist = messageIndex === 1;
      await AppointmentMessage.updateOne({ _id: objectId(`7f5651d150636bede457${String(index * 2 + messageIndex + 1).padStart(4, "0")}`) }, { $setOnInsert: {
        conversationId, appointmentId, senderId: sentByTherapist ? therapistUser._id : patients[index]._id, recipientId: sentByTherapist ? patients[index]._id : therapistUser._id,
        text: sentByTherapist ? "Thank you for sharing. Please continue the routine we discussed and note what feels helpful." : "I completed the practice we discussed and would like to continue with the next session.",
        deliveredAt: new Date(date.getTime() + messageIndex * 60_000), createdAt: new Date(date.getTime() + messageIndex * 60_000), updatedAt: new Date(date.getTime() + messageIndex * 60_000),
      } }, { upsert: true, timestamps: false });
    }
  }

  for (let index = 0; index < 10; index++) {
    const appointmentId = objectId(`8a5651d150636bede457cd${String(index + 1).padStart(2, "0")}`);
    const provider = index === 0 ? therapistUser : therapistUsers[(index - 1) % therapistUsers.length];
    const date = daysAgo(index * 11 + 3);
    await Appointment.updateOne({ _id: appointmentId }, { $setOnInsert: {
      userId: user._id, therapistId: provider._id, date, timeSlot: "04:00 PM - 05:00 PM", status: "COMPLETED", paymentStatus: "SUCCESS", refundStatus: "NOT_REQUIRED", type: index % 2 ? "chat" : "voice", reason: "Wellness follow-up", consultationFee: 1000, amountPaid: 1000, paymentId: `pay_demo_user_${index + 1}`, orderId: `order_demo_user_${index + 1}`, messagingEnabled: true, approvalTimestamp: date, bookingDate: date, createdAt: date, updatedAt: date,
    } }, { upsert: true, timestamps: false });
    await PaymentHistory.updateOne({ _id: objectId(`8b5651d150636bede457cd${String(index + 1).padStart(2, "0")}`) }, { $setOnInsert: { userId: user._id, appointmentId, type: "therapist_consultation", description: "Completed wellness consultation", invoiceNumber: `pay_demo_user_${index + 1}`, razorpayOrderId: `order_demo_user_${index + 1}`, paymentMethod: "Demo Razorpay", amount: 1000, platformCommission: 150, companionEarnings: 850, gst: 0, status: "success", createdAt: date, updatedAt: date } }, { upsert: true, timestamps: false });
  }

  const moods = ["Calm", "Hopeful", "Focused", "Relaxed", "Grateful"];
  for (let index = 0; index < 10; index++) {
    const date = daysAgo(index);
    await Mood.updateOne({ _id: objectId(`8c5651d150636bede457cd${String(index + 1).padStart(2, "0")}`) }, { $setOnInsert: { userId: user._id, rating: 3 + (index % 3), emotion: moods[index % moods.length], note: "Recorded a short Kerala wellness check-in.", date, createdAt: date, updatedAt: date } }, { upsert: true, timestamps: false });
    await Journal.updateOne({ _id: objectId(`8d5651d150636bede457cd${String(index + 1).padStart(2, "0")}`) }, { $setOnInsert: { userId: user._id, title: `Wellness reflection ${index + 1}`, content: "A safe reflection on routine, family support, rest, and mindful daily practices in Kerala.", mood: 3 + (index % 3), date, createdAt: date, updatedAt: date } }, { upsert: true, timestamps: false });
    await Chat.updateOne({ _id: objectId(`8e5651d150636bede457cd${String(index + 1).padStart(2, "0")}`) }, { $setOnInsert: { userId: user._id, conversationId: "demo-wellness-history", sessionId: "demo-wellness-history", sender: index % 2 ? "ai" : "user", recipient: "ai", text: index % 2 ? "That sounds like a constructive routine. What would you like to carry into tomorrow?" : "I would like to keep a balanced evening routine after work.", time: date, riskLevel: "none", emotion: "calm", createdAt: date, updatedAt: date } }, { upsert: true, timestamps: false });
    await Notification.updateOne({ _id: objectId(`8f5651d150636bede457cd${String(index + 1).padStart(2, "0")}`) }, { $setOnInsert: { userId: user._id, title: "Wellness reminder", message: "Your Kerala wellness summary is ready to review.", type: "info", read: index < 5, date, createdAt: date, updatedAt: date } }, { upsert: true, timestamps: false });
  }

  const resourceTopics = ["Breathing practice", "Sleep routine", "Mindful walking", "Work boundaries", "Family support", "Relaxation", "Thought journal", "Rest planning", "Grounding exercise", "Wellness review"];
  for (let index = 0; index < 10; index++) {
    await Resource.updateOne({ _id: objectId(`9a5651d150636bede457cd${String(index + 1).padStart(2, "0")}`) }, { $setOnInsert: { type: ["article", "exercise", "audio", "video"][index % 4], category: "Kerala Wellness", image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=800", tag: "Wellness", title: resourceTopics[index], meta: "Evidence-informed wellbeing resource", content: `A safe, general wellbeing resource about ${resourceTopics[index].toLowerCase()}.`, rating: 0, featured: index < 3, published: true } }, { upsert: true });
  }

  for (let index = 0; index < 10; index++) {
    const date = daysAgo(index * 2);
    await AuditLog.updateOne({ _id: objectId(`9b5651d150636bede457cd${String(index + 1).padStart(2, "0")}`) }, { $setOnInsert: { userId: admin._id, userName: admin.name, userEmail: admin.email, role: "admin", action: "DEMO_ROLE_DATA_REVIEW", status: "success", details: `Reviewed Kerala demo data batch ${index + 1}.`, createdAt: date, updatedAt: date } }, { upsert: true, timestamps: false });
    await Reports.updateOne({ _id: objectId(`9c5651d150636bede457cd${String(index + 1).padStart(2, "0")}`) }, { $setOnInsert: { reporterId: admin._id, reportedId: patients[index]._id, reason: "Routine demo quality review", evidence: "Safe fictional Kerala demo record.", actionTaken: "reviewed", createdAt: date, updatedAt: date } }, { upsert: true, timestamps: false });
    await EmergencyAlert.updateOne({ _id: objectId(`9d5651d150636bede457cd${String(index + 1).padStart(2, "0")}`) }, { $setOnInsert: { userId: patients[index]._id, userName: patients[index].name, detectedTrigger: "Routine wellbeing follow-up", messageContent: "Safe fictional follow-up record; no emergency action is required.", riskLevel: "low", confidenceScore: 0, source: "manual", status: "resolved", resolvedBy: admin._id, resolutionNotes: "Demo quality review completed.", respondedAt: date, createdAt: date, updatedAt: date } }, { upsert: true, timestamps: false });
  }

  const counts = {
    therapistPatients: await Appointment.distinct("userId", { therapistId: therapistUser._id }),
    therapistAppointments: await Appointment.countDocuments({ therapistId: therapistUser._id }),
    therapistMessages: await AppointmentMessage.countDocuments({ recipientId: therapistUser._id }),
    therapistSettlements: await Appointment.countDocuments({ therapistId: therapistUser._id, status: "COMPLETED", paymentStatus: "SUCCESS" }),
    userMoods: await Mood.countDocuments({ userId: user._id }), userJournals: await Journal.countDocuments({ userId: user._id }),
    userChats: await Chat.countDocuments({ userId: user._id }), userNotifications: await Notification.countDocuments({ userId: user._id }),
    userAppointments: await Appointment.countDocuments({ userId: user._id }), publishedResources: await Resource.countDocuments({ published: true }),
    users: await User.countDocuments(), therapists: await Therapist.countDocuments(), appointments: await Appointment.countDocuments(), payments: await PaymentHistory.countDocuments(), audits: await AuditLog.countDocuments(), reports: await Reports.countDocuments(), alerts: await EmergencyAlert.countDocuments(),
  };
  console.log("[FIXED-ROLE-DEMO-SEED]", JSON.stringify({ ...counts, therapistPatients: counts.therapistPatients.length }, null, 2));
  return counts;
}
