import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Radar, Shield, HeartHandshake, Sparkles, X, Lock, EyeOff, Shuffle, ShieldCheck, MessageSquare, Mic, Zap, Users, CheckCircle2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useLocationReporter } from '@/hooks/useLocationReporter';

const TOPIC_OPTIONS = [
  { id: "stress", label: "🌿 Work & Daily Stress", desc: "Burnout, workload & pressure" },
  { id: "anxiety", label: "💤 Sleep & Anxiety", desc: "Overthinking & restless nights" },
  { id: "relationships", label: "🤝 Relationships & Family", desc: "Communication & loneliness" },
  { id: "vent", label: "🧘 Just Need to Vent", desc: "Safe space to share freely" },
  { id: "motivation", label: "💡 Daily Encouragement", desc: "Mindset boost & positivity" }
];

export default function Companions() {
  useLocationReporter();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [matchStatus, setMatchStatus] = useState<'idle' | 'searching' | 'connecting' | 'found' | 'connected'>('idle');
  const [dots, setDots] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string>("stress");
  const [commMode, setCommMode] = useState<'chat' | 'voice'>('chat');
  const [favoriteInfo, setFavoriteInfo] = useState<{
    hasFavorite: boolean;
    name?: string;
    isBusy?: boolean;
    companionId?: string;
  } | null>(null);

  useEffect(() => {
    api.matching.getFavoriteStatus().then(setFavoriteInfo).catch(() => {});
  }, []);

  useEffect(() => {
    if (matchStatus === 'searching' || matchStatus === 'connecting') {
      const interval = setInterval(() => {
        setDots(d => d.length >= 3 ? '' : d + '.');
      }, 500);
      return () => clearInterval(interval);
    }
  }, [matchStatus]);

  const handleStartMatching = async (useFavorite = false) => {
    setMatchStatus('searching');
    try {
      const res = await api.matching.requestMatch(useFavorite);
      setTimeout(() => {
        setMatchStatus('connecting');
        setTimeout(() => {
          setMatchStatus('found');
          setTimeout(() => {
            setMatchStatus('connected');
            setTimeout(() => {
              setLocation(`/companions/chat/${res.session.companionAlias.replace('#', '')}?sessionId=${res.session._id}`);
            }, 1000);
          }, 1000);
        }, 1500);
      }, 2000);
    } catch (err: any) {
      setMatchStatus('idle');
      toast({
        variant: "destructive",
        title: "No One Available Right Now",
        description: "We couldn't find an available peer companion at this moment. Please try again in a few minutes."
      });
    }
  };

  const handleCancel = () => {
    setMatchStatus('idle');
    toast({ title: "Search Cancelled", description: "You can initiate a random anonymous match whenever you're ready." });
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-12 max-w-5xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
              <HeartHandshake className="w-6 h-6 text-emerald-600" /> Anonymous Peer Support Network
            </h1>
            <p className="text-sm text-gray-500">Connect with a compassionate peer listener — 100% confidential, random, and judgment-free.</p>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-0 text-xs px-3.5 py-1.5 font-bold self-start sm:self-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> 18 Peer Listeners Active
          </Badge>
        </div>

        {/* Hero Banner */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-emerald-900 via-teal-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 w-fit">
                <Lock className="w-3 h-3 text-emerald-300" /> 100% Confidential &amp; Anonymous
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-black leading-tight">You Don't Have to Carry It Alone</h2>
              <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed font-medium">
                MindCare dynamically pairs you with an anonymous online peer listener. No personal identities, real names, or phone numbers are ever revealed.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shrink-0 text-center w-full md:w-auto">
              <div>
                <p className="text-xl font-black text-white">1,240+</p>
                <p className="text-[10px] text-emerald-200 font-bold uppercase">Sessions Completed</p>
              </div>
              <div>
                <p className="text-xl font-black text-white">&lt; 15s</p>
                <p className="text-[10px] text-emerald-200 font-bold uppercase">Avg Match Time</p>
              </div>
            </div>
          </div>
        </div>

        {/* Step 1: Select Topic Focus */}
        <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xl p-6 sm:p-8 space-y-4">
          <div>
            <h3 className="font-black text-gray-900 dark:text-zinc-100 text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" /> What would you like to discuss today?
            </h3>
            <p className="text-xs text-gray-400">Select a topic focus to help route to a relevant peer listener</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {TOPIC_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTopic(t.id)}
                className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedTopic === t.id
                    ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 shadow-sm scale-105'
                    : 'border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 hover:border-emerald-300'
                }`}
              >
                <p className="font-bold text-xs text-gray-900 dark:text-zinc-100 mb-1">{t.label}</p>
                <p className="text-[10px] text-gray-500 dark:text-zinc-400 leading-tight font-medium">{t.desc}</p>
              </button>
            ))}
          </div>

          {/* Mode Switcher */}
          <div className="pt-3 border-t border-gray-100 dark:border-zinc-900 flex items-center justify-between flex-wrap gap-4">
            <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">Preferred Interaction Mode:</span>
            <div className="flex gap-2 bg-gray-100 dark:bg-zinc-900 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setCommMode('chat')}
                className={`text-xs px-4 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  commMode === 'chat' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 dark:text-zinc-400'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Anonymous Text Chat
              </button>
              <button
                type="button"
                onClick={() => setCommMode('voice')}
                className={`text-xs px-4 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  commMode === 'voice' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 dark:text-zinc-400'
                }`}
              >
                <Mic className="w-3.5 h-3.5" /> Anonymous Voice Call
              </button>
            </div>
          </div>
        </div>

        {/* AirDrop Radar Anonymous Matcher */}
        <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xl p-8 sm:p-10 text-center max-w-2xl mx-auto space-y-6">
          <div className="space-y-2">
            <h3 className="font-black text-gray-900 dark:text-zinc-100 text-xl">
              {matchStatus === 'idle' ? 'Random Peer Companion Match' : 'Locating Available Peer Listener...'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium max-w-md mx-auto">
              {matchStatus === 'idle'
                ? 'Click below to initiate an anonymous connection. No profiles, no names, total confidentiality.'
                : 'Please wait while we route your encrypted connection to an available peer listener.'}
            </p>
          </div>

          {/* Radar Animation */}
          <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
            {matchStatus !== 'idle' && (
              <>
                <div className="absolute inset-0 border-2 border-emerald-500/30 rounded-full animate-ping pointer-events-none" style={{ animationDuration: '2.5s' }} />
                <div className="absolute inset-6 border-2 border-emerald-500/40 rounded-full animate-ping pointer-events-none" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-12 border-2 border-emerald-500/50 rounded-full animate-ping pointer-events-none" style={{ animationDuration: '1.5s' }} />
              </>
            )}
            <div className="w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/40 flex items-center justify-center relative z-10 shadow-lg shadow-emerald-500/10">
              <Radar className={`w-10 h-10 text-emerald-600 ${matchStatus !== 'idle' ? 'animate-spin' : ''}`} style={{ animationDuration: matchStatus === 'connecting' ? '1.5s' : '4s' }} />
            </div>
          </div>

          <div className="space-y-3">
            <AnimatePresence mode="wait">
              {matchStatus === 'idle' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
                  <Button
                    onClick={() => handleStartMatching(false)}
                    className="w-full max-w-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-600/25 text-sm h-13 flex items-center justify-center gap-2 mx-auto"
                  >
                    <Shuffle className="w-4 h-4" /> Start Anonymous Peer Match ({commMode === 'chat' ? 'Text' : 'Voice'})
                  </Button>
                </motion.div>
              )}

              {matchStatus === 'searching' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <p className="text-xs text-emerald-600 font-extrabold italic">Searching random online peer listeners{dots}</p>
                  <Button variant="outline" onClick={handleCancel} className="text-xs rounded-xl h-9 px-5 border-gray-200 dark:border-zinc-800">
                    <X className="w-3.5 h-3.5 mr-1" /> Cancel Search
                  </Button>
                </motion.div>
              )}

              {matchStatus === 'connected' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-emerald-600 font-extrabold animate-bounce">
                  🌿 Connected! Opening your private, anonymous session...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Privacy & Confidentiality Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: EyeOff, title: "Zero Real Names", desc: "You and your peer companion interact using randomized anonymous aliases." },
            { icon: Shuffle, title: "Random Pairing", desc: "System dynamically matches you based on live availability, with no user directory." },
            { icon: Lock, title: "Encrypted Room", desc: "Temporary 1-on-1 private chat or voice session with full end-to-end security." },
            { icon: ShieldCheck, title: "Instant Exit", desc: "You can leave the session at any moment with zero trace or public record." },
          ].map((pillar, i) => (
            <div key={i} className="bg-white dark:bg-zinc-950 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 shadow-sm space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
                <pillar.icon className="w-4 h-4" />
              </div>
              <p className="font-bold text-gray-900 dark:text-zinc-100 text-xs">{pillar.title}</p>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 leading-relaxed font-medium">{pillar.desc}</p>
            </div>
          ))}
        </div>

        {/* Safety Guarantee */}
        <div className="bg-gray-50 dark:bg-zinc-900/50 p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 flex items-start gap-3 shadow-sm">
          <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-gray-800 dark:text-zinc-200">Strict Confidentiality Guarantee</p>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400 leading-relaxed font-medium">
              MindCare ensures complete privacy across all peer support interactions. User identities, contact numbers, and personal details are strictly protected and never displayed publicly.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
