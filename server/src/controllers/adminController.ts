import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.ts";
import { User } from "../models/User.ts";
import { Therapist } from "../models/Therapist.ts";
import { BlockedAccount } from "../models/BlockedAccount.ts";
import { AuditLog } from "../models/AuditLog.ts";
import { EmergencyAlert } from "../models/EmergencyAlert.ts";
import { Notification } from "../models/Notification.ts";
import { logActivity } from "../utils/auditLogger.ts";
import { PaymentHistory } from "../models/PaymentHistory.ts";
import { Mood } from "../models/Mood.ts";
import crypto from "crypto";
import { Reports } from "../models/Reports.ts";
import { SystemSettings } from "../models/SystemSettings.ts";
import { Journal } from "../models/Journal.ts";
import { Chat } from "../models/Chat.ts";
import { Appointment } from "../models/Appointment.ts";
import { CompanionSession } from "../models/CompanionSession.ts";
import { CompanionEarnings } from "../models/CompanionEarnings.ts";
import bcryptjs from "bcryptjs";
import { maskPan } from "../utils/pan.ts";

const SUCCESS_PAYMENT_STATUSES = ["success", "SUCCESS"];
const FAILED_PAYMENT_STATUSES = ["failed", "FAILED"];

function adminListUser(user: any) {
  const item = user.toObject ? user.toObject() : user;
  return { ...item, panNumber: maskPan(item.panNumber || item.panCard), panCard: undefined };
}

// ─── THERAPIST APPROVAL WORKFLOW ─────────────────────────────────────────────

export async function getTherapistsAdmin(req: AuthRequest, res: Response) {
  try {
    const { search, status } = req.query;
    const query: any = { role: "therapist" };

    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query).select("+panNumber +panCard").sort({ createdAt: -1 });
    return res.status(200).json({ therapists: users.map(adminListUser) });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function updateTherapistStatus(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body; // "approved" | "suspended" | "rejected" | "pending"

    if (!["approved", "suspended", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status state" });
    }

    const therapistUser = await User.findOne({ _id: id, role: "therapist" });
    if (!therapistUser) {
      return res.status(404).json({ message: "Therapist not found" });
    }

    therapistUser.status = status;
    await therapistUser.save();

    // Notify therapist user
    let title = "Registration Request Update";
    let message = `Your therapist registration status has been updated to: ${status}.`;

    if (status === "approved") {
      title = "Congratulations! Therapist Registration Approved";
      message = "Your professional therapist registration has been approved. You can now login and receive appointments.";
    } else if (status === "suspended") {
      title = "Therapist Account Suspended";
      message = "Your therapist account has been suspended by an administrator. Please contact support.";
    }

    await Notification.create({
      userId: therapistUser._id,
      title,
      message,
      type: status === "approved" ? "info" : "alert",
    });

    await logActivity({
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: req.user.email,
      role: req.user.role,
      action: "THERAPIST_STATUS_CHANGE",
      status: "success",
      details: `Changed status of therapist ${therapistUser.email} to ${status}`,
      req,
    });

    return res.status(200).json({ therapist: therapistUser });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// ─── VERIFIED COMPANION BADGE ────────────────────────────────────────────────
export async function getCompanionsAdmin(req: AuthRequest, res: Response) {
  try {
    const { search, verificationStatus } = req.query;
    const query: any = { role: "user" }; // companions are users with verificationStatus

    if (verificationStatus) {
      query.companionVerificationStatus = verificationStatus;
    } else {
      query.companionVerificationStatus = { $in: ["pending", "verified", "rejected"] };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const companions = await User.find(query).sort({ updatedAt: -1 });
    return res.status(200).json({ companions });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function requestCompanionVerification(req: AuthRequest, res: Response) {
  try {
    const { panCard } = req.body;
    if (!panCard) {
      return res.status(400).json({ message: "PAN Card number is mandatory for companion registration." });
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const formattedPan = panCard.trim().toUpperCase();
    if (!panRegex.test(formattedPan)) {
      return res.status(400).json({ message: "Invalid PAN Card format. Must match standard Indian PAN (e.g. ABCDE1234F)." });
    }

    const duplicate = await User.findOne({ panCard: formattedPan, _id: { $ne: req.user._id } });
    if (duplicate) {
      return res.status(400).json({ message: "This PAN Card number is already registered under another account." });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.panCard = formattedPan;
    user.companionVerificationStatus = "pending";
    await user.save();

    await logActivity({
      userId: user._id.toString(),
      userName: user.name,
      userEmail: user.email,
      role: user.role,
      action: "COMPANION_VERIFY_REQUEST",
      status: "success",
      details: `User ${user.email} requested companion verification badge`,
      req,
    });

    // Notify Admin
    const admins = await User.find({ role: "admin" });
    for (const admin of admins) {
      await Notification.create({
        userId: admin._id,
        title: "New Companion Verification Request",
        message: `${user.name} is requesting a Verified Companion Badge.`,
        type: "info",
      });
    }

    return res.status(200).json({ user });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function verifyCompanionStatus(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { verify } = req.body; // boolean

    const companionUser = await User.findById(id);
    if (!companionUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (verify) {
      companionUser.companionVerificationStatus = "verified";
      companionUser.verifiedCompanion = true;
    } else {
      companionUser.companionVerificationStatus = "rejected";
      companionUser.verifiedCompanion = false;
    }
    await companionUser.save();

    await Notification.create({
      userId: companionUser._id,
      title: verify ? "Companion Badge Approved!" : "Companion Verification Declined",
      message: verify
        ? "Congratulations! Your Companion Verification request was approved. You now have a Verified checkmark."
        : "Your request for companion verification badge was declined by an administrator.",
      type: verify ? "info" : "alert",
    });

    await logActivity({
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: req.user.email,
      role: req.user.role,
      action: "COMPANION_VERIFICATION_RESOLVE",
      status: "success",
      details: `Companion verification for user ${companionUser.email} was ${verify ? "approved" : "rejected"}`,
      req,
    });

    return res.status(200).json({ companion: companionUser });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// ─── AUDIT LOG SYSTEM ────────────────────────────────────────────────────────
export async function getAuditLogs(req: AuthRequest, res: Response) {
  try {
    const { search, role, status, limit = 50, page = 1 } = req.query;
    const query: any = {};

    if (role) query.role = role;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: "i" } },
        { userEmail: { $regex: search, $options: "i" } },
        { action: { $regex: search, $options: "i" } },
        { details: { $regex: search, $options: "i" } },
      ];
    }

    const parsedLimit = Number(limit);
    const parsedPage = Number(page);

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit);

    const total = await AuditLog.countDocuments(query);

    return res.status(200).json({
      logs,
      total,
      pages: Math.ceil(total / parsedLimit),
      currentPage: parsedPage,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// ─── EMERGENCY RISK DETECTION ────────────────────────────────────────────────
export async function getEmergencyAlerts(req: AuthRequest, res: Response) {
  try {
    const { status } = req.query;
    const query: any = {};
    if (status) query.status = status;

    // Therapists may only view alerts for patients with whom they have an
    // approved clinical relationship. Administrators retain global access.
    if (req.user.role === "therapist") {
      const therapist = await Therapist.findOne({ userId: req.user._id }).select("_id");
      const therapistIds = therapist ? [req.user._id, therapist._id] : [req.user._id];
      const patientIds = await Appointment.distinct("userId", {
        therapistId: { $in: therapistIds },
        status: { $in: ["APPROVED", "IN_PROGRESS", "COMPLETED"] },
      });
      query.userId = { $in: patientIds };
    }

    const alerts = await EmergencyAlert.find(query).sort({ createdAt: -1 });
    return res.status(200).json({ alerts });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function resolveEmergencyAlert(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const alert = await EmergencyAlert.findById(id);
    if (!alert) {
      return res.status(404).json({ message: "Emergency alert not found" });
    }

    if (req.user.role === "therapist") {
      const therapist = await Therapist.findOne({ userId: req.user._id }).select("_id");
      const therapistIds = therapist ? [req.user._id, therapist._id] : [req.user._id];
      const isAssignedPatient = await Appointment.exists({
        therapistId: { $in: therapistIds },
        userId: alert.userId,
        status: { $in: ["APPROVED", "IN_PROGRESS", "COMPLETED"] },
      });
      if (!isAssignedPatient) {
        return res.status(403).json({ message: "You do not have access to this patient's emergency alert." });
      }
    }

    alert.status = "resolved";
    alert.resolvedBy = req.user._id;
    alert.resolutionNotes = notes || "Case reviewed and resolved.";
    alert.respondedAt = new Date();

    // Check SLA breach
    const openTimeMs = alert.respondedAt.getTime() - new Date(alert.createdAt).getTime();
    const openTimeMins = openTimeMs / (1000 * 60);
    if (openTimeMins > (alert.slaMinutes || 15)) {
      alert.slaBreach = true;
    }

    await alert.save();

    await logActivity({
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: req.user.email,
      role: req.user.role,
      action: "EMERGENCY_ALERT_RESOLVE",
      status: "success",
      details: `Resolved emergency alert ID ${id} with notes: ${notes}`,
      req,
    });

    return res.status(200).json({ alert });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// ─── ADVANCED SEARCH / DATA LISTS ────────────────────────────────────────────
export async function getAllUsers(req: AuthRequest, res: Response) {
  try {
    const { search, role, country, status, limit = 50, page = 1 } = req.query;
    const query: any = {};

    if (role) query.role = role;
    if (country) query.country = country;
    if (status) query.status = status;
    if (search) {
      const searchStr = String(search).trim();
      const isObjectId = mongoose.Types.ObjectId.isValid(searchStr);
      query.$or = [
        { name: { $regex: searchStr, $options: "i" } },
        { email: { $regex: searchStr, $options: "i" } },
        { phone: { $regex: searchStr, $options: "i" } },
        { panNumber: { $regex: searchStr, $options: "i" } },
        { panCard: { $regex: searchStr, $options: "i" } },
        ...(isObjectId ? [{ _id: searchStr }] : [])
      ];
    }

    const parsedLimit = Number(limit);
    const parsedPage = Number(page);

    const users = await User.find(query).select("+panNumber +panCard")
      .sort({ createdAt: -1 })
      .skip((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit);
      
    const total = await User.countDocuments(query);

    return res.status(200).json({ 
      users: users.map(adminListUser),
      total,
      pages: Math.ceil(total / parsedLimit),
      currentPage: parsedPage
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function blockAccount(req: AuthRequest, res: Response) {
  try {
    const { reason, category } = req.body;
    const userId = req.params.id || req.body.userId;
    if (!userId || !reason) {
      return res.status(400).json({ message: "userId and reason are required to block an account." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.status = "blocked";
    await user.save();

    if (user.role === "therapist") {
      await Therapist.updateOne({ userId: user._id }, { $set: { verificationStatus: "Rejected" } });
    }

    const pan = user.panNumber || user.panCard || "";
    await BlockedAccount.findOneAndUpdate(
      { $or: [{ userId: user._id }, ...(pan ? [{ panNumber: pan }] : [])] },
      {
        userId: user._id,
        panNumber: pan,
        email: user.email,
        phone: user.phone,
        reason,
        category: category || "Policy Violation",
        blockedBy: req.user._id,
        blockedAt: new Date()
      },
      { upsert: true, new: true }
    );

    await Notification.create({
      userId: user._id,
      title: "Account Restricted",
      message: "Your MindCare account has been restricted by an administrator. Please contact support for assistance.",
      type: "alert",
    });

    await logActivity({
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: req.user.email,
      role: req.user.role,
      action: "BLOCK_ACCOUNT",
      status: "success",
      details: `Admin blocked ${user.role} (${user.email}) - Category: ${category || "Policy Violation"}, Reason: ${reason}`,
      req
    });

    return res.status(200).json({ message: "Account blocked successfully", user });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function unblockAccount(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = id || req.body.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.status = "approved";
    await user.save();

    const pan = user.panNumber || user.panCard || "";
    await BlockedAccount.deleteMany({
      $or: [
        { userId: user._id },
        { email: user.email },
        ...(pan ? [{ panNumber: pan }] : [])
      ]
    });

    await Notification.create({
      userId: user._id,
      title: "Account Restored",
      message: "Your MindCare account has been restored by an administrator. You may sign in again.",
      type: "info",
    });

    await logActivity({
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: req.user.email,
      role: req.user.role,
      action: "UNBLOCK_ACCOUNT",
      status: "success",
      details: `Admin unblocked ${user.role} (${user.email})`,
      req
    });

    return res.status(200).json({ message: "Account unblocked successfully", user });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getAdminDashboardStats(req: AuthRequest, res: Response) {
  try {
    const totalUsers = await User.countDocuments({ role: "user" });
    const activeUsers = await User.countDocuments({ role: "user", status: "approved" });
    const suspendedUsers = await User.countDocuments({ role: "user", status: "suspended" });
    
    const totalTherapists = await User.countDocuments({ role: "therapist" });
    const pendingTherapists = await User.countDocuments({ role: "therapist", status: "pending" });
    const approvedTherapists = await User.countDocuments({ role: "therapist", status: "approved" });
    const rejectedTherapists = await User.countDocuments({ role: "therapist", status: "rejected" });

    const totalCompanions = await User.countDocuments({ verifiedCompanion: true });

    // 1. Weekly Activity Data
    const today = new Date();
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(today.getDate() - (6 - i));
      return d;
    });

    const weeklyActivityData = await Promise.all(
      last7Days.map(async (date) => {
        const startOfDay = new Date(date.setHours(0, 0, 0, 0));
        const endOfDay = new Date(date.setHours(23, 59, 59, 999));
        
        const users = await User.countDocuments({
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        });
        
        const sessions = await Appointment.countDocuments({
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        return {
          label: startOfDay.toLocaleDateString('en-US', { weekday: 'short' }),
          users,
          sessions,
        };
      })
    );

    // 2. Platform Mood Data
    const moods = await Mood.aggregate([
      { $group: { _id: "$emotion", count: { $sum: 1 } } }
    ]);
    
    const moodMapToColor: any = {
      'great': { name: 'Happy', color: '#10b981' },
      'good': { name: 'Calm', color: '#3b82f6' },
      'okay': { name: 'Calm', color: '#3b82f6' },
      'bad': { name: 'Anxious', color: '#f59e0b' },
      'awful': { name: 'Sad', color: '#ef4444' },
      'calm': { name: 'Calm', color: '#3b82f6' },
      'hopeful': { name: 'Hopeful', color: '#10b981' },
      'anxious': { name: 'Anxious', color: '#f59e0b' },
      'focused': { name: 'Focused', color: '#8b5cf6' }
    };
    
    const platformMoodMap = new Map();
    moods.forEach(m => {
      const mapped = moodMapToColor[m._id] || { name: 'Calm', color: '#3b82f6' };
      const current = platformMoodMap.get(mapped.name) || 0;
      platformMoodMap.set(mapped.name, current + m.count);
    });
    
    const platformMoodData = Array.from(platformMoodMap.entries()).map(([name, value]) => {
      const color = (Object.values(moodMapToColor).find((m: any) => m.name === name) as any)?.color;
      return { name, value, color };
    });

    // 3. Monthly mood trend from real check-ins only.
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const monthlyTrendData = await Mood.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          avgScore: { $avg: { $multiply: ["$rating", 20] } },
          entries: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      {
        $project: {
          _id: 0,
          month: { $concat: [{ $toString: "$_id.year" }, "-", { $toString: "$_id.month" }] },
          avgScore: { $round: ["$avgScore", 1] },
          entries: 1,
        },
      },
    ]);

    // Aggregated Revenue metrics
    const paymentSummary = await PaymentHistory.aggregate([
      { $match: { status: { $in: SUCCESS_PAYMENT_STATUSES } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          platformRevenue: { $sum: "$platformCommission" },
          walletRevenue: { $sum: "$companionEarnings" },
          subscriptionRevenue: { $sum: { $cond: [{ $eq: ["$type", "subscription"] }, "$amount", 0] } },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    // Dynamic country distributions
    const countryAgg = await User.aggregate([
      { $group: { _id: "$country", count: { $sum: 1 } } }
    ]);
    const countryStats = countryAgg.map(c => ({ name: c._id || "Unspecified", count: c.count }));

    // Dynamic mood distributions
    const moodAgg = await Mood.aggregate([
      { $group: { _id: "$rating", count: { $sum: 1 } } }
    ]);
    const moodMap = moodAgg.reduce((acc: any, cur) => {
      acc[cur._id] = cur.count;
      return acc;
    }, {});
    const moodStats = {
      happy: (moodMap[5] || 0) + (moodMap[4] || 0),
      neutral: moodMap[3] || 0,
      anxious: moodMap[2] || 0,
      sad: moodMap[1] || 0
    };

    const [appointmentStats, paymentStats, reviewStats, activeEmergencyAlerts, activeChats, registrationsToday, registrationsThisWeek] = await Promise.all([
      Appointment.aggregate([
        {
          $group: {
            _id: null,
            totalAppointments: { $sum: 1 },
            pendingApprovals: { $sum: { $cond: [{ $eq: ["$status", "PENDING_APPROVAL"] }, 1, 0] } },
            completedConsultations: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
            cancelledAppointments: { $sum: { $cond: [{ $in: ["$status", ["CANCELLED", "EXPIRED", "REJECTED"]] }, 1, 0] } },
            pendingRefunds: { $sum: { $cond: [{ $in: ["$refundStatus", ["PENDING", "PROCESSING"]] }, 1, 0] } },
          },
        },
      ]),
      PaymentHistory.aggregate([
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            successfulPayments: { $sum: { $cond: [{ $in: ["$status", SUCCESS_PAYMENT_STATUSES] }, 1, 0] } },
            failedPayments: { $sum: { $cond: [{ $in: ["$status", FAILED_PAYMENT_STATUSES] }, 1, 0] } },
            refundedPayments: { $sum: { $cond: [{ $in: ["$status", ["refunded", "REFUNDED"]] }, 1, 0] } },
            totalRevenue: { $sum: { $cond: [{ $in: ["$status", SUCCESS_PAYMENT_STATUSES] }, "$amount", 0] } },
            platformCommission: { $sum: { $cond: [{ $in: ["$status", SUCCESS_PAYMENT_STATUSES] }, "$platformCommission", 0] } },
          },
        },
      ]),
      Therapist.aggregate([
        { $unwind: "$reviews" },
        { $group: { _id: null, totalReviews: { $sum: 1 }, averageRating: { $avg: "$reviews.rating" } } },
      ]),
      EmergencyAlert.countDocuments({ status: "active" }),
      Chat.countDocuments({ createdAt: { $gte: new Date(today.getTime() - 5 * 60 * 1000) } }),
      User.countDocuments({ createdAt: { $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()) } }),
      User.countDocuments({ createdAt: { $gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) } }),
    ]);
    const appointmentSummary = appointmentStats[0] || {};
    const paymentMetrics = paymentStats[0] || {};
    const reviewSummary = reviewStats[0] || {};

    return res.status(200).json({
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers: suspendedUsers,
        blockedUsers: await User.countDocuments({ status: "blocked" }),
        onlineUsers: activeChats,
        totalTherapists,
        pendingTherapists,
        approvedTherapists,
        rejectedTherapists,
        totalCompanions,
        totalAppointments: appointmentSummary.totalAppointments || 0,
        pendingApprovals: appointmentSummary.pendingApprovals || 0,
        completedConsultations: appointmentSummary.completedConsultations || 0,
        cancelledAppointments: appointmentSummary.cancelledAppointments || 0,
        pendingRefunds: appointmentSummary.pendingRefunds || 0,
        totalRevenue: paymentMetrics.totalRevenue || 0,
        platformRevenue: paymentMetrics.platformCommission || 0,
        totalTransactions: paymentMetrics.totalTransactions || 0,
        successfulPayments: paymentMetrics.successfulPayments || 0,
        failedPayments: paymentMetrics.failedPayments || 0,
        refundedPayments: paymentMetrics.refundedPayments || 0,
        totalReviews: reviewSummary.totalReviews || 0,
        averageRating: reviewSummary.averageRating || 0,
        activeEmergencyAlerts,
        dailyRegistrations: registrationsToday,
        weeklyRegistrations: registrationsThisWeek,
        walletRevenue: paymentSummary[0]?.walletRevenue || 0,
        subscriptionRevenue: paymentSummary[0]?.subscriptionRevenue || 0,
        moodStats,
        countryStats,
        systemStatus: "Operational",
      },
      weeklyActivityData,
      platformMoodData,
      monthlyTrendData
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}



export async function suspendUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.status = "suspended";
    await user.save();
    
    await logActivity({
      userId: req.user?._id as string,
      userName: req.user?.name as string,
      userEmail: req.user?.email as string,
      role: req.user?.role as string,
      action: "USER_SUSPEND",
      status: "success",
      details: `Admin suspended user ${user.email}`,
      req
    });

    return res.status(200).json({ user });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function activateUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.status = "approved";
    await user.save();
    
    await logActivity({
      userId: req.user?._id as string,
      userName: req.user?.name as string,
      userEmail: req.user?.email as string,
      role: req.user?.role as string,
      action: "USER_ACTIVATE",
      status: "success",
      details: `Admin activated user ${user.email}`,
      req
    });

    return res.status(200).json({ user });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function resetUserPassword(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(tempPassword, salt);
    
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    
    user.password = hashedPassword;
    await user.save();
    
    await logActivity({
      userId: req.user?._id as string,
      userName: req.user?.name as string,
      userEmail: req.user?.email as string,
      role: req.user?.role as string,
      action: "password_reset",
      status: "success",
      details: `Admin reset password for user ${user.email}`,
      req
    });
    
    // In production, this would trigger an email. For now, we return a success message.
    return res.status(200).json({ message: "Password reset successfully. User will receive an email." });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getReportsAdmin(req: AuthRequest, res: Response) {
  try {
    const reports = await Reports.find().populate("reporterId").populate("reportedId").sort({ createdAt: -1 });
    return res.status(200).json({ reports });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}



// ─── REVENUE & PAYMENTS ──────────────────────────────────────────────────────

export async function getRevenueStats(req: AuthRequest, res: Response) {
  try {
    // ── Aggregate totals from successful payments ──────────────────────────
    const totalAgg = await PaymentHistory.aggregate([
      { $match: { status: { $in: SUCCESS_PAYMENT_STATUSES } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          platformCommission: { $sum: "$platformCommission" },
          companionEarnings: { $sum: "$companionEarnings" },
          totalGst: { $sum: "$gst" },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    // ── Subscription revenue ───────────────────────────────────────────────
    const subAgg = await PaymentHistory.aggregate([
      { $match: { status: { $in: SUCCESS_PAYMENT_STATUSES }, type: "subscription" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // ── Therapist revenue ──────────────────────────────────────────────────
    const therapistAgg = await PaymentHistory.aggregate([
      { $match: { status: { $in: SUCCESS_PAYMENT_STATUSES }, type: "therapist_consultation" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // ── Today's revenue ────────────────────────────────────────────────────
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const todayAgg = await PaymentHistory.aggregate([
      { $match: { status: { $in: SUCCESS_PAYMENT_STATUSES }, createdAt: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // ── This month's revenue ───────────────────────────────────────────────
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthAgg = await PaymentHistory.aggregate([
      { $match: { status: { $in: SUCCESS_PAYMENT_STATUSES }, createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // ── Previous month for growth % ────────────────────────────────────────
    const prevMonthStart = new Date(monthStart); prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthEnd = new Date(monthStart); prevMonthEnd.setMilliseconds(-1);
    const prevMonthAgg = await PaymentHistory.aggregate([
      { $match: { status: { $in: SUCCESS_PAYMENT_STATUSES }, createdAt: { $gte: prevMonthStart, $lte: prevMonthEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // ── Pending (failed) amount ────────────────────────────────────────────
    const failedAgg = await PaymentHistory.aggregate([
      { $match: { status: { $in: FAILED_PAYMENT_STATUSES } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // ── Revenue by type breakdown ──────────────────────────────────────────
    const typeBreakdown = await PaymentHistory.aggregate([
      { $match: { status: { $in: SUCCESS_PAYMENT_STATUSES } } },
      { $group: { _id: "$type", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    // ── Recent 20 transactions ─────────────────────────────────────────────
    const recentTransactions = await PaymentHistory.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .limit(20);

    const t = totalAgg[0] || { totalRevenue: 0, platformCommission: 0, companionEarnings: 0, totalGst: 0, totalTransactions: 0 };
    const thisMonth = monthAgg[0]?.total || 0;
    const prevMonth = prevMonthAgg[0]?.total || 0;
    const growthPct = prevMonth > 0 ? Math.round(((thisMonth - prevMonth) / prevMonth) * 100) : 0;

    return res.status(200).json({
      totalRevenue: Math.round(t.totalRevenue),
      platformCommission: Math.round(t.platformCommission),
      companionEarnings: Math.round(t.companionEarnings),
      subscriptionRevenue: Math.round(subAgg[0]?.total || 0),
      therapistRevenue: Math.round(therapistAgg[0]?.total || 0),
      totalGst: Math.round(t.totalGst),
      totalTransactions: t.totalTransactions,
      todayRevenue: Math.round(todayAgg[0]?.total || 0),
      monthlyRevenue: Math.round(thisMonth),
      growthPercent: growthPct,
      pendingAmount: Math.round(failedAgg[0]?.total || 0),
      netRevenue: Math.round((t.totalRevenue || 0) - (failedAgg[0]?.total || 0)),
      avgTransactionValue: t.totalTransactions > 0 ? Math.round(t.totalRevenue / t.totalTransactions) : 0,
      typeBreakdown,
      recentTransactions,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getRevenueChart(req: AuthRequest, res: Response) {
  try {
    const { period = "monthly" } = req.query;
    let chartData: any[] = [];

    if (period === "daily") {
      // Last 30 days, grouped by day
      const from = new Date(); from.setDate(from.getDate() - 29); from.setHours(0, 0, 0, 0);
      const agg = await PaymentHistory.aggregate([
        { $match: { status: { $in: SUCCESS_PAYMENT_STATUSES }, createdAt: { $gte: from } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$amount" },
            commission: { $sum: "$platformCommission" },
            earnings: { $sum: "$companionEarnings" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      chartData = agg.map((d) => ({
        label: new Date(d._id).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        revenue: Math.round(d.revenue),
        commission: Math.round(d.commission),
        earnings: Math.round(d.earnings),
        transactions: d.count,
      }));
    } else if (period === "weekly") {
      // Last 12 weeks
      const from = new Date(); from.setDate(from.getDate() - 83); from.setHours(0, 0, 0, 0);
      const agg = await PaymentHistory.aggregate([
        { $match: { status: { $in: SUCCESS_PAYMENT_STATUSES }, createdAt: { $gte: from } } },
        {
          $group: {
            _id: { $isoWeek: "$createdAt" },
            year: { $first: { $isoWeekYear: "$createdAt" } },
            revenue: { $sum: "$amount" },
            commission: { $sum: "$platformCommission" },
            earnings: { $sum: "$companionEarnings" },
            count: { $sum: 1 },
            firstDate: { $min: "$createdAt" },
          },
        },
        { $sort: { year: 1, _id: 1 } },
      ]);
      chartData = agg.map((d) => ({
        label: `W${d._id}`,
        revenue: Math.round(d.revenue),
        commission: Math.round(d.commission),
        earnings: Math.round(d.earnings),
        transactions: d.count,
      }));
    } else {
      // Monthly — last 12 months
      const from = new Date(); from.setMonth(from.getMonth() - 11); from.setDate(1); from.setHours(0, 0, 0, 0);
      const agg = await PaymentHistory.aggregate([
        { $match: { status: { $in: SUCCESS_PAYMENT_STATUSES }, createdAt: { $gte: from } } },
        {
          $group: {
            _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
            revenue: { $sum: "$amount" },
            commission: { $sum: "$platformCommission" },
            earnings: { $sum: "$companionEarnings" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]);
      const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      chartData = agg.map((d) => ({
        label: `${MONTHS[d._id.month - 1]} ${d._id.year}`,
        revenue: Math.round(d.revenue),
        commission: Math.round(d.commission),
        earnings: Math.round(d.earnings),
        transactions: d.count,
      }));
    }

    return res.status(200).json({ chartData, period });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// ─── SYSTEM SETTINGS ─────────────────────────────────────────────────────────

export async function getSystemSettings(req: AuthRequest, res: Response) {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = await SystemSettings.create({});
    }
    return res.status(200).json({ settings });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function updateSystemSettings(req: AuthRequest, res: Response) {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
    }
    
    // Update allowed fields
    const allowedFields = [
      "companionCommissionRate",
      "therapistCommissionRate",
      "freeTrialMinutes",
      "allowAnonymousSessions",
      "maintenanceMode",
      "emergencyHotline"
    ];
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        (settings as any)[field] = req.body[field];
      }
    }
    
    await settings.save();
    
    await logActivity({
      userId: req.user?._id as string,
      userName: req.user?.name as string,
      userEmail: req.user?.email as string,
      role: req.user?.role as string,
      action: "UPDATE_SYSTEM_SETTINGS",
      status: "success",
      details: "Admin updated global system settings",
      req
    });
    
    return res.status(200).json({ settings });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// ─── USER PROFILE ────────────────────────────────────────────────────────────
export async function getUserProfileAdmin(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    // Full PAN is deliberately available only through this admin-protected detail endpoint.
    const user = await User.findById(id).select("-password +panNumber +panCard");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Fetch related records
    const moods = await Mood.find({ userId: id }).sort({ createdAt: -1 }).limit(10);
    const journals = await Journal.find({ userId: id }).sort({ createdAt: -1 }).limit(5);
    const [payments, alerts, appointments, activity] = await Promise.all([
      PaymentHistory.find({ userId: id }).sort({ createdAt: -1 }).limit(10),
      EmergencyAlert.find({ userId: id }).sort({ createdAt: -1 }).limit(20),
      Appointment.find({ $or: [{ userId: id }, { therapistId: id }] })
        .populate("userId", "name email")
        .populate("therapistId", "name email")
        .sort({ date: -1 })
        .limit(10),
      AuditLog.find({ userId: String(id) }).sort({ createdAt: -1 }).limit(20),
    ]);

    return res.status(200).json({
      user,
      moods,
      journals,
      payments,
      alerts,
      appointments,
      activity,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getAllPaymentsAdmin(req: AuthRequest, res: Response) {
  try {
    const {
      search,
      type,
      status,
      page = 1,
      limit = 20,
      from,
      to,
    } = req.query;

    const query: any = {};
    if (status && status !== "all") query.status = status;
    if (type && type !== "all") query.type = type;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from as string);
      if (to) {
        const toDate = new Date(to as string);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    // If searching by user email/name we need a lookup first
    let payments: any[];
    let total: number;

    if (search) {
      // Aggregate with lookup so we can filter on user fields
      const pipeline: any[] = [
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmpty: true } },
        {
          $match: {
            ...query,
            $or: [
              { "user.name": { $regex: search, $options: "i" } },
              { "user.email": { $regex: search, $options: "i" } },
              { invoiceNumber: { $regex: search, $options: "i" } },
              { description: { $regex: search, $options: "i" } },
            ],
          },
        },
      ];
      total = (await PaymentHistory.aggregate([...pipeline, { $count: "n" }]))[0]?.n || 0;
      payments = await PaymentHistory.aggregate([
        ...pipeline,
        { $sort: { createdAt: -1 } },
        { $skip: (parsedPage - 1) * parsedLimit },
        { $limit: parsedLimit },
        {
          $project: {
            _id: 1, type: 1, description: 1, invoiceNumber: 1, paymentMethod: 1,
            amount: 1, platformCommission: 1, companionEarnings: 1, gst: 1,
            status: 1, createdAt: 1,
            userId: { _id: "$user._id", name: "$user.name", email: "$user.email" },
          },
        },
      ]);
    } else {
      total = await PaymentHistory.countDocuments(query);
      payments = await PaymentHistory.find(query)
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip((parsedPage - 1) * parsedLimit)
        .limit(parsedLimit);
    }

    return res.status(200).json({
      payments,
      total,
      pages: Math.ceil(total / parsedLimit),
      currentPage: parsedPage,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// ─── ADMIN APPOINTMENT MANAGEMENT MODULE ─────────────────────────────────────

export async function getAllAppointmentsAdmin(req: AuthRequest, res: Response) {
  try {
    const { search, status, paymentStatus, refundStatus, limit = 50, page = 1, sortBy = "createdAt", sortOrder = "desc" } = req.query;
    const query: any = {};

    if (status && String(status) !== "ALL") {
      query.status = { $regex: new RegExp(`^${status}$`, "i") };
    }
    if (paymentStatus && String(paymentStatus) !== "ALL") {
      query.paymentStatus = { $regex: new RegExp(`^${paymentStatus}$`, "i") };
    }
    if (refundStatus && String(refundStatus) !== "ALL") {
      query.refundStatus = { $regex: new RegExp(`^${refundStatus}$`, "i") };
    }

    const parsedLimit = Number(limit);
    const parsedPage = Number(page);
    const sortDirection = sortOrder === "asc" ? 1 : -1;

    let appointments: any[] = [];
    let total = 0;

    const pipeline: any[] = [
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: { path: "$patient", preserveNullAndEmpty: true } },
      {
        $lookup: {
          from: "users",
          localField: "therapistId",
          foreignField: "_id",
          as: "therapist",
        },
      },
      { $unwind: { path: "$therapist", preserveNullAndEmpty: true } },
    ];

    if (search) {
      const searchStr = String(search).trim();
      pipeline.push({
        $match: {
          $or: [
            { "patient.name": { $regex: searchStr, $options: "i" } },
            { "patient.email": { $regex: searchStr, $options: "i" } },
            { "therapist.name": { $regex: searchStr, $options: "i" } },
            { "therapist.email": { $regex: searchStr, $options: "i" } },
            { paymentId: { $regex: searchStr, $options: "i" } },
            { orderId: { $regex: searchStr, $options: "i" } },
            { gatewayTransactionId: { $regex: searchStr, $options: "i" } },
            { refundId: { $regex: searchStr, $options: "i" } },
            { refundReference: { $regex: searchStr, $options: "i" } },
            { timeSlot: { $regex: searchStr, $options: "i" } },
          ],
        },
      });
    }

    if (Object.keys(query).length > 0) {
      pipeline.push({ $match: query });
    }

    total = (await Appointment.aggregate([...pipeline, { $count: "count" }]))[0]?.count || 0;

    pipeline.push(
      { $sort: { [String(sortBy)]: sortDirection } },
      { $skip: (parsedPage - 1) * parsedLimit },
      { $limit: parsedLimit },
      {
        $project: {
          _id: 1,
          date: 1,
          timeSlot: 1,
          status: 1,
          paymentStatus: 1,
          refundStatus: 1,
          type: 1,
          consultationFee: 1,
          amountPaid: 1,
          bookingDate: 1,
          paymentId: 1,
          orderId: 1,
          gatewayTransactionId: 1,
          refundId: 1,
          refundReference: 1,
          refundDate: 1,
          refundAmount: 1,
          cancellationReason: 1,
          createdAt: 1,
          user: { _id: "$patient._id", name: "$patient.name", email: "$patient.email", phone: "$patient.phone" },
          therapist: { _id: "$therapist._id", name: "$therapist.name", email: "$therapist.email", title: "$therapist.title" },
        },
      }
    );

    appointments = await Appointment.aggregate(pipeline);

    return res.status(200).json({
      appointments,
      total,
      pages: Math.ceil(total / parsedLimit),
      currentPage: parsedPage,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function processAdminRefund(req: AuthRequest, res: Response) {
  try {
    const { appointmentId } = req.params;
    const { reason, amount } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    const refundAmount = Number(amount) || appointment.amountPaid || appointment.consultationFee || 0;
    const refundId = `ref_admin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const refundReference = `REF-ADMIN-${Date.now()}`;
    const refundDate = new Date();

    appointment.status = "CANCELLED";
    appointment.paymentStatus = "REFUNDED";
    appointment.refundStatus = "COMPLETED";
    appointment.refundId = refundId;
    appointment.refundReference = refundReference;
    appointment.refundDate = refundDate;
    appointment.refundAmount = refundAmount;
    appointment.cancellationReason = reason || "Admin manual refund process";
    await appointment.save();

    // Credit user wallet
    if (refundAmount > 0) {
      await User.findByIdAndUpdate(appointment.userId, {
        $inc: { walletBalance: refundAmount },
      });
    }

    // Update or Create PaymentHistory
    await PaymentHistory.findOneAndUpdate(
      { $or: [{ invoiceNumber: appointment.paymentId }, { appointmentId: appointment._id }] },
      {
        userId: appointment.userId,
        appointmentId: appointment._id,
        type: "therapist_consultation",
        description: `Admin Manual Refund - ${appointment.timeSlot}`,
        amount: refundAmount,
        status: "REFUNDED",
        refundId,
        refundReference,
        refundDate,
        refundAmount,
        cancellationReason: appointment.cancellationReason,
      },
      { upsert: true, new: true }
    );

    // Notify User
    await Notification.create({
      userId: appointment.userId,
      title: "Refund Processed by Admin 💳",
      message: `A full refund of ₹${refundAmount} has been processed for your session on ${new Date(appointment.date).toLocaleDateString()}. Ref: ${refundReference}.`,
      type: "info",
    });

    await logActivity({
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: req.user.email,
      role: req.user.role,
      action: "ADMIN_PROCESS_REFUND",
      details: `Processed admin refund of ₹${refundAmount} for appointment ${appointmentId}`,
      req,
    });

    return res.status(200).json({ message: "Refund processed successfully", appointment });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function exportAppointmentsCSV(req: AuthRequest, res: Response) {
  try {
    const appointments = await Appointment.find()
      .populate("userId", "name email")
      .populate("therapistId", "name email")
      .sort({ createdAt: -1 });

    const headers = [
      "Appointment ID", "User Name", "User Email", "Therapist Name", "Therapist Email",
      "Date", "Time Slot", "Type", "Consultation Fee", "Amount Paid",
      "Appointment Status", "Payment Status", "Refund Status", "Refund Amount",
      "Payment Gateway Txn ID", "Refund Txn ID", "Refund Ref", "Cancellation Reason", "Booking Date", "Refund Date"
    ];

    const rows = appointments.map((a: any) => [
      a._id.toString(),
      a.userId?.name || "N/A",
      a.userId?.email || "N/A",
      a.therapistId?.name || "N/A",
      a.therapistId?.email || "N/A",
      new Date(a.date).toLocaleDateString(),
      a.timeSlot,
      a.type || "voice",
      a.consultationFee,
      a.amountPaid || 0,
      a.status,
      a.paymentStatus,
      a.refundStatus,
      a.refundAmount || 0,
      a.gatewayTransactionId || a.paymentId || "N/A",
      a.refundId || "N/A",
      a.refundReference || "N/A",
      `"${(a.cancellationReason || "").replace(/"/g, '""')}"`,
      new Date(a.bookingDate || a.createdAt).toLocaleDateString(),
      a.refundDate ? new Date(a.refundDate).toLocaleDateString() : "N/A"
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=appointments_report_${Date.now()}.csv`);
    return res.status(200).send(csvContent);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}
