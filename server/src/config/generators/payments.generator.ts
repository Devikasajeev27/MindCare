import { User } from "../../models/User.ts";
import { BillingPlan } from "../../models/BillingPlan.ts";
import { Appointment } from "../../models/Appointment.ts";
import { CompanionSession } from "../../models/CompanionSession.ts";
import { PaymentHistory } from "../../models/PaymentHistory.ts";

export async function generatePayments(targetCount = 600) {
  console.log("Checking Payments collection...");
  const clients = await User.find({ role: "user", verifiedCompanion: false });
  const plans = await BillingPlan.find({});
  
  if (clients.length === 0 || plans.length === 0) {
    console.log("No client users or billing plans found. Skipping payments generation.");
    return;
  }

  const existingCount = await PaymentHistory.countDocuments();

  if (existingCount >= targetCount) {
    console.log(`Payments collection satisfies target count (${existingCount}/${targetCount}).`);
    return;
  }

  const payments = [];

  // 1. Gather all companion sessions with paymentCompleted
  const sessions = await CompanionSession.find({ paymentCompleted: true });
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const subtotal = s.duration * 3; // 3 INR/min
    const comm = Math.floor(subtotal * 0.20);
    const compShare = subtotal - comm;
    const gst = Math.floor(subtotal * 0.18);

    payments.push({
      userId: s.userId,
      sessionId: s._id,
      type: "companion_session",
      description: `Peer discussion session duration: ${s.duration} mins`,
      invoiceNumber: `INV-COMP-INR-${8000 + i}`,
      paymentMethod: "Razorpay UPI",
      amount: subtotal + gst,
      platformCommission: comm,
      companionEarnings: compShare,
      gst: gst,
      status: "success",
      createdAt: s.createdAt
    });
  }

  // 2. Gather all non-cancelled appointments
  const appts = await Appointment.find({ status: { $ne: "cancelled" } });
  for (let i = 0; i < appts.length; i++) {
    const app = appts[i];
    const subtotal = app.amountPaid;
    const comm = Math.floor(subtotal * 0.15);
    const gst = Math.floor(subtotal * 0.18);

    payments.push({
      userId: app.userId,
      type: "therapist_consultation",
      description: "Clinical therapist online consultation slot",
      invoiceNumber: `INV-THER-INR-${9000 + i}`,
      paymentMethod: "Razorpay Card",
      amount: subtotal + gst,
      platformCommission: comm,
      companionEarnings: 0,
      gst: gst,
      status: "success",
      createdAt: app.date
    });
  }

  // 3. Add subscription billing logs
  let index = 0;
  while (payments.length < targetCount) {
    const client = clients[index % clients.length];
    const plan = plans[index % plans.length];
    const gst = Math.floor(plan.price * 0.18);

    payments.push({
      userId: client._id,
      planId: plan._id,
      type: "subscription",
      description: `MindCare monthly subscription plan renewal: ${plan.name}`,
      invoiceNumber: `INV-SUB-INR-${15000 + index}`,
      paymentMethod: "Razorpay NetBanking",
      amount: plan.price + gst,
      platformCommission: plan.price,
      companionEarnings: 0,
      gst: gst,
      status: "success",
      createdAt: new Date(Date.now() - (index % 60) * 24 * 60 * 60 * 1000)
    });
    index++;
  }

  // Deduplicate against existing invoices to be safe
  const existingInvoices = new Set((await PaymentHistory.find({}, { invoiceNumber: 1 })).map(p => p.invoiceNumber));
  const newPayments = payments.filter(p => !existingInvoices.has(p.invoiceNumber));

  if (newPayments.length > 0) {
    await PaymentHistory.insertMany(newPayments);
  }

  console.log(`Seeding complete. PaymentHistory count: ${await PaymentHistory.countDocuments()}`);
}
