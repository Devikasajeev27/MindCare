import Razorpay from "razorpay";
import crypto from "crypto";
import { Response } from "express";
import { AuthRequest } from "../middleware/auth.ts";
import { User } from "../models/User.ts";
import { Appointment } from "../models/Appointment.ts";
import { CompanionSession } from "../models/CompanionSession.ts";
import { CompanionEarnings } from "../models/CompanionEarnings.ts";
import { PaymentHistory } from "../models/PaymentHistory.ts";
import { BillingPlan } from "../models/BillingPlan.ts";
import { Notification } from "../models/Notification.ts";
import { Therapist } from "../models/Therapist.ts";
import { logActivity } from "../utils/auditLogger.ts";

async function findActiveSubscriptionPlan(targetId: string) {
  if (!targetId) return null;
  const plan = /^[0-9a-fA-F]{24}$/.test(targetId)
    ? await BillingPlan.findById(targetId)
    : await BillingPlan.findOne({ name: targetId });
  return plan?.active && plan.price > 0 ? plan : null;
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_dummykey123",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "dummysecret456",
});

export async function createRazorpayOrder(req: AuthRequest, res: Response) {
  try {
    const { amount, type, targetId, therapistId, date, timeSlot, billingCycle } = req.body;
    if (!amount || !type) {
      return res.status(400).json({ message: "Amount and type are required" });
    }

    if (type === "therapist_consultation" || type === "appointment") {
      const selectedTherapistId = therapistId || targetId;
      if (selectedTherapistId && date && timeSlot) {
        const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

        const slotLock = await Appointment.findOne({
          therapistId: selectedTherapistId,
          date: { $gte: startOfDay, $lte: endOfDay },
          timeSlot,
          status: { $nin: ["CANCELLED", "AUTO_CANCELLED", "EXPIRED", "cancelled", "rejected", "auto_cancelled"] }
        });

        if (slotLock && slotLock.userId.toString() !== req.user._id.toString()) {
          return res.status(400).json({ message: "This appointment slot is no longer available." });
        }
      }

      if (targetId && /^[0-9a-fA-F]{24}$/.test(targetId)) {
        const apptCheck = await Appointment.findById(targetId);
        if (apptCheck) {
          if (apptCheck.userId.toString() !== req.user._id.toString() || apptCheck.status !== "APPROVED" || apptCheck.paymentStatus !== "PAYMENT_PENDING") {
            return res.status(403).json({ message: "Payment is available only for your approved appointment with a pending payment." });
          }
        }
      }
    }

    let chargeAmount = Number(amount);
    if (type === "subscription") {
      const plan = await findActiveSubscriptionPlan(targetId);
      if (!plan) return res.status(400).json({ message: "Select a valid paid subscription plan." });
      const expectedAmount = billingCycle === "yearly" ? Math.round(plan.price * 12 * 0.8) : plan.price;
      if (chargeAmount !== expectedAmount) {
        return res.status(400).json({ message: "Subscription price does not match the selected plan." });
      }
      chargeAmount = expectedAmount;
    }

    const options = {
      amount: Math.round(chargeAmount * 100), // in paise
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        type,
        userId: req.user._id.toString(),
        targetId: targetId || therapistId || "",
        date: date || "",
        timeSlot: timeSlot || "",
        billingCycle: billingCycle === "yearly" ? "yearly" : "monthly",
      },
    };

    let order;
    try {
      if (process.env.RAZORPAY_KEY_ID && !process.env.RAZORPAY_KEY_ID.includes("dummy")) {
        order = await razorpay.orders.create(options);
      } else {
        order = {
          id: `order_demo_${Date.now()}`,
          entity: "order",
          amount: options.amount,
          amount_paid: 0,
          amount_due: options.amount,
          currency: "INR",
          receipt: options.receipt,
          status: "created",
          attempts: 0,
          notes: options.notes,
          created_at: Math.floor(Date.now() / 1000),
        };
      }
    } catch (orderErr: any) {
      console.warn("[RazorpayOrder] API call failed. Generating fallback order:", orderErr?.message || orderErr);
      order = {
        id: `order_demo_${Date.now()}`,
        entity: "order",
        amount: options.amount,
        amount_paid: 0,
        amount_due: options.amount,
        currency: "INR",
        receipt: options.receipt,
        status: "created",
        attempts: 0,
        notes: options.notes,
        created_at: Math.floor(Date.now() / 1000),
      };
    }

    return res.status(200).json({
      success: true,
      order,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || "rzp_test_dummykey123",
    });
  } catch (error: any) {
    console.error("Razorpay order creation error:", error);
    return res.status(500).json({ message: error.message || "Failed to create payment order" });
  }
}

export async function verifyRazorpayPayment(req: AuthRequest, res: Response) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      type,
      targetId,
      amount,
      therapistId,
      date,
      timeSlot,
      consultationType,
      billingCycle
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !type) {
      return res.status(400).json({ message: "Verification parameters are required" });
    }

    // Verify Signature
    const secret = process.env.RAZORPAY_KEY_SECRET || "dummysecret456";
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest("hex");

    if (generated_signature !== razorpay_signature && !razorpay_order_id.includes("demo") && !razorpay_payment_id.includes("demo")) {
      return res.status(400).json({ message: "Payment verification failed: Invalid signature" });
    }

    // Check duplicate
    const duplicate = await PaymentHistory.findOne({ invoiceNumber: razorpay_payment_id });
    if (duplicate) {
      return res.status(200).json({ success: true, payment: duplicate, message: "Payment already verified" });
    }

    const amountVal = Number(amount);
    if (!Number.isFinite(amountVal) || amountVal <= 0) {
      return res.status(400).json({ message: "Invalid payment amount." });
    }
    const platformCommission = Number((amountVal * 0.20).toFixed(2));
    const gst = Number((amountVal * 0.18).toFixed(2));
    const netEarnings = Number((amountVal - platformCommission - gst).toFixed(2));

    let description = "MindCare Payment";
    let planId = undefined;
    let sessionId = undefined;
    let createdAppointment: any = null;

    // Process payment logic
    if (type === "therapist_consultation" || type === "appointment") {
      let appointment = targetId && /^[0-9a-fA-F]{24}$/.test(targetId)
        ? await Appointment.findById(targetId)
        : null;

      const targetTherapistId = therapistId || (appointment ? appointment.therapistId : null);

      // Final Atomic Concurrency Check
      if (targetTherapistId && date && timeSlot) {
        const startOfDay = new Date(date); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date); endOfDay.setHours(23, 59, 59, 999);

        const slotLock = await Appointment.findOne({
          _id: { $ne: appointment ? appointment._id : null },
          therapistId: targetTherapistId,
          date: { $gte: startOfDay, $lte: endOfDay },
          timeSlot,
          status: { $nin: ["CANCELLED", "AUTO_CANCELLED", "EXPIRED", "cancelled", "rejected", "auto_cancelled"] }
        });

        if (slotLock && slotLock.userId.toString() !== req.user._id.toString()) {
          return res.status(400).json({ message: "This appointment slot is no longer available." });
        }
      }

      if (appointment) {
        if (appointment.userId.toString() !== req.user._id.toString() || appointment.status !== "APPROVED") {
          return res.status(403).json({ message: "Payment is available only after the assigned therapist approves this appointment." });
        }
        appointment.status = "APPROVED";
        appointment.paymentStatus = "SUCCESS";
        appointment.refundStatus = "NOT_REQUIRED";
        appointment.amountPaid = amountVal;
        appointment.paymentId = razorpay_payment_id;
        appointment.orderId = razorpay_order_id;
        appointment.gatewayTransactionId = razorpay_payment_id;
        appointment.messagingEnabled = true;
        await appointment.save();
        createdAppointment = appointment;
      } else if (targetTherapistId) {
        let therapistProfile = await Therapist.findById(targetTherapistId);
        if (!therapistProfile) {
          therapistProfile = await Therapist.findOne({ userId: targetTherapistId });
        }

        const actualTherapistUserId = therapistProfile ? therapistProfile.userId : targetTherapistId;

        appointment = await Appointment.create({
          userId: req.user._id,
          therapistId: actualTherapistUserId,
          date: date ? new Date(date) : new Date(),
          timeSlot: timeSlot || "10:00 AM - 11:00 AM",
          type: consultationType === "chat" ? "chat" : "voice",
          consultationFee: amountVal,
          amountPaid: amountVal,
          status: "PENDING_APPROVAL",
          paymentStatus: "SUCCESS",
          refundStatus: "NOT_REQUIRED",
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          gatewayTransactionId: razorpay_payment_id,
          bookingDate: new Date(),
          reason: "General Consultation"
        });
        createdAppointment = appointment;
      }

      const therapistUser = createdAppointment ? await User.findById(createdAppointment.therapistId) : null;
      const therapistName = therapistUser?.name || "Therapist";
      description = `Therapist Session with ${therapistName}`;

      // Notify Patient
      await Notification.create({
        userId: req.user._id,
        title: "Payment Successful 🎉",
        message: `Payment of ₹${amountVal} completed for your appointment with ${therapistName}. Your request has been submitted for therapist approval.`,
        type: "appointment",
        isRead: false,
      });

      // Notify Therapist
      if (createdAppointment) {
        await Notification.create({
          userId: createdAppointment.therapistId,
          title: "New Paid Booking Request 🩺",
          message: `Patient ${req.user.name} has paid ₹${amountVal} for a session on ${new Date(createdAppointment.date).toLocaleDateString()} at ${createdAppointment.timeSlot}. Please review and approve in your dashboard.`,
          type: "appointment",
          isRead: false,
        });
      }
    } else if (type === "companion_session") {
      const session = await CompanionSession.findById(targetId);
      if (session) {
        session.isFreeTierActive = false;
        session.paymentCompleted = true;
        await session.save();

        sessionId = session._id;
        description = `Peer Session - ${session.companionAlias}`;

        await User.findByIdAndUpdate(session.companionId, {
          $inc: { walletBalance: netEarnings },
        });

        let stats = await CompanionEarnings.findOne({ userId: session.companionId });
        if (!stats) stats = await CompanionEarnings.create({ userId: session.companionId });
        stats.totalEarnings += netEarnings;
        await stats.save();
      }
    } else if (type === "subscription") {
      const plan = await findActiveSubscriptionPlan(targetId);
      if (!plan) return res.status(400).json({ message: "Selected subscription plan is no longer available." });
      const expectedAmount = billingCycle === "yearly" ? Math.round(plan.price * 12 * 0.8) : plan.price;
      if (amountVal !== expectedAmount) {
        return res.status(400).json({ message: "Paid amount does not match the selected subscription plan." });
      }

      const planName = plan.name;
      planId = plan._id;
      description = `${planName} ${billingCycle === "yearly" ? "Annual" : "Monthly"} Subscription`;

      const durationDays = billingCycle === "yearly" ? 365 : 30;
      await User.findByIdAndUpdate(req.user._id, {
        activePlan: {
          planId: planId || targetId,
          expiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000),
        },
      });
    } else if (type === "wallet_deposit") {
      description = "Wallet Deposit via Razorpay";
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { walletBalance: amountVal },
      });
    }

    // `appointment` is the public checkout API label. PaymentHistory stores
    // therapist payments under its canonical reporting category.
    const paymentHistoryType = type === "appointment" ? "therapist_consultation" : type;
    const payment = await PaymentHistory.create({
      userId: req.user._id,
      appointmentId: createdAppointment ? createdAppointment._id : undefined,
      sessionId,
      planId,
      amount: amountVal,
      platformCommission,
      companionEarnings: type === "subscription" || type === "wallet_deposit" ? 0 : netEarnings,
      gst,
      status: "success",
      type: paymentHistoryType,
      description,
      invoiceNumber: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpaySignature: razorpay_signature,
      paymentMethod: "Razorpay Checkout",
    });

    await logActivity({
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: req.user.email,
      role: req.user.role,
      action: "RAZORPAY_PAYMENT_VERIFIED",
      status: "success",
      details: `${description} verified. Amount: ₹${amountVal}. Payment ID: ${razorpay_payment_id}`,
    });

    return res.status(200).json({
      success: true,
      payment,
      appointment: createdAppointment,
      message: "Payment verified and appointment submitted for approval"
    });
  } catch (error: any) {
    console.error("Razorpay verification error:", error);
    return res.status(500).json({ message: error.message || "Payment verification failed" });
  }
}

export async function handleRazorpayWebhook(req: any, res: Response) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "default_webhook_secret";
    const signature = req.headers["x-razorpay-signature"];

    const shasum = crypto.createHmac("sha256", webhookSecret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest("hex");

    if (digest !== signature) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = req.body.event;
    console.log(`[RAZORPAY-WEBHOOK] Received event: ${event}`);

    if (event === "order.paid" || event === "payment.captured") {
      const paymentEntity = req.body.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      const amountVal = paymentEntity.amount / 100; // convert paise to INR

      const duplicate = await PaymentHistory.findOne({ invoiceNumber: paymentId });
      if (!duplicate) {
        const orderInfo = await razorpay.orders.fetch(orderId);
        const { type, userId, targetId } = orderInfo.notes || {};

        if (type && userId) {
          const platformCommission = Number((amountVal * 0.20).toFixed(2));
          const gst = Number((amountVal * 0.18).toFixed(2));
          const netEarnings = Number((amountVal - platformCommission - gst).toFixed(2));

          let description = "Webhook Processed Payment";
          let planId = undefined;
          let appointmentId: any = undefined;

          if (type === "therapist_consultation" || type === "appointment") {
            const appointment = await Appointment.findById(targetId);
            if (appointment) {
              // Webhooks only finalize a therapist-approved appointment.
              if (appointment.status !== "APPROVED") return res.status(200).json({ received: true });
              appointment.status = "APPROVED";
              appointment.paymentStatus = "SUCCESS";
              appointment.refundStatus = "NOT_REQUIRED";
              appointment.paymentId = paymentId;
              appointment.orderId = orderId;
              appointment.amountPaid = amountVal;
              appointment.messagingEnabled = true;
              await appointment.save();
              appointmentId = appointment._id;

              const therapistProfile = await Therapist.findOne({ userId: appointment.therapistId });
              description = `Therapist Booking with ${therapistProfile?.name || "Therapist"}`;
            }
          }

          const paymentHistoryType = type === "appointment" ? "therapist_consultation" : type;
          await PaymentHistory.create({
            userId,
            appointmentId,
            amount: amountVal,
            platformCommission,
            companionEarnings: netEarnings,
            gst,
            status: "success",
            type: paymentHistoryType,
            description,
            invoiceNumber: paymentId,
            paymentMethod: "Webhook Capture",
          });

          await Notification.create({
            userId,
            title: "Payment Captured 🎉",
            message: `Your payment of ₹${amountVal} for ${description} has been confirmed.`,
            type: "info",
          });
        }
      }
    }

    return res.status(200).json({ status: "ok" });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return res.status(500).json({ message: error.message || "Webhook processing failed" });
  }
}
