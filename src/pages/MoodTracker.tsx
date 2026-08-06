import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Flame, Heart, Sparkles, TrendingUp, Calendar, Zap, Smile, Frown, Meh, Sun, CloudRain } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const moods = [
  { score: 5, emoji: "😄", label: "Great", desc: "Feeling vibrant & energetic", color: "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800" },
  { score: 4, emoji: "🙂", label: "Good", desc: "Calm, steady & focused", color: "bg-lime-100 border-lime-300 text-lime-800 dark:bg-lime-950/40 dark:border-lime-800" },
  { score: 3, emoji: "😐", label: "Neutral", desc: "Balanced, taking it easy", color: "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800" },
  { score: 2, emoji: "😕", label: "Low", desc: "Slightly overwhelmed or tired", color: "bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-950/40 dark:border-orange-800" },
  { score: 1, emoji: "😢", label: "Very Low", desc: "Distressed or feeling down", color: "bg-red-100 border-red-300 text-red-800 dark:bg-red-950/40 dark:border-red-800" },
];

const factors = [
  "Work & Career", "Sleep Quality", "Relationships", "Exercise & Fitness",
  "Nutrition & Water", "Social Time", "Weather", "Personal Finances",
  "Mindfulness", "Health & Energy"
];

export default function MoodTracker() {
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [selectedFactors, setSelectedFactors] = useState<string[]>([]);
  const [logged, setLogged] = useState(false);
  const [moodHistory, setMoodHistory] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();

  const fetchUnifiedMoods = async () => {
    try {
      const res = await api.moods.getHistory();
      if (res && res.recent7) {
        setChartData(res.recent7.map((d: any) => ({ ...d, mood: d.rating })));
      }
      if (res && res.moods) {
        setMoodHistory(res.moods);
      }
    } catch (err) {
      console.error("Failed to load mood history:", err);
    }
  };

  useEffect(() => {
    fetchUnifiedMoods();
  }, []);

  const toggleFactor = (f: string) =>
    setSelectedFactors(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const handleLog = async () => {
    if (!selected) return;
    try {
      const fullNote = selectedFactors.length > 0
        ? `Factors: ${selectedFactors.join(", ")}. ${note}`.trim()
        : note;
      const emotionObj = moods.find(m => m.score === selected);
      const emotionLabel = emotionObj ? emotionObj.label : undefined;
      await api.moods.add(selected, fullNote, undefined, emotionLabel);
      await fetchUnifiedMoods();
      window.dispatchEvent(new Event("moodUpdated"));
      setLogged(true);
      toast({ title: "Mood Logged! 🌿", description: "Your daily emotional state has been saved." });
      setTimeout(() => setLogged(false), 4000);
      setSelected(null);
      setNote('');
      setSelectedFactors([]);
      refreshProfile();
    } catch (err) {
      console.error("Failed to log mood:", err);
    }
  };

  const currentStreak = user?.streak || 12;
  const displayChart = chartData.length > 0 ? chartData : [
    { label: "Mon", mood: 4 },
    { label: "Tue", mood: 3 },
    { label: "Wed", mood: 5 },
    { label: "Thu", mood: 4 },
    { label: "Fri", mood: 4 },
    { label: "Sat", mood: 5 },
    { label: "Sun", mood: 5 }
  ];

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 max-w-4xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-600" /> Daily Mood &amp; Emotion Tracker
            </h1>
            <p className="text-sm text-gray-500">Log your emotional check-in to uncover patterns and nurture resilience.</p>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-0 text-xs px-3.5 py-1.5 font-bold self-start sm:self-auto flex items-center gap-1">
            🔥 {currentStreak} Days Active Streak
          </Badge>
        </div>

        {/* Success Alert */}
        <AnimatePresence>
          {logged && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center gap-3 text-emerald-700 dark:text-emerald-300 shadow-sm"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-bold text-sm">Your mood check-in has been logged successfully! XP rewarded.</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Logging Card */}
        <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1">
            <h3 className="font-black text-gray-900 dark:text-zinc-100 text-lg">How are you feeling right now?</h3>
            <p className="text-xs text-gray-400 font-medium">Select the emoji that best matches your current state</p>
          </div>

          {/* 5 Mood Selector Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {moods.map(m => (
              <button
                key={m.score}
                onClick={() => setSelected(m.score)}
                type="button"
                className={`flex flex-col items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  selected === m.score
                    ? `${m.color} scale-105 shadow-md font-bold`
                    : 'border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 hover:border-emerald-300 text-gray-600'
                }`}
              >
                <span className="text-4xl my-1">{m.emoji}</span>
                <div className="text-center">
                  <p className="text-xs font-black">{m.label}</p>
                  <p className="text-[9px] opacity-75 font-medium mt-0.5">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Factors Selection */}
          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-2">What factors influenced your mood today?</p>
            <div className="flex flex-wrap gap-2">
              {factors.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFactor(f)}
                  className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all ${
                    selectedFactors.includes(f)
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-zinc-900 text-gray-600 hover:bg-emerald-100'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <p className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-2">Add a Reflection Note (Optional)</p>
            <Textarea
              placeholder="What triggered this emotion? Write down any thoughts or observations..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="rounded-2xl border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 resize-none h-28 text-sm"
            />
          </div>

          <Button
            onClick={handleLog}
            disabled={!selected}
            className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 text-sm shadow-lg shadow-emerald-600/20 disabled:opacity-50"
          >
            Log Today's Mood
          </Button>
        </div>

        {/* 7-Day Trend Chart */}
        <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-gray-900 dark:text-zinc-100 text-base">7-Day Emotional Baseline</h3>
              <p className="text-xs text-gray-400">Rolling mood score overview</p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-0 text-xs font-bold">
              Stable Baseline
            </Badge>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayChart} margin={{ top: 10, right: 10, bottom: 5, left: -25 }}>
                <defs>
                  <linearGradient id="moodTrackerGrad" x1="0" y1="0" x2="0" y2="1">
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
                      <p className="text-emerald-600 font-black">Mood Rating: {payload[0].value}/5</p>
                    </div>
                  ) : null}
                />
                <Area
                  type="monotone"
                  dataKey="mood"
                  stroke="#10b981"
                  strokeWidth={3}
                  fill="url(#moodTrackerGrad)"
                  dot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
