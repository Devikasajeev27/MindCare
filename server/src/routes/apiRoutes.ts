import { Router } from "express";
import { protect, requireRole, requireSubscription } from "../middleware/auth.ts";
import { languageDetectorMiddleware } from "../middleware/languageDetector.ts";
import {
  register,
  login,
  getProfile,
  updateProfile,
  completeOnboarding,
  toggleCompanionStatus,
  deleteAccount,
  exportUserData,
  forgotPassword,
  resetPassword,
  changePassword,
  logout,
  uploadPanDocument,
} from "../controllers/authController.ts";
import { runAuthSelfTest } from "../controllers/testAuthController.ts";
import { validateObjectId } from "../middleware/validateObjectId.ts";
import {
  getMoods,
  addMood,
  getJournals,
  addJournal,
  updateJournal,
  deleteJournal,
  getTherapists,
  addTherapistReview,
  updateTherapistAvailability,
  registerAsTherapist,
  getCompanions,
  getChatHistory,
  getChatHistoryForSession,
  sendMessage,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  addNotification,
  getExchangeRatesProxy,
  getTherapistDashboardStats,
  getDashboardOverview,
  getProgressSummary,
  getResourcesLibrary,
  getBillingOverview,
  subscribeBillingPlan,
  getAiInsights,
  bookAppointment,
  getAppointments,
  deleteChatMessage,
  runLanguageSelfTest,
  getMoodAnalytics,
  getUnifiedMoodHistory,
  uploadAttachment,
  downloadAttachment,
  deleteAttachment,
  seedStreakDebug,
  runStreakCronDebug,
  processVoiceInput,
  testGeminiConnection,
  getMasterReferences,
} from "../controllers/apiController.ts";

import {
  getProfile as getAiProfile,
  updateProfile as updateAiProfile,
  addMemory as addAiMemory,
  editMemory as editAiMemory,
  deleteMemory as deleteAiMemory,
  importHistory as importAiHistory,
  deleteImportedHistory as deleteImportedAiHistory,
  setTherapistEscalationConsent,
} from "../controllers/aiCompanionController.ts";

import {
  getEmergencyContacts,
  saveEmergencyContact,
  getActiveEmergencySession,
} from "../controllers/crisisController.ts";
import {
  acceptEmergencyAssignment,
  declineEmergencyAssignment,
  getEmergencyAssignments,
  triggerManualSOS,
  updateEmergencyOnCall,
} from "../controllers/emergencyAssignmentController.ts";

import {
  reportLocation,
  getRiskScore,
  getEmergencyEvents,
  resolveEmergencyEvent,
} from "../controllers/riskController.ts";

import {
  requestMatch,
  processSessionPayment,
  endSession,
  getCompanionStats,
  getFavoriteCompanionStatus,
  getDetailedCompanionStats,
} from "../controllers/matchingController.ts";
import { getCompanionMessages, sendCompanionMessage } from "../controllers/companionChatController.ts";
import { getEmergencyMessages, sendEmergencyMessage } from "../controllers/emergencyCommunicationController.ts";

import {
  getTherapistsAdmin,
  updateTherapistStatus,
  getCompanionsAdmin,
  requestCompanionVerification,
  verifyCompanionStatus,
  getAuditLogs,
  getEmergencyAlerts,
  resolveEmergencyAlert,
  getAllUsers,
  blockAccount,
  unblockAccount,
  getAdminDashboardStats,
  suspendUser,
  activateUser,
  resetUserPassword,
  getReportsAdmin,
  getSystemSettings,
  updateSystemSettings,
  getUserProfileAdmin,
  getRevenueStats,
  getRevenueChart,
  getAllPaymentsAdmin,
  getAllAppointmentsAdmin,
  processAdminRefund,
  exportAppointmentsCSV,
} from "../controllers/adminController.ts";

import {
  getAppointmentDetails,
  cancelAppointment,
  rescheduleAppointment,
  setAppointmentReminder,
  reviewAppointment,
  approveAppointment,
  rejectAppointment,
  getBookedSlots,
  getUpcomingAppointment,
  triggerAutoCancellationCron,
} from "../controllers/appointmentController.ts";

import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
} from "../controllers/paymentController.ts";

import { asyncHandler } from "../middleware/asyncHandler.ts";
import { getAppointmentConversation, getMessageableAppointmentForTherapist, sendAppointmentMessage, markAppointmentMessagesRead, setAppointmentUserBlock, authorizeAppointmentCall } from "../controllers/appointmentCommunicationController.ts";
import mongoose from "mongoose";

const router = Router();

// ── wrap(): ensures any unhandled promise rejection is forwarded to the
//    global error handler rather than crashing the process ───────────────────
const wrap = asyncHandler;

// ── Parameter ObjectId validation ────────────────────────────────────────────
router.param("id", (req, res, next, val) => {
  if (val && !mongoose.Types.ObjectId.isValid(val)) {
    return res.status(400).json({ message: "Invalid identification format for parameter: id" });
  }
  next();
});



router.param("appointmentId", (req, res, next, val) => {
  if (val && !mongoose.Types.ObjectId.isValid(val)) {
    return res.status(400).json({ message: "Invalid identification format for parameter: appointmentId" });
  }
  next();
});

// ── Public routes ─────────────────────────────────────────────────────────────
router.get("/exchange-rates", wrap(getExchangeRatesProxy));
router.get("/test-languages", wrap(runLanguageSelfTest));
router.get("/test-gemini", wrap(testGeminiConnection));

// ── Auth routes ───────────────────────────────────────────────────────────────
// Note: register and login are already wrapped via asyncHandler inside authController.ts
router.post("/auth/register", register);
router.post("/auth/login", login);
router.post("/auth/forgot-password", forgotPassword);
router.post("/auth/reset-password", resetPassword);
router.post("/auth/logout", protect, logout);
router.get("/auth/profile", protect, getProfile);
router.put("/auth/profile", protect, updateProfile);
router.post("/auth/pan/upload", protect, wrap(uploadPanDocument));
router.delete("/auth/profile", protect, deleteAccount);
router.get("/auth/export", protect, exportUserData);
router.post("/auth/onboarding", protect, completeOnboarding);
router.put("/auth/companion-status", protect, requireRole("user", "therapist", "admin"), toggleCompanionStatus);
router.get("/test-auth", wrap(runAuthSelfTest));

// ── Mood routes ───────────────────────────────────────────────────────────────
router.get("/moods", protect, wrap(getMoods));
router.get("/moods/history", protect, wrap(getUnifiedMoodHistory));
router.post("/moods", protect, wrap(addMood));
router.get("/mood/analytics", protect, requireRole("user"), wrap(getMoodAnalytics));

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get("/dashboard", protect, requireRole("user"), wrap(getDashboardOverview));
router.get("/progress/summary", protect, requireRole("user"), wrap(getProgressSummary));
router.get("/resources", protect, requireRole("user", "therapist"), wrap(getResourcesLibrary));
router.get("/billing", protect, requireRole("user"), wrap(getBillingOverview));
router.post("/billing/subscribe", protect, requireRole("user"), wrap(subscribeBillingPlan));

// ── AI Companion ──────────────────────────────────────────────────────────────
router.get("/ai/profile", protect, wrap(getAiProfile));
router.put("/ai/profile", protect, wrap(updateAiProfile));
router.post("/ai/memories", protect, wrap(addAiMemory));
router.put("/ai/memories/:memoryId", protect, wrap(editAiMemory));
router.delete("/ai/memories/:memoryId", protect, wrap(deleteAiMemory));
router.post("/ai/import", protect, wrap(importAiHistory));
router.delete("/ai/import", protect, wrap(deleteImportedAiHistory));
router.post("/ai/therapist-escalation/consent", protect, wrap(setTherapistEscalationConsent));
router.post("/ai/voice", protect, wrap(processVoiceInput));
router.get("/ai/insights", protect, requireRole("user"), requireSubscription, wrap(getAiInsights));

// ── Journal routes ────────────────────────────────────────────────────────────
router.get("/journals", protect, wrap(getJournals));
router.post("/journals", protect, wrap(addJournal));
router.put("/journals/:id", protect, wrap(updateJournal));
router.delete("/journals/:id", protect, wrap(deleteJournal));

// ── Therapist routes ──────────────────────────────────────────────────────────
router.get("/therapists", protect, wrap(getTherapists));
router.post("/therapists/register", protect, wrap(registerAsTherapist));
router.post("/therapists/:id/reviews", protect, wrap(addTherapistReview));
router.put("/therapist/availability", protect, wrap(updateTherapistAvailability));
router.get("/therapist/dashboard/stats", protect, requireRole("therapist"), wrap(getTherapistDashboardStats));
router.put("/therapist/emergency-on-call", protect, requireRole("therapist"), wrap(updateEmergencyOnCall));
router.get("/therapist/emergency-cases", protect, requireRole("therapist"), wrap(getEmergencyAssignments));
router.post("/therapist/emergency-cases/:caseId/accept", protect, requireRole("therapist"), wrap(acceptEmergencyAssignment));
router.post("/therapist/emergency-cases/:caseId/decline", protect, requireRole("therapist"), wrap(declineEmergencyAssignment));
router.get("/appointments/booked-slots", protect, wrap(getBookedSlots));
router.post("/appointments/cron/auto-cancel", protect, wrap(triggerAutoCancellationCron));
router.post("/appointments", protect, wrap(bookAppointment));
router.get("/appointments", protect, wrap(getAppointments));
router.get("/appointments/upcoming", protect, wrap(getUpcomingAppointment));
router.get("/appointments/therapist/:therapistId/messaging", protect, wrap(getMessageableAppointmentForTherapist));
router.get("/appointments/:appointmentId", protect, wrap(getAppointmentDetails));
router.put("/appointments/:appointmentId/approve", protect, wrap(approveAppointment));
router.put("/appointments/:appointmentId/reject", protect, wrap(rejectAppointment));
router.post("/appointments/:appointmentId/cancel", protect, wrap(cancelAppointment));
router.put("/appointments/:appointmentId/reschedule", protect, wrap(rescheduleAppointment));
router.post("/appointments/:appointmentId/reminder", protect, wrap(setAppointmentReminder));
router.post("/appointments/:appointmentId/review", protect, wrap(reviewAppointment));
router.get("/appointments/:appointmentId/conversation", protect, wrap(getAppointmentConversation));
router.post("/appointments/:appointmentId/messages", protect, wrap(sendAppointmentMessage));
router.put("/appointments/:appointmentId/messages/read", protect, wrap(markAppointmentMessagesRead));
router.put("/appointments/:appointmentId/block", protect, requireRole("therapist"), wrap(setAppointmentUserBlock));
router.post("/appointments/:appointmentId/call/authorize", protect, wrap(authorizeAppointmentCall));

// ── Companion routes ──────────────────────────────────────────────────────────
router.get("/companions", protect, wrap(getCompanions));
router.post("/companions/verify-request", protect, wrap(requestCompanionVerification));

// ── Chat routes ───────────────────────────────────────────────────────────────
router.get("/chats", protect, wrap(getChatHistory));
router.get("/chats/:sessionId", protect, wrap(getChatHistoryForSession));
router.post("/chats", protect, languageDetectorMiddleware, wrap(sendMessage));
router.post("/chats/voice", protect, wrap(processVoiceInput));
router.delete("/chats/:id", protect, wrap(deleteChatMessage));
router.get("/companion-sessions/:sessionId/messages", protect, wrap(getCompanionMessages));
router.post("/companion-sessions/:sessionId/messages", protect, wrap(sendCompanionMessage));

// A user-requested SOS never pretends that contacts were messaged. It creates
// an auditable on-call offer and reports whether a clinician actually accepts.
router.post("/crisis/sos", protect, requireRole("user"), wrap(triggerManualSOS));

// ── Attachment routes ──────────────────────────────────────────────────────────
router.post("/attachments/upload", protect, wrap(uploadAttachment));
router.get("/attachments/download/:filename", protect, wrap(downloadAttachment));
router.delete("/attachments/:id", protect, wrap(deleteAttachment));

// ── Notification routes ───────────────────────────────────────────────────────
router.get("/notifications", protect, wrap(getNotifications));
router.put("/notifications/:id/read", protect, wrap(markNotificationRead));
router.put("/notifications/read-all", protect, wrap(markAllNotificationsRead));
router.delete("/notifications/:id", protect, wrap(deleteNotification));
router.post("/notifications", protect, wrap(addNotification));

// ── User Settings routes ─────────────────────────────────────────────────────
router.get("/user/settings", protect, wrap(async (req: any, res: any) => {
  try {
    const { User } = await import("../models/User.ts");
    const user = await User.findById(req.user._id).select("notificationPreferences privacySettings");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({
      notificationPreferences: user.notificationPreferences || { email: true, push: true, sms: false, weekly: true, crisis: true },
      privacySettings: user.privacySettings || { anonymousMode: false, twoFactorAuth: true, dataSharing: false },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}));
router.put("/user/settings", protect, wrap(async (req: any, res: any) => {
  try {
    const { User } = await import("../models/User.ts");
    const { notificationPreferences, privacySettings } = req.body;
    const update: any = {};
    if (notificationPreferences) update.notificationPreferences = notificationPreferences;
    if (privacySettings) update.privacySettings = privacySettings;
    const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true }).select("notificationPreferences privacySettings");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({
      notificationPreferences: user.notificationPreferences,
      privacySettings: user.privacySettings,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}));

// ── Crisis routes ─────────────────────────────────────────────────────────────
router.get("/crisis/contacts", protect, wrap(getEmergencyContacts));
router.post("/crisis/contacts", protect, wrap(saveEmergencyContact));
router.get("/crisis/active-session", protect, wrap(getActiveEmergencySession));
router.get("/emergency-sessions/:sessionId/messages", protect, wrap(getEmergencyMessages));
router.post("/emergency-sessions/:sessionId/messages", protect, wrap(sendEmergencyMessage));
router.post("/risk/report-location", protect, wrap(reportLocation));
router.get("/risk/score", protect, wrap(getRiskScore));
router.get("/risk/events", protect, wrap(getEmergencyEvents));
router.post("/risk/resolve/:eventId", protect, wrap(resolveEmergencyEvent));

// ── Companion Matching routes ─────────────────────────────────────────────────
router.post("/matching/request", protect, wrap(requestMatch));
router.post("/matching/payment", protect, wrap(processSessionPayment));
router.post("/matching/end", protect, wrap(endSession));
router.get("/matching/stats", protect, wrap(getCompanionStats));
router.get("/matching/favorite-status", protect, wrap(getFavoriteCompanionStatus));
router.get("/matching/detailed-stats", protect, wrap(getDetailedCompanionStats));

// ── Razorpay Payment routes ──────────────────────────────────────────────────
router.post("/payments/order", protect, wrap(createRazorpayOrder));
router.post("/payments/verify", protect, wrap(verifyRazorpayPayment));
router.post("/payments/webhook", wrap(handleRazorpayWebhook));

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get("/admin/therapists", protect, requireRole("admin"), wrap(getTherapistsAdmin));
router.put("/admin/therapists/:id/status", protect, requireRole("admin"), wrap(updateTherapistStatus));
router.get("/admin/companions/requests", protect, requireRole("admin"), wrap(getCompanionsAdmin));
router.put("/admin/companions/:id/verify", protect, requireRole("admin"), wrap(verifyCompanionStatus));
router.get("/admin/audit-logs", protect, requireRole("admin"), wrap(getAuditLogs));
router.get("/admin/alerts", protect, requireRole("admin", "therapist"), wrap(getEmergencyAlerts));
router.put("/admin/alerts/:id/resolve", protect, requireRole("admin", "therapist"), wrap(resolveEmergencyAlert));
router.get("/admin/emergency-alerts", protect, requireRole("admin", "therapist"), wrap(getEmergencyAlerts));
router.put("/admin/emergency-alerts/:id/resolve", protect, requireRole("admin", "therapist"), wrap(resolveEmergencyAlert));
router.get("/admin/users", protect, requireRole("admin"), wrap(getAllUsers));
router.get("/admin/users/:id/profile", protect, requireRole("admin"), wrap(getUserProfileAdmin));
router.post("/admin/users/:id/block", protect, requireRole("admin"), wrap(blockAccount));
router.post("/admin/users/:id/unblock", protect, requireRole("admin"), wrap(unblockAccount));
router.get("/admin/dashboard/stats", protect, requireRole("admin"), wrap(getAdminDashboardStats));
router.put("/admin/users/:id/suspend", protect, requireRole("admin"), wrap(suspendUser));
router.put("/admin/users/:id/activate", protect, requireRole("admin"), wrap(activateUser));
router.put("/admin/users/:id/reset-password", protect, requireRole("admin"), wrap(resetUserPassword));
router.get("/admin/reports", protect, requireRole("admin"), wrap(getReportsAdmin));
router.get("/admin/revenue/stats", protect, requireRole("admin"), wrap(getRevenueStats));
router.get("/admin/revenue/chart", protect, requireRole("admin"), wrap(getRevenueChart));
router.get("/admin/payments", protect, requireRole("admin"), wrap(getAllPaymentsAdmin));
router.get("/admin/appointments", protect, requireRole("admin"), wrap(getAllAppointmentsAdmin));
router.post("/admin/appointments/:appointmentId/refund", protect, requireRole("admin"), wrap(processAdminRefund));
router.get("/admin/appointments/export", protect, requireRole("admin"), wrap(exportAppointmentsCSV));
router.get("/admin/settings", protect, requireRole("admin"), wrap(getSystemSettings));
router.put("/admin/settings", protect, requireRole("admin"), wrap(updateSystemSettings));

// ── Reference & Master Data routes ──────────────────────────────────────────────────
router.get("/reference-data", wrap(getMasterReferences));

// ── Debug routes ──────────────────────────────────────────────────────────────
router.post("/debug/seed-streak", protect, requireRole("admin"), wrap(seedStreakDebug));
router.post("/debug/run-streak-cron", protect, requireRole("admin"), wrap(runStreakCronDebug));

export default router;
