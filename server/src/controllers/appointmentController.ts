import { Response } from "express";
import { AuthRequest } from "../middleware/auth.ts";
import { Appointment } from "../models/Appointment.ts";
import { Notification } from "../models/Notification.ts";
import { User } from "../models/User.ts";
import { PaymentHistory } from "../models/PaymentHistory.ts";
import { Therapist } from "../models/Therapist.ts";
import { logActivity } from "../utils/auditLogger.ts";

// New appointments store the therapist's User id.  Include the owned Therapist
// profile id only for legacy records, matching the dashboard's read scope.
async function therapistAppointmentScope(userId: any) {
  const therapist = await Therapist.findOne({ userId }).select("_id").lean();
  return { therapistId: { $in: therapist ? [userId, therapist._id] : [userId] } };
}

// Helper: Process Automatic Refund
export async function processAutomaticRefund(
  appointment: any,
  cancellationReason: string,
  cancelledByRole: string,
  isAutoCancel = false
) {
  const refundAmount = appointment.amountPaid || appointment.consultationFee || 0;
  const prefix = isAutoCancel ? "ref_auto_" : "ref_";
  const refPrefix = isAutoCancel ? "REF-AUTO-" : "REF-";
  
  const refundId = `${prefix}${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const refundReference = `${refPrefix}${Date.now()}`;
  const refundDate = new Date();

  appointment.status = isAutoCancel ? "EXPIRED" : "CANCELLED";
  appointment.paymentStatus = "REFUNDED";
  appointment.refundStatus = "COMPLETED";
  appointment.refundId = refundId;
  appointment.refundReference = refundReference;
  appointment.refundDate = refundDate;
  appointment.refundAmount = refundAmount;
  appointment.cancellationReason = cancellationReason;

  if (isAutoCancel) {
    appointment.autoCancellationTimestamp = new Date();
  }

  if (cancellationReason) {
    appointment.notes = appointment.notes
      ? `${appointment.notes}\n\nCancellation Reason: ${cancellationReason}\nRefund Ref: ${refundReference}`
      : `Cancellation Reason: ${cancellationReason}\nRefund Ref: ${refundReference}`;
  }
  await appointment.save();

  // Update or Create PaymentHistory record for Refund
  if (appointment.paymentId || appointment._id) {
    let paymentRec = await PaymentHistory.findOne({
      $or: [
        { invoiceNumber: appointment.paymentId },
        { appointmentId: appointment._id }
      ]
    });

    if (paymentRec) {
      paymentRec.status = "refunded";
      paymentRec.refundId = refundId;
      paymentRec.refundReference = refundReference;
      paymentRec.refundDate = refundDate;
      paymentRec.refundAmount = refundAmount;
      paymentRec.cancellationReason = cancellationReason;
      await paymentRec.save();
    } else {
      await PaymentHistory.create({
        userId: appointment.userId,
        appointmentId: appointment._id,
        type: "therapist_consultation",
        description: isAutoCancel 
          ? `Auto-Cancelled Session Refund - ${appointment.timeSlot}`
          : `Refund for Cancelled Session - ${appointment.timeSlot}`,
        invoiceNumber: appointment.paymentId || `PAY-${Date.now()}`,
        paymentMethod: "Automatic Refund to Source",
        amount: refundAmount,
        platformCommission: 0,
        companionEarnings: 0,
        gst: 0,
        status: "REFUNDED",
        refundId,
        refundReference,
        refundDate,
        refundAmount,
        cancellationReason
      });
    }
  }

  // Credit user wallet with refund amount
  if (refundAmount > 0) {
    await User.findByIdAndUpdate(appointment.userId, {
      $inc: { walletBalance: refundAmount }
    });
  }

  const therapistObj = await User.findById(appointment.therapistId);
  const therapistName = therapistObj?.name || "Therapist";

  if (isAutoCancel) {
    // Notify User
    await Notification.create({
      userId: appointment.userId,
      title: "Appointment Auto-Cancelled & Refunded 🔄",
      message: `Your appointment with ${therapistName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.timeSlot} was auto-cancelled because it was not approved within 24 hours. A full refund of ₹${refundAmount} has been processed. Ref: ${refundReference}.`,
      type: "appointment",
      isRead: false,
    });

    // Notify Therapist
    await Notification.create({
      userId: appointment.therapistId,
      title: "Appointment Request Auto-Cancelled ⚠️",
      message: `The booking request for ${new Date(appointment.date).toLocaleDateString()} at ${appointment.timeSlot} was auto-cancelled because 24 hours elapsed without therapist approval.`,
      type: "alert",
      isRead: false,
    });
  } else {
    // Notification 1: Refund Initiated
    await Notification.create({
      userId: appointment.userId,
      title: "Appointment Cancelled & Refund Initiated 🔄",
      message: `Your appointment with ${therapistName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.timeSlot} was cancelled. A full refund of ₹${refundAmount} has been initiated automatically.`,
      type: "appointment",
      isRead: false,
    });

    // Notification 2: Refund Completed
    await Notification.create({
      userId: appointment.userId,
      title: "Refund Completed 💳",
      message: `Refund of ₹${refundAmount} for transaction #${appointment.paymentId || 'ONLINE'} has been processed. Reference Number: ${refundReference}.`,
      type: "info",
      isRead: false,
    });
  }

  return { refundId, refundReference, refundAmount, refundDate };
}

// 24-HOUR AUTO CANCELLATION ENGINE
export async function checkAndProcessAutoCancellations() {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredPendingAppointments = await Appointment.find({
      status: { $in: ["PENDING_APPROVAL", "pending"] },
      createdAt: { $lte: twentyFourHoursAgo }
    });

    console.log(`[AutoCancellationCron] Found ${expiredPendingAppointments.length} pending appointments older than 24 hours.`);

    for (const appt of expiredPendingAppointments) {
      await processAutomaticRefund(
        appt,
        "Auto-cancelled: Therapist did not respond within 24 hours.",
        "system",
        true
      );
    }
    return expiredPendingAppointments.length;
  } catch (err) {
    console.error("[AutoCancellationCron] Error running auto-cancellation check:", err);
    return 0;
  }
}

// GET booked time slots for therapist on a specific date (to lock unavailable slots)
export async function getBookedSlots(req: AuthRequest, res: Response) {
  try {
    const { therapistId, date } = req.query;
    if (!therapistId || !date) {
      return res.status(400).json({ message: "therapistId and date are required parameters" });
    }

    const startOfDay = new Date(String(date));
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(String(date));
    endOfDay.setHours(23, 59, 59, 999);

    // Active appointments occupy the slot
    const activeAppointments = await Appointment.find({
      therapistId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ["CANCELLED", "AUTO_CANCELLED", "EXPIRED", "cancelled", "rejected", "auto_cancelled"] }
    }).select("timeSlot status");

    const bookedSlots = activeAppointments.map(a => a.timeSlot);
    return res.status(200).json({ bookedSlots, activeAppointments });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// Trigger manual or cron auto cancellation endpoint
export async function triggerAutoCancellationCron(req: AuthRequest, res: Response) {
  try {
    const processedCount = await checkAndProcessAutoCancellations();
    return res.status(200).json({
      message: `Auto-cancellation engine check completed. Processed ${processedCount} expired appointments.`,
      processedCount
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getAppointmentDetails(req: AuthRequest, res: Response) {
  try {
    const { appointmentId } = req.params;
    const isTherapist = req.user.role === "therapist";
    const isAdmin = req.user.role === "admin";

    const therapistScope = isTherapist ? await therapistAppointmentScope(req.user._id) : null;
    const query = isAdmin
      ? { _id: appointmentId }
      : isTherapist
      ? { _id: appointmentId, ...therapistScope }
      : { _id: appointmentId, userId: req.user._id };

    const appointment = await Appointment.findOne(query)
      .populate("userId", "name avatar email phone")
      .populate("therapistId", "name avatar email phone title qualification specialization bio consultationFee");

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found or unauthorized access" });
    }

    return res.status(200).json({ appointment });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getAppointments(req: AuthRequest, res: Response) {
  try {
    const isTherapist = req.user.role === "therapist";
    const isAdmin = req.user.role === "admin";

    const therapistScope = isTherapist ? await therapistAppointmentScope(req.user._id) : null;
    const query = isAdmin
      ? {}
      : isTherapist
      ? therapistScope!
      : { userId: req.user._id };

    // Trigger 24-hr auto cancellation check lazily
    checkAndProcessAutoCancellations().catch(() => {});

    const appointments = await Appointment.find(query)
      .populate("userId", "name avatar email phone")
      .populate("therapistId", "name avatar email phone title qualification specialization bio consultationFee")
      .sort({ date: -1, createdAt: -1 });

    return res.status(200).json({ appointments });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// Compatibility endpoint retained for clients that request the upcoming card
// directly. It never exposes another user's appointment.
export async function getUpcomingAppointment(req: AuthRequest, res: Response) {
  const isTherapist = req.user.role === "therapist";
  const ownerQuery = isTherapist ? await therapistAppointmentScope(req.user._id) : { userId: req.user._id };
  const appointment = await Appointment.findOne({ ...ownerQuery, status: "APPROVED", date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } })
    .sort({ date: 1 })
    .populate(isTherapist ? "userId" : "therapistId", "name avatar email");
  return res.json({ appointment });
}

export async function cancelAppointment(req: AuthRequest, res: Response) {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;
    const isTherapist = req.user.role === "therapist";
    const isAdmin = req.user.role === "admin";

    const therapistScope = isTherapist ? await therapistAppointmentScope(req.user._id) : null;
    const query = isAdmin
      ? { _id: appointmentId }
      : isTherapist
      ? { _id: appointmentId, ...therapistScope }
      : { _id: appointmentId, userId: req.user._id };

    const appointment = await Appointment.findOne(query);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found or unauthorized access" });
    }

    if (appointment.status === "CANCELLED" || appointment.status === "EXPIRED") {
      return res.status(400).json({ message: "Appointment is already cancelled" });
    }

    const cancellationReason = reason || (isTherapist ? "Cancelled by therapist" : "Cancelled by patient");
    const refundDetails = await processAutomaticRefund(appointment, cancellationReason, req.user.role, false);

    // Ensure messaging is disabled on cancellation
    appointment.messagingEnabled = false;
    await appointment.save();

    await logActivity({
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: req.user.email,
      role: req.user.role,
      action: isTherapist ? "CANCEL_APPOINTMENT_THERAPIST" : "CANCEL_APPOINTMENT_USER",
      details: `Cancelled appointment ${appointmentId}. Automatic refund processed: ${refundDetails.refundReference}`,
      req,
    });

    return res.status(200).json({
      message: "Appointment cancelled and automatic refund processed successfully",
      appointment,
      refundDetails
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function rescheduleAppointment(req: AuthRequest, res: Response) {
  try {
    const { appointmentId } = req.params;
    const { date, timeSlot } = req.body;
    const isTherapist = req.user.role === "therapist";

    if (!date || !timeSlot) {
      return res.status(400).json({ message: "Date and timeSlot are required" });
    }

    const therapistScope = isTherapist ? await therapistAppointmentScope(req.user._id) : null;
    const query = isTherapist
      ? { _id: appointmentId, ...therapistScope }
      : { _id: appointmentId, userId: req.user._id };

    const appointment = await Appointment.findOne(query);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found or unauthorized access" });
    }

    // Check slot collision on reschedule
    const startOfDay = new Date(date); startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(date); endOfDay.setHours(23,59,59,999);

    const existingSlot = await Appointment.findOne({
      _id: { $ne: appointmentId },
      therapistId: appointment.therapistId,
      date: { $gte: startOfDay, $lte: endOfDay },
      timeSlot,
      status: { $nin: ["CANCELLED", "AUTO_CANCELLED", "EXPIRED", "cancelled", "rejected", "auto_cancelled"] }
    });

    if (existingSlot) {
      return res.status(400).json({ message: "This appointment slot is no longer available." });
    }

    const oldDate = appointment.date;
    const oldTimeSlot = appointment.timeSlot;

    appointment.date = new Date(date);
    appointment.timeSlot = timeSlot;
    appointment.status = "PENDING_APPROVAL"; // Requires re-confirmation if rescheduled
    await appointment.save();

    await logActivity({
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: req.user.email,
      role: req.user.role,
      action: isTherapist ? "RESCHEDULE_APPOINTMENT_THERAPIST" : "RESCHEDULE_APPOINTMENT_USER",
      details: `Rescheduled appointment ${appointmentId} to ${date} ${timeSlot}`,
      req,
    });

    const notifyParty = isTherapist ? appointment.userId : appointment.therapistId;
    await Notification.create({
      userId: notifyParty,
      title: "Voice Consultation Rescheduled",
      message: `Your appointment has been rescheduled to ${new Date(date).toLocaleDateString()} at ${timeSlot}. Previous slot: ${new Date(oldDate).toLocaleDateString()} at ${oldTimeSlot}.`,
      type: "appointment",
      isRead: false,
    });

    return res.status(200).json({ message: "Appointment rescheduled successfully", appointment });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function setAppointmentReminder(req: AuthRequest, res: Response) {
  try {
    const { appointmentId } = req.params;
    const { reminderTimes } = req.body;

    if (!reminderTimes || !Array.isArray(reminderTimes)) {
      return res.status(400).json({ message: "reminderTimes must be an array of dates" });
    }

    const appointment = await Appointment.findOne({ _id: appointmentId, userId: req.user._id });

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found or unauthorized access" });
    }

    appointment.reminderTimes = reminderTimes.map((d: string) => new Date(d));
    await appointment.save();

    await Notification.create({
      userId: req.user._id,
      title: "Reminders Set",
      message: `You will receive consultation reminders for your appointment on ${new Date(appointment.date).toLocaleDateString()}.`,
      type: "appointment",
      isRead: false,
    });

    return res.status(200).json({ message: "Reminders updated successfully", appointment });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function reviewAppointment(req: AuthRequest, res: Response) {
  try {
    const { appointmentId } = req.params;
    const { review } = req.body;

    if (!review) {
      return res.status(400).json({ message: "Review text is required" });
    }

    const appointment = await Appointment.findOne({ _id: appointmentId, userId: req.user._id });

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found or unauthorized access" });
    }

    appointment.review = review;
    appointment.status = "COMPLETED";
    await appointment.save();

    await logActivity({
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: req.user.email,
      role: req.user.role,
      action: "REVIEW_APPOINTMENT",
      details: `Submitted review for appointment ${appointmentId}`,
      req,
    });

    return res.status(200).json({ message: "Review submitted successfully", appointment });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function approveAppointment(req: AuthRequest, res: Response) {
  try {
    const { appointmentId } = req.params;
    const isTherapist = req.user.role === "therapist";
    const isAdmin = req.user.role === "admin";

    const therapistScope = isTherapist ? await therapistAppointmentScope(req.user._id) : null;
    const query = isAdmin
      ? { _id: appointmentId }
      : isTherapist
      ? { _id: appointmentId, ...therapistScope }
      : { _id: appointmentId };

    const appointment = await Appointment.findOne(query);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found or unauthorized access" });
    }

    if (appointment.status !== "PENDING_APPROVAL") {
      return res.status(400).json({ message: "Only pending approval appointments can be approved" });
    }

    // Older bookings could have been paid before the therapist acted. Preserve
    // that successful payment instead of resetting it and requiring a second
    // checkout; approval immediately unlocks their allowed communication.
    const wasAlreadyPaid = appointment.paymentStatus === "SUCCESS";
    appointment.status = "APPROVED";
    appointment.paymentStatus = wasAlreadyPaid ? "SUCCESS" : "PAYMENT_PENDING";
    appointment.approvalTimestamp = new Date();
    appointment.messagingEnabled = wasAlreadyPaid;
    await appointment.save();

    const therapistObj = await User.findById(appointment.therapistId);
    const therapistName = therapistObj?.name || "Therapist";

    await Notification.create({
      userId: appointment.userId,
      title: "Therapist Approved Your Appointment! 🎉",
      message: wasAlreadyPaid
        ? `Your consultation with ${therapistName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.timeSlot} has been approved. Messaging and calls are now enabled.`
        : `Your consultation with ${therapistName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.timeSlot} has been approved. Complete payment to enable messaging and calls.`,
      type: "appointment",
      isRead: false,
    });

    await logActivity({
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: req.user.email,
      role: req.user.role,
      action: "APPROVE_APPOINTMENT",
      details: `Approved appointment ${appointmentId}`,
      req,
    });

    return res.status(200).json({ message: "Appointment approved successfully", appointment });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function rejectAppointment(req: AuthRequest, res: Response) {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;
    const isTherapist = req.user.role === "therapist";
    const isAdmin = req.user.role === "admin";

    const therapistScope = isTherapist ? await therapistAppointmentScope(req.user._id) : null;
    const query = isAdmin
      ? { _id: appointmentId }
      : isTherapist
      ? { _id: appointmentId, ...therapistScope }
      : { _id: appointmentId };

    const appointment = await Appointment.findOne(query);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found or unauthorized access" });
    }

    const rejectionReason = reason || "Therapist unavailable for selected slot";
    const refundDetails = await processAutomaticRefund(appointment, rejectionReason, req.user.role, false);

    // A rejection is not a cancellation; keep the business outcome explicit.
    appointment.status = "REJECTED";
    appointment.rejectionTimestamp = new Date();
    appointment.messagingEnabled = false;
    await appointment.save();

    await logActivity({
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: req.user.email,
      role: req.user.role,
      action: "REJECT_APPOINTMENT",
      details: `Rejected appointment ${appointmentId}. Refund Reference: ${refundDetails.refundReference}`,
      req,
    });

    return res.status(200).json({
      message: "Appointment rejected and automatic refund initiated",
      appointment,
      refundDetails
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}
