import React, { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, ArrowLeft, PhoneCall, AlertCircle, MessageSquare, CheckCircle, XCircle, Sliders, Bell } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useCommunication } from "@/services/communication/CommunicationProvider";
import { socket } from "@/lib/socket";

export default function AppointmentDetails() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { startCall, status: callStatus } = useCommunication();

  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states for reschedule / cancel / review
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("10:00 AM - 11:00 AM");
  
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [reminderTime, setReminderTime] = useState("15"); // minutes before
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");

  useEffect(() => {
    fetchDetails();
  }, [appointmentId]);

  useEffect(() => {
    if (!appointmentId) return;
    api.appointments.getConversation(appointmentId).then((data) => {
      setConversation(data.conversation);
      setMessages(data.messages);
      socket.connect();
      socket.emit("conversation:join", data.conversation._id);
      socket.on("message:receive", (message: any) => setMessages((current) => [...current, message]));
    }).catch(() => {});
    return () => { socket.off("message:receive"); };
  }, [appointmentId]);

  const handleSendAppointmentMessage = async () => {
    if (!messageText.trim() || !appointmentId) return;
    try {
      const { message } = await api.appointments.sendMessage(appointmentId, messageText);
      setMessages((current) => [...current, message]);
      setMessageText("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Message not sent", description: err.message || "Messaging is not available for this appointment." });
    }
  };

  const fetchDetails = async () => {
    if (!appointmentId || appointmentId === "undefined" || appointmentId === "" || appointmentId === "null") {
      setError("Invalid Appointment ID.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.therapists.getAppointmentDetails(appointmentId);
      if (!data || !data._id) {
        throw new Error("Invalid appointment record returned.");
      }
      setAppointment(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load appointment details.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartVoiceCall = async () => {
    if (!appointment || !appointment.therapistId) return;
    try {
      await startCall(appointment.therapistId._id, {
        name: appointment.therapistId.name,
        avatar: appointment.therapistId.avatar,
        role: appointment.therapistId.title || "Consultation Therapist"
      });
      toast({
        title: "Voice Call Initiated",
        description: `Connecting with ${appointment.therapistId.name}...`
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Call Failed",
        description: err.message || "Could not start voice session."
      });
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please specify a reason for cancellation."
      });
      return;
    }
    try {
      await api.therapists.cancelAppointment(appointmentId, cancelReason);
      toast({
        title: "Appointment Cancelled",
        description: "Your session has been cancelled successfully."
      });
      setIsCancelling(false);
      fetchDetails();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Cancellation Failed",
        description: err.message || "Failed to cancel appointment."
      });
    }
  };

  const handleReschedule = async () => {
    if (!newDate) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please select a valid date."
      });
      return;
    }
    try {
      await api.therapists.rescheduleAppointment(appointmentId, newDate, newTime);
      toast({
        title: "Appointment Rescheduled",
        description: "Your reschedule request has been submitted."
      });
      setIsRescheduling(false);
      fetchDetails();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Reschedule Failed",
        description: err.message || "Failed to reschedule appointment."
      });
    }
  };

  const handleSetReminder = async () => {
    if (!appointment) return;
    try {
      const dateObj = new Date(appointment.date);
      // Subtract minutes
      const reminderTimeObj = new Date(dateObj.getTime() - parseInt(reminderTime) * 60000);
      await api.therapists.setAppointmentReminder(appointmentId, [reminderTimeObj.toISOString()]);
      toast({
        title: "Reminder Saved",
        description: `You will be notified ${reminderTime} minutes before the session starts.`
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error setting reminder",
        description: err.message || "Failed to save reminder."
      });
    }
  };

  const handleReview = async () => {
    if (!reviewText.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please write a brief feedback comment."
      });
      return;
    }
    setSubmittingReview(true);
    try {
      await api.therapists.reviewAppointment(appointmentId, reviewText);
      toast({
        title: "Feedback Submitted",
        description: "Thank you for sharing your experience!"
      });
      setReviewText("");
      fetchDetails();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: err.message || "Failed to submit review."
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500 font-medium">Fetching appointment details...</p>
        </div>
      </AppLayout>
    );
  }

  if (error || !appointment) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-10 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Appointment</h2>
          <p className="text-sm text-gray-500 mb-6">{error || "Could not retrieve appointment details."}</p>
          <Button onClick={() => setLocation("/dashboard")} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </div>
      </AppLayout>
    );
  }

  const { therapistId, date, timeSlot, status, notes, amountPaid, review } = appointment;
  const normalizedStatus = status?.toLowerCase();
  const therapistInitials = therapistId?.name?.split(" ").map((n: string) => n[0]).join("") || "TH";

  const handleCompletePayment = async () => {
    try {
      const { loadRazorpayScript, openRazorpayCheckout } = await import("@/lib/razorpay");
      await loadRazorpayScript();

      const orderRes = await api.payments.createOrder({
        amount: appointment.consultationFee || 1200,
        type: "therapist_consultation",
        targetId: appointment._id,
      });

      const { order, razorpayKeyId } = orderRes;

      const options = {
        key: razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: "MindCare",
        description: `Consultation with ${appointment.therapistId?.name || "Therapist"}`,
        order_id: order.id,
        theme: { color: "#10b981" },
        handler: async (response: any) => {
          try {
            await api.payments.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              type: "therapist_consultation",
              targetId: appointment._id,
              amount: appointment.consultationFee || 1200,
            });
            toast({
              title: "Payment Successful! 🎉",
              description: "Your appointment has been confirmed.",
            });
            fetchDetails();
          } catch (err: any) {
            toast({
              variant: "destructive",
              title: "Payment Verification Failed",
              description: err.message || "Failed to confirm payment.",
            });
          }
        },
      };

      openRazorpayCheckout(options);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Payment Error",
        description: err.message || "Could not initiate payment.",
      });
    }
  };

  return (
    <AppLayout>
      <PageTransition>
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
          {/* Top Bar Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setLocation("/dashboard")}
              className="flex items-center text-sm font-semibold text-gray-500 hover:text-primary transition-colors gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
            <Badge className={`text-xs font-bold px-3 py-1 capitalize border-0 ${
              normalizedStatus === "approved" || normalizedStatus === "confirmed"
                ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                : normalizedStatus === "pending"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                : normalizedStatus === "completed"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            }`}>
              {status?.replace("_", " ")} Consultation
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left 2 Columns: Therapist Details & Appointment Info */}
            <div className="md:col-span-2 space-y-6">
              {/* Therapist Profile Summary */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-900 p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5 shadow-sm"
              >
                <Avatar className="h-20 w-20 border-2 border-primary/20">
                  <AvatarImage src={therapistId?.avatar} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                    {therapistInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">{therapistId?.name}</h2>
                    <p className="text-xs text-primary font-semibold uppercase tracking-wide">{therapistId?.title || "Clinical Therapist"}</p>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-xl">
                    {therapistId?.bio || "Licensed clinical mental wellness professional specializing in supportive voice counseling, Cognitive Behavioral Therapy, and mindfulness training."}
                  </p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 pt-1">
                    {(therapistId?.specialization || ["Anxiety", "CBT", "Stress Management"]).map((spec: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-[10px] rounded-full border-gray-200 text-gray-600 dark:text-zinc-400">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Consultation Details */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-900 p-6 shadow-sm space-y-4"
              >
                <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Consultation Overview</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-zinc-900/40 rounded-2xl border border-gray-100/50 dark:border-zinc-900/10">
                    <Calendar className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Scheduled Date</p>
                      <p className="text-xs font-bold text-gray-800 dark:text-zinc-200">{new Date(date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-zinc-900/40 rounded-2xl border border-gray-100/50 dark:border-zinc-900/10">
                    <Clock className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Consultation Slot</p>
                      <p className="text-xs font-bold text-gray-800 dark:text-zinc-200">{timeSlot}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-zinc-900/80">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-medium">Session Type</span>
                    <span className="text-gray-800 dark:text-zinc-200 font-bold">Voice Consultation</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-medium">Consultation Fee</span>
                    <span className="text-gray-800 dark:text-zinc-200 font-bold">₹{amountPaid || therapistId?.consultationFee || appointment.consultationFee || 1200}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-medium">Payment Status</span>
                    <span className={`font-extrabold flex items-center gap-1 ${
                      appointment.paymentStatus === "REFUNDED" || appointment.paymentStatus === "refunded"
                        ? "text-purple-600 dark:text-purple-400"
                        : appointment.paymentStatus === "SUCCESS" || appointment.paymentStatus === "success" || normalizedStatus === "confirmed"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}>
                      <CheckCircle className="w-3.5 h-3.5" />
                      {appointment.paymentStatus || (normalizedStatus === "confirmed" ? "SUCCESS" : "PAID")}
                    </span>
                  </div>
                </div>

                {/* Refund Details Card */}
                {(appointment.paymentStatus === "REFUNDED" || appointment.paymentStatus === "refunded" || normalizedStatus === "cancelled") && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-200">Refund Status</span>
                      <Badge className="bg-purple-600 text-white text-[10px] font-bold">
                        {appointment.refundStatus || "COMPLETED"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div>
                        <span className="text-[10px] text-gray-500 font-medium block">Refund Amount</span>
                        <span className="font-bold text-gray-900 dark:text-zinc-100">₹{appointment.refundAmount || appointment.amountPaid || appointment.consultationFee || 1200}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-medium block">Reference Number</span>
                        <span className="font-bold text-gray-900 dark:text-zinc-100">{appointment.refundReference || `REF-${Date.now()}`}</span>
                      </div>
                      {appointment.refundDate && (
                        <div>
                          <span className="text-[10px] text-gray-500 font-medium block">Refund Date</span>
                          <span className="font-bold text-gray-900 dark:text-zinc-100">{new Date(appointment.refundDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {appointment.cancellationReason && (
                        <div className="col-span-2">
                          <span className="text-[10px] text-gray-500 font-medium block">Cancellation Reason</span>
                          <span className="text-xs text-gray-700 dark:text-zinc-300 font-medium">{appointment.cancellationReason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1 pt-3">
                  <span className="text-xs text-gray-450 font-bold uppercase tracking-wider block">Important Notes</span>
                  <p className="text-xs text-gray-650 dark:text-zinc-400 leading-relaxed bg-gray-50 dark:bg-zinc-900/50 p-3.5 rounded-2xl border border-gray-100 dark:border-zinc-900/20 italic">
                    {notes || "No additional session preparation notes provided. Please make sure you are in a quiet room and have a working microphone."}
                  </p>
                </div>
              </motion.div>

              {/* Completed Post-Session Care Details */}
              {normalizedStatus === "completed" && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-900 p-6 shadow-sm space-y-4"
                >
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Post-Session Summary &amp; Notes</h3>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 font-bold uppercase">Session Notes</span>
                      <p className="text-xs text-gray-700 dark:text-zinc-350 bg-primary/5 p-3.5 rounded-2xl border border-primary/5 leading-relaxed">
                        Client discussed stress factors related to upcoming deadlines. Practiced deep breathing exercises and aligned on boundary settings. Shows strong commitment.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 font-bold uppercase">Care Recommendations</span>
                      <ul className="text-xs text-gray-600 dark:text-zinc-450 list-disc list-inside space-y-1 pl-1">
                        <li>Practice 4-7-8 breathing twice daily when feeling heart rate elevate.</li>
                        <li>Log emotional triggers in the journal daily.</li>
                        <li>Limit screening time 30 minutes before sleep cycle.</li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right 1 Column: Interactive Actions */}
            <div className="space-y-6">

              {conversation && normalizedStatus === "approved" && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-900 rounded-3xl p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Secure therapist messaging</h3>
                  </div>
                  <div className="max-h-44 overflow-y-auto space-y-2 text-xs">
                    {messages.length === 0 ? <p className="text-gray-400">No messages yet. Send a message to your therapist.</p> : messages.map((message: any) => (
                      <div key={message._id} className="rounded-xl bg-gray-50 dark:bg-zinc-900 p-2.5 text-gray-700 dark:text-zinc-300">{message.text}</div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleSendAppointmentMessage()} placeholder="Write a message…" className="h-10 text-xs" />
                    <Button onClick={handleSendAppointmentMessage} size="sm" className="h-10 rounded-xl">Send</Button>
                  </div>
                </motion.div>
              )}

              {/* Approved -> Payment Action Panel */}
              {normalizedStatus === "approved" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-3xl p-6 shadow-sm text-center space-y-4"
                >
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-gray-900 dark:text-zinc-100 text-sm">Appointment Approved! 🎉</h3>
                    <p className="text-xs text-gray-500 mt-1">Your therapist has approved your requested slot. Complete payment to confirm your booking.</p>
                  </div>
                  <Button
                    onClick={handleCompletePayment}
                    className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold h-11 shadow-md shadow-emerald-500/20"
                  >
                    Complete Payment (₹{appointment.consultationFee || 1200})
                  </Button>
                </motion.div>
              )}

              {/* Pending Action Panel */}
              {normalizedStatus === "pending" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-amber-50 dark:bg-amber-950/20 border border-amber-500/20 rounded-3xl p-6 shadow-sm text-center space-y-3"
                >
                  <Clock className="w-8 h-8 text-amber-600 mx-auto animate-pulse" />
                  <div>
                    <h3 className="font-extrabold text-gray-900 dark:text-zinc-100 text-sm">Awaiting Therapist Approval ⏳</h3>
                    <p className="text-xs text-gray-500 mt-1">Your booking request has been sent to the therapist. Payment will be enabled once approved.</p>
                  </div>
                  <Button disabled className="w-full rounded-2xl bg-gray-200 text-gray-400 font-bold h-10 text-xs">
                    Payment Disabled (Pending Approval)
                  </Button>
                </motion.div>
              )}
              {/* Voice call action panel */}
              {normalizedStatus === "confirmed" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-3xl p-6 shadow-sm text-center space-y-4"
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                    <PhoneCall className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-zinc-150 text-sm">Voice Session Available</h3>
                    <p className="text-xs text-gray-500 mt-1">Connect directly via secure one-to-one audio call with your therapist.</p>
                  </div>
                  <Button
                    onClick={handleStartVoiceCall}
                    className="w-full rounded-2xl bg-primary text-white font-bold h-11 shadow-md shadow-primary/10 hover:shadow-lg transition-all"
                  >
                    Start Voice Call
                  </Button>
                </motion.div>
              )}

              {/* Status Actions (Scheduled / Pending options) */}
              {(normalizedStatus === "pending" || normalizedStatus === "confirmed") && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-4"
                >
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Manage Appointment</h3>
                  
                  {/* Set Reminder */}
                  <div className="space-y-2 pb-3 border-b border-gray-100 dark:border-zinc-900">
                    <label className="text-[10px] text-gray-400 font-bold uppercase block">Reminder Alert</label>
                    <div className="flex gap-2">
                      <select
                        value={reminderTime}
                        onChange={(e) => setReminderTime(e.target.value)}
                        className="flex-1 h-9 rounded-xl border border-gray-200 bg-gray-50/50 text-xs px-2 focus:outline-none"
                      >
                        <option value="15">15 minutes before</option>
                        <option value="60">1 hour before</option>
                        <option value="1440">1 day before</option>
                      </select>
                      <Button size="sm" onClick={handleSetReminder} variant="outline" className="rounded-xl text-xs gap-1.5">
                        <Bell className="w-3.5 h-3.5" /> Save
                      </Button>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex flex-col gap-2">
                    <Link href="/therapist-chat" className="w-full">
                      <Button variant="outline" className="w-full rounded-xl text-xs font-semibold h-9 gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-primary" /> Chat with Therapist
                      </Button>
                    </Link>

                    {!isRescheduling && !isCancelling && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setIsRescheduling(true)}
                          className="w-full rounded-xl text-xs font-semibold h-9"
                        >
                          Reschedule
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setIsCancelling(true)}
                          className="w-full rounded-xl text-xs font-semibold h-9 text-red-600 hover:bg-red-50"
                        >
                          Cancel Appointment
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Cancel Modal/Box */}
                  {isCancelling && (
                    <div className="pt-2 space-y-3">
                      <div className="bg-red-50/50 border border-red-100 rounded-2xl p-3">
                        <p className="text-[10px] text-red-800 font-bold block mb-1">Reason for cancellation</p>
                        <Input
                          placeholder="e.g. Work conflict..."
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="h-9 text-xs rounded-xl bg-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleCancel} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs h-8">Confirm Cancel</Button>
                        <Button onClick={() => setIsCancelling(false)} variant="outline" className="rounded-xl text-xs h-8">Close</Button>
                      </div>
                    </div>
                  )}

                  {/* Reschedule Modal/Box */}
                  {isRescheduling && (
                    <div className="pt-2 space-y-3">
                      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-3 space-y-2">
                        <label className="text-[10px] text-gray-400 font-bold block">Select New Date</label>
                        <Input
                          type="date"
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                          className="h-9 text-xs rounded-xl bg-white"
                        />
                        <label className="text-[10px] text-gray-400 font-bold block">Select Slot</label>
                        <select
                          value={newTime}
                          onChange={(e) => setNewTime(e.target.value)}
                          className="w-full h-9 rounded-xl border border-gray-250 bg-white text-xs px-2"
                        >
                          <option value="10:00 AM - 11:00 AM">10:00 AM - 11:00 AM</option>
                          <option value="11:30 AM - 12:30 PM">11:30 AM - 12:30 PM</option>
                          <option value="02:00 PM - 03:00 PM">02:00 PM - 03:00 PM</option>
                          <option value="04:30 PM - 05:30 PM">04:30 PM - 05:30 PM</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleReschedule} className="flex-1 bg-primary text-white rounded-xl text-xs h-8">Submit</Button>
                        <Button onClick={() => setIsRescheduling(false)} variant="outline" className="rounded-xl text-xs h-8">Close</Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Leave Review Form for Completed */}
              {normalizedStatus === "completed" && !review && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-4"
                >
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Post-Session Review</h3>
                  <p className="text-xs text-gray-500">Provide a brief review of your experience with {therapistId?.name || "the therapist"}.</p>
                  <div className="space-y-3">
                    <Input
                      placeholder="Comment on your session..."
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      className="h-10 text-xs rounded-xl"
                    />
                    <Button
                      onClick={handleReview}
                      disabled={submittingReview}
                      className="w-full rounded-xl bg-primary text-white text-xs h-9"
                    >
                      {submittingReview ? "Submitting..." : "Submit Review"}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Show Existing Review */}
              {review && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-900 rounded-3xl p-6 shadow-sm space-y-2"
                >
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Submitted Feedback</h3>
                  <div className="bg-gray-50 dark:bg-zinc-900/50 p-3 rounded-2xl border border-gray-100/50 dark:border-zinc-900/10 italic text-xs text-gray-600 dark:text-zinc-350">
                    "{review}"
                  </div>
                </motion.div>
              )}

              {/* Book again action for cancelled / completed */}
              {(normalizedStatus === "completed" || normalizedStatus === "cancelled") && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-900 rounded-3xl p-6 shadow-sm text-center space-y-3"
                >
                  <XCircle className="w-10 h-10 text-gray-400 mx-auto" />
                  <div>
                    <h3 className="font-bold text-gray-850 dark:text-zinc-250 text-xs">Need another session?</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">Schedule a follow-up voice consultation today.</p>
                  </div>
                  <Link href="/therapists" className="w-full block">
                    <Button className="w-full rounded-xl text-xs h-9 font-bold bg-primary text-white">
                      Book Session
                    </Button>
                  </Link>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </PageTransition>
    </AppLayout>
  );
}
