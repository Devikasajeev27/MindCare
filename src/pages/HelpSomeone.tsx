import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  HeartHandshake, Clock, Coins, Star, TrendingUp, Users,
  Award, Wallet, Activity, CheckCircle2, Shield, Sparkles, Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useCurrency } from '@/context/CurrencyContext';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { delay, duration: 0.4 } }
});

interface DetailedStats {
  totalHours: number;
  weeklyActiveHours: number;
  performanceScore: number;
  favoritesCount: number;
  completedSessions: number;
  todaySessions: number;
  weeklySessions: number;
  monthlySessions: number;
  avgDuration: number;
  todayEarnings: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  lifetimeEarnings: number;
  pendingBalance: number;
  withdrawableBalance: number;
  currentMilestone: { name: string; minHours: number; maxHours: number; ratePerMinute: number };
  weeklyChart: { label: string; hours: number; earnings: number }[];
  recentSessions: { alias: string; duration: number; amountEarned: number; date: string }[];
}

export default function HelpSomeone() {
  const { format } = useCurrency();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user, refreshProfile } = useAuth();
  const [isAvailable, setIsAvailable] = useState(user?.isAvailableAsCompanion || false);
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.matching.getDetailedStats().then(res => {
      setStats(res.stats);
    }).catch(err => {
      console.error("Failed to load companion stats:", err);
    }).finally(() => setLoading(false));
  }, []);

  const handleStartHelping = () => {
    if (!isAvailable) {
      toast({
        title: "You are offline",
        description: "Please toggle your availability status first.",
        variant: "destructive"
      });
      return;
    }
    setLocation('/companions/helping');
  };

  const handleToggleAvailability = async () => {
    try {
      const res = await api.auth.toggleCompanionStatus(!isAvailable);
      setIsAvailable(res.isAvailableAsCompanion);
      await refreshProfile();
      toast({
        title: res.isAvailableAsCompanion ? "You are now online 🌿" : "You are now offline",
        description: res.isAvailableAsCompanion ? "You are available to accept anonymous match requests." : "You will no longer receive match requests.",
      });
    } catch (err: any) {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    }
  };

  const milestoneProgress = stats ? Math.min(100, Math.round(
    ((stats.totalHours - stats.currentMilestone.minHours) /
      Math.max(1, stats.currentMilestone.maxHours - stats.currentMilestone.minHours)) * 100
  )) : 0;

  const hoursRemaining = stats
    ? Math.max(0, stats.currentMilestone.maxHours - stats.totalHours)
    : 0;

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 max-w-5xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
              <HeartHandshake className="w-6 h-6 text-emerald-600" /> Help Someone &amp; Peer Listener Portal
            </h1>
            <p className="text-sm text-gray-500">Your time and empathy can transform someone's day. Earn while helping others.</p>
          </div>
          <Badge className={isAvailable ? "bg-emerald-600 text-white font-bold text-xs px-3.5 py-1.5 self-start sm:self-auto" : "bg-gray-200 text-gray-700 font-bold text-xs px-3.5 py-1.5 self-start sm:self-auto"}>
            {isAvailable ? "● Online & Ready" : "○ Offline"}
          </Badge>
        </div>

        {/* Hero CTA */}
        <motion.div {...fade(0.05)} className="bg-gradient-to-r from-emerald-900 via-teal-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                  <HeartHandshake className="w-6 h-6 text-emerald-300" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black leading-tight">Someone Needs Your Support Today</h2>
                  <p className="text-xs text-emerald-200">You'll be anonymously matched with peers seeking a compassionate listener.</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shrink-0 w-full sm:w-auto space-y-3">
              <div className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-xs font-bold text-white">Availability Toggle</p>
                  <p className="text-[10px] text-emerald-200 font-medium">{isAvailable ? 'Receiving Requests' : 'Offline Mode'}</p>
                </div>
                <button
                  onClick={handleToggleAvailability}
                  className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${isAvailable ? 'bg-emerald-500' : 'bg-gray-400'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${isAvailable ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <Button
                onClick={handleStartHelping}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl h-10 text-xs shadow-md shadow-emerald-600/30"
              >
                Start Helping Now
              </Button>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm p-12 text-center">
            <p className="text-xs text-gray-400 animate-pulse font-bold">Loading your companion statistics...</p>
          </div>
        ) : stats ? (
          <>
            {/* Quick Stats Grid */}
            <motion.div {...fade(0.1)}>
              <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm mb-3">Listener Performance Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: Clock, label: "Today's Hours", value: `${stats.todaySessions * (stats.avgDuration / 60) || 0}h`, color: "text-blue-500 bg-blue-50" },
                  { icon: Activity, label: "Weekly Hours", value: `${stats.weeklyActiveHours || 0}h`, color: "text-purple-500 bg-purple-50" },
                  { icon: TrendingUp, label: "Total Hours", value: `${stats.totalHours}h`, color: "text-emerald-600 bg-emerald-50" },
                  { icon: Coins, label: "Wallet Balance", value: format(stats.withdrawableBalance), color: "text-emerald-600 bg-emerald-50" },
                  { icon: Star, label: "Performance Rating", value: `${(stats.performanceScore / 20).toFixed(1)} ★`, color: "text-amber-500 bg-amber-50" },
                  { icon: Award, label: "Current Milestone", value: stats.currentMilestone.name, color: "text-orange-500 bg-orange-50" },
                  { icon: CheckCircle2, label: "Completed Sessions", value: stats.completedSessions.toString(), color: "text-teal-600 bg-teal-50" },
                  { icon: Users, label: "Favorites Received", value: stats.favoritesCount.toString(), color: "text-pink-500 bg-pink-50" },
                ].map((s, i) => (
                  <div key={i} className="bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4 hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</p>
                      <div className={`w-7 h-7 rounded-lg ${s.color} flex items-center justify-center`}>
                        <s.icon className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <p className="text-sm font-black text-gray-900 dark:text-zinc-100 truncate">{s.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Earnings Breakdowns */}
            <motion.div {...fade(0.15)}>
              <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm mb-3">Earnings Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Today", value: format(stats.todayEarnings) },
                  { label: "This Week", value: format(stats.weeklyEarnings) },
                  { label: "This Month", value: format(stats.monthlyEarnings) },
                  { label: "Lifetime", value: format(stats.lifetimeEarnings) },
                  { label: "Pending", value: format(stats.pendingBalance) },
                  { label: "Withdrawable", value: format(stats.withdrawableBalance) },
                ].map((e, i) => (
                  <div key={i} className="bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 p-4 shadow-sm">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">{e.label}</p>
                    <p className="text-sm font-black text-gray-900 dark:text-zinc-100">{e.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Milestone Progress */}
            <motion.div {...fade(0.2)} className="bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm">Milestone Tier Advancement</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Current Level: <span className="font-bold text-emerald-600">{stats.currentMilestone.name}</span></p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-0 font-bold text-xs px-3 py-1">
                  ₹{stats.currentMilestone.ratePerMinute}/min Rate
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-600 dark:text-zinc-400 font-bold">
                  <span>{stats.totalHours}h completed</span>
                  <span>{hoursRemaining}h remaining to next tier</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-zinc-900 rounded-full h-3 overflow-hidden">
                  <motion.div
                    className="h-full bg-emerald-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${milestoneProgress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 font-bold">{milestoneProgress}% progress toward {stats.currentMilestone.maxHours > 9000 ? 'Max Level' : `${stats.currentMilestone.maxHours}h Tier`}</p>
              </div>
            </motion.div>

            {/* Analytics Charts */}
            <motion.div {...fade(0.25)}>
              <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm mb-3">Companion Activity Analytics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 shadow-sm">
                  <h4 className="font-bold text-gray-800 dark:text-zinc-200 text-xs mb-3">Weekly Active Hours</h4>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.weeklyChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: any) => [`${v}h`, 'Active Hours']} />
                        <Bar dataKey="hours" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 shadow-sm">
                  <h4 className="font-bold text-gray-800 dark:text-zinc-200 text-xs mb-3">Earnings Trend</h4>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.weeklyChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: any) => [format(v), 'Earnings']} />
                        <Line type="monotone" dataKey="earnings" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Wallet & Recent Sessions */}
            <motion.div {...fade(0.35)} className="bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-600" /> Wallet &amp; Payouts
                </h3>
                <Button
                  size="sm"
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-5 font-bold shadow-md shadow-emerald-600/20"
                  onClick={() => toast({ title: "Withdrawal Requested 💸", description: "Your payout request has been sent to processing." })}
                >
                  Withdraw Funds
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-3 text-center">
                  <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Withdrawable</p>
                  <p className="text-sm font-black text-gray-900 dark:text-zinc-100">{format(stats.withdrawableBalance)}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 rounded-2xl p-3 text-center">
                  <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Pending Payout</p>
                  <p className="text-sm font-black text-gray-900 dark:text-zinc-100">{format(stats.pendingBalance)}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 rounded-2xl p-3 text-center">
                  <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Lifetime Total</p>
                  <p className="text-sm font-black text-gray-900 dark:text-zinc-100">{format(stats.lifetimeEarnings)}</p>
                </div>
              </div>
            </motion.div>

            {/* Safety & Trust Note */}
            <motion.div {...fade(0.4)} className="bg-gray-50 dark:bg-zinc-900/50 p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 flex items-start gap-3 shadow-sm">
              <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-zinc-200">Protected, Respected, and Rewarded</p>
                <p className="text-[11px] text-gray-500 dark:text-zinc-400 leading-relaxed font-medium">
                  As a peer companion, your personal details are never exposed. You control your online schedule and can exit any session immediately if uncomfortable.
                </p>
              </div>
            </motion.div>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
