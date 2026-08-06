import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Plus, Trash2, Edit3, Save, X, Search, Sun, Cloud, CloudRain, Sparkles, Heart, Feather, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

interface JournalEntry {
  id: string | number;
  title: string;
  content: string;
  mood: number;
  tags: string[];
  date: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

const MOODS = [
  { score: 5, emoji: '😄', label: 'Great', color: 'text-emerald-600', bg: 'bg-emerald-100 border-emerald-300' },
  { score: 4, emoji: '🙂', label: 'Good', color: 'text-lime-600', bg: 'bg-lime-100 border-lime-300' },
  { score: 3, emoji: '😐', label: 'Okay', color: 'text-yellow-600', bg: 'bg-yellow-100 border-yellow-300' },
  { score: 2, emoji: '😕', label: 'Low', color: 'text-orange-600', bg: 'bg-orange-100 border-orange-300' },
  { score: 1, emoji: '😢', label: 'Bad', color: 'text-red-600', bg: 'bg-red-100 border-red-300' },
];

const TAGS = ['Gratitude', 'Anxiety', 'Work', 'Family', 'Health', 'Growth', 'Relationships', 'Sleep'];

const PROMPTS = [
  "What are three small moments that brought you calm today?",
  "What emotion am I carrying right now, and what does it need from me?",
  "What is one positive boundary you set to protect your peace?",
  "What would you tell a dear friend facing the challenge you faced today?",
  "What step did you take toward your mental health this week?"
];

function detectSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const pos = ['happy', 'grateful', 'joy', 'love', 'wonderful', 'great', 'amazing', 'peaceful', 'hopeful', 'excited', 'proud', 'better', 'improve'];
  const neg = ['sad', 'anxious', 'depressed', 'hopeless', 'tired', 'overwhelmed', 'stressed', 'worry', 'scared', 'hurt', 'alone', 'cry', 'fail'];
  const l = text.toLowerCase();
  const pCount = pos.filter(w => l.includes(w)).length;
  const nCount = neg.filter(w => l.includes(w)).length;
  if (pCount > nCount) return 'positive';
  if (nCount > pCount) return 'negative';
  return 'neutral';
}

const sentimentMeta = {
  positive: { icon: Sun, color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800', label: 'Positive' },
  neutral: { icon: Cloud, color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800', label: 'Neutral' },
  negative: { icon: CloudRain, color: 'text-purple-500', bg: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800', label: 'Growth Need' },
};

export default function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [editing, setEditing] = useState<string | number | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', content: '', mood: 4, tags: [] as string[] });
  const [activeFilter, setActiveFilter] = useState<'all' | 'positive' | 'neutral' | 'negative'>('all');
  const { refreshProfile } = useAuth();
  const [promptIdx, setPromptIdx] = useState(0);

  const loadJournals = async () => {
    try {
      const list = await api.journals.list();
      if (Array.isArray(list)) {
        const mapped = list.map(e => ({
          ...e,
          id: e._id || e.id,
          date: new Date(e.date || e.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
          sentiment: e.sentiment || detectSentiment(e.content),
          tags: e.tags || []
        }));
        setEntries(mapped);
      }
    } catch (err) {
      console.error("Failed to load journals from server:", err);
    }
  };

  useEffect(() => {
    loadJournals();
  }, []);

  const currentPrompt = PROMPTS[promptIdx % PROMPTS.length];
  const filtered = entries.filter(e =>
    (activeFilter === 'all' || e.sentiment === activeFilter) &&
    (e.title.toLowerCase().includes(search.toLowerCase()) || e.content.toLowerCase().includes(search.toLowerCase()))
  );

  const saveEntry = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    try {
      if (editing) {
        await api.journals.update(String(editing), { title: form.title, content: form.content, mood: form.mood });
        setEditing(null);
      } else {
        await api.journals.add({ title: form.title, content: form.content, mood: form.mood });
        setIsWriting(false);
      }
      setForm({ title: '', content: '', mood: 4, tags: [] });
      await loadJournals();
      refreshProfile();
    } catch (err) {
      console.error("Failed to save entry:", err);
    }
  };

  const deleteEntry = async (id: string | number) => {
    try {
      await api.journals.delete(String(id));
      await loadJournals();
    } catch (err) {
      setEntries(prev => prev.filter(e => e.id !== id));
    }
  };

  const startEdit = (e: JournalEntry) => {
    setForm({ title: e.title, content: e.content, mood: e.mood, tags: e.tags });
    setEditing(e.id);
    setIsWriting(true);
  };

  const toggleTag = (t: string) =>
    setForm(prev => ({ ...prev, tags: prev.tags.includes(t) ? prev.tags.filter(x => x !== t) : [...prev.tags, t] }));

  const posCount = entries.filter(e => e.sentiment === 'positive').length;
  const negCount = entries.filter(e => e.sentiment === 'negative').length;

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 max-w-5xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
              <Feather className="w-6 h-6 text-emerald-600" /> Mindful Journal &amp; Reflection
            </h1>
            <p className="text-sm text-gray-500">A private, HIPAA-safe sanctuary for your thoughts and emotional growth.</p>
          </div>
          {!isWriting && (
            <Button onClick={() => setIsWriting(true)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 h-11 px-5 shadow-md shadow-emerald-600/20">
              <Plus className="w-4 h-4" /> New Entry
            </Button>
          )}
        </div>

        {/* Hero Banner with Daily Inspiration */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-teal-900 via-emerald-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold tracking-wider uppercase">
                  Daily Mindfulness Prompt
                </Badge>
                <button
                  onClick={() => setPromptIdx(i => i + 1)}
                  className="text-[10px] text-emerald-200 underline font-semibold hover:text-white"
                >
                  Refresh Prompt
                </button>
              </div>
              <p className="text-lg sm:text-xl font-bold italic text-emerald-100 leading-snug">
                "{currentPrompt}"
              </p>
            </div>

            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 shrink-0">
              <ShieldCheck className="w-8 h-8 text-emerald-300" />
              <div>
                <p className="text-xs font-bold text-white">100% Encrypted &amp; Private</p>
                <p className="text-[10px] text-emerald-200">Only accessible to you</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sentiment Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Reflection Entries', value: entries.length, sub: 'Mental check-ins logged', color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Positive Reflection Days', value: posCount, sub: 'Optimistic mindset entries', color: 'text-amber-600 bg-amber-50' },
            { label: 'Self-Care Focus Needed', value: negCount, sub: 'Growth areas identified', color: 'text-purple-600 bg-purple-50' },
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</p>
                <p className="text-2xl font-black text-gray-900 dark:text-zinc-100 mt-1">{s.value}</p>
                <p className="text-[10px] text-gray-500 font-medium">{s.sub}</p>
              </div>
              <div className={`w-10 h-10 rounded-2xl ${s.color} flex items-center justify-center font-bold text-lg`}>
                📖
              </div>
            </div>
          ))}
        </div>

        {/* Writing Panel */}
        <AnimatePresence>
          {isWriting && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="bg-white dark:bg-zinc-950 rounded-3xl border border-emerald-500/30 shadow-xl p-6 sm:p-8 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-gray-900 dark:text-zinc-100 text-lg">
                  {editing ? 'Edit Reflection Entry' : 'Write New Journal Entry'}
                </h3>
                <button
                  onClick={() => { setIsWriting(false); setEditing(null); setForm({ title: '', content: '', mood: 4, tags: [] }); }}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <Input
                placeholder="Give your entry a title…"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="h-12 rounded-xl border-gray-200 dark:border-zinc-800 font-bold text-base bg-gray-50 dark:bg-zinc-900"
              />

              <div>
                <p className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-2">How are you feeling right now?</p>
                <div className="flex gap-2 flex-wrap">
                  {MOODS.map(m => (
                    <button
                      key={m.score}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, mood: m.score }))}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                        form.mood === m.score ? `${m.bg} ${m.color} scale-105 font-bold shadow-sm` : 'border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 text-gray-600'
                      }`}
                    >
                      <span className="text-lg">{m.emoji}</span>
                      <span className="text-xs font-bold">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Textarea
                placeholder="Express your thoughts freely here. What happened today? How did you respond?"
                value={form.content}
                onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                className="rounded-2xl border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 resize-none h-44 text-sm leading-relaxed"
              />

              <div>
                <p className="text-xs font-bold text-gray-700 dark:text-zinc-300 uppercase tracking-wider mb-2">Select Tags</p>
                <div className="flex flex-wrap gap-2">
                  {TAGS.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleTag(t)}
                      className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all ${
                        form.tags.includes(t) ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 hover:bg-emerald-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={saveEntry} className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 gap-2 shadow-md shadow-emerald-600/20">
                  <Save className="w-4 h-4" /> {editing ? 'Save Changes' : 'Save Reflection'}
                </Button>
                <Button variant="outline" onClick={() => { setIsWriting(false); setEditing(null); }} className="rounded-xl border-gray-200 dark:border-zinc-800 h-11 px-6">
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search & Category Filter Pills */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search your journal entries by keyword or title..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-11 rounded-xl border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
            />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'positive', 'neutral', 'negative'] as const).map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`text-xs px-4 py-2 rounded-xl font-bold transition-all ${
                  activeFilter === f ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 text-gray-600 hover:border-emerald-400'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Entries List */}
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-12 text-center shadow-sm">
              <BookOpen className="w-10 h-10 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-800 dark:text-zinc-200">No Journal Entries Found</h3>
              <p className="mt-1 text-xs text-gray-400">Click "New Entry" above to start your mindful journaling habit.</p>
            </div>
          ) : (
            filtered.map((entry, i) => {
              const sm = sentimentMeta[entry.sentiment] || sentimentMeta.neutral;
              const mood = MOODS.find(m => m.score === entry.mood) || MOODS[2];
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-base">{entry.title}</h3>
                        <span className="text-xl">{mood.emoji}</span>
                        <div className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${sm.bg} ${sm.color}`}>
                          <sm.icon className="w-3 h-3" /> {sm.label}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 font-medium">{entry.date}</p>
                      <p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">{entry.content}</p>
                      {entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {entry.tags.map(t => (
                            <Badge key={t} className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-0 text-[10px] font-bold">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(entry)} className="p-2 rounded-xl bg-gray-50 dark:bg-zinc-900 hover:bg-emerald-100 text-emerald-600 transition-colors">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteEntry(entry.id)} className="p-2 rounded-xl bg-gray-50 dark:bg-zinc-900 hover:bg-red-100 text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
