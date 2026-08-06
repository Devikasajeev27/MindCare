import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Bell, Search, Calendar, Heart, Flame, SmilePlus, TrendingUp,
  MessageSquare, Users, ChevronRight, Play, Phone, ShieldAlert, Star, X, Clock
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useCommunication } from '@/services/communication/CommunicationProvider';
import { openRazorpayCheckout } from '@/lib/razorpay';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { delay, duration: 0.45 } }
});

const moodEmoji: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };

function getCompanionLevelInfo(hours: number) {
  if (hours <= 100) return { name: "New Companion", nextName: "Helpful Listener", min: 0, max: 100 };
  if (hours <= 500) return { name: "Helpful Listener", nextName: "Trusted Companion", min: 100, max: 500 };
  if (hours <= 1000) return { name: "Trusted Companion", nextName: "Senior Companion", min: 500, max: 1000 };
  if (hours <= 1500) return { name: "Senior Companion", nextName: "Expert Companion", min: 1000, max: 1500 };
  if (hours <= 2500) return { name: "Expert Companion", nextName: "Elite Companion", min: 1500, max: 2500 };
  if (hours <= 4000) return { name: "Elite Companion", nextName: "Mental Wellness Ambassador", min: 2500, max: 4000 };
  return { name: "Mental Wellness Ambassador", nextName: "Max level achieved", min: 4000, max: 99999 };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { startCall } = useCommunication();
  const [, setLocation] = useLocation();
const [headerSearch, setHeaderSearch] = useState('');
const [aiInput, setAiInput] = useState('');

// Notify user when payment is completed and enable messaging/call
// Payment completion toast moved below after upcomingSession declaration
  const [moodHistory, setMoodHistory] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [therapists, setTherapists] = useState<any[]>([]);
  const [companions, setCompanions] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [upcomingSession, setUpcomingSession] = useState<any>(null);

  // Refresh helper for upcoming appointment and payment status
  const refreshAppointment = async () => {
    try {
      const appt = await api.appointments.getUpcoming();
      setUpcomingSession(appt);
      setUserAppointment(appt);
      // Audit log for state refresh
      await api.notifications.add('Appointment Refresh', `Refreshed appointment status: ${appt?.status}`, 'info');
    } catch (e) {
      setUpcomingSession(null);
      setUserAppointment(null);
    }
  };

  const payForAppointment = async (appointment: any) => {
    try {
      const amount = Number(appointment.consultationFee);
      if (!appointment?._id || !Number.isFinite(amount) || amount <= 0) throw new Error("Appointment payment details are unavailable.");
      const { order, razorpayKeyId } = await api.payments.createOrder({ amount, type: "appointment", targetId: appointment._id });
      await openRazorpayCheckout({
        key: razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: "MindCare",
        description: "Therapy consultation payment",
        order_id: order.id,
        theme: { color: "#198754" },
        handler: async (response: any) => {
          try {
            await api.payments.verifyPayment({ razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature, type: "appointment", targetId: appointment._id, amount });
            toast({ title: "Payment successful", description: "Messaging is now available for your approved appointment." });
            await refreshAppointment();
          } catch (error: any) { toast({ variant: "destructive", title: "Payment verification failed", description: error.message || "Please contact support if you were charged." }); }
        },
      });
    } catch (error: any) { toast({ variant: "destructive", title: "Unable to start payment", description: error.message || "Please try again." }); }
  };

// Notify when therapist approves; messaging is now enabled by the approved appointment workflow.
useEffect(() => {
  if (upcomingSession?.status && (upcomingSession.status === 'APPROVED')) {
    toast({
      title: 'Therapist Approved Your Appointment',
      description: 'Complete payment to enable secure messaging and calls.',
      variant: 'default',
    });
    // Audit log
    api.notifications.add('Therapist Approved', `Appointment ${upcomingSession._id} approved.`, 'info');
  }
}, [upcomingSession, toast]);

// Notify when payment is completed and enable messaging/call
useEffect(() => {
  if (upcomingSession?.status === 'PAID') {
    toast({
      title: 'Payment Verified',
      description: 'Chat messaging is now unlocked.',
      variant: 'default',
    });
    // Audit log
    api.notifications.add('Payment Verified', `Appointment ${upcomingSession._id} marked as PAID.`, 'info');
  }
}, [upcomingSession?.status, toast]);
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [matchingStats, setMatchingStats] = useState<any>(null);
const [loading, setLoading] = useState(true);
const [showDetailsModal, setShowDetailsModal] = useState(false);
const [showPanModal, setShowPanModal] = useState(false);
const [panInput, setPanInput] = useState('');

  const [userAppointment, setUserAppointment] = useState<any>(null);
  // Initial load of upcoming appointment using shared helper
  useEffect(() => {
    refreshAppointment();
  }, []);


  const currentUser = user as any;
  const displayName = currentUser?.name?.trim() || "";
  const firstName = displayName ? displayName.split(" ")[0] : "";
  const avatarInitial = displayName ? displayName[0]?.toUpperCase() : "G";

  const upcomingTherapist = therapists[0] || { name: "", title: "", specializations: [] };
  const therapistInitials = upcomingTherapist.name
    ? upcomingTherapist.name
      .split(" ")
      .map((namePart: string) => namePart[0])
      .join("")
    : "";

  const sessionTherapistName = upcomingSession?.therapistName || upcomingTherapist.name || "Dr. Sarah Mitchell";
  const sessionTherapistTitle = upcomingSession?.therapistTitle || upcomingTherapist.title || "Clinical Psychologist";
  const sessionTherapistAvatar = upcomingSession?.therapistAvatar || upcomingTherapist.avatar || "";
  const sessionDateLabel = upcomingSession?.dateLabel || "Tomorrow • 4:00 PM";
  const sessionRatingLabel = upcomingSession?.ratingLabel || "4.9 rating (128 reviews)";
  const sessionInitials = sessionTherapistName
    ? sessionTherapistName
      .split(" ")
      .map((namePart: string) => namePart[0])
      .join("")
    : "";

  const visibleCompanions = companions;
  const [verificationStatus, setVerificationStatus] = useState<string>(currentUser?.companionVerificationStatus || "none");

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const overview = await api.dashboard.getOverview();
        setMoodHistory(overview?.moodHistory || []);
        setTherapists(overview?.therapists || []);
        setCompanions(overview?.companions || []);
        setResources(overview?.resources || []);
        // Map recentActivity to add Lucide icons, colors, and relative time labels
        const mappedActivity = (overview?.recentActivity || []).map((item: any) => {
          let icon = Bell;
          let color = "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
          if (item.type === "ai") {
            icon = MessageSquare;
            color = "bg-purple-100 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400";
          } else if (item.type === "message") {
            icon = MessageSquare;
            color = "bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400";
          } else if (item.type === "journal") {
            icon = Calendar;
            color = "bg-green-100 text-green-600 dark:bg-green-950/30 dark:text-green-400";
          } else if (item.type === "mood") {
            icon = SmilePlus;
            color = "bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400";
          }

          let timeLabel = "Just now";
          if (item.date) {
            const dateObj = new Date(item.date);
            const diffMs = Date.now() - dateObj.getTime();
            const diffMins = Math.floor(diffMs / (60 * 1000));
            const diffHours = Math.floor(diffMins / 60);

            if (diffMins < 60) {
              timeLabel = diffMins <= 1 ? "Just now" : `${diffMins}m ago`;
            } else if (diffHours < 24) {
              timeLabel = `${diffHours}h ago`;
            } else {
              timeLabel = dateObj.toLocaleDateString([], { month: "short", day: "numeric" });
            }
          }

          return {
            ...item,
            icon,
            color,
            time: timeLabel
          };
        });
        setRecentActivity(mappedActivity);
        setUpcomingSession(overview?.upcomingSession || null);
        setEmergencyContacts(overview?.emergencyContacts || []);
        setMatchingStats(overview?.matchingStats || null);
      } catch (err) {
        console.error("Dashboard data load error:", err);
        toast({ variant: "destructive", title: "Failed to load dashboard data" });
      } finally {
        setLoading(false);
      }
    }

    async function loadMoodAnalytics() {
      try {
        setAnalyticsLoading(true);
        const res = await api.moods.getHistory();
        if (res && res.recent7) {
          setChartData(res.recent7.map((d: any) => ({ ...d, mood: d.rating })));
        }
        if (res && res.moods) {
          setMoodHistory(res.moods);
        }
      } catch (err) {
        console.error("Mood list load error:", err);
      } finally {
        setAnalyticsLoading(false);
      }
    }
    loadDashboardData();
    loadMoodAnalytics();

    const handleMoodUpdate = () => {
      loadDashboardData();
      loadMoodAnalytics();
    };
    window.addEventListener("moodUpdated", handleMoodUpdate);
    return () => window.removeEventListener("moodUpdated", handleMoodUpdate);
  }, []);

  useEffect(() => {
    setVerificationStatus(currentUser?.companionVerificationStatus || "none");
  }, [currentUser?.companionVerificationStatus]);

  useEffect(() => {
    api.matching.getDetailedStats().then(data => {
      setMatchingStats(data);
    }).catch(err => console.error("Error loading matching stats:", err));
  }, []);

  const handleRequestVerification = async (pan: string) => {
    try {
      await api.companions.requestVerification(pan);
      setVerificationStatus("pending");
      setShowPanModal(false);
      toast({
        title: "Verification Requested",
        description: "Your verification request has been sent to the administrator.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Request failed",
        description: err.message || "Failed to submit request."
      });
    }
  };

  const handleWithdrawal = () => {
    toast({
      title: "Withdrawal",
      description: "Withdrawal is currently not available. Please connect wallet/billing in Payments.",
    });
  };

  const handleHeaderSearchSubmit = (text: string) => {
    if (!text.trim()) return;
    setLocation(`/resources?search=${encodeURIComponent(text)}`);
  };

  const handleAiAssistantSubmit = (text: string) => {
    if (!text.trim()) return;
    setLocation(`/ai-assistant?initialMessage=${encodeURIComponent(text)}`);
  };

  const moodEmojiMap: Record<number, string> = { 1: '😢', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };
  const moodTextMap: Record<number, string> = { 1: 'Very Low', 2: 'Low', 3: 'Neutral', 4: 'Good', 5: 'Great' };

  const moodTrackerGraphData = chartData;

  const hours = matchingStats?.stats?.lifetimeHours || matchingStats?.stats?.totalHours || 0;
  const levelInfo = getCompanionLevelInfo(hours);
  const progressPct = levelInfo.max === 99999 ? 100 : Math.min(100, Math.max(0, ((hours - levelInfo.min) / (levelInfo.max - levelInfo.min)) * 100));

  const sortedMoods = (moodHistory || []).slice().sort((a: any, b: any) => {
    const timeA = new Date(a.updatedAt || a.date || a.createdAt || 0).getTime();
    const timeB = new Date(b.updatedAt || b.date || b.createdAt || 0).getTime();
    return timeA - timeB;
  });
  const latestMoodEntry = sortedMoods.length > 0 ? sortedMoods[sortedMoods.length - 1] : null;

  const todayMoodVal = latestMoodEntry ? (latestMoodEntry.emotion || moodTextMap[latestMoodEntry.rating] || "Calm") : "Not Logged";
  const todayMoodEmoji = latestMoodEntry ? (moodEmojiMap[latestMoodEntry.rating] || "😊") : "🌿";
  const todayMoodChange = latestMoodEntry ? `Last updated ${new Date(latestMoodEntry.updatedAt || latestMoodEntry.date || latestMoodEntry.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Check in today";

  return (
    <AppLayout>
      <div className="space-y-6 pb-10">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <motion.div {...fade(0)}>
            <h1 className="text-2xl font-bold text-gray-900">
              Good morning, {firstName}! <span className="text-2xl">🌿</span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Take care of your mind. You matter.</p>
          </motion.div>
          <motion.div className="flex items-center gap-3" {...fade(0.1)}>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search anything..."
                value={headerSearch}
                onChange={e => setHeaderSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleHeaderSearchSubmit(headerSearch);
                }}
                className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-primary w-52"
              />
            </div>
            <Link href="/notifications">
              <button className="relative p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
                <Bell className="w-4 h-4 text-gray-500" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
              </button>
            </Link>
            <Link href="/therapists">
              <button className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
                <Calendar className="w-4 h-4 text-gray-500" />
              </button>
            </Link>
            <Avatar className="h-9 w-9 border-2 border-primary/20">
              <AvatarImage src={currentUser.avatar && !currentUser.avatar.includes('dicebear.com') ? currentUser.avatar : undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">{avatarInitial}</AvatarFallback>
            </Avatar>
          </motion.div>
        </div>

        {/* Companion Verification Request Notification banner */}
        {verificationStatus === "none" && (
          <motion.div {...fade(0.05)} className="bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/10 dark:border-purple-900/30 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_8px_30px_rgba(147,51,234,0.03)] backdrop-blur-sm">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-bold text-purple-900 dark:text-purple-300 text-sm">Targeted Peer Supporter Recognition</h3>
                <Badge className="bg-purple-600/15 text-purple-700 dark:text-purple-300 border border-purple-600/20 text-[10px] font-bold">
                  Verified Badge
                </Badge>
              </div>
              <p className="text-xs text-purple-700/85 dark:text-purple-400/90 leading-relaxed max-w-2xl">
                Become a Verified Companion. Verified peer companions receive a blue checkmark badge next to their usernames across chat listings and support maps.
              </p>
            </div>
            <Button
              onClick={() => setShowPanModal(true)}
              size="sm"
              className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs px-4 h-9 shrink-0 font-semibold shadow-md shadow-purple-600/10 hover:shadow-lg transition-all"
            >
              Request Companion Verification
            </Button>
          </motion.div>
        )}

        {verificationStatus === "pending" && (
          <motion.div {...fade(0.05)} className="bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/10 dark:border-amber-900/30 rounded-3xl p-4 text-center shadow-[0_8px_30px_rgba(245,158,11,0.03)] backdrop-blur-sm">
            <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold">
              ⏳ Your Companion Verification request has been submitted and is currently pending administrator review.
            </p>
          </motion.div>
        )}

        {verificationStatus === "verified" && (
          <motion.div {...fade(0.05)} className="bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/10 dark:border-blue-900/30 rounded-3xl p-4 text-center flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(59,130,246,0.03)] backdrop-blur-sm">
            <span className="text-blue-600 dark:text-blue-400 font-extrabold text-sm">✔</span>
            <p className="text-xs text-blue-800 dark:text-blue-300 font-bold">
              Congratulations! Your Verified Companion Badge is active. You are now shown with verification symbols.
            </p>
          </motion.div>
        )}

        {matchingStats?.stats && (
          <motion.div {...fade(0.06)} className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-900 pb-3">
              <div>
                <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Companion Performance Dashboard</h3>
                <p className="text-[10px] text-gray-400">Track your weekly active hours, milestones, and session statistics.</p>
              </div>
              <Badge className="bg-green-600/10 text-green-700 dark:text-green-300 border border-green-600/20 text-[10px] font-bold">
                Earning Tier 1 Active
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50/50 dark:bg-zinc-900/40 border border-gray-100/80 dark:border-zinc-900/30 rounded-2xl p-4">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Today's Earnings</p>
                <p className="text-lg font-bold text-gray-800 dark:text-zinc-100 mt-1">₹{matchingStats.stats.todayEarnings ?? (matchingStats.stats.totalEarnings * 0.25).toFixed(2)}</p>
                <p className="text-[9px] text-gray-400 font-semibold mt-0.5">{matchingStats.stats.completedSessions || 0} sessions completed</p>
              </div>
              <div className="bg-gray-50/50 dark:bg-zinc-900/40 border border-gray-100/80 dark:border-zinc-900/30 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Lifetime Earnings</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-zinc-100 mt-1">₹{matchingStats.stats.lifetimeEarnings ?? matchingStats.stats.totalEarnings ?? "0.00"}</p>
                </div>
                <Button
                  onClick={handleWithdrawal}
                  variant="outline"
                  size="sm"
                  className="mt-2 text-[10px] h-7 w-full rounded-lg border-primary/20 text-primary hover:bg-primary/5 font-semibold transition-all"
                >
                  Withdraw Balance
                </Button>
              </div>
              <div className="bg-gray-50/50 dark:bg-zinc-900/40 border border-gray-100/80 dark:border-zinc-900/30 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Companion Level</p>
                  <p className="text-sm font-bold text-primary mt-0.5">{levelInfo.name}</p>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="w-full bg-gray-200/60 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${progressPct}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[8px] text-gray-400 font-semibold">
                    <span>{hours}h / {levelInfo.max}h</span>
                    <span>Next: {levelInfo.nextName.split(' ')[0]}</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50/50 dark:bg-zinc-900/40 border border-gray-100/80 dark:border-zinc-900/30 rounded-2xl p-4">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Performance Score</p>
                <p className="text-lg font-bold text-green-600 mt-1">{matchingStats.stats.performanceScore || 95}%</p>
                <p className="text-[9px] text-green-500 font-semibold mt-0.5">● Excellent status</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Wellness Score", value: `${currentUser.wellnessScore}`, sub: "/100", badge: "Good",
              badgeColor: "bg-green-600/10 text-green-700 dark:text-green-300 border border-green-600/20", change: "+12% from last week",
              changeColor: "text-green-600", icon: null, extra: (
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-semibold">
                    <span>Progress</span><span>{currentUser.wellnessScore}/100</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-zinc-900 rounded-full overflow-hidden border border-gray-200/10">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${currentUser.wellnessScore}%` }} />
                  </div>
                </div>
              )
            },
            {
              label: "Mood Today", value: todayMoodVal, sub: "", badge: null,
              change: todayMoodChange, changeColor: "text-gray-400",
              icon: todayMoodEmoji, extra: (
                <Link href="/mood-tracker" className="w-full">
                  <Button variant="outline" size="sm" className="mt-3 rounded-xl border-gray-200 dark:border-zinc-800 text-xs w-full font-semibold hover:bg-gray-50 dark:hover:bg-zinc-900/50">Update Mood</Button>
                </Link>
              )
            },
            {
              label: "Streak", value: `${currentUser.streak} Days`, sub: "", badge: null,
              change: "Keep up the great work!", changeColor: "text-orange-500 font-semibold",
              icon: "🔥", extra: (
                <Link href="/progress" className="w-full">
                  <Button variant="outline" size="sm" className="mt-3 rounded-xl border-gray-200 dark:border-zinc-800 text-xs w-full font-semibold hover:bg-gray-50 dark:hover:bg-zinc-900/50">View Progress</Button>
                </Link>
              )
            },
          ].map((card, i) => (
            <motion.div
              key={i}
              className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl p-5 shadow-[0_8px_30px_rgba(25,135,84,0.03)] border border-gray-100/90 dark:border-zinc-900/50 hover:shadow-[0_8px_32px_rgba(25,135,84,0.06)] hover:-translate-y-0.5 transition-all duration-300"
              {...fade(0.1 + i * 0.08)}
            >
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{card.label}</p>
              <div className="flex items-end gap-2">
                {card.icon && <span className="text-2xl">{card.icon}</span>}
                <span className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{card.value}</span>
                {card.sub && <span className="text-sm text-gray-400 mb-0.5">{card.sub}</span>}
                {card.badge && <Badge className={`ml-auto text-[10px] font-bold px-2.5 py-0.5 ${card.badgeColor}`}>{card.badge}</Badge>}
              </div>
              <p className={`text-[10px] mt-1.5 ${card.changeColor}`}>{card.change}</p>
              {card.extra}
            </motion.div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left 2/3 */}
          <div className="xl:col-span-2 space-y-6">
            {/* Mood Chart + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl p-5 border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)]" {...fade(0.2)}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Mood Over Time</h3>
                  <select className="text-xs text-gray-500 border border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 rounded-lg px-2 py-1 focus:outline-none">
                    <option>This Week</option>
                  </select>
                </div>
                <div className="h-[160px]">
                  {analyticsLoading ? (
                    <div className="flex flex-col justify-between h-full py-2 animate-pulse">
                      <div className="flex items-end justify-between space-x-2 h-28 px-4">
                        <div className="w-[10%] h-[30%] bg-gray-100 dark:bg-zinc-800/60 rounded-lg" />
                        <div className="w-[10%] h-[50%] bg-gray-100 dark:bg-zinc-800/60 rounded-lg" />
                        <div className="w-[10%] h-[40%] bg-gray-100 dark:bg-zinc-800/60 rounded-lg" />
                        <div className="w-[10%] h-[75%] bg-gray-100 dark:bg-zinc-800/60 rounded-lg" />
                        <div className="w-[10%] h-[60%] bg-gray-100 dark:bg-zinc-800/60 rounded-lg" />
                        <div className="w-[10%] h-[80%] bg-gray-100 dark:bg-zinc-800/60 rounded-lg" />
                        <div className="w-[10%] h-[90%] bg-gray-100 dark:bg-zinc-800/60 rounded-lg" />
                      </div>
                      <div className="flex justify-between w-full px-4 pt-2 border-t border-gray-100 dark:border-zinc-800/40">
                        <div className="w-8 h-3 bg-gray-100 dark:bg-zinc-800/60 rounded" />
                        <div className="w-8 h-3 bg-gray-100 dark:bg-zinc-800/60 rounded" />
                        <div className="w-8 h-3 bg-gray-100 dark:bg-zinc-800/60 rounded" />
                        <div className="w-8 h-3 bg-gray-100 dark:bg-zinc-800/60 rounded" />
                        <div className="w-8 h-3 bg-gray-100 dark:bg-zinc-800/60 rounded" />
                        <div className="w-8 h-3 bg-gray-100 dark:bg-zinc-800/60 rounded" />
                        <div className="w-8 h-3 bg-gray-100 dark:bg-zinc-800/60 rounded" />
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={moodTrackerGraphData} margin={{ top: 5, right: 10, bottom: 5, left: -25 }}>
                        <defs>
                          <linearGradient id="moodGradDash" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <Tooltip content={({ active, payload, label }) => active && payload?.length ? (<div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-2 shadow text-xs"><p className="font-semibold text-gray-700 dark:text-zinc-200">{label}</p><p className="text-primary font-bold">Mood: {payload[0].value}/5</p></div>) : null} />
                        <Area type="monotone" dataKey="mood" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#moodGradDash)" dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: '#fff' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </motion.div>

              <motion.div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl p-5 border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)]" {...fade(0.25)}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Recent Activity</h3>
                  <Link href="/progress" className="text-xs text-primary font-semibold hover:underline">View All</Link>
                </div>
                <div className="space-y-3">
                  {recentActivity.map((item, i) => {
                    const targetLink = item.type === "journal"
                      ? "/journal"
                      : item.type === "mood"
                        ? "/mood-tracker"
                        : item.type === "ai"
                          ? "/ai-assistant"
                          : "/companions";
                    return (
                      <Link key={i} href={targetLink} className="flex items-center gap-3 group cursor-pointer">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${item.color} group-hover:scale-105 transition-transform`}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-zinc-200 truncate group-hover:text-primary transition-colors">{item.label}</p>
                          <p className="text-[10px] text-gray-400 truncate">{item.sub}</p>
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0">{item.time}</span>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            </div>

            {/* Upcoming Session + Daily Tip */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl p-5 border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)]" {...fade(0.3)}>
                <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm mb-4">Upcoming Session</h3>
                {!upcomingSession ? (
                  <div className="text-center py-6 flex flex-col items-center justify-center">
                    <Calendar className="w-8 h-8 text-gray-300 dark:text-zinc-700 mb-2 animate-pulse" />
                    <p className="text-xs text-gray-500 font-bold">No upcoming appointments.</p>
                    <p className="text-[10px] text-gray-400 mt-1 mb-4 font-medium">Schedule a session with one of our licensed experts.</p>
                    <Link href="/therapists" className="w-full">
                      <Button className="w-full rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-bold h-9">
                        Book a Session
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="h-12 w-12 border-2 border-primary/20">
                        <AvatarImage src={sessionTherapistAvatar && !sessionTherapistAvatar.includes('dicebear.com') ? sessionTherapistAvatar : undefined} />
                        <AvatarFallback>{sessionInitials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-zinc-100 text-sm">{sessionTherapistName}</p>
                        <p className="text-xs text-gray-400">{sessionTherapistTitle}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="w-3.5 h-3.5 text-primary" /> {sessionDateLabel}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Star className="w-3.5 h-3.5 text-yellow-500" /> {sessionRatingLabel}
                      </div>
                    </div>
                    {(() => {
                      const status = upcomingSession.status || "pending";
                      const dateStr = upcomingSession.date || upcomingSession.bookingDate;

                      const isAppointmentTimeArrived = (() => {
                        if (!dateStr || !upcomingSession.timeSlot) return false;
                        const match = upcomingSession.timeSlot.split('-')[0].trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                        if (!match) return false;
                        let hours = Number(match[1]) % 12;
                        if (match[3].toUpperCase() === 'PM') hours += 12;
                        const start = new Date(dateStr);
                        start.setHours(hours, Number(match[2]), 0, 0);
                        return Date.now() >= start.getTime();
                      })();

                      if (status === "cancelled" || status === "rejected") {
                        return (
                          <div className="space-y-2">
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-950/40 text-[10px] font-extrabold border-0">
                              Appointment {status === "rejected" ? "Declined by Therapist" : "Cancelled"}
                            </Badge>
                            <Link href="/therapists" className="w-full block">
                              <Button className="w-full rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-bold h-9">
                                Book Another Therapist
                              </Button>
                            </Link>
                          </div>
                        );
                      }

                      if (status === "PENDING_APPROVAL") {
                        return (
                          <div className="space-y-2.5">
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-extrabold border-0 flex items-center gap-1.5 w-fit">
                              <Clock className="w-3 h-3 text-amber-600 animate-pulse" /> Pending Therapist Confirmation
                            </Badge>
                            <p className="text-[11px] text-gray-500 dark:text-zinc-400 font-medium leading-relaxed">
                              Messaging will be available once your appointment has been approved by the therapist.
                            </p>
                          </div>
                        );
                      }

                      if (status === "APPROVED" && !["SUCCESS", "success"].includes(upcomingSession.paymentStatus || "")) {
                        return (
                          <div className="space-y-2.5">
                            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border-0">✓ Approved · Payment Required</Badge>
                            <p className="text-[11px] text-gray-500 font-medium">Your therapist approved this appointment. Complete payment to enable messaging and calls.</p>
                            <Button onClick={() => payForAppointment(upcomingSession)} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-md">Complete Payment (₹{upcomingSession.consultationFee})</Button>
                          </div>
                        );
                      }

                      if (status === "APPROVED") {
                        return (
                          <div className="space-y-2.5">
                            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border-0">
                              ✓ Approved
                            </Badge>
                            <p className="text-[11px] text-gray-500 font-medium">
                              Your therapist approved this appointment. Secure messaging is available now.
                            </p>
                            <div className="flex gap-2">
                              <Link href={`/appointments/${upcomingSession._id}`} className="flex-1">
                              <Button
                                className="w-full rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs h-9 shadow-sm"
                              >
                                <MessageSquare className="w-3.5 h-3.5 mr-1" /> Message
                              </Button>
                              </Link>
                              {isAppointmentTimeArrived ? (
                                <Button
                                  onClick={async () => {
                                    try {
                                      await api.appointments.authorizeCall(upcomingSession._id);
                                      await startCall(upcomingSession.therapistId || upcomingSession._id, { name: upcomingSession.therapistName || "Therapist", avatar: upcomingSession.therapistAvatar || "", role: upcomingSession.therapistTitle || "Consultation Therapist" });
                                    } catch (err: any) { toast({ variant: "destructive", title: "Call unavailable", description: err.message || "Call will be available at your scheduled appointment time." }); }
                                  }}
                                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-sm"
                                ><Phone className="w-3.5 h-3.5 mr-1" /> Call</Button>
                              ) : (
                                <Button disabled title="Call will be available at your scheduled appointment time." variant="outline" className="flex-1 rounded-xl text-xs h-9 opacity-50 cursor-not-allowed"><Phone className="w-3.5 h-3.5 mr-1" /> Call</Button>
                              )}
                            </div>
                            {!isAppointmentTimeArrived && <p className="text-[10px] text-gray-400 font-semibold text-center">Call will be available at your scheduled appointment time.</p>}
                          </div>
                        );
                      }
                      if (status === "PAID") {
                        return null;
                      }

                      if (status === "CONSULTATION_COMPLETED") {
                        return (
                          <Link href={`/appointments/${upcomingSession._id}`} className="w-full">
                            <Button className="w-full rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-bold h-9">
                              View Session Summary
                            </Button>
                          </Link>
                        );
                      }
                      
                      return null;
                    })()}
                  </>
                )}
              </motion.div>

              <motion.div className="bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 rounded-3xl p-5 shadow-[0_8px_30px_rgba(25,135,84,0.02)]" {...fade(0.35)}>
                <div className="flex items-start gap-2 mb-2">
                  <div className="text-primary text-2xl font-serif leading-none">"</div>
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Daily Tip</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed italic">
                  It's okay to not be okay. What matters is that you're here and taking steps for yourself.
                </p>
              </motion.div>
            </div>

            <motion.div {...fade(0.4)}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">Recommended For You</h3>
                <Link href="/resources" className="text-xs text-primary font-semibold hover:underline">View All</Link>
              </div>
              {resources.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-50/30 dark:bg-zinc-900/10 border border-dashed border-gray-200 dark:border-zinc-800 rounded-3xl text-center">
                  <p className="text-xs text-gray-550 dark:text-zinc-400 font-bold">No personalized recommendations available yet.</p>
                  <p className="text-[10px] text-gray-400 mt-1">Try tracking your mood or writing in your journal to unlock tailored content guides.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {resources.map((r, i) => (
                    <Link key={i} href="/resources" className="relative rounded-2xl overflow-hidden shadow-sm cursor-pointer group hover:shadow-md transition-all block">
                      <img
                        src={r.image || r.img || "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=400"}
                        alt={r.title}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=400";
                        }}
                        className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <div className="absolute top-2.5 left-2.5">
                        <Badge className="text-[9px] bg-primary text-white border-0 font-semibold">{r.tag}</Badge>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                        <Play className="w-6 h-6 mb-1 opacity-80" />
                        <p className="font-bold text-xs leading-tight">{r.title}</p>
                        <p className="text-[10px] text-white/70">{r.meta}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Companions Banner */}
            <motion.div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl p-5 border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.035)]" {...fade(0.45)}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-gray-800 dark:text-zinc-200 mb-0.5">You're not alone.</p>
                  <p className="text-xs text-gray-500">Connect with someone who understands.</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex -space-x-2">
                    {visibleCompanions.map((c, i) => (
                      <Avatar key={i} className="w-7 h-7 border-2 border-white dark:border-zinc-950">
                        <AvatarImage src={c.avatar && !c.avatar.includes('dicebear.com') ? c.avatar : undefined} />
                        <AvatarFallback className="text-[9px]">{(c.name || c.username || 'C')[0]}</AvatarFallback>
                      </Avatar>
                    ))}
                    <div className="w-7 h-7 rounded-full bg-primary/10 border-2 border-white dark:border-zinc-950 flex items-center justify-center text-[9px] font-bold text-primary">+8</div>
                  </div>
                  <p className="text-xs text-gray-500">Voice calls available<br />with your favorites.</p>
                </div>
                <div className="flex">
                  <Button asChild size="sm" className="rounded-xl text-xs bg-primary text-white font-bold">
                    <Link href="/companions">Connect with Peer</Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right 1/3 */}
          <div className="space-y-5">
            {/* AI Assistant Widget */}
            <motion.div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl shadow-[0_8px_30px_rgba(25,135,84,0.03)] border border-gray-100/90 dark:border-zinc-900/50 overflow-hidden" {...fade(0.2)}>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-900/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">AI Assistant</h3>
                </div>
                <Button asChild size="sm" variant="outline" className="rounded-xl text-xs border-gray-200 dark:border-zinc-800 font-semibold"><Link href="/ai-assistant">New Chat</Link></Button>
              </div>
              <div className="p-4 space-y-3">
                <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl rounded-tl-sm p-3 border border-primary/10 dark:border-primary/20">
                  <p className="text-xs text-gray-700 dark:text-zinc-300 leading-relaxed font-medium">Hi {firstName}, I'm here to listen and support you. How are you feeling today?</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {["Feeling anxious", "Feeling overwhelmed", "Need to talk", "I'm not sure"].map((q) => (
                    <div
                      onClick={() => handleAiAssistantSubmit(q)}
                      key={q}
                      className="inline-block text-[10px] bg-gray-50 hover:bg-primary/10 hover:text-primary text-gray-600 dark:text-zinc-400 rounded-full px-2.5 py-1.5 cursor-pointer transition-colors font-semibold border border-gray-100 dark:border-zinc-800"
                    >
                      {q}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-gray-50/50 dark:bg-zinc-900/30 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs px-3 py-2 focus:outline-none focus:border-primary outline-none"
                    placeholder="Type a message..."
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAiAssistantSubmit(aiInput);
                    }}
                  />
                  <button
                    onClick={() => handleAiAssistantSubmit(aiInput)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary hover:bg-primary/95 transition-colors shrink-0 cursor-pointer"
                    aria-label="Open AI assistant"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              </div>
            </motion.div>


            {upcomingSession && upcomingSession.status !== "suggested" && (
              <motion.div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl p-5 shadow-[0_8px_30px_rgba(25,135,84,0.03)] border border-gray-100/90 dark:border-zinc-900/50" {...fade(0.3)}>
                <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm mb-3">Session Details</h3>
                <div className="text-center py-2">
                  <Avatar className="h-14 w-14 mx-auto mb-2 border-2 border-primary/20">
                    <AvatarImage src={sessionTherapistAvatar && !sessionTherapistAvatar.includes('dicebear.com') ? sessionTherapistAvatar : undefined} />
                    <AvatarFallback>{sessionInitials}</AvatarFallback>
                  </Avatar>
                  <p className="font-bold text-gray-900 dark:text-zinc-100 text-sm">{sessionTherapistName}</p>
                  <p className="text-xs text-gray-400">{sessionTherapistTitle}</p>
                  <Badge className="mt-1.5 bg-green-600/10 text-green-700 dark:text-green-300 border border-green-600/20 text-[10px] font-bold">
                    {upcomingSession?.availability || "Available Today"}
                  </Badge>
                </div>
                <div className="mt-3 bg-gray-50/50 dark:bg-zinc-900/40 border border-gray-100/80 dark:border-zinc-900/30 rounded-xl p-2.5 text-xs text-gray-500 text-center font-medium">
                  {sessionDateLabel}
                </div>
                <Button
                  onClick={() => setShowDetailsModal(true)}
                  className="w-full mt-3 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white text-xs font-semibold h-8 transition-colors"
                >
                  View Details
                </Button>
              </motion.div>
            )}            {/* Crisis Contacts */}
            <motion.div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl p-5 shadow-[0_8px_30px_rgba(25,135,84,0.03)] border border-gray-100/90 dark:border-zinc-900/50" {...fade(0.4)}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Crisis Contacts</h3>
                <Link href="/crisis-support" className="text-xs text-primary font-semibold hover:underline">Manage</Link>
              </div>
              <div className="space-y-2">
                {emergencyContacts.length > 0 ? (
                  emergencyContacts.map((contact, index) => {
                    const initials = contact.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "EC";
                    return (
                      <div key={contact._id || index} className="flex items-center gap-3 p-2.5 bg-gray-50/50 dark:bg-zinc-900/40 border border-gray-100/85 dark:border-zinc-900/30 rounded-xl">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Emergency Contact</p>
                          <p className="text-[10px] text-gray-400">{contact.name} ({contact.relationship || contact.relation || "Contact"})</p>
                          <p className="text-[10px] text-gray-400">{contact.phone}</p>
                        </div>
                        <a href={`tel:${contact.phone}`} className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors shrink-0">
                          <Phone className="w-3 h-3" />
                        </a>
                      </div>
                    );
                  })
                ) : user?.emergencyContact?.name ? (
                  (() => {
                    const contact = user.emergencyContact;
                    const initials = contact.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "EC";
                    return (
                      <div className="flex items-center gap-3 p-2.5 bg-gray-50/50 dark:bg-zinc-900/40 border border-gray-100/85 dark:border-zinc-900/30 rounded-xl">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-zinc-200">Emergency Contact</p>
                          <p className="text-[10px] text-gray-400">{contact.name} ({contact.relation || "Contact"})</p>
                          <p className="text-[10px] text-gray-400">{contact.phone}</p>
                        </div>
                        <a href={`tel:${contact.phone}`} className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors shrink-0">
                          <Phone className="w-3 h-3" />
                        </a>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 text-center bg-gray-50/30 dark:bg-zinc-900/20 border border-dashed border-gray-200 dark:border-zinc-800 rounded-xl">
                    <p className="text-[10px] text-gray-400 mb-1.5 font-medium">No emergency contact registered</p>
                    <Link href="/settings">
                      <Button size="sm" variant="outline" className="h-6 rounded-lg text-[9px] px-2 font-semibold bg-white dark:bg-zinc-900">
                        Add Contact
                      </Button>
                    </Link>
                  </div>
                )}
                <div className="flex items-center gap-3 p-2.5 bg-red-500/5 dark:bg-red-950/20 border border-red-500/10 dark:border-red-900/30 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center shrink-0">
                    <Heart className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-red-800 dark:text-red-300">National Helpline</p>
                    <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold">988 Suicide & Crisis Lifeline</p>
                    <p className="text-[10px] text-red-500/80">Call or Text 988</p>
                  </div>
                  <a href="tel:988" className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shrink-0">
                    <Phone className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {showDetailsModal && upcomingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-900/50 shadow-2xl p-6 w-full max-w-md relative overflow-hidden"
          >
            <button
              onClick={() => setShowDetailsModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-base mb-4">Session Details</h3>

            <div className="flex items-center gap-3 p-4 bg-gray-50/50 dark:bg-zinc-900/40 border border-gray-100/80 dark:border-zinc-900/30 rounded-2xl mb-4">
              <Avatar className="h-12 w-12 border-2 border-primary/20">
                <AvatarImage src={sessionTherapistAvatar && !sessionTherapistAvatar.includes('dicebear.com') ? sessionTherapistAvatar : undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">{sessionInitials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-gray-950 dark:text-zinc-50 text-sm">{sessionTherapistName}</p>
                <p className="text-xs text-gray-400 font-medium">{sessionTherapistTitle}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs mb-6">
              <div className="flex justify-between border-b border-gray-100 dark:border-zinc-900/50 pb-2">
                <span className="text-gray-400 font-medium">Scheduled Time</span>
                <span className="text-gray-800 dark:text-zinc-200 font-bold">{sessionDateLabel}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 dark:border-zinc-900/50 pb-2">
                <span className="text-gray-400 font-medium">Status</span>
                <Badge className={`text-[10px] font-bold capitalize ${upcomingSession.status === "confirmed"
                    ? "bg-green-600/10 text-green-700 dark:text-green-300 border border-green-600/20"
                    : upcomingSession.status === "pending"
                      ? "bg-amber-600/10 text-amber-700 dark:text-amber-300 border border-amber-600/20"
                      : upcomingSession.status === "completed"
                        ? "bg-blue-600/10 text-blue-700 dark:text-blue-300 border border-blue-600/20"
                        : "bg-red-650/10 text-red-700 dark:text-red-300 border border-red-650/20"
                  }`}>
                  {upcomingSession.status}
                </Badge>
              </div>
              <div className="space-y-1">
                <span className="text-gray-400 font-medium block">Session Notes</span>
                <p className="text-gray-600 dark:text-zinc-400 leading-relaxed bg-gray-50/50 dark:bg-zinc-900/40 p-3 rounded-xl border border-gray-100/50 dark:border-zinc-900/20">
                  {upcomingSession.notes || "No special preparation needed. Please make sure your microphone is operational."}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setShowDetailsModal(false)}
                variant="outline"
                className="flex-1 rounded-xl text-xs font-semibold h-9"
              >
                Close
              </Button>
              {(() => {
                const status = upcomingSession.status;
                const dateStr = upcomingSession.date || upcomingSession.bookingDate;

                const isSessionToday = (() => {
                  if (!dateStr) return false;
                  const d = new Date(dateStr);
                  const today = new Date();
                  return d.getDate() === today.getDate() &&
                    d.getMonth() === today.getMonth() &&
                    d.getFullYear() === today.getFullYear();
                })();

                if (status === "completed") {
                  return (
                    <Link href={`/appointments/${upcomingSession._id}`} onClick={() => setShowDetailsModal(false)} className="flex-1">
                      <Button className="w-full rounded-xl bg-primary text-white text-xs font-bold h-9">
                        Session Summary
                      </Button>
                    </Link>
                  );
                }

                if (status === "cancelled") {
                  return (
                    <Link href="/therapists" onClick={() => setShowDetailsModal(false)} className="flex-1">
                      <Button className="w-full rounded-xl bg-primary text-white text-xs font-bold h-9">
                        Book Again
                      </Button>
                    </Link>
                  );
                }

                if (status === "confirmed" || status === "pending") {
                  return (
                    <>
                      <Link href={`/appointments/${upcomingSession._id}`} onClick={() => setShowDetailsModal(false)} className="flex-1">
                        <Button variant="outline" className="w-full rounded-xl text-xs font-semibold h-9">
                          View Details
                        </Button>
                      </Link>
                      <Button
                        onClick={async () => {
                          try {
                            await startCall(upcomingSession.therapistId || upcomingSession._id, {
                              name: upcomingSession.therapistName || "Therapist",
                              avatar: upcomingSession.therapistAvatar || "",
                              role: upcomingSession.therapistTitle || "Consultation Therapist"
                            });
                            setShowDetailsModal(false);
                            toast({
                              title: "Launching voice call",
                              description: "Connecting to secure HIPAA-compliant voice consultation room.",
                            });
                          } catch (err: any) {
                            toast({
                              variant: "destructive",
                              title: "Call failed",
                              description: err.message || "Failed to start call."
                            });
                          }
                        }}
                        className="flex-1 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-bold h-9 shadow-md shadow-primary/10 hover:shadow-lg transition-all"
                      >
                        Start Call
                      </Button>
                    </>
                  );
                }
              })()}
            </div>
          </motion.div>
        </div>
      )}
      {showPanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-900/50 shadow-2xl p-6 w-full max-w-sm relative overflow-hidden"
          >
            <button
              onClick={() => setShowPanModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-zinc-300"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-base mb-2">Verification Form</h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Companion verification is mandatory under regulatory compliance guidelines. Please enter a valid Indian PAN Card number.
            </p>

            <div className="space-y-3 mb-6">
              <label className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">PAN Card Number</label>
              <input
                type="text"
                maxLength={10}
                placeholder="e.g. ABCDE1234F"
                value={panInput}
                onChange={e => setPanInput(e.target.value.toUpperCase())}
                className="w-full text-xs font-semibold bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 outline-none dark:bg-zinc-900 text-gray-800 dark:text-zinc-100 focus:border-primary"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setShowPanModal(false)}
                variant="outline"
                className="flex-1 rounded-xl text-xs font-semibold h-9"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleRequestVerification(panInput)}
                disabled={panInput.trim().length !== 10}
                className="flex-1 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-bold h-9 shadow-md shadow-primary/10 hover:shadow-lg transition-all"
              >
                Submit
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AppLayout>
  );
}
