import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";

import { connectDB } from "../config/db.ts";
import { Appointment } from "../models/Appointment.ts";
import { AuditLog } from "../models/AuditLog.ts";
import { Chat } from "../models/Chat.ts";
import { EmergencyAlert } from "../models/EmergencyAlert.ts";
import { Mood } from "../models/Mood.ts";
import { Notification } from "../models/Notification.ts";
import { PaymentHistory } from "../models/PaymentHistory.ts";
import { Therapist } from "../models/Therapist.ts";
import { User } from "../models/User.ts";

dotenv.config();

const seedPassword = await bcrypt.hash("MindCareDemo!2026", 10);

async function ensureUser(input: { name: string; email: string; role?: "user" | "therapist" | "admin"; panNumber?: string; phone: string }) {
  return User.findOneAndUpdate(
    { email: input.email },
    {
      $setOnInsert: {
        name: input.name,
        email: input.email,
        password: seedPassword,
        role: input.role || "user",
        status: "approved",
        panNumber: input.panNumber,
        phone: input.phone,
        phoneNumber: input.phone,
        country: "India",
        countryCode: "IN",
        dialCode: "+91",
        onboardingCompleted: true,
        wellnessScore: 72,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

async function seedAdminDashboardData() {
  await connectDB();

  const admin = await ensureUser({
    name: "MindCare Operations Admin",
    email: "admin.dashboard.seed@mindcare.local",
    role: "admin",
    phone: "+919900000001",
  });

  const therapistUsers = await Promise.all([
    ensureUser({ name: "Dr. Meera Nair", email: "meera.dashboard.seed@mindcare.local", role: "therapist", panNumber: "ADMSD1001A", phone: "+919900000011" }),
    ensureUser({ name: "Dr. Arjun Varma", email: "arjun.dashboard.seed@mindcare.local", role: "therapist", panNumber: "ADMSD1002B", phone: "+919900000012" }),
  ]);

  const therapistProfiles = await Promise.all(
    therapistUsers.map((user, index) => Therapist.findOneAndUpdate(
      { userId: user._id },
      {
        $setOnInsert: {
          userId: user._id,
          name: user.name,
          title: index === 0 ? "Clinical Psychologist" : "Counselling Psychologist",
          qualification: index === 0 ? "M.Phil Clinical Psychology" : "M.Sc Counselling Psychology",
          specializations: index === 0 ? ["Anxiety", "CBT"] : ["Stress", "Relationships"],
          yearsExperience: 8 + index,
          consultationFee: 1200 + index * 300,
          availability: "Mon-Fri (9:00 AM - 5:00 PM)",
          bio: "MindCare verified therapist profile used for the operational dashboard dataset.",
          verificationStatus: "Verified",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )),
  );

  const patientNames = ["Ananya Joseph", "Rohan Menon", "Farah Khan", "Vivek Kumar", "Nisha Thomas", "Kiran Das", "Maya George", "Aditya Pillai"];
  const patients = await Promise.all(patientNames.map((name, index) => ensureUser({
    name,
    email: `patient${index + 1}.dashboard.seed@mindcare.local`,
    panNumber: `ADMSP${String(1101 + index).padStart(4, "0")}C`,
    phone: `+919900000${String(21 + index).padStart(3, "0")}`,
  })));

  const today = new Date();
  today.setHours(10, 0, 0, 0);
  let completedAppointments = 0;
  let upcomingAppointments = 0;
  let paymentsCreated = 0;

  for (let index = 0; index < 14; index++) {
    const patient = patients[index % patients.length];
    const therapist = therapistProfiles[index % therapistProfiles.length];
    const completed = index < 9;
    const date = new Date(today);
    date.setDate(today.getDate() + (completed ? -(index * 3 + 2) : index - 8));
    date.setHours(9 + (index % 5), 0, 0, 0);
    const fee = therapist.consultationFee;
    const seedReference = `admin-dashboard-appointment-${index + 1}`;

    const appointment = await Appointment.findOneAndUpdate(
      { userId: patient._id, therapistId: therapist.userId, notes: seedReference },
      {
        $setOnInsert: {
          userId: patient._id,
          therapistId: therapist.userId,
          date,
          timeSlot: `${String(9 + (index % 5)).padStart(2, "0")}:00 AM - ${String(10 + (index % 5)).padStart(2, "0")}:00 AM`,
          status: completed ? "COMPLETED" : "APPROVED",
          paymentStatus: "SUCCESS",
          refundStatus: "NOT_REQUIRED",
          type: index % 2 === 0 ? "voice" : "chat",
          consultationFee: fee,
          amountPaid: fee,
          paymentId: `pay_admin_dashboard_${index + 1}`,
          orderId: `order_admin_dashboard_${index + 1}`,
          gatewayTransactionId: `pay_admin_dashboard_${index + 1}`,
          approvalTimestamp: new Date(date.getTime() - 24 * 60 * 60 * 1000),
          messagingEnabled: true,
          reason: ["Anxiety management", "Stress and burnout", "Sleep concerns", "Relationship support"][index % 4],
          notes: seedReference,
          bookingDate: new Date(date.getTime() - 3 * 24 * 60 * 60 * 1000),
          createdAt: new Date(date.getTime() - 3 * 24 * 60 * 60 * 1000),
          updatedAt: completed ? date : new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, timestamps: false },
    );

    if (completed) completedAppointments++; else upcomingAppointments++;

    const result = await PaymentHistory.updateOne(
      { invoiceNumber: `INV-ADMIN-DASH-${index + 1}` },
      {
        $setOnInsert: {
          userId: patient._id,
          appointmentId: appointment._id,
          type: "therapist_consultation",
          description: `Completed MindCare consultation with ${therapist.name}`,
          invoiceNumber: `INV-ADMIN-DASH-${index + 1}`,
          paymentMethod: index % 2 === 0 ? "UPI" : "Razorpay Checkout",
          amount: fee,
          platformCommission: Math.round(fee * 0.15),
          companionEarnings: Math.round(fee * 0.85),
          gst: Math.round(fee * 0.18),
          status: "SUCCESS",
          createdAt: date,
          updatedAt: date,
        },
      },
      { upsert: true, timestamps: false },
    );
    if (result.upsertedCount) paymentsCreated++;
  }

  for (const [index, patient] of patients.entries()) {
    for (let monthOffset = 0; monthOffset < 6; monthOffset++) {
      const moodDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 8 + (index % 14), 12, 0, 0);
      await Mood.updateOne(
        { userId: patient._id, note: `admin-dashboard-mood-${index}-${monthOffset}` },
        {
          $setOnInsert: {
            userId: patient._id,
            rating: 2 + ((index + monthOffset) % 4),
            emotion: ["calm", "hopeful", "anxious", "focused"][((index + monthOffset) % 4)],
            note: `admin-dashboard-mood-${index}-${monthOffset}`,
            date: moodDate,
            createdAt: moodDate,
            updatedAt: moodDate,
          },
        },
        { upsert: true, timestamps: false },
      );
    }
  }

  for (const [index, therapist] of therapistProfiles.entries()) {
    const reviews = [
      { rating: 5, text: "The session was thoughtful and well structured.", reviewerName: `Dashboard Seed Patient ${index + 1}A`, date: new Date(today.getTime() - 12 * 86400000) },
      { rating: 4, text: "Helpful guidance and clear next steps.", reviewerName: `Dashboard Seed Patient ${index + 1}B`, date: new Date(today.getTime() - 5 * 86400000) },
    ];
    for (const review of reviews) {
      await Therapist.updateOne(
        { _id: therapist._id, "reviews.reviewerName": { $ne: review.reviewerName } },
        { $push: { reviews: review } },
      );
    }
  }

  await EmergencyAlert.updateOne(
    { userId: patients[0]._id, messageContent: "admin-dashboard-active-alert" },
    {
      $setOnInsert: {
        userId: patients[0]._id,
        userName: patients[0].name,
        detectedTrigger: "Elevated distress pattern",
        messageContent: "admin-dashboard-active-alert",
        riskLevel: "high",
        status: "active",
        source: "ai_chat",
        createdAt: new Date(),
      },
    },
    { upsert: true, timestamps: false },
  );

  await Chat.updateOne(
    { userId: patients[0]._id, conversationId: "admin-dashboard-live-chat" },
    {
      $set: {
        userId: patients[0]._id,
        conversationId: "admin-dashboard-live-chat",
        sender: "user",
        recipient: "ai",
        text: "I would like some help with managing stress this week.",
        emotion: "anxious",
        time: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true, timestamps: false },
  );

  await Notification.updateOne(
    { userId: admin._id, title: "Admin Dashboard Dataset Ready" },
    {
      $setOnInsert: {
        userId: admin._id,
        title: "Admin Dashboard Dataset Ready",
        message: "Linked appointments, payments, reviews, mood activity, and alerts are available for operational review.",
        type: "info",
        read: false,
      },
    },
    { upsert: true },
  );

  await AuditLog.updateOne(
    { userEmail: admin.email, action: "ADMIN_DASHBOARD_DATASET_SEEDED" },
    {
      $setOnInsert: {
        userId: admin._id,
        userName: admin.name,
        userEmail: admin.email,
        role: "admin",
        action: "ADMIN_DASHBOARD_DATASET_SEEDED",
        status: "success",
        details: "Created linked operational dashboard records for local development.",
      },
    },
    { upsert: true },
  );

  console.log(JSON.stringify({
    completedAppointments,
    upcomingAppointments,
    newPayments: paymentsCreated,
    patients: patients.length,
    therapists: therapistProfiles.length,
  }, null, 2));
}

seedAdminDashboardData()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
