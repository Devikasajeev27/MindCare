import React, { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageTransition } from "@/components/layout/PageTransition";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Calendar, Clock, Search, MessageSquare, PhoneCall, CheckCircle,
  AlertCircle, ChevronLeft, ChevronRight, Star, RefreshCw, XCircle,
  RotateCcw, ShieldAlert, FileText, ArrowRight, UserCheck
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useCommunication } from "@/services/communication/CommunicationProvider";
import { motion, AnimatePresence } from "framer-motion";
import { openRazorpayCheckout } from "@/lib/razorpay";

type FilterTab =
  | "ALL"
  | "UPCOMING"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "COMPLETED"
  | "CANCELLED"
  | "AUTO_CANCELLED"
  | "REFUNDED"
  | "EXPIRED";

// Helper: Check if current time falls inside scheduled consultation window
function getCallWindowStatus(dateStr: string, timeSlotStr: string): {
  isCallAvailable: boolean;
  label: string;
  isPast: boolean;
} {
  try {
    const apptDate = new Date(dateStr);
    const now = new Date();

    // Check date match
    const isSameDay =
      now.getFullYear() === apptDate.getFullYear() &&
      now.getMonth() === apptDate.getMonth() &&
      now.getDate() === apptDate.getDate();

    // Extract start time string e.g. "10:00 AM" from "10:00 AM - 11:00 AM" or "10:00 AM"
    const startTimeStr = timeSlotStr.split("-")[0].trim();
    const timeMatch = startTimeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

    if (!timeMatch) {
      // Fallback if slot string format varies
      if (isSameDay) return { isCallAvailable: true, label: "Start Call", isPast: false };
      const isPastDate = now.getTime() > apptDate.getTime();
      return {
        isCallAvailable: false,
        label: isPastDate ? "Session Ended" : `Available on ${apptDate.toLocaleDateString()}`,
        isPast: isPastDate
      };
    }

    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[3].toUpperCase();

    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;

    const slotStart = new Date(apptDate);
    slotStart.setHours(hours, minutes, 0, 0);

    const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000); // 1 hour duration

    // Buffer 10 mins before slot
    const bufferStart = new Date(slotStart.getTime() - 10 * 60 * 1000);

    if (now > slotEnd) {
      return { isCallAvailable: false, label: "Consultation Ended", isPast: true };
    }

    if (now >= bufferStart && now <= slotEnd) {
      return { isCallAvailable: true, label: "Start Voice Call 📞", isPast: false };
    }

    return {
      isCallAvailable: false,
      label: `Available at ${startTimeStr}`,
      isPast: false
    };
  } catch (err) {
    return { isCallAvailable: false, label: "Available at scheduled time", isPast: false };
  }
}

export default function MyAppointments() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { startCall } = useCommunication();

  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "fee-desc" | "fee-asc">("date-desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      // Trigger lazy 24-hr auto cancellation check
      api.appointments.triggerAutoCancel().catch(() => {});
      const list = await api.appointments.getAll();
      setAppointments(list || []);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error Loading Appointments",
        description: err.message || "Failed to retrieve appointments list.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStartCall = async (appt: any) => {
    const therapist = appt.therapistId;
    if (!therapist || !therapist._id) return;

    try {
      await startCall(therapist._id, {
        name: therapist.name,
        avatar: therapist.avatar,
        role: therapist.title || "Clinical Therapist"
      });
      toast({
        title: "Connecting Voice Session 📞",
        description: `Initiating secure call with ${therapist.name}...`
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Call Connection Failed",
        description: err.message || "Unable to start voice session."
      });
    }
  };

  const handlePayment = async (appt: any) => {
    try {
      const amount = Number(appt.consultationFee);
      const { order, razorpayKeyId } = await api.payments.createOrder({ amount, type: "appointment", targetId: appt._id });
      await openRazorpayCheckout({ key: razorpayKeyId, amount: order.amount, currency: order.currency, name: "MindCare", description: "Therapy consultation payment", order_id: order.id, theme: { color: "#198754" }, handler: async (response: any) => {
        try {
          await api.payments.verifyPayment({ razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature, type: "appointment", targetId: appt._id, amount });
          toast({ title: "Payment successful", description: "Your consultation is confirmed and messaging is enabled." });
          await fetchAppointments();
        } catch (error: any) { toast({ variant: "destructive", title: "Payment verification failed", description: error.message || "Please contact support if you were charged." }); }
      }});
    } catch (error: any) { toast({ variant: "destructive", title: "Unable to start payment", description: error.message || "Please try again." }); }
  };

  // Filter & Sort Logic
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      const statusUpper = (appt.status || "").toUpperCase();
      const paymentStatusUpper = (appt.paymentStatus || "").toUpperCase();
      const now = new Date();
      const apptDate = new Date(appt.date);

      // Filter Tab Matching
      let matchesTab = true;
      if (activeTab === "UPCOMING") {
        matchesTab = (statusUpper === "APPROVED" || statusUpper === "CONFIRMED" || statusUpper === "PENDING_APPROVAL") && apptDate >= now;
      } else if (activeTab === "PENDING_APPROVAL") {
        matchesTab = statusUpper === "PENDING_APPROVAL" || statusUpper === "PENDING";
      } else if (activeTab === "APPROVED") {
        matchesTab = statusUpper === "APPROVED" || statusUpper === "CONFIRMED";
      } else if (activeTab === "COMPLETED") {
        matchesTab = statusUpper === "COMPLETED";
      } else if (activeTab === "CANCELLED") {
        matchesTab = statusUpper === "CANCELLED";
      } else if (activeTab === "AUTO_CANCELLED") {
        matchesTab = statusUpper === "AUTO_CANCELLED";
      } else if (activeTab === "REFUNDED") {
        matchesTab = paymentStatusUpper === "REFUNDED" || appt.refundStatus === "COMPLETED";
      } else if (activeTab === "EXPIRED") {
        matchesTab = statusUpper === "EXPIRED" || (apptDate < now && statusUpper !== "COMPLETED" && statusUpper !== "CANCELLED" && statusUpper !== "AUTO_CANCELLED");
      }

      // Search Matching
      const searchLower = search.toLowerCase().trim();
      const therapistName = appt.therapistId?.name || "";
      const therapistTitle = appt.therapistId?.title || "";
      const timeSlot = appt.timeSlot || "";
      const paymentId = appt.paymentId || "";
      const refundRef = appt.refundReference || "";

      const matchesSearch =
        !searchLower ||
        therapistName.toLowerCase().includes(searchLower) ||
        therapistTitle.toLowerCase().includes(searchLower) ||
        timeSlot.toLowerCase().includes(searchLower) ||
        paymentId.toLowerCase().includes(searchLower) ||
        refundRef.toLowerCase().includes(searchLower);

      return matchesTab && matchesSearch;
    }).sort((a, b) => {
      if (sortBy === "date-desc") return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === "date-asc") return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === "fee-desc") return (b.consultationFee || 0) - (a.consultationFee || 0);
      if (sortBy === "fee-asc") return (a.consultationFee || 0) - (b.consultationFee || 0);
      return 0;
    });
  }, [appointments, activeTab, search, sortBy]);

  const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
  const paginatedAppointments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAppointments.slice(start, start + itemsPerPage);
  }, [filteredAppointments, currentPage]);

  const filterTabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: "ALL", label: "All", count: appointments.length },
    { id: "UPCOMING", label: "Upcoming" },
    { id: "PENDING_APPROVAL", label: "Pending Approval" },
    { id: "APPROVED", label: "Approved" },
    { id: "COMPLETED", label: "Completed" },
    { id: "CANCELLED", label: "Cancelled" },
    { id: "AUTO_CANCELLED", label: "Auto Cancelled" },
    { id: "REFUNDED", label: "Refunded" },
    { id: "EXPIRED", label: "Expired" },
  ];

  return (
    <AppLayout variant="user">
      <PageTransition>
        <div className="space-y-6 pb-12">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100">My Appointments</h1>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Complete timeline and history of all your therapist consultation bookings.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setLocation("/therapists")}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 h-10 shadow-sm"
              >
                <Calendar className="w-4 h-4" /> Book New Session
              </Button>
            </div>
          </div>

          {/* Filter Tabs Bar */}
          <div className="flex gap-2 overflow-x-auto border-b border-gray-100 dark:border-zinc-900 pb-3 scrollbar-none">
            {filterTabs.map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTab(t.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                    isActive
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:border-blue-300"
                  }`}
                  type="button"
                >
                  {t.label} {t.count !== undefined ? `(${t.count})` : ""}
                </button>
              );
            })}
          </div>

          {/* Search and Sort Options Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-gray-100 dark:border-zinc-900 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search therapist, slot, ref number..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 text-xs h-9 rounded-xl border-gray-200 dark:border-zinc-800"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-gray-400 font-medium">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="h-9 text-xs font-semibold rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 outline-none"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="fee-desc">Fee: High to Low</option>
                <option value="fee-asc">Fee: Low to High</option>
              </select>

              <Button
                onClick={fetchAppointments}
                size="sm"
                variant="outline"
                className="rounded-xl border-gray-200 dark:border-zinc-800 h-9"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <p className="mt-4 text-xs font-semibold text-gray-400">Loading appointment records...</p>
            </div>
          ) : paginatedAppointments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-12 text-center shadow-sm">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-800 dark:text-zinc-200">No appointments found</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                No appointment history matched your current filter criteria.
              </p>
              <Button
                onClick={() => setLocation("/therapists")}
                className="mt-4 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                Find &amp; Book Therapist
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {paginatedAppointments.map((appt, idx) => {
                const therapist = appt.therapistId || {};
                const statusUpper = (appt.status || "PENDING_APPROVAL").toUpperCase();
                const paymentStatusUpper = (appt.paymentStatus || "PENDING").toUpperCase();
                const refundStatusUpper = (appt.refundStatus || "NOT_REQUIRED").toUpperCase();

                const callWindow = getCallWindowStatus(appt.date, appt.timeSlot);
                const canMessage = statusUpper === "APPROVED" && paymentStatusUpper === "SUCCESS";

                return (
                  <motion.div
                    key={appt._id || idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-900 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    {/* Top Row: Therapist Info & Badges */}
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3.5">
                          <Avatar className="h-14 w-14 border-2 border-blue-100 dark:border-zinc-800 shrink-0">
                            <AvatarImage src={therapist.avatar} />
                            <AvatarFallback className="bg-blue-100 text-blue-600 font-bold text-base">
                              {therapist.name ? therapist.name[0] : "T"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-base">{therapist.name || "Licensed Therapist"}</h3>
                            <p className="text-xs text-blue-600 font-semibold">{therapist.title || "Clinical Specialist"}</p>
                            <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                              Booked on: {new Date(appt.bookingDate || appt.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <Badge
                          className={`text-[10px] font-extrabold uppercase px-2.5 py-1 border-0 ${
                            statusUpper === "APPROVED" || statusUpper === "CONFIRMED"
                              ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                              : statusUpper === "PENDING_APPROVAL" || statusUpper === "PENDING"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                              : statusUpper === "COMPLETED"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                              : statusUpper === "AUTO_CANCELLED"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                              : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                          }`}
                        >
                          {statusUpper.replace("_", " ")}
                        </Badge>
                      </div>

                      {/* Specialization Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {(therapist.specialization || ["Anxiety", "Depression"]).map((spec: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-[10px] font-semibold bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 border-0">
                            {spec}
                          </Badge>
                        ))}
                      </div>

                      {/* Key Appointment Meta Grid */}
                      <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-gray-50 dark:bg-zinc-900/40 rounded-2xl border border-gray-100 dark:border-zinc-900/30 text-xs mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                          <div>
                            <span className="text-[9px] text-gray-400 font-bold uppercase block">Date</span>
                            <span className="font-bold text-gray-800 dark:text-zinc-200">{new Date(appt.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                          <div>
                            <span className="text-[9px] text-gray-400 font-bold uppercase block">Time Slot</span>
                            <span className="font-bold text-gray-800 dark:text-zinc-200">{appt.timeSlot}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-400 font-bold uppercase block">Consultation Fee</span>
                          <span className="font-extrabold text-gray-900 dark:text-zinc-100">₹{appt.consultationFee || 1200}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-gray-400 font-bold uppercase block">Payment Status</span>
                          <span className={`font-bold text-[10px] ${
                            paymentStatusUpper === "REFUNDED"
                              ? "text-purple-600"
                              : paymentStatusUpper === "SUCCESS"
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }`}>
                            {paymentStatusUpper}
                          </span>
                        </div>
                      </div>

                      {/* Automated Refund Banner (If Cancelled or Refunded) */}
                      {(paymentStatusUpper === "REFUNDED" || statusUpper === "CANCELLED" || statusUpper === "AUTO_CANCELLED") && (
                        <div className="p-3.5 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/30 rounded-2xl space-y-1.5 text-xs mb-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-purple-900 dark:text-purple-200 text-xs">Automated Refund Issued</span>
                            <Badge className="bg-purple-600 text-white text-[9px] font-bold">
                              {refundStatusUpper}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                            <div>
                              <span className="text-[9px] text-gray-500 font-medium block">Refund Amount</span>
                              <span className="font-bold text-purple-700 dark:text-purple-300">₹{appt.refundAmount || appt.consultationFee || 1200}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-gray-500 font-medium block">Reference Number</span>
                              <span className="font-mono font-bold text-gray-800 dark:text-zinc-200">{appt.refundReference || `REF-${Date.now()}`}</span>
                            </div>
                            {appt.cancellationReason && (
                              <div className="col-span-2 pt-0.5">
                                <span className="text-[9px] text-gray-500 font-medium block">Cancellation Reason</span>
                                <span className="text-[11px] font-medium text-gray-700 dark:text-zinc-300">{appt.cancellationReason}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Controls */}
                    <div className="pt-2 border-t border-gray-100 dark:border-zinc-900 space-y-2">
                      {statusUpper === "APPROVED" && paymentStatusUpper === "PAYMENT_PENDING" && (
                        <Button onClick={() => handlePayment(appt)} size="sm" className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold h-9">Complete Payment (₹{appt.consultationFee})</Button>
                      )}
                      <div className="flex gap-2">
                        {/* Message Button (Only enabled if Approved) */}
                        <Button
                          disabled={!canMessage}
                          onClick={() => setLocation("/therapist/chat")}
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-xl text-xs font-bold gap-1.5 border-gray-200 dark:border-zinc-800 disabled:opacity-40"
                          type="button"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                          {canMessage ? "Message Therapist" : "Message (Approval Required)"}
                        </Button>

                        {/* Details Link */}
                        <Button
                          onClick={() => setLocation(`/appointments/${appt._id}`)}
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-xs border-gray-200 dark:border-zinc-800 px-3"
                          type="button"
                        >
                          Details <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </div>

                      {/* Call Window Action Button */}
                      {statusUpper === "APPROVED" || statusUpper === "CONFIRMED" ? (
                        <Button
                          disabled={!callWindow.isCallAvailable}
                          onClick={() => handleStartCall(appt)}
                          size="sm"
                          className={`w-full rounded-xl text-xs font-extrabold h-9 gap-1.5 ${
                            callWindow.isCallAvailable
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                              : "bg-gray-100 dark:bg-zinc-900 text-gray-400 cursor-not-allowed"
                          }`}
                          type="button"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          {callWindow.label}
                        </Button>
                      ) : null}

                      {/* Book Follow-Up if Cancelled or Completed */}
                      {statusUpper === "COMPLETED" || statusUpper === "CANCELLED" || statusUpper === "AUTO_CANCELLED" ? (
                        <Button
                          onClick={() => setLocation("/therapists")}
                          size="sm"
                          variant="secondary"
                          className="w-full rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border-0"
                          type="button"
                        >
                          Book New Session
                        </Button>
                      ) : null}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-zinc-900">
              <p className="text-xs text-gray-400 font-medium">
                Page {currentPage} of {totalPages} · {filteredAppointments.length} total sessions
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="rounded-xl h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`h-8 w-8 rounded-xl text-xs font-bold transition-all ${
                      p === currentPage ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="rounded-xl h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageTransition>
    </AppLayout>
  );
}
