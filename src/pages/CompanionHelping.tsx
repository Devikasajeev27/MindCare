import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  HeartHandshake, ShieldCheck, CheckCircle2, UserCheck, AlertCircle, X,
  Radio, Sparkles, Coins, MessageSquare, Volume2, VolumeX, Clock, Flame, Zap,
  Award, RefreshCw, Eye, ArrowRight, Activity, Globe, Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { socket } from '@/lib/socket';
import { useAuth } from '@/context/AuthContext';

export default function CompanionHelping() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [isOnline, setIsOnline] = useState(true);
  const [matchFound, setMatchFound] = useState(false);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [matchedTopic, setMatchedTopic] = useState("Anxiety & Overwhelm");
  const [matchedLang, setMatchedLang] = useState("Malayalam & English");
  const [stats, setStats] = useState({
    todayEarnings: 750,
    sessionsCompleted: 3,
    impactRating: 4.9,
    heartsEarned: 28
  });

  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Audio tone generator for incoming match
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn("Audio play blocked", e);
    }
  };

  useEffect(() => {
    socket.connect();
    if (user?.id) {
      socket.emit("join", user.id);
    }

    socket.on("match_request_received", (data: any) => {
      if (!isOnline) return;
      setSessionDetails(data);
      setMatchedTopic(data.topic || "Overwhelm & Stress");
      setMatchedLang(data.language || "Malayalam & English");
      setMatchFound(true);
      playAlertSound();
      toast({
        title: "⚡ Incoming Peer Session Request!",
        description: "A patient is reaching out for anonymous peer support.",
      });
    });

    // Auto demo simulation if waiting online for 6 seconds
    const timer = setTimeout(() => {
      if (!matchFound && isOnline) {
        triggerDemoMatch();
      }
    }, 6000);

    return () => {
      socket.off("match_request_received");
      clearTimeout(timer);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [user, isOnline, matchFound, toast]);

  // Countdown timer when match request is active
  useEffect(() => {
    if (matchFound) {
      setCountdown(30);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            setMatchFound(false);
            toast({
              title: "Request Expired",
              description: "The request was re-routed to another available peer listener.",
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
  }, [matchFound, toast]);

  const triggerDemoMatch = () => {
    const topics = [
      "Exam & Career Anxiety",
      "Relationship & Feeling Lonely",
      "Stress & Burnout",
      "Need a Friendly Voice to Talk To"
    ];
    const langs = ["Malayalam & English", "Manglish & Malayalam", "English Only"];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    const randomLang = langs[Math.floor(Math.random() * langs.length)];
    const randomAlias = `Patient #${Math.floor(1000 + Math.random() * 9000)}`;

    setSessionDetails({
      sessionId: `helping_demo_${Date.now()}`,
      userAlias: randomAlias
    });
    setMatchedTopic(randomTopic);
    setMatchedLang(randomLang);
    setMatchFound(true);
    playAlertSound();
  };

  const handleAcceptMatch = () => {
    const sId = sessionDetails?.sessionId || "helping_demo_session";
    const userAlias = sessionDetails?.userAlias || "Patient_9021";
    toast({
      title: "Connecting to Session...",
      description: "Opening secure encrypted listener chat room.",
    });
    setLocation(`/companions/chat/${userAlias}?sessionId=${sId}`);
  };

  const handleDeclineMatch = () => {
    setMatchFound(false);
    toast({
      title: "Request Passed",
      description: "Resuming active radar scan for new match requests.",
    });
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl p-6 rounded-3xl border border-gray-100/90 dark:border-zinc-900/60 shadow-xl shadow-emerald-500/5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Live Peer Listener Command Center
              </Badge>
            </div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <HeartHandshake className="w-7 h-7 text-emerald-500" /> Peer Listener Hub
            </h1>
            <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium">
              Provide supportive, compassionate listening to peers in need while earning rewards.
            </p>
          </div>

          {/* Action Toggles */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2.5 rounded-2xl bg-gray-100 dark:bg-zinc-900 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-all"
              title={soundEnabled ? "Mute audio alerts" : "Enable audio alerts"}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5 text-emerald-500" /> : <VolumeX className="w-5 h-5 text-gray-400" />}
            </button>

            <Button
              onClick={() => setIsOnline(!isOnline)}
              className={`rounded-2xl font-bold text-xs h-11 px-5 flex items-center gap-2 transition-all shadow-md ${
                isOnline
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300'
              }`}
            >
              <Radio className={`w-4 h-4 ${isOnline ? 'animate-pulse' : ''}`} />
              {isOnline ? "Status: Online & Ready" : "Status: Paused"}
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 rounded-3xl bg-white/70 dark:bg-zinc-950/70 border border-gray-100 dark:border-zinc-900 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Today's Earnings</p>
              <p className="text-lg font-black text-gray-900 dark:text-zinc-100">₹{stats.todayEarnings}</p>
            </div>
          </Card>

          <Card className="p-4 rounded-3xl bg-white/70 dark:bg-zinc-950/70 border border-gray-100 dark:border-zinc-900 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sessions Today</p>
              <p className="text-lg font-black text-gray-900 dark:text-zinc-100">{stats.sessionsCompleted} Chats</p>
            </div>
          </Card>

          <Card className="p-4 rounded-3xl bg-white/70 dark:bg-zinc-950/70 border border-gray-100 dark:border-zinc-900 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Listener Rating</p>
              <p className="text-lg font-black text-gray-900 dark:text-zinc-100">⭐ {stats.impactRating}</p>
            </div>
          </Card>

          <Card className="p-4 rounded-3xl bg-white/70 dark:bg-zinc-950/70 border border-gray-100 dark:border-zinc-900 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold shrink-0">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hearts Received</p>
              <p className="text-lg font-black text-gray-900 dark:text-zinc-100">{stats.heartsEarned} ❤️</p>
            </div>
          </Card>
        </div>

        {/* Main Grid: Live Radar + Guidelines */}
        <div className="grid lg:grid-cols-12 gap-6">
          
          {/* Left Hero Radar Card */}
          <Card className="lg:col-span-7 p-8 rounded-[2.5rem] bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border border-gray-100/90 dark:border-zinc-900/60 shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[440px]">
            {/* Background Grid Accent */}
            <div className="absolute inset-0 opacity-15 dark:opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

            {/* Radar Sweep Visual */}
            <div className="relative w-64 h-64 my-6 flex items-center justify-center">
              {/* Animated Radar Rings */}
              <motion.div
                className="absolute inset-0 bg-emerald-500/10 rounded-full border border-emerald-500/20"
                animate={{ scale: [0.8, 1.3, 1.8], opacity: [0.7, 0.3, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeOut" }}
              />
              <motion.div
                className="absolute inset-6 bg-emerald-500/15 rounded-full border border-emerald-500/30"
                animate={{ scale: [0.8, 1.3, 1.7], opacity: [0.8, 0.4, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeOut", delay: 1 }}
              />

              {/* Sweeping Line Rotation */}
              <motion.div
                className="absolute inset-0 rounded-full border border-emerald-500/25 flex items-center justify-center overflow-hidden"
              >
                <motion.div
                  className="w-full h-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,rgba(16,185,129,0.35)_360deg)] rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                />
              </motion.div>

              {/* Center Radar Icon */}
              <div className="w-20 h-20 rounded-3xl bg-emerald-600 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/40 relative z-10 border-2 border-emerald-400/30">
                <HeartHandshake className="w-10 h-10 animate-pulse" />
              </div>

              {/* Random floating signal dots */}
              <motion.div
                className="absolute top-8 right-12 w-3 h-3 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/80"
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
              <motion.div
                className="absolute bottom-10 left-10 w-2.5 h-2.5 rounded-full bg-teal-400 shadow-md"
                animate={{ opacity: [0.3, 0.9, 0.3] }}
                transition={{ repeat: Infinity, duration: 2.5, delay: 0.5 }}
              />
            </div>

            <div className="space-y-2 relative z-10 max-w-md">
              <h2 className="text-2xl font-black text-gray-900 dark:text-zinc-100 tracking-tight">
                {isOnline ? "Scanning for Live Peer Requests" : "Search Paused"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium leading-relaxed">
                {isOnline
                  ? "Matching engine active. Connecting you with users seeking empathetic, non-judgmental peer support in real-time."
                  : "You are currently offline. Turn on your status above to receive incoming listener match requests."}
              </p>

              <div className="pt-3 flex items-center justify-center gap-3">
                <Button
                  onClick={triggerDemoMatch}
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold gap-1.5 h-9"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Simulate Test Match Request
                </Button>
              </div>
            </div>

            {/* Bottom Security Footer */}
            <div className="mt-8 pt-4 border-t border-gray-100 dark:border-zinc-900 w-full flex items-center justify-between text-[11px] text-gray-400 font-semibold px-2">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> End-to-End Encrypted & Anonymous
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" /> Avg Match Time: ~12s
              </span>
            </div>
          </Card>

          {/* Right Listener Guidelines & Best Practices Card */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Principles Card */}
            <Card className="p-6 rounded-[2.5rem] bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border border-gray-100/90 dark:border-zinc-900/60 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-900 pb-3">
                <h3 className="font-extrabold text-gray-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Listener Principles
                </h3>
                <Badge className="bg-amber-500/10 text-amber-600 text-[10px] font-bold">Best Practices</Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-2xl bg-gray-50/80 dark:bg-zinc-900/40 border border-gray-100 dark:border-zinc-800 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 font-black text-xs flex items-center justify-center shrink-0">1</div>
                  <div>
                    <p className="font-extrabold text-gray-800 dark:text-zinc-200 text-xs">Empathetic Active Listening</p>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 font-medium leading-relaxed">
                      Let the patient express their thoughts without rushing to solve or give unsolicited advice.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-gray-50/80 dark:bg-zinc-900/40 border border-gray-100 dark:border-zinc-800 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 font-black text-xs flex items-center justify-center shrink-0">2</div>
                  <div>
                    <p className="font-extrabold text-gray-800 dark:text-zinc-200 text-xs">100% Anonymity Guaranteed</p>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 font-medium leading-relaxed">
                      Never exchange personal phone numbers, real names, or social handles during the chat.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-gray-50/80 dark:bg-zinc-900/40 border border-gray-100 dark:border-zinc-800 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 font-black text-xs flex items-center justify-center shrink-0">3</div>
                  <div>
                    <p className="font-extrabold text-gray-800 dark:text-zinc-200 text-xs">Immediate Crisis Safety Net</p>
                    <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 font-medium leading-relaxed">
                      If self-harm or severe distress is mentioned, click the "Escalate to Professional" button in chat.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Reminder Banner */}
            <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-600/15 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-200">Listener Reward System</span>
                <Coins className="w-4 h-4 text-emerald-200" />
              </div>
              <p className="text-xs font-bold leading-snug">
                You earn ₹250 per completed 30-minute peer session + bonus tips from grateful patients!
              </p>
              <p className="text-[10px] text-emerald-100 font-medium">
                Payouts are processed directly to your linked UPI / Bank account every Friday.
              </p>
            </div>
          </div>
        </div>

        {/* Incoming Match Popup Modal */}
        <AnimatePresence>
          {matchFound && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-md">
              <motion.div
                className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl rounded-[2.5rem] border border-gray-100 dark:border-zinc-900 shadow-2xl max-w-md w-full overflow-hidden p-7 space-y-5"
                initial={{ y: 60, opacity: 0, scale: 0.92 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 60, opacity: 0, scale: 0.92 }}
                transition={{ type: "spring", damping: 22, stiffness: 320 }}
              >
                {/* Header with countdown badge */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-900 pb-4">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black text-xs px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                      <Flame className="w-3.5 h-3.5" /> INCOMING REQUEST
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full">
                    <Clock className="w-3.5 h-3.5 animate-spin" /> {countdown}s
                  </div>
                </div>

                {/* Patient Overview Card */}
                <div className="space-y-4">
                  <div className="bg-emerald-500/10 dark:bg-emerald-950/30 rounded-3xl p-5 border border-emerald-500/20 text-center space-y-2 relative overflow-hidden">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white font-black text-lg mx-auto flex items-center justify-center shadow-lg shadow-emerald-600/30">
                      {(sessionDetails?.userAlias || "P")[0]}
                    </div>
                    <div>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-extrabold uppercase tracking-wider">Patient Alias</p>
                      <p className="text-xl font-black text-gray-900 dark:text-zinc-100 mt-0.5">
                        {sessionDetails?.userAlias || "Patient #9021"}
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 pt-1">
                      <Badge className="bg-white/80 dark:bg-zinc-900/80 text-gray-700 dark:text-zinc-300 border-0 text-[10px] font-bold">
                        Topic: {matchedTopic}
                      </Badge>
                      <Badge className="bg-white/80 dark:bg-zinc-900/80 text-gray-700 dark:text-zinc-300 border-0 text-[10px] font-bold">
                        🌐 {matchedLang}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-3 rounded-2xl bg-gray-50 dark:bg-zinc-900/60 border border-gray-100 dark:border-zinc-800">
                      <p className="text-[9px] font-extrabold text-gray-400 uppercase">Est. Session Duration</p>
                      <p className="text-sm font-black text-gray-800 dark:text-zinc-200 mt-0.5">30 - 45 Mins</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-gray-50 dark:bg-zinc-900/60 border border-gray-100 dark:border-zinc-800">
                      <p className="text-[9px] font-extrabold text-gray-400 uppercase">Session Reward</p>
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">₹250 Credit</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleAcceptMatch}
                    className="w-full flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs h-12 shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
                  >
                    Accept & Start Session <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleDeclineMatch}
                    variant="outline"
                    className="w-full flex-1 rounded-2xl border-gray-200 dark:border-zinc-800 text-xs h-12 font-bold text-gray-500 hover:bg-gray-50"
                  >
                    Pass
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

