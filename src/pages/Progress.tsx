import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Flame, Star, TrendingUp, Calendar, Award, CheckCircle2, Sparkles, Target, Zap, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

const iconMap: Record<string, React.ComponentType<any>> = {
  Flame, Star, TrendingUp, Award, Zap, Target
};

export default function ProgressPage() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'week' | 'month'>('week');
  const [userHabits, setUserHabits] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    api.progress.getSummary().then(res => {
      setProgress(res);
      if (res?.habits) setUserHabits(res.habits);
    }).catch(err => {
      console.error(err);
      toast({ variant: "destructive", title: "Failed to load progress data" });
    });
  }, []);

  const stats = progress?.stats || { wellnessScore: user?.wellnessScore ?? 0, streak: user?.streak ?? 0, sessionsDone: 0, sessionsThisMonth: 0 };
  const achievements = progress?.achievements || [];
  const displayHabits = userHabits;

  const moodHistory = progress?.moodHistory || [];
  const chartData = moodHistory.map((d: any) => ({
    ...d,
    label: d.label || new Date(d.date || Date.now()).toLocaleDateString('en-US', { weekday: 'short' }),
    mood: d.rating || (d.moodScore ? Math.round(d.moodScore / 20) : 4),
  }));

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-600" /> My Progress &amp; Growth
            </h1>
            <p className="text-sm text-gray-500">Track your mental resilience, daily habits, and achievements over time.</p>
          </div>
          <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border border-emerald-600/20 text-xs px-3.5 py-1.5 font-extrabold self-start sm:self-auto">
            🔥 {stats.streak} Days Active Streak
          </Badge>
        </div>

        {/* Hero Banner */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-emerald-900 via-teal-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold tracking-wider uppercase mb-1">
                Personalized Growth Insights
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-black leading-tight">
                Your progress{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed font-medium">
                {progress?.motivationMessage || "Your recorded wellbeing activity appears here as it is added."}
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-center shrink-0 w-full sm:w-auto">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Wellness Score</p>
              <p className="text-3xl font-black text-white mt-1">{stats.wellnessScore}<span className="text-xs text-emerald-200">/100</span></p>
              <p className="text-[10px] font-semibold text-emerald-300 mt-0.5">Based on recorded activity</p>
            </div>
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Wellness Score", value: `${stats.wellnessScore}/100`, sub: "Based on recorded activity", icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
            { label: "Current Streak", value: `${stats.streak} Days`, sub: "Consecutive daily check-ins", icon: Flame, color: "text-orange-500 bg-orange-50" },
            { label: "Consultation Sessions", value: `${stats.sessionsDone} Completed`, sub: `${stats.sessionsThisMonth} this month`, icon: Calendar, color: "text-blue-600 bg-blue-50" },
            { label: "Badges Earned", value: `${achievements.filter((a: any) => a.earned).length} / ${achievements.length}`, sub: "Milestone achievements unlocked", icon: Award, color: "text-purple-600 bg-purple-50" },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</p>
                <div className={`w-8 h-8 rounded-xl ${s.color} flex items-center justify-center`}>
                  <s.icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-gray-900 dark:text-zinc-100">{s.value}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1">{s.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Chart + Radial Score */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-6 flex flex-col items-center justify-between">
            <div className="w-full flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm">Overall Wellness Index</h3>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>

            <div className="relative w-40 h-40 my-4">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="10"
                  strokeDasharray={`${stats.wellnessScore * 2.51} ${100 * 2.51}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-gray-900 dark:text-zinc-100">{stats.wellnessScore}</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Out of 100</span>
              </div>
            </div>

            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-0 font-bold px-3 py-1">
              Current wellness score
            </Badge>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2 text-center font-medium">
              Calculated based on your daily mood stability, CBT journaling, and session attendance.
            </p>
          </div>

          {/* Area Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm">Mood &amp; Emotional Stability</h3>
                <p className="text-xs text-gray-400">7-Day rolling mood baseline</p>
              </div>
              <div className="flex gap-1 bg-gray-50 dark:bg-zinc-900 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('week')}
                  className={`text-xs px-3 py-1 rounded-lg font-bold transition-all ${activeTab === 'week' ? 'bg-white dark:bg-zinc-950 text-emerald-600 shadow-sm' : 'text-gray-500'}`}
                >
                  This Week
                </button>
                <button
                  onClick={() => setActiveTab('month')}
                  className={`text-xs px-3 py-1 rounded-lg font-bold transition-all ${activeTab === 'month' ? 'bg-white dark:bg-zinc-950 text-emerald-600 shadow-sm' : 'text-gray-500'}`}
                >
                  This Month
                </button>
              </div>
            </div>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: -25 }}>
                  <defs>
                    <linearGradient id="progressGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) => active && payload?.length ? (
                      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-2.5 shadow-md text-xs">
                        <p className="font-bold text-gray-700 dark:text-zinc-200">{label}</p>
                        <p className="text-emerald-600 font-extrabold">Mood Score: {payload[0].value}/5</p>
                      </div>
                    ) : null}
                  />
                  <Area
                    type="monotone"
                    dataKey="mood"
                    stroke="#10b981"
                    strokeWidth={3}
                    fill="url(#progressGrad)"
                    dot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Achievements + Daily Habits */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Achievements */}
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm">Milestones &amp; Badges</h3>
              <Badge className="bg-purple-100 text-purple-700 border-0 text-xs font-bold">
                {achievements.filter((a: any) => a.earned).length} Unlocked
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {achievements.map((a: any, i: number) => {
                const IconComp = iconMap[a.icon] || Award;
                return (
                  <div
                    key={i}
                    className={`rounded-2xl p-4 border transition-all ${
                      a.earned
                        ? 'border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/30'
                        : 'border-dashed border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/30 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-9 h-9 rounded-xl ${a.color} flex items-center justify-center font-bold`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      {a.earned && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="font-bold text-gray-900 dark:text-zinc-100 text-xs">{a.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-medium">{a.desc}</p>
                    {a.earned ? (
                      <Badge className="mt-2 bg-emerald-600 text-white border-0 text-[9px] font-bold">
                        Earned
                      </Badge>
                    ) : (
                      <div className="mt-2 space-y-1">
                        <div className="h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${a.progress || 40}%` }} />
                        </div>
                        <p className="text-[9px] text-gray-400 font-bold">{a.progress || 40}% complete</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Habits */}
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm">Daily Habit Tracker</h3>
              <p className="text-xs text-emerald-600 font-bold">Based on recorded activity</p>
            </div>

            <div className="space-y-3">
              {displayHabits.map((h: any) => (
                <div
                  key={h.id}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                    h.done
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40'
                      : 'bg-gray-50 dark:bg-zinc-900/50 border-gray-100 dark:border-zinc-800 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${h.done ? 'bg-emerald-600 text-white' : 'border-2 border-gray-300 text-transparent'}`}>
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${h.done ? 'text-gray-900 dark:text-zinc-100 line-through text-gray-400' : 'text-gray-800 dark:text-zinc-200'}`}>
                        {h.label}
                      </p>
                      <p className="text-[10px] text-emerald-600 font-bold">{h.streak} day streak</p>
                    </div>
                  </div>
                  <Badge className={h.done ? 'bg-emerald-600 text-white border-0 text-[10px]' : 'bg-gray-200 text-gray-600 border-0 text-[10px]'}>
                    {h.done ? 'Done ✨' : 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
