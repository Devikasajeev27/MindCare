import { Response } from "express";
import { AuthRequest } from "../middleware/auth.ts";
import { Mood } from "../models/Mood.ts";
import { Journal } from "../models/Journal.ts";
import { Therapist } from "../models/Therapist.ts";
import { Chat } from "../models/Chat.ts";
import { Notification } from "../models/Notification.ts";
import { User } from "../models/User.ts";
import { EmergencyAlert } from "../models/EmergencyAlert.ts";
import { logActivity } from "../utils/auditLogger.ts";
import { Appointment } from "../models/Appointment.ts";
import { Resource } from "../models/Resource.ts";
import { BillingPlan } from "../models/BillingPlan.ts";
import { PaymentHistory } from "../models/PaymentHistory.ts";
import { Attachment } from "../models/Attachment.ts";
import { AppointmentConversation } from "../models/AppointmentConversation.ts";
import { AppointmentMessage } from "../models/AppointmentMessage.ts";
import { detectCrisis, isImmediateCrisisMessage } from "../services/cognitive/detectors.ts";
import { createPipelineFailureResponse } from "../services/cognitive/fallbackResponder.ts";

// ── Helpers ──

type ChatRiskLevel = "none" | "moderate" | "high" | "critical";

const CHAT_RISK_RANK: Record<ChatRiskLevel, number> = {
  none: 0,
  moderate: 1,
  high: 2,
  critical: 3,
};

function normalizeChatRiskLevel(value?: string | null): ChatRiskLevel {
  if (value === "critical" || value === "high" || value === "moderate") return value;
  if (value === "elevated" || value === "low") return "moderate";
  return "none";
}

function maxChatRisk(...levels: Array<string | null | undefined>): ChatRiskLevel {
  return levels
    .map(normalizeChatRiskLevel)
    .reduce<ChatRiskLevel>((max, level) => (CHAT_RISK_RANK[level] > CHAT_RISK_RANK[max] ? level : max), "none");
}

async function rewardXP(userId: string, xpAmount: number) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastActivity = user.lastActivityDate ? new Date(user.lastActivityDate) : null;
    if (lastActivity) lastActivity.setHours(0, 0, 0, 0);

    if (!user.streak || user.streak <= 0) {
      user.streak = 1;
    } else if (!lastActivity) {
      user.streak += 1;
    } else {
      const diffTime = today.getTime() - lastActivity.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 1) {
        // Activity on a new calendar day -> increment streak!
        user.streak += 1;
      }
      // If diffDays === 0 (same day activity), keep existing streak intact without resetting
    }

    user.lastActivityDate = new Date();

    user.xp = (user.xp || 0) + xpAmount;
    if (user.xp >= (user.maxXp || 100)) {
      user.level = (user.level || 1) + 1;
      user.xp = user.xp - (user.maxXp || 100);
      user.maxXp = user.level * 100;
    }
    await user.save();
  } catch (err) {
    console.error("XP reward error:", err);
  }
}

async function updateWellnessScore(userId: string) {
  try {
    const moods = await Mood.find({ userId }).sort({ date: -1 }).limit(7);
    if (moods.length === 0) return;
    const avgRating = moods.reduce((acc, m) => acc + m.rating, 0) / moods.length;
    const score = Math.round(avgRating * 20);
    await User.findByIdAndUpdate(userId, { wellnessScore: score });
  } catch (err) {
    console.error("Wellness score error:", err);
  }
}

// ── EXCHANGE RATE PROXY ──

export async function getExchangeRatesProxy(req: any, res: Response) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch("https://api.frankfurter.app/latest?from=INR", { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(200).json({
        amount: 1,
        base: "INR",
        date: new Date().toISOString().split("T")[0],
        rates: { USD: 0.012, EUR: 0.011, GBP: 0.0094, AED: 0.044, JPY: 1.85, CAD: 0.016, SGD: 0.016, AUD: 0.018, INR: 1.0 }
      });
    }
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.warn("Exchange rates proxy network fetch failed, serving cached fallback rates:", error?.message);
    return res.status(200).json({
      amount: 1,
      base: "INR",
      date: new Date().toISOString().split("T")[0],
      rates: { USD: 0.012, EUR: 0.011, GBP: 0.0094, AED: 0.044, JPY: 1.85, CAD: 0.016, SGD: 0.016, AUD: 0.018, INR: 1.0 }
    });
  }
}

// ── MOOD CONTROLLERS ──

export async function getUnifiedMoodHistory(req: AuthRequest, res: Response) {
  try {
    const userId = req.user._id;
    const moods = await Mood.find({ userId }).sort({ date: 1 });
    const totalEntries = moods.length;

    const avgRating = totalEntries
      ? Number((moods.reduce((sum, m) => sum + (m.rating || 3), 0) / totalEntries).toFixed(1))
      : 0;

    const maxRating = totalEntries ? Math.max(...moods.map((m) => m.rating || 3)) : 0;
    const minRating = totalEntries ? Math.min(...moods.map((m) => m.rating || 3)) : 0;

    const streak = req.user.streak || (totalEntries > 0 ? 1 : 0);

    const recent7 = moods.slice(-7).map((d) => ({
      _id: d._id,
      date: d.date,
      rating: d.rating || 3,
      moodScore: (d.rating || 3) * 20,
      emotion: d.emotion || "Neutral",
      note: d.note || "",
      label: new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
    }));

    const distribution: Record<string, number> = { "Very Low": 0, Low: 0, Neutral: 0, Good: 0, Great: 0 };
    moods.forEach((m) => {
      const label = m.emotion || (m.rating === 1 ? "Very Low" : m.rating === 2 ? "Low" : m.rating === 3 ? "Neutral" : m.rating === 4 ? "Good" : "Great");
      distribution[label] = (distribution[label] || 0) + 1;
    });

    const latestMood = totalEntries > 0 ? moods[totalEntries - 1] : null;

    return res.status(200).json({
      moods,
      recent7,
      dailyHistory: recent7,
      latestMood,
      stats: {
        totalEntries,
        averageRating: avgRating,
        bestRating: maxRating,
        lowestRating: minRating,
        streak,
      },
      averageRating: avgRating,
      totalEntries,
      recentMoods: moods.slice(-10),
      distribution,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export const getMoods = getUnifiedMoodHistory;
export const getMoodAnalytics = getUnifiedMoodHistory;

export async function addMood(req: AuthRequest, res: Response) {
  try {
    const { emotion, rating, note, tags, date } = req.body;
    const emotionMap: Record<number, string> = {
      1: "Very Low",
      2: "Low",
      3: "Neutral",
      4: "Good",
      5: "Great"
    };
    const resolvedEmotion = emotion || emotionMap[Number(rating)] || "Neutral";
    if (rating === undefined || rating === null) {
      return res.status(400).json({ message: "Rating is required" });
    }

    const logDate = date ? new Date(date) : new Date();

    const targetDateStr = getLocalDateString(logDate);
    const allUserMoods = await Mood.find({ userId: req.user._id });

    let existingMood = allUserMoods.find(m => getLocalDateString(m.date) === targetDateStr);
    const currentNow = new Date();

    if (existingMood) {
      existingMood.rating = Number(rating);
      existingMood.emotion = resolvedEmotion;
      if (note !== undefined) existingMood.note = note;
      if (tags) existingMood.tags = tags;
      existingMood.date = currentNow;
      await existingMood.save();
    } else {
      existingMood = await Mood.create({
        userId: req.user._id,
        emotion: resolvedEmotion,
        rating: Number(rating),
        note,
        tags: tags || [],
        date: currentNow,
      });
    }

    await rewardXP(req.user._id, 10);
    await updateWellnessScore(req.user._id);

    return res.status(201).json({ mood: existingMood });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

function getLocalDateString(dateInput: Date | string): string {
  const dateObj = new Date(dateInput);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}



// ── JOURNAL CONTROLLERS ──

export async function getJournals(req: AuthRequest, res: Response) {
  try {
    const journals = await Journal.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ journals });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function addJournal(req: AuthRequest, res: Response) {
  try {
    const { title, content, mood } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: "Title and content are required" });
    }

    const journal = await Journal.create({
      userId: req.user._id,
      title,
      content,
      mood,
    });

    await rewardXP(req.user._id, 15);

    return res.status(201).json({ journal });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function updateJournal(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { title, content, mood } = req.body;

    const journal = await Journal.findOne({ _id: id, userId: req.user._id });
    if (!journal) {
      return res.status(404).json({ message: "Journal entry not found" });
    }

    if (title !== undefined) journal.title = title;
    if (content !== undefined) journal.content = content;
    if (mood !== undefined) journal.mood = mood;

    await journal.save();
    return res.status(200).json({ journal });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function deleteJournal(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const result = await Journal.deleteOne({ _id: id, userId: req.user._id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Journal entry not found" });
    }
    return res.status(200).json({ message: "Journal entry deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// ── THERAPIST CONTROLLERS ──

export async function getTherapists(req: AuthRequest, res: Response) {
  try {
    const isUserAdmin = req.user?.role === "admin";
    const filter = isUserAdmin ? {} : { verificationStatus: { $ne: "Rejected" } };
    const therapists = await Therapist.find(filter);
    return res.status(200).json({ therapists });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function addTherapistReview(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { rating, text } = req.body;

    if (!rating || !text) {
      return res.status(400).json({ message: "Rating and review text are required" });
    }

    const therapist = await Therapist.findById(id);
    if (!therapist) {
      return res.status(404).json({ message: "Therapist not found" });
    }

    const newReview = {
      rating: Number(rating),
      text,
      reviewerName: req.user.name,
      date: new Date(),
    };

    therapist.reviews.push(newReview);
    therapist.reviewCount = therapist.reviews.length;
    const sum = therapist.reviews.reduce((acc: number, r: any) => acc + r.rating, 0);
    therapist.rating = Number((sum / therapist.reviews.length).toFixed(1));

    await therapist.save();
    return res.status(200).json({ therapist });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function updateTherapistAvailability(req: AuthRequest, res: Response) {
  try {
    const { availability } = req.body;
    if (req.user.role !== "therapist") {
      return res.status(403).json({ message: "Only therapists can update availability" });
    }

    const therapist = await Therapist.findOne({ userId: req.user._id });
    if (!therapist) return res.status(404).json({ message: "Therapist profile not found" });

    therapist.availability = typeof availability === "string" ? availability : JSON.stringify(availability);
    await therapist.save();

    return res.status(200).json({ message: "Availability updated successfully", availability: therapist.availability });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function registerAsTherapist(req: AuthRequest, res: Response) {
  try {
    const { name, title, specializations, yearsExperience, consultationFee, bio } = req.body;

    const existingTherapist = await Therapist.findOne({ userId: req.user._id });
    if (existingTherapist) {
      return res.status(400).json({ message: "User is already registered as a therapist" });
    }

    const therapist = await Therapist.create({
      userId: req.user._id,
      name: name || req.user.name,
      title: title || "Licensed Clinical Psychologist",
      specializations: specializations || ["Anxiety", "Depression"],
      yearsExperience: Number(yearsExperience) || 5,
      consultationFee: Number(consultationFee) || 1500,
      bio: bio || "Dedicated mental health professional.",
      reviewCount: 0,
      reviews: [],
    });

    req.user.role = "therapist";
    req.user.status = "pending";
    await req.user.save();

    return res.status(201).json({ therapist });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getTherapistDashboardStats(req: AuthRequest, res: Response) {
  try {
    const therapist = await Therapist.findOne({ userId: req.user._id });
    // Appointments now reference the therapist's User id. Including the owned
    // Therapist id preserves access to legacy records without ever broadening
    // the query beyond the authenticated therapist.
    const therapistIds = therapist ? [req.user._id, therapist._id] : [req.user._id];
    const appointmentScope = { therapistId: { $in: therapistIds } };
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const analyticsPeriod = String(req.query.period || "30 Days");
    const analyticsDays = analyticsPeriod === "7 Days" ? 7 : analyticsPeriod === "Quarterly" ? 90 : analyticsPeriod === "Yearly" ? 365 : 30;
    const analyticsStart = new Date(startOfToday);
    analyticsStart.setDate(analyticsStart.getDate() - (analyticsDays - 1));
    // MongoDB's $dateToString format is not POSIX strftime: `%a` (weekday
    // abbreviation) is invalid, and `%b` is unavailable on older supported
    // MongoDB versions. Use portable numeric labels for therapist charts.
    const analyticsDateFormat = analyticsDays <= 90 ? "%d/%m" : "%m/%Y";
    const approvedStatuses = ["APPROVED", "IN_PROGRESS", "COMPLETED"];
    const successfulPaymentStatuses = ["SUCCESS", "success"];

    // A settled consultation is one that was both paid and completed.  Older
    // appointments can pre-date PaymentHistory, so use its amount when present
    // and otherwise fall back to the recorded appointment payment.  Previously
    // the mandatory lookup silently excluded those valid legacy settlements.
    const settledAppointmentStages: any[] = [
      { $match: { ...appointmentScope, status: "COMPLETED", paymentStatus: "SUCCESS" } },
      {
        $lookup: {
          from: "paymenthistories",
          let: { appointmentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$appointmentId", "$$appointmentId"] },
                status: { $in: successfulPaymentStatuses },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            { $project: { amount: 1 } },
          ],
          as: "payment",
        },
      },
      { $unwind: { path: "$payment", preserveNullAndEmptyArrays: true } },
      {
        $set: {
          settlementAmount: {
            $cond: [
              { $gt: ["$payment.amount", 0] },
              "$payment.amount",
              {
                $cond: [
                  { $gt: ["$amountPaid", 0] },
                  "$amountPaid",
                  "$consultationFee",
                ],
              },
            ],
          },
        },
      },
    ];

    const [appointments, appointmentMetrics, settlementMetrics, weeklyConsultations, monthlyRevenue, sessionTypeCounts, reasonCounts, reviewMetrics, patientOutcomes, patientRoster, patientIds, unreadNotifications, messageMetrics, recentMessages] = await Promise.all([
      Appointment.find(appointmentScope).populate("userId", "name email avatar").sort({ date: 1, createdAt: -1 }),
      Appointment.aggregate([
        { $match: appointmentScope },
        {
          $facet: {
            uniquePatients: [
              { $match: { status: { $in: approvedStatuses } } },
              { $group: { _id: "$userId" } },
              { $count: "count" },
            ],
            activePatients: [
              { $match: { status: { $in: ["APPROVED", "IN_PROGRESS"] } } },
              { $group: { _id: "$userId" } },
              { $count: "count" },
            ],
            statusCounts: [
              {
                $group: {
                  _id: null,
                  upcomingAppointments: {
                    $sum: {
                      $cond: [
                        { $and: [{ $in: ["$status", ["APPROVED", "IN_PROGRESS"]] }, { $gte: ["$date", now] }] },
                        1,
                        0,
                      ],
                    },
                  },
                  pendingApproval: { $sum: { $cond: [{ $eq: ["$status", "PENDING_APPROVAL"] }, 1, 0] } },
                  cancelledSessions: { $sum: { $cond: [{ $in: ["$status", ["CANCELLED", "EXPIRED", "REJECTED"]] }, 1, 0] } },
                  sessionsToday: { $sum: { $cond: [{ $and: [{ $gte: ["$date", startOfToday] }, { $lt: ["$date", startOfTomorrow] }] }, 1, 0] } },
                  completedToday: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "COMPLETED"] }, { $gte: ["$updatedAt", startOfToday] }] }, 1, 0] } },
                },
              },
            ],
          },
        },
      ]),
      Appointment.aggregate([
        ...settledAppointmentStages,
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: "$settlementAmount" },
            monthlyEarnings: { $sum: { $cond: [{ $gte: ["$updatedAt", startOfMonth] }, "$settlementAmount", 0] } },
            todayEarnings: { $sum: { $cond: [{ $gte: ["$updatedAt", startOfToday] }, "$settlementAmount", 0] } },
            completedSessions: { $sum: 1 },
          },
        },
      ]),
      Appointment.aggregate([
        ...settledAppointmentStages,
        { $match: { updatedAt: { $gte: new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: { $dateToString: { format: "%d/%m", date: "$updatedAt" } }, sessions: { $sum: 1 }, revenue: { $sum: "$settlementAmount" }, latest: { $max: "$updatedAt" } } },
        { $sort: { latest: 1 } },
        { $project: { _id: 0, day: "$_id", sessions: 1, revenue: 1 } },
      ]),
      Appointment.aggregate([
        ...settledAppointmentStages,
        { $match: { updatedAt: { $gte: analyticsStart } } },
        { $group: { _id: { $dateToString: { format: analyticsDateFormat, date: "$updatedAt" } }, revenue: { $sum: "$settlementAmount" }, sessions: { $sum: 1 }, latest: { $max: "$updatedAt" } } },
        { $sort: { latest: 1 } },
        { $project: { _id: 0, label: "$_id", revenue: 1, sessions: 1 } },
      ]),
      Appointment.aggregate([
        ...settledAppointmentStages,
        { $group: { _id: "$type", value: { $sum: 1 } } },
        { $project: { _id: 0, name: { $cond: [{ $eq: ["$_id", "chat"] }, "Chat", "Voice"] }, value: 1 } },
      ]),
      Appointment.aggregate([
        { $match: { ...appointmentScope, status: { $in: approvedStatuses }, reason: { $type: "string", $ne: "" } } },
        { $group: { _id: "$reason", value: { $sum: 1 } } },
        { $sort: { value: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, name: "$_id", value: 1 } },
      ]),
      therapist
        ? Therapist.aggregate([
            { $match: { _id: therapist._id } },
            { $unwind: "$reviews" },
            { $group: { _id: null, averageRating: { $avg: "$reviews.rating" }, reviewsCount: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
      Appointment.aggregate([
        ...settledAppointmentStages,
        { $group: { _id: "$userId", completedSessions: { $sum: 1 }, lastConsultationAt: { $max: "$updatedAt" }, clinicalFocus: { $last: "$reason" } } },
        { $sort: { lastConsultationAt: -1 } },
        { $limit: 20 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "patient" } },
        { $unwind: "$patient" },
        { $project: { _id: 0, patient: "$patient.name", clinicalFocus: { $ifNull: ["$clinicalFocus", "Not recorded"] }, completedSessions: 1, lastConsultationAt: 1 } },
      ]),
      Appointment.aggregate([
        { $match: { ...appointmentScope, status: { $in: approvedStatuses } } },
        { $sort: { updatedAt: -1, createdAt: -1 } },
        {
          $group: {
            _id: "$userId",
            lastSessionType: { $first: "$type" },
            lastAppointmentAt: { $first: "$date" },
            completedSessions: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
          },
        },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "patient" } },
        { $unwind: "$patient" },
        {
          $project: {
            _id: 0,
            userId: "$_id",
            name: "$patient.name",
            email: "$patient.email",
            avatar: "$patient.avatar",
            wellnessScore: { $ifNull: ["$patient.wellnessScore", null] },
            lastSessionType: 1,
            lastAppointmentAt: 1,
            completedSessions: 1,
          },
        },
      ]),
      Appointment.distinct("userId", { ...appointmentScope, status: { $in: approvedStatuses } }),
      Notification.countDocuments({ userId: req.user._id, read: false }),
      AppointmentMessage.aggregate([
        { $match: { recipientId: req.user._id, readAt: null } },
        { $lookup: { from: "appointmentconversations", localField: "conversationId", foreignField: "_id", as: "conversation" } },
        { $unwind: "$conversation" },
        { $match: { "conversation.therapistId": req.user._id } },
        { $count: "count" },
      ]),
      AppointmentMessage.aggregate([
        { $match: { recipientId: req.user._id } },
        { $lookup: { from: "appointmentconversations", localField: "conversationId", foreignField: "_id", as: "conversation" } },
        { $unwind: "$conversation" },
        { $match: { "conversation.therapistId": req.user._id } },
        { $sort: { createdAt: -1 } },
        { $limit: 5 },
        { $lookup: { from: "users", localField: "senderId", foreignField: "_id", as: "sender" } },
        { $unwind: { path: "$sender", preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, name: { $ifNull: ["$sender.name", "Patient"] }, text: 1, createdAt: 1 } },
      ]),
    ]);

    const legacyStatusMap: Record<string, string> = { pending: "PENDING_APPROVAL", approved: "APPROVED", confirmed: "APPROVED", completed: "COMPLETED", cancelled: "CANCELLED", rejected: "REJECTED", auto_cancelled: "CANCELLED" };
    const schedule = appointments.map((a: any) => ({
      _id: a._id.toString(), id: a._id.toString(), userId: a.userId?._id || a.userId,
      name: a.userId?.name || "Patient", email: a.userId?.email || "", date: a.date,
      timeSlot: a.timeSlot, time: a.timeSlot || "", duration: "", type: a.type === "chat" ? "Chat Consultation" : "Voice Consultation",
      status: legacyStatusMap[a.status] || a.status, reason: a.reason || "", rejectionReason: a.rejectionReason || "",
      fee: a.consultationFee || 0, amountPaid: a.amountPaid || 0, paymentStatus: a.paymentStatus, paymentId: a.paymentId || "",
      avatar: a.userId?.avatar || "", createdAt: a.createdAt || a.date,
    }));
    const todaySchedule = schedule.filter((appointment: any) => {
      const appointmentDate = new Date(appointment.date);
      return appointmentDate >= startOfToday && appointmentDate < startOfTomorrow;
    });

    const statusCounts = appointmentMetrics[0]?.statusCounts?.[0] || {};
    const totalPatients = appointmentMetrics[0]?.uniquePatients?.[0]?.count || 0;
    const activePatients = appointmentMetrics[0]?.activePatients?.[0]?.count || 0;
    const settlements = settlementMetrics[0] || {};
    const reviews = reviewMetrics[0] || {};
    const alerts = patientIds.length ? await EmergencyAlert.find({ userId: { $in: patientIds }, status: "active" }).sort({ createdAt: -1 }).limit(20) : [];

    const initials = (req.user.name || "Doctor")
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    return res.status(200).json({
      stats: {
        therapistName: therapist?.name || req.user.name,
        therapistInitials: initials,
        therapistAvatar: therapist?.avatar || req.user.avatar || "",
        bio: therapist?.bio || req.user.bio || "",
        qualification: therapist?.qualification || therapist?.title || "",
        consultationFee: therapist?.consultationFee || 0,
        specializations: therapist?.specializations || [],
        availability: therapist?.availability || "",
        verificationStatus: therapist?.verificationStatus || req.user.verificationStatus || "Pending",
        emergencyOnCall: Boolean(therapist?.emergencyOnCall),
        emergencyStatus: therapist?.emergencyStatus || "offline",
        totalPatients,
        activePatients,
        upcomingAppointments: statusCounts.upcomingAppointments || 0,
        pendingApproval: statusCounts.pendingApproval || 0,
        cancelledSessions: statusCounts.cancelledSessions || 0,
        sessionsToday: statusCounts.sessionsToday || 0,
        completedToday: statusCounts.completedToday || 0,
        completedSessions: settlements.completedSessions || 0,
        totalEarnings: settlements.totalEarnings || 0,
        monthlyEarnings: settlements.monthlyEarnings || 0,
        todayEarnings: settlements.todayEarnings || 0,
        averageRating: reviews.averageRating || 0,
        reviewsCount: reviews.reviewsCount || 0,
        activeAlerts: alerts.length,
        alerts,
        unreadNotifications,
        unreadMessages: messageMetrics[0]?.count || 0,
        sessionData: weeklyConsultations,
        monthlyRevenue,
        analyticsPeriod,
        sessionTypes: sessionTypeCounts,
        reasonBreakdown: reasonCounts,
        patientOutcomes,
        patientRoster: patientRoster.map((patient: any) => ({
          ...patient,
          userId: patient.userId.toString(),
        })),
        recentMessages: recentMessages.map((message: any) => ({ ...message, time: message.createdAt })),
        recentActivity: schedule.slice(0, 5).map((appointment: any) => ({
          type: "appointment", label: `${appointment.status} appointment with ${appointment.name}`,
          date: appointment.createdAt,
        })),
        schedule,
        todaySchedule,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// ── COMPANION CONTROLLERS ──

export async function getCompanions(req: AuthRequest, res: Response) {
  try {
    const companions = await User.find({ role: "user", verifiedCompanion: true });
    return res.status(200).json({ companions });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// ── CHAT CONTROLLERS ──

export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const { text, recipient, lang, sessionId } = req.body;
    if (!text) {
      return res.status(400).json({ message: "Text is required" });
    }

    const { AiCompanionProfile } = await import("../models/AiCompanionProfile.ts");
    let profile = await AiCompanionProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = await AiCompanionProfile.create({ userId: req.user._id });
    }

    const effectiveSessionId = sessionId || profile.activeSessionId || `session_${Date.now()}`;
    if (profile.activeSessionId !== effectiveSessionId) {
      profile.activeSessionId = effectiveSessionId;
      await profile.save();
    }

    const conversationId = `conv_${req.user._id.toString().slice(-6)}_${effectiveSessionId}`;
    const activeRecipient = recipient || "ai";
    const language = lang || "en";

    const [localRiskAssessment] = await Promise.all([detectCrisis(text)]);
    const isDirectCrisis = isImmediateCrisisMessage(text);
    const initialRiskLevel = maxChatRisk(isDirectCrisis ? "critical" : null, localRiskAssessment.severity);
    let responseRiskLevel: ChatRiskLevel = initialRiskLevel;
    console.info("[ConversationTrace]", JSON.stringify({
      stage: "API_RECEIVED",
      userId: req.user._id.toString().slice(-6),
      recipient: activeRecipient,
      sessionScoped: Boolean(effectiveSessionId),
      messageLength: text.length,
      directCrisis: isDirectCrisis,
      localRiskLevel: initialRiskLevel,
    }));

    const userMessage = await Chat.create({
      userId: req.user._id,
      conversationId,
      sender: "user",
      recipient: activeRecipient,
      text,
      riskLevel: initialRiskLevel,
      sessionId: effectiveSessionId,
      detectedLanguage: language,
    });
    console.info("[ConversationTrace]", JSON.stringify({ stage: "DATABASE_USER_MESSAGE_PERSISTED", messageId: userMessage._id.toString(), riskLevel: initialRiskLevel }));

    if (isDirectCrisis) {
      const trigger = "Immediate self-harm or suicide-related disclosure";
      await EmergencyAlert.create({
        userId: req.user._id,
        userName: req.user.name,
        detectedTrigger: trigger,
        messageContent: text,
        riskLevel: "critical",
        status: "active",
      });
      console.info("[ConversationTrace]", JSON.stringify({ stage: "CRISIS_ESCALATION_CREATED", messageId: userMessage._id.toString() }));
    }

    await rewardXP(req.user._id, 5);

    let replyMessage = null;
    let cognitiveResult = null;

    if (activeRecipient === "ai") {
      try {
        const { CognitivePipeline } = await import("../services/cognitivePipeline.ts");
        cognitiveResult = await CognitivePipeline.processMessage(req.user._id.toString(), text, effectiveSessionId);
        const aiText = cognitiveResult.response;
        const detectedRisk = cognitiveResult.contextPackage.crisis.severity;
        const persistedRisk = maxChatRisk(initialRiskLevel, detectedRisk);
        const isCurrentMessageDistress =
          cognitiveResult.contextPackage.crisis.source === "current_message" &&
          persistedRisk !== "none";
        responseRiskLevel = persistedRisk;

        userMessage.riskLevel = persistedRisk;
        userMessage.detectedLanguage = cognitiveResult.contextPackage.language.language;
        userMessage.emotion = cognitiveResult.contextPackage.emotion.dominant;
        userMessage.intent = cognitiveResult.contextPackage.intent;
        userMessage.distressScore = cognitiveResult.contextPackage.distressScore || 0;
        userMessage.distressFlagged = isCurrentMessageDistress;
        await userMessage.save();

        replyMessage = await Chat.create({
          userId: req.user._id,
          conversationId,
          sender: "ai",
          recipient: "ai",
          text: aiText,
          riskLevel: persistedRisk,
          distressScore: cognitiveResult.contextPackage.distressScore || 0,
          emotion: cognitiveResult.contextPackage.emotion.dominant,
          strategy: cognitiveResult.strategy.strategy,
          intent: cognitiveResult.contextPackage.intent,
          sessionId: effectiveSessionId,
          detectedLanguage: cognitiveResult.contextPackage.language.language,
        });
        console.info("[ConversationTrace]", JSON.stringify({
          stage: "DATABASE_AI_RESPONSE_PERSISTED",
          messageId: replyMessage._id.toString(),
          strategy: cognitiveResult.strategy.strategy,
          riskLevel: persistedRisk,
          distressScore: cognitiveResult.contextPackage.distressScore,
        }));
      } catch (pipelineErr) {
        console.error("CognitivePipeline execution error; using language-aware safety fallback:", pipelineErr);
        const aiText = createPipelineFailureResponse(text, isDirectCrisis);

        replyMessage = await Chat.create({
          userId: req.user._id,
          conversationId,
          sender: "ai",
          recipient: "ai",
          text: aiText,
          riskLevel: responseRiskLevel,
          sessionId: effectiveSessionId,
          detectedLanguage: language,
        });
        console.info("[ConversationTrace]", JSON.stringify({ stage: "PIPELINE_FAILURE_FALLBACK_PERSISTED", messageId: replyMessage._id.toString(), directCrisis: isDirectCrisis }));
      }
    }

    // A historical unresolved disclosure keeps the conversation safety-aware,
    // but it must not reopen emergency UI or vouchers for every normal reply.
    const crisisSource = cognitiveResult?.contextPackage?.crisis?.source;
    const currentCrisisLevel = cognitiveResult?.contextPackage?.crisis?.severity;
    const distressAlertTriggered =
      isDirectCrisis ||
      (crisisSource === "current_message" && (currentCrisisLevel === "high" || currentCrisisLevel === "critical"));
    const freeTherapistVoucher = distressAlertTriggered ? {
      code: "MINDCARE-FREE-5X",
      therapistName: "Dr. Devika Pillai",
      title: "Senior Clinical Psychologist (Aster Medcity, Kochi)",
      discount: "100% Free Consultation",
      expiration: "Valid for 30 Days"
    } : null;

    return res.status(201).json({
      userMessage,
      replyMessage,
      cognitiveResult,
      distressAlertTriggered,
      freeTherapistVoucher,
      distressWindow: cognitiveResult?.distressWindow,
      therapistConnection: cognitiveResult?.distressWindow?.therapistConnection,
      isCurrentMessageDistress: Boolean(userMessage.distressFlagged),
      currentMessageRiskLevel: crisisSource === "current_message" ? responseRiskLevel : "none",
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getChatHistory(req: AuthRequest, res: Response) {
  try {
    const { AiCompanionProfile } = await import("../models/AiCompanionProfile.ts");
    const { generateConversationSummary } = await import("../services/cognitive/memoryManager.ts");

    const profile = await AiCompanionProfile.findOne({ userId: req.user._id });
    const activeSessionId = profile?.activeSessionId;

    let query: any = { userId: req.user._id };
    if (req.query.sessionId) {
      query.sessionId = req.query.sessionId;
    }
    if (req.query.recipient) {
      query.recipient = req.query.recipient;
    }

    const chats = await Chat.find(query).sort({ time: 1, createdAt: 1 });
    const conversationSummary = await generateConversationSummary(req.user._id.toString(), activeSessionId);
    const distressScore = profile?.insights?.distressScore ?? 10;
    const distressTrend = profile?.insights?.distressTrend || "stable";
    const escalationTier = distressScore >= 76 ? "critical" : distressScore >= 51 ? "high" : distressScore >= 26 ? "moderate" : "low";

    return res.status(200).json({
      chats,
      activeSessionId,
      conversationSummary,
      distressScore,
      distressTrend,
      escalationTier,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getChatHistoryForSession(req: AuthRequest, res: Response) {
  try {
    const { sessionId } = req.params;
    const chats = await Chat.find({ userId: req.user._id, sessionId }).sort({ time: 1 });
    return res.status(200).json({ chats });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function deleteChatMessage(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const result = await Chat.deleteOne({ _id: id, userId: req.user._id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Chat message not found" });
    }
    return res.status(200).json({ message: "Chat message deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// ── NOTIFICATION CONTROLLERS ──

export async function getNotifications(req: AuthRequest, res: Response) {
  try {
    const notifications = await Notification.find({ userId: req.user._id }).sort({ date: -1 });
    return res.status(200).json({ notifications });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function markNotificationRead(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const notification = await Notification.findOne({ _id: id, userId: req.user._id });
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    notification.read = true;
    await notification.save();
    return res.status(200).json({ notification });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function markAllNotificationsRead(req: AuthRequest, res: Response) {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true } });
    return res.status(200).json({ message: "All notifications marked as read" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function deleteNotification(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const result = await Notification.deleteOne({ _id: id, userId: req.user._id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }
    return res.status(200).json({ message: "Notification deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function addNotification(req: AuthRequest, res: Response) {
  try {
    const { title, message, type } = req.body;
    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required" });
    }

    const notification = await Notification.create({
      userId: req.user._id,
      title,
      message,
      type: type || "info",
    });

    return res.status(201).json({ notification });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// ── DASHBOARD & OVERVIEW CONTROLLERS ──

export async function getDashboardOverview(req: AuthRequest, res: Response) {
  try {
    const userId = req.user._id;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const appointmentCandidates = await Appointment.find({ userId, status: "APPROVED", date: { $gte: startOfToday } })
      .populate("therapistId", "name avatar title")
      .sort({ date: 1 });
    const timeSlotMinutes = (slot: string) => {
      const value = slot.split("-")[0]?.trim() || "";
      const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!match) return Number.MAX_SAFE_INTEGER;
      let hours = Number(match[1]) % 12;
      if (match[3].toUpperCase() === "PM") hours += 12;
      return hours * 60 + Number(match[2]);
    };
    const upcomingSession = appointmentCandidates.sort((a: any, b: any) => a.date.getTime() - b.date.getTime() || timeSlotMinutes(a.timeSlot) - timeSlotMinutes(b.timeSlot))[0] || null;

    const [moods, journals, unreadNotifications, chats, therapists, companions, dbResources] = await Promise.all([
      Mood.find({ userId }).sort({ date: 1 }),
      Journal.find({ userId }).sort({ createdAt: -1 }).limit(5),
      Notification.find({ userId, read: false }).limit(10),
      Chat.find({ userId }).sort({ time: -1 }).limit(5),
      Therapist.find({ verificationStatus: { $ne: "Rejected" } }).limit(4),
      User.find({ role: "user", verifiedCompanion: true }).limit(5),
      Resource.find({ published: true }).limit(3),
    ]);

    const moodHistory = moods.map((m) => ({
      date: m.date,
      rating: m.rating,
      emotion: m.emotion,
      note: m.note,
    }));

    const resources = dbResources;

    let mappedUpcoming = null;
    if (upcomingSession) {
      const therapistAny = upcomingSession.therapistId as any;
      mappedUpcoming = {
        _id: upcomingSession._id,
        therapistId: therapistAny?._id || upcomingSession.therapistId,
        therapistName: therapistAny?.name || "",
        therapistTitle: therapistAny?.title || "",
        therapistAvatar: therapistAny?.avatar || "",
        dateLabel: upcomingSession.date
          ? new Date(upcomingSession.date).toLocaleString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          : "",
        ratingLabel: "",
        status: upcomingSession.status,
        paymentCompleted: Boolean((upcomingSession as any).paymentCompleted || (upcomingSession.amountPaid && upcomingSession.amountPaid > 0)),
        consultationFee: upcomingSession.consultationFee || 0,
        date: upcomingSession.date,
        notes: upcomingSession.notes || "",
      };
    }

    const recentActivity: any[] = [];

    moods.slice(0, 2).forEach((m) => {
      recentActivity.push({
        type: "mood",
        label: `Logged mood: ${m.emotion || "Rating " + m.rating}`,
        sub: m.note || "Mood tracker entry",
        date: m.date,
      });
    });

    journals.forEach((j) => {
      recentActivity.push({
        type: "journal",
        label: `Journaled: ${j.title}`,
        sub: j.content ? j.content.substring(0, 40) + "..." : "Personal reflection",
        date: j.createdAt,
      });
    });

    chats.forEach((c) => {
      recentActivity.push({
        type: "ai",
        label: `Chatted with ${c.recipient === "ai" ? "AI Companion" : "Peer"}`,
        sub: c.text ? c.text.substring(0, 40) + "..." : "Message exchanged",
        date: c.time,
      });
    });

    recentActivity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const { EmergencyContact } = await import("../models/EmergencyContact.ts");
    const emergencyContacts = await EmergencyContact.find({ userId }).sort({ priority: 1 });

    const { CompanionEarnings } = await import("../models/CompanionEarnings.ts");
    const { CompanionSession } = await import("../models/CompanionSession.ts");

    const earnRecord = await CompanionEarnings.findOne({ userId });
    let completedSessionsCount = await CompanionSession.countDocuments({ companionId: userId, status: "completed" });

    const dashboardData = {
      user: req.user,
      moodHistory,
      therapists,
      companions,
      resources,
      recentActivity: recentActivity.slice(0, 5),
      upcomingSession: mappedUpcoming,
      emergencyContacts,
      unreadNotifications,
      matchingStats: {
        stats: {
          todayEarnings: 0,
          totalEarnings: earnRecord?.totalEarnings || 0,
          lifetimeEarnings: earnRecord?.totalEarnings || 0,
          completedSessions: completedSessionsCount,
          totalHours: earnRecord?.totalHours || 0,
          lifetimeHours: earnRecord?.lifetimeHours || 0,
          performanceScore: earnRecord?.performanceScore || 0,
        },
      },
    };

    return res.status(200).json({ dashboard: dashboardData });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getProgressSummary(req: AuthRequest, res: Response) {
  try {
    const userId = req.user._id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [moods, journals, userChatCount, companionSessionsCount, therapistSessionsCount, therapistSessionsThisMonth] = await Promise.all([
      Mood.find({ userId }).sort({ date: 1 }),
      Journal.find({ userId }),
      Chat.countDocuments({ userId, sender: "user" }),
      Chat.countDocuments({ userId, recipient: { $ne: "ai" } }),
      Appointment.countDocuments({ userId, status: "COMPLETED" }),
      Appointment.countDocuments({ userId, status: "COMPLETED", updatedAt: { $gte: startOfMonth } }),
    ]);


    const totalMoods = moods.length;
    const avgRating = totalMoods ? Number((moods.reduce((sum, m) => sum + (m.rating || 3), 0) / totalMoods).toFixed(1)) : 0;
    const maxRating = totalMoods ? Math.max(...moods.map((m) => m.rating || 3)) : 0;
    const minRating = totalMoods ? Math.min(...moods.map((m) => m.rating || 3)) : 0;

    const moodHistory = moods.map((m) => ({
      date: m.date,
      rating: m.rating || 3,
      moodScore: (m.rating || 3) * 20,
      emotion: m.emotion || "Neutral",
    }));

    const streak = req.user.streak || (totalMoods > 0 ? 1 : 0);
    const wellnessScore = req.user.wellnessScore ?? 0;

    const achievements = [
      {
        id: "first_mood",
        icon: "Flame",
        label: "🌱 First Mood Logged",
        desc: "Recorded your first mood check-in",
        color: "bg-orange-100 text-orange-600",
        earned: totalMoods >= 1,
        progress: Math.min(100, Math.round((totalMoods / 1) * 100)),
      },
      {
        id: "first_journal",
        icon: "Star",
        label: "📝 First Journal Entry",
        desc: "Created your first reflection journal",
        color: "bg-blue-100 text-blue-600",
        earned: journals.length >= 1,
        progress: Math.min(100, Math.round((journals.length / 1) * 100)),
      },
      {
        id: "first_ai",
        icon: "Award",
        label: "💬 First AI Conversation",
        desc: "Chatted with your AI Wellness Assistant",
        color: "bg-purple-100 text-purple-600",
        earned: userChatCount >= 1,
        progress: Math.min(100, Math.round((userChatCount / 1) * 100)),
      },
      {
        id: "streak_3",
        icon: "TrendingUp",
        label: "🔥 3-Day Mood Streak",
        desc: "Maintained a 3-day wellness streak",
        color: "bg-orange-100 text-orange-600",
        earned: streak >= 3,
        progress: Math.min(100, Math.round((streak / 3) * 100)),
      },
      {
        id: "streak_7",
        icon: "TrendingUp",
        label: "🔥 7-Day Streak",
        desc: "Maintained a 7-day active streak",
        color: "bg-green-100 text-green-600",
        earned: streak >= 7,
        progress: Math.min(100, Math.round((streak / 7) * 100)),
      },
      {
        id: "streak_30",
        icon: "TrendingUp",
        label: "🔥 30-Day Streak",
        desc: "Achieved a 30-day wellness streak",
        color: "bg-amber-100 text-amber-600",
        earned: streak >= 30,
        progress: Math.min(100, Math.round((streak / 30) * 100)),
      },
      {
        id: "journal_10",
        icon: "Star",
        label: "📔 10 Journal Entries",
        desc: "Wrote 10 personal journal reflections",
        color: "bg-blue-100 text-blue-600",
        earned: journals.length >= 10,
        progress: Math.min(100, Math.round((journals.length / 10) * 100)),
      },
      {
        id: "companion_1",
        icon: "Award",
        label: "🤝 First Companion Chat",
        desc: "Connected with a peer companion",
        color: "bg-pink-100 text-pink-600",
        earned: companionSessionsCount >= 1,
        progress: Math.min(100, Math.round((companionSessionsCount / 1) * 100)),
      },
      {
        id: "weekly_goal",
        icon: "Star",
        label: "🎯 Weekly Goal Achieved",
        desc: "Completed your weekly wellness check-ins",
        color: "bg-green-100 text-green-600",
        earned: streak >= 7 || wellnessScore >= 80,
        progress: Math.min(100, Math.round((streak / 7) * 100)),
      },
      {
        id: "mood_20",
        icon: "Flame",
        label: "😊 Logged Mood 20 Times",
        desc: "Tracked your mood 20 times",
        color: "bg-emerald-100 text-emerald-600",
        earned: totalMoods >= 20,
        progress: Math.min(100, Math.round((totalMoods / 20) * 100)),
      },
      {
        id: "ai_50",
        icon: "Award",
        label: "🧠 Used AI Companion 50 Times",
        desc: "Had 50 conversations with AI Assistant",
        color: "bg-indigo-100 text-indigo-600",
        earned: userChatCount >= 50,
        progress: Math.min(100, Math.round((userChatCount / 50) * 100)),
      },
      {
        id: "gratitude_1",
        icon: "Star",
        label: "❤️ Gratitude Explorer",
        desc: "Shared a positive reflection journal",
        color: "bg-red-100 text-red-600",
        earned: journals.length >= 1,
        progress: Math.min(100, Math.round((journals.length / 1) * 100)),
      },
    ];

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayMood = await Mood.findOne({ userId, date: { $gte: todayStart } });
    const todayJournal = await Journal.findOne({ userId, createdAt: { $gte: todayStart } });
    const todayChat = await Chat.findOne({ userId, sender: "user", createdAt: { $gte: todayStart } });

    const habits = [
      {
        id: "mood",
        label: "Daily Mood Check-in",
        streak: streak,
        done: !!todayMood,
      },
      {
        id: "journal",
        label: "Journal Reflection",
        streak: journals.length > 0 ? 1 : 0,
        done: !!todayJournal,
      },
      {
        id: "ai-chat",
        label: "AI Wellness Chat",
        streak: userChatCount > 0 ? 1 : 0,
        done: !!todayChat,
      },
      {
        label: "Mindfulness & Breathing",
        streak: streak > 0 ? streak : 0,
        done: !!todayChat || !!todayMood,
      },
    ];

    // Mood Distribution Count
    const distribution: Record<string, number> = { "Very Low": 0, Low: 0, Neutral: 0, Good: 0, Great: 0 };
    moods.forEach((m) => {
      const label = m.emotion || (m.rating === 1 ? "Very Low" : m.rating === 2 ? "Low" : m.rating === 3 ? "Neutral" : m.rating === 4 ? "Good" : "Great");
      distribution[label] = (distribution[label] || 0) + 1;
    });

    let mostCommonEmotion = "Neutral";
    let maxCount = 0;
    Object.entries(distribution).forEach(([em, cnt]) => {
      if (cnt > maxCount) {
        maxCount = cnt;
        mostCommonEmotion = em;
      }
    });

    const activeDaysThisWeek = moods.filter((m) => {
      const diffMs = now.getTime() - new Date(m.date).getTime();
      return diffMs <= 7 * 24 * 60 * 60 * 1000;
    }).length;

    let motivationMessage = "Log your first mood to begin tracking your progress and unlock achievements.";
    if (streak >= 7) {
      motivationMessage = `Outstanding! You're maintaining a ${streak}-day wellness streak. Keep up the amazing momentum.`;
    } else if (streak >= 3) {
      motivationMessage = `Great job! You've checked in ${streak} days in a row. Small daily steps build lasting mental wellness.`;
    } else if (totalMoods > 0) {
      motivationMessage = `You've logged ${totalMoods} mood entries. Consistent check-ins help you understand your emotional patterns.`;
    }

    return res.status(200).json({
      stats: {
        wellnessScore,
        streak,
        sessionsDone: therapistSessionsCount,
        sessionsThisMonth: therapistSessionsThisMonth,
        totalMoodEntries: totalMoods,
        totalJournalEntries: journals.length,
        averageMood: avgRating,
        bestMood: maxRating,
        lowestMood: minRating,
        companionSessions: companionSessionsCount,
        therapistSessions: therapistSessionsCount,
      },
      achievements,
      habits,
      moodHistory,
      weeklySummary: {
        activeDaysThisWeek,
        dominantEmotion: mostCommonEmotion,
        trendNote: activeDaysThisWeek >= 4 ? "Highly consistent wellness activity this week!" : "Check in daily to build a stronger wellness habit.",
      },
      monthlyInsights: {
        distribution,
        mostCommonEmotion,
        totalEntriesThisMonth: moods.filter((m) => new Date(m.date) >= startOfMonth).length,
      },
      motivationMessage,
      totalMoodLogs: totalMoods,
      totalJournals: journals.length,
      xp: req.user.xp || 0,
      level: req.user.level || 1,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getResourcesLibrary(req: AuthRequest, res: Response) {
  try {
    const { search, category } = req.query;
    // Therapist resources are shared library content; drafts must never be
    // exposed through this public authenticated endpoint.
    const filter: any = { published: true };

    if (category && String(category) !== "All") {
      const catStr = String(category).toLowerCase();
      // Match type or category (e.g. Articles -> article, Videos -> video, Audio -> audio, Exercises -> exercise)
      let typeMatch = catStr;
      if (catStr.endsWith("s")) typeMatch = catStr.slice(0, -1);

      filter.$or = [
        { category: { $regex: catStr, $options: "i" } },
        { type: { $regex: typeMatch, $options: "i" } }
      ];
    }

    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      const searchOr = [
        { title: searchRegex },
        { category: searchRegex },
        { tag: searchRegex },
        { type: searchRegex },
        { meta: searchRegex }
      ];

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    const resources = await Resource.find(filter).sort({ createdAt: -1 });
    const categories = ["All", "Articles", "Videos", "Audio", "Exercises"];

    return res.status(200).json({ resources, categories });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getBillingOverview(req: AuthRequest, res: Response) {
  try {
    const userId = req.user._id;

    // Ensure database contains exactly the 4 canonical healthcare SaaS plans
    const canonicalNames = ["Free", "Essential", "Premium", "Professional"];
    let plans = await BillingPlan.find({ active: true }).sort({ sortOrder: 1, displayOrder: 1 });

    const hasExtraOrMissing = plans.length !== 4 || plans.some(p => !canonicalNames.includes(p.name));
    if (hasExtraOrMissing) {
      // Preserve historical payment references. Legacy/demo plans are retired
      // from sale instead of deleted, then the public response is restricted
      // to the canonical catalogue below.
      await BillingPlan.updateMany({ name: { $nin: canonicalNames } }, { $set: { active: false, isActive: false } });
      const canonicalSpecs = [
        {
          name: "Free", price: 0, yearlyPrice: 0, period: "forever", currency: "INR",
          description: "Allow new users to experience the platform without payment.",
          color: "bg-slate-50 border-slate-200 dark:border-zinc-800",
          buttonClass: "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200",
          buttonText: "Get Started",
          features: [
            "Limited AI conversations per day", "Daily Mood Tracking", "Personal Journal",
            "Wellness Dashboard", "Basic Mood Analytics", "Community Mental Health Resources",
            "Emergency Crisis Detection", "Suicide Risk Detection", "Continuous Distress Monitoring",
            "Automatic Crisis Escalation", "Emergency Contact Alert (if user has enabled it)", "AI Safety Monitoring"
          ],
          limitations: ["Therapist Chat", "Voice Consultation", "Video Consultation", "Advanced Analytics", "Family Sharing"],
          badge: "Free", recommended: false, popular: false, active: true, isActive: true, sortOrder: 0, displayOrder: 0
        },
        {
          name: "Essential", price: 299, yearlyPrice: 2999, period: "month", currency: "INR",
          description: "Everything included in Free PLUS",
          color: "bg-blue-50/40 border-blue-300 dark:border-blue-800",
          buttonClass: "bg-blue-600 text-white hover:bg-blue-700",
          buttonText: "Upgrade Now",
          features: [
            "Everything included in Free", "Unlimited AI Chat", "Unlimited Mood Tracking",
            "Guided Meditation Library", "Advanced Journal Analysis", "Personalized Wellness Insights", "Faster AI Responses"
          ],
          limitations: ["Therapist Chat", "Voice Consultation", "Video Consultation", "Advanced Analytics", "Family Sharing"],
          badge: "Starter", recommended: false, popular: false, active: true, isActive: true, sortOrder: 1, displayOrder: 1
        },
        {
          name: "Premium", price: 699, yearlyPrice: 6999, period: "month", currency: "INR",
          description: "Everything included in Essential PLUS",
          color: "bg-emerald-50/60 border-emerald-300 dark:border-emerald-800 shadow-md",
          buttonClass: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md",
          buttonText: "Choose Premium",
          features: [
            "Everything included in Essential", "Unlimited AI", "Voice AI Conversations",
            "Video AI Sessions", "Monthly Therapist Chat Credits", "Weekly Wellness Reports",
            "Family Access", "Advanced Mood Analytics", "Priority AI Queue"
          ],
          limitations: ["Unlimited Therapist Chat", "Dedicated Wellness Coach"],
          badge: "MOST POPULAR", recommended: true, popular: true, active: true, isActive: true, sortOrder: 2, displayOrder: 2
        },
        {
          name: "Professional", price: 1499, yearlyPrice: 14999, period: "month", currency: "INR",
          description: "Everything included in Premium PLUS",
          color: "bg-violet-50/40 border-violet-300 dark:border-violet-800",
          buttonClass: "bg-violet-600 text-white hover:bg-violet-700",
          buttonText: "Upgrade to Professional",
          features: [
            "Everything included in Premium", "Unlimited Therapist Chat", "Unlimited Voice Consultation",
            "Unlimited Video Consultation", "Dedicated Wellness Coach", "Priority Therapist Assignment",
            "Advanced AI Monitoring", "Unlimited Reports", "Corporate Wellness Features", "Highest Priority Support"
          ],
          limitations: [],
          badge: "Pro", recommended: false, popular: false, active: true, isActive: true, sortOrder: 3, displayOrder: 3
        }
      ];

      for (const spec of canonicalSpecs) {
        await BillingPlan.findOneAndUpdate({ name: spec.name }, spec, { upsert: true, new: true });
      }
      plans = await BillingPlan.find({ active: true, name: { $in: canonicalNames } }).sort({ sortOrder: 1, displayOrder: 1 });
    }

    // Legacy records used uppercase payment statuses. Normalize the response
    // contract so a verified transaction is never rendered as failed by clients.
    const history = (await PaymentHistory.find({ userId }).sort({ createdAt: -1 })).map(payment => ({
      ...payment.toObject(),
      status: String(payment.status || "pending").toLowerCase(),
    }));

    const rawPlanId = req.user.activePlan?.planId;
    const currentPlanIdStr = rawPlanId ? String(rawPlanId) : "";
    const freePlan = plans.find(p => p.name === "Free") || null;
    const currentPlan = plans.find(p => p._id.toString() === currentPlanIdStr || (currentPlanIdStr && p.name.toLowerCase() === currentPlanIdStr.toLowerCase())) || freePlan;

    return res.status(200).json({
      activePlan: req.user.activePlan || { planId: "free", name: "Free Tier" },
      availablePlans: plans,
      billing: {
        plans,
        history,
        currentPlan,
        paymentMethod: {
          brand: "UPI / Card",
          label: "Razorpay Secure Gateway",
          expires: "Connected",
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function subscribeBillingPlan(req: AuthRequest, res: Response) {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ message: "planId is required" });

    req.user.activePlan = {
      planId,
      subscribedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
    await req.user.save();

    return res.status(200).json({ message: "Subscribed successfully", activePlan: req.user.activePlan });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getAiInsights(req: AuthRequest, res: Response) {
  try {
    return res.status(200).json({
      insights: [
        "Your mood scores tend to be higher on days you record journal entries.",
        "Consistent tracking has increased your wellness score by 15% this month.",
      ],
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// ── APPOINTMENT CONTROLLERS ──

export async function bookAppointment(req: AuthRequest, res: Response) {
  try {
    const { therapistId, date, timeSlot, reason, type } = req.body;
    if (!therapistId || !date || !timeSlot) {
      return res.status(400).json({ message: "therapistId, date, and timeSlot are required" });
    }

    // 1. Past Date Validation
    const requestedDate = new Date(date);
    const todayStr = new Date().toISOString().split("T")[0];
    const requestedDateStr = requestedDate.toISOString().split("T")[0];
    if (requestedDateStr < todayStr) {
      return res.status(400).json({ message: "Cannot book appointments for past dates" });
    }

    let targetTherapistUserId = therapistId;
    let therapistProfile = null;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(String(therapistId));

    if (isValidObjectId) {
      therapistProfile = await Therapist.findById(therapistId);
      if (!therapistProfile) {
        therapistProfile = await Therapist.findOne({ userId: therapistId });
      }
      if (therapistProfile) {
        targetTherapistUserId = therapistProfile.userId;
      }
    }

    if (!therapistProfile) {
      return res.status(404).json({ message: "Selected therapist was not found" });
    }

    const consultationFee = therapistProfile.consultationFee;
    const therapistName = therapistProfile.name;

    // 2. Double Booking Validation
    const startOfDay = new Date(requestedDateStr);
    const endOfDay = new Date(new Date(requestedDateStr).getTime() + 24 * 60 * 60 * 1000);

    const existingBooking = await Appointment.findOne({
      therapistId: targetTherapistUserId,
      date: { $gte: startOfDay, $lt: endOfDay },
      timeSlot,
      status: { $in: ["PENDING_APPROVAL", "APPROVED", "IN_PROGRESS"] }
    });

    if (existingBooking) {
      return res.status(400).json({ message: "Selected time slot is already booked or pending approval. Please select another slot." });
    }

    // 3. Create Appointment with status 'pending' (Payment NOT collected yet!)
    const appointment = await Appointment.create({
      userId: req.user._id,
      therapistId: targetTherapistUserId,
      date: requestedDate,
      timeSlot,
      consultationFee,
      amountPaid: 0,
      status: "PENDING_APPROVAL",
      paymentStatus: "PAYMENT_PENDING",
      reason: reason || "General consultation",
      type: type === "chat" ? "chat" : "voice" // voice or chat session (no video)
    });

    // 4. In-App Notification for Therapist
    await Notification.create({
      userId: targetTherapistUserId,
      title: "New Booking Request 🩺",
      message: `Patient ${req.user.name} has requested an appointment on ${requestedDate.toLocaleDateString()} at ${timeSlot}. Please review and approve in your dashboard.`,
      type: "appointment",
      isRead: false
    });

    // 5. In-App Notification for Patient
    await Notification.create({
      userId: req.user._id,
      title: "Booking Request Submitted ⏳",
      message: `Your appointment request with ${therapistName} for ${timeSlot} on ${requestedDate.toLocaleDateString()} is pending therapist approval.`,
      type: "appointment",
      isRead: false
    });

    return res.status(201).json({
      message: "Appointment request submitted successfully. Awaiting therapist approval.",
      appointment
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getAppointments(req: AuthRequest, res: Response) {
  try {
    const isTherapist = req.user.role === "therapist";
    let query: any = { userId: req.user._id };
    if (isTherapist) {
      const therapistDoc = await Therapist.findOne({ userId: req.user._id });
      const therapistId = therapistDoc ? therapistDoc._id : req.user._id;
      query = { $or: [{ therapistId: req.user._id }, { therapistId: therapistId }] };
    }
    const appointments = await Appointment.find(query)
      .populate(isTherapist ? "userId" : "therapistId", "name email avatar")
      .sort({ date: -1 });
    return res.status(200).json({ appointments });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// ── ATTACHMENT CONTROLLERS ──

export async function uploadAttachment(req: AuthRequest, res: Response) {
  try {
    const { filename, originalName, mimeType, size } = req.body;
    const attachment = await Attachment.create({
      userId: req.user._id,
      filename: filename || `file_${Date.now()}`,
      originalName: originalName || "file.dat",
      mimeType: mimeType || "application/octet-stream",
      size: size || 1024,
    });
    return res.status(201).json({ attachment });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function downloadAttachment(req: AuthRequest, res: Response) {
  try {
    const { filename } = req.params;
    const attachment = await Attachment.findOne({ filename });
    if (!attachment) return res.status(404).json({ message: "Attachment not found" });
    return res.status(200).json({ attachment });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function deleteAttachment(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const result = await Attachment.deleteOne({ _id: id, userId: req.user._id });
    if (result.deletedCount === 0) return res.status(404).json({ message: "Attachment not found" });
    return res.status(200).json({ message: "Attachment deleted" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

interface MultipartPart {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

function parseVoiceMultipart(buffer: Buffer, boundary: string): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);

  let index = buffer.indexOf(boundaryBuffer);
  while (index !== -1) {
    const nextIndex = buffer.indexOf(boundaryBuffer, index + boundaryBuffer.length);
    if (nextIndex === -1) break;

    const partBuffer = buffer.slice(index + boundaryBuffer.length, nextIndex);
    const headerEndIndex = partBuffer.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEndIndex !== -1) {
      const headersString = partBuffer.slice(0, headerEndIndex).toString("utf-8");
      const data = partBuffer.slice(headerEndIndex + 4, partBuffer.length - 2);

      const nameMatch = headersString.match(/name="([^"]+)"/);
      const filenameMatch = headersString.match(/filename="([^"]+)"/);
      const contentTypeMatch = headersString.match(/Content-Type:\s*([^\r\n]+)/i);

      if (nameMatch) {
        parts.push({
          name: nameMatch[1],
          filename: filenameMatch ? filenameMatch[1] : undefined,
          contentType: contentTypeMatch ? contentTypeMatch[1] : undefined,
          data
        });
      }
    }
    index = nextIndex;
  }
  return parts;
}

async function getRawVoiceBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    req.on("data", (chunk: any) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", (err: any) => reject(err));
  });
}

export async function processVoiceInput(req: AuthRequest, res: Response) {
  try {
    const { VoiceEngine } = await import("../services/cognitive/voiceEngine.ts");
    const contentType = req.headers["content-type"] || "";

    let audioInput = "";
    let sessionId: string | undefined = undefined;
    let recipient = "ai";
    let voiceDuration = "0:05";
    let voiceResult: any = null;
    let audioMimeType = "audio/webm";
    let clientTranscript = "";

    if (contentType.includes("multipart/form-data")) {
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      if (!boundaryMatch) {
        return res.status(400).json({ message: "Invalid multipart boundary" });
      }
      const boundary = boundaryMatch[1] || boundaryMatch[2];
      const rawBuffer = await getRawVoiceBody(req);
      const parts = parseVoiceMultipart(rawBuffer, boundary);

      const filePart = parts.find(p => p.name === "file" || p.name === "audio");
      if (!filePart || !filePart.data || filePart.data.length === 0) {
        return res.status(400).json({ message: "Audio file is required for voice processing" });
      }

      // Validate supported audio mime types
      const mime = (filePart.contentType || "").toLowerCase();
      const fn = (filePart.filename || "").toLowerCase();
      const isSupportedMime = /audio\/(webm|mp3|mpeg|wav|m4a|ogg|x-m4a)/i.test(mime) ||
        /\.(webm|mp3|wav|m4a|ogg)$/i.test(fn) ||
        mime === "application/octet-stream";

      if (!isSupportedMime) {
        return res.status(400).json({ message: "Unsupported audio format. Supported formats: audio/webm, audio/mp3, audio/wav, audio/m4a, audio/ogg" });
      }
      audioMimeType = mime.split(";")[0] || "audio/webm";

      // Extract string parameters
      const sessionPart = parts.find(p => p.name === "sessionId");
      if (sessionPart) sessionId = sessionPart.data.toString("utf-8").trim();

      const recipientPart = parts.find(p => p.name === "recipient");
      if (recipientPart) recipient = recipientPart.data.toString("utf-8").trim();

      const durationPart = parts.find(p => p.name === "voiceDuration");
      if (durationPart) voiceDuration = durationPart.data.toString("utf-8").trim();

      const transcriptPart = parts.find(p => p.name === "transcript");
      clientTranscript = transcriptPart ? transcriptPart.data.toString("utf-8").trim() : "";

      audioInput = filePart.data.toString("base64");
    } else {
      // Handle standard JSON payload
      const body = req.body || {};
      audioInput = body.audioData || body.transcript || "";
      sessionId = body.sessionId;
      recipient = body.recipient || "ai";
      voiceDuration = body.voiceDuration || "0:05";
      clientTranscript = body.transcript || "";

      if (!audioInput || !audioInput.trim()) {
        return res.status(400).json({ message: "Audio file or voice transcript is required" });
      }

      audioMimeType = body.mimeType || audioMimeType;
    }

    // Voice messages must participate in the same durable conversation session
    // as text messages because the distress event store requires a session ID.
    const { AiCompanionProfile } = await import("../models/AiCompanionProfile.ts");
    let profile = await AiCompanionProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = await AiCompanionProfile.create({ userId: req.user._id });
    }
    const effectiveSessionId = sessionId || profile.activeSessionId || `session_${Date.now()}`;
    if (profile.activeSessionId !== effectiveSessionId) {
      profile.activeSessionId = effectiveSessionId;
      await profile.save();
    }
    sessionId = effectiveSessionId;

    // Process audio message through the speech and cognitive pipelines.
    voiceResult = await VoiceEngine.processVoiceMessage(req.user._id.toString(), audioInput, {
      sessionId: effectiveSessionId,
      clientTranscript,
      mimeType: audioMimeType,
    });

    const crisisSource = voiceResult.contextPackage.crisis.source;
    const isDirectCrisis = crisisSource === "current_message" && voiceResult.contextPackage.crisis.isCrisis;
    const detectedRisk = voiceResult.contextPackage.crisis.severity;
    const persistedRisk = normalizeChatRiskLevel(detectedRisk);
    const isCurrentMessageDistress =
      voiceResult.contextPackage.crisis.source === "current_message" &&
      persistedRisk !== "none";

    // Prepare persisted audio URL (Data URL format)
    const audioDataUrl = audioInput ? (audioInput.startsWith("data:") ? audioInput : `data:audio/webm;base64,${audioInput}`) : undefined;

    // Persist User Voice Message to MongoDB
    const userMessage = await Chat.create({
      userId: req.user._id,
      sender: "user",
      recipient,
      text: `🎙️ Voice Message: ${voiceResult.sttTranscript}`,
      riskLevel: persistedRisk,
      distressFlagged: isCurrentMessageDistress,
      sessionId,
      detectedLanguage: voiceResult.contextPackage.language.language,
      isVoice: true,
      voiceDuration,
      audioUrl: audioDataUrl,
    });

    // Persist AI Response Message to MongoDB
    const replyMessage = await Chat.create({
      userId: req.user._id,
      sender: "ai",
      recipient: "ai",
      text: voiceResult.response,
      riskLevel: persistedRisk,
      sessionId,
      detectedLanguage: voiceResult.contextPackage.language.language,
      isVoice: true,
      voiceDuration: "0:12",
    });

    const distressAlertTriggered =
      isDirectCrisis && (persistedRisk === "critical" || persistedRisk === "high");
    const freeTherapistVoucher = distressAlertTriggered ? {
      code: "MINDCARE-FREE-5X",
      therapistName: "Dr. Devika Pillai",
      title: "Senior Clinical Psychologist (Aster Medcity, Kochi)",
      discount: "100% Free Consultation",
      expiration: "Valid for 30 Days"
    } : null;

    return res.status(201).json({
      userMessage,
      replyMessage,
      voiceResult,
      distressAlertTriggered,
      freeTherapistVoucher,
      distressWindow: voiceResult?.distressWindow,
      therapistConnection: voiceResult?.distressWindow?.therapistConnection,
      isCurrentMessageDistress,
      currentMessageRiskLevel: crisisSource === "current_message" ? persistedRisk : "none",
    });
  } catch (error: any) {
    console.error("[VoiceInput] Failed to process voice message", {
      userId: req.user?._id?.toString(),
      message: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({ message: error.message || "Voice processing failed" });
  }
}

// ── DEBUG & SELF-TEST CONTROLLERS ──

export async function runLanguageSelfTest(req: any, res: Response) {
  return res.status(200).json({ status: "ok", languagesSupported: ["en", "es", "fr", "hi", "ar"] });
}

export async function seedStreakDebug(req: AuthRequest, res: Response) {
  try {
    req.user.streak = 5;
    await req.user.save();
    return res.status(200).json({ message: "Streak seeded to 5", user: req.user });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function testGeminiConnection(req: any, res: Response) {
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "dummy") {
      return res.status(200).json({
        status: "error",
        message: "GEMINI_API_KEY is not configured in .env",
      });
    }

    const aiClient = new GoogleGenAI({ apiKey });
    const modelsToTest = [process.env.GEMINI_MODEL || "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-2.5-flash"];
    const errors: Record<string, string> = {};

    for (const model of modelsToTest) {
      try {
        const response = await aiClient.models.generateContent({
          model,
          contents: "Hello! Confirm in 5 words that Gemini API connection is working.",
        });

        if (response && response.text) {
          return res.status(200).json({
            status: "success",
            modelUsed: model,
            apiKeyPrefix: `${apiKey.substring(0, 8)}...`,
            response: response.text.trim(),
          });
        }
      } catch (modelErr: any) {
        errors[model] = modelErr.message || String(modelErr);
      }
    }

    return res.status(200).json({
      status: "error",
      message: "Gemini API key provided, but API request failed across all tested models.",
      apiKeyPrefix: `${apiKey.substring(0, 8)}...`,
      modelErrors: errors,
    });
  } catch (err: any) {
    return res.status(200).json({ status: "error", message: err.message, stack: err.stack });
  }
}

export async function runStreakCronDebug(req: AuthRequest, res: Response) {
  try {
    return res.status(200).json({ message: "Streak cron executed successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getMasterReferences(req: any, res: Response) {
  try {
    const { type } = req.query;
    const { MasterReference } = await import("../models/MasterReference.ts");
    const query = type ? { type: String(type) } : {};
    const items = await MasterReference.find(query).sort({ name: 1 });
    return res.status(200).json({ success: true, count: items.length, data: items });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}
