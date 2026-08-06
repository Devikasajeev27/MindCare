import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from "wouter";
import { AppLayout } from '@/components/layout/AppLayout';
import { PageTransition } from '@/components/layout/PageTransition';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Clock, X, Phone, PhoneOff, Mic, MicOff, Volume2, Sparkles, Heart, HeartHandshake } from 'lucide-react';
import { ChatWindow, Message } from '@/components/chat/ChatWindow';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { socket } from '@/lib/socket';

const ICEBREAKERS = [
  "🌿 I'm feeling a bit overwhelmed today.",
  "💼 I had a very stressful day at work.",
  "💤 I'm having trouble sleeping due to anxiety.",
  "🤗 I just need a calm space to share my thoughts."
];

export default function CompanionChat() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [matching, setMatching] = useState(true);
  const [sessionTime, setSessionTime] = useState(300); // 5 minutes free trial
  const [isLocked, setIsLocked] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);

  // Live Voice Call State
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Exit & Feedback States
  const [showExitModal, setShowExitModal] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [rating, setRating] = useState(5);

  const sessionId = new URLSearchParams(window.location.search).get("sessionId") || "";
  const companionAlias = id ? decodeURIComponent(id).replace('_', ' ') : "Peer Listener #4821";

  const [messages, setMessages] = useState<Message[]>([
    { id: "1", sender: "other" as const, text: `Hello there! I'm ${companionAlias}. I'm here to listen without any judgment. How are you feeling right now?`, time: "Just now" }
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMatching(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  // Live Voice Call Timer
  useEffect(() => {
    let timer: any;
    if (isVoiceCallActive) {
      timer = setInterval(() => setCallSeconds(s => s + 1), 1000);
    } else {
      setCallSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isVoiceCallActive]);

  useEffect(() => {
    socket.connect();
    if (sessionId) {
      socket.emit("join_session", sessionId);
    }

    socket.on("receive_message", (msg: any) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg._id || m.id === msg.id)) return prev;
        return [...prev, {
          id: msg._id || msg.id,
          sender: 'other',
          text: msg.text,
          time: new Date(msg.createdAt || msg.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isVoice: msg.isVoice,
          audioUrl: msg.audioUrl,
          voiceDuration: msg.voiceDuration,
          isDistress: Boolean(msg.distressFlagged)
        }];
      });
    });

    if (!sessionId) return;
    api.companions.getSessionMessages(sessionId).then(({ messages: history }) => {
      if (history.length > 0) {
        const historyMsgs = history.map((m: any) => ({
          id: m._id,
          sender: (m.sender === 'user' ? 'user' : 'other') as 'user' | 'other',
          text: m.text,
          time: new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isVoice: m.isVoice,
          audioUrl: m.audioUrl,
          voiceDuration: m.voiceDuration,
          isDistress: Boolean(m.distressFlagged)
        }));
        setMessages(historyMsgs);
      }
    }).catch(console.error);

    return () => {
      socket.off("receive_message");
    };
  }, [sessionId]);

  useEffect(() => {
    if (matching || isLocked) return;

    const timer = setInterval(() => {
      setSessionTime(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsLocked(true);
          setShowPayModal(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [matching, isLocked]);

  const formatTime = (seconds: number) => {
    if (seconds > 999) return "Unlimited Active";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSendMessage = async (text: string, isVoice = false, audioUrl?: string, duration?: string) => {
    if (isLocked) {
      setShowPayModal(true);
      return;
    }
    const newMsg: Message = {
      id: Date.now().toString(),
      sender: 'user' as const,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVoice,
      audioUrl,
      voiceDuration: duration
    };
    setMessages(prev => [...prev, newMsg]);

    try {
      const { message, safety } = await api.companions.sendSessionMessage(sessionId, text);
      setMessages(prev => prev.map(item => item.id === newMsg.id ? { ...item, id: message._id, isDistress: Boolean(safety?.distressFlagged) } : item));
    } catch (err: any) {
      setMessages(prev => prev.filter(item => item.id !== newMsg.id));
      toast({ variant: "destructive", title: "Message not sent", description: err.message || "Peer-session safety monitoring could not process this message." });
      console.error(err);
    }
  };

  const handleStartCall = () => {
    setIsVoiceCallActive(true);
    toast({ title: "Connecting Voice Call 📞", description: `Encrypted audio call started with ${companionAlias}` });
  };

  const handleEndCall = () => {
    setIsVoiceCallActive(false);
    toast({ title: "Call Ended", description: "Voice call session concluded." });
  };

  const handlePayment = async () => {
    try {
      await api.matching.processPayment(sessionId, 49);
      setIsLocked(false);
      setShowPayModal(false);
      setSessionTime(99999);
      toast({ title: "Session Extended! 🌿", description: "You now have unlimited continuation time." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Payment Failed", description: err.message });
    }
  };

  const handleConcludeSession = async () => {
    try {
      await api.matching.endSession({
        sessionId,
        durationMinutes: 5,
        favorite: isFavorited,
        rating
      });
      setShowExitModal(false);
      toast({ title: "Session Closed", description: "Thank you for connecting." });
      setLocation("/companions");
    } catch (err: any) {
      setLocation("/companions");
    }
  };

  if (matching) {
    return (
      <AppLayout>
        <PageTransition>
          <div className="h-[calc(100vh-6rem)] flex items-center justify-center">
            <div className="text-center max-w-md p-8 bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xl space-y-4">
              <div className="relative w-28 h-28 mx-auto my-4">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
                <div className="absolute inset-3 bg-emerald-500/40 rounded-full animate-pulse"></div>
                <div className="absolute inset-6 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-600/30">
                  <HeartHandshake className="w-9 h-9" />
                </div>
              </div>
              <h2 className="text-xl font-black text-gray-900 dark:text-zinc-100">Establishing Encrypted Session...</h2>
              <p className="text-xs text-gray-400 font-medium leading-relaxed">Connecting anonymously with {companionAlias}. Your identity is protected.</p>
            </div>
          </div>
        </PageTransition>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageTransition>
        {/* Active Live Voice Call Modal */}
        {isVoiceCallActive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center text-white space-y-6"
            >
              <div className="space-y-1">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                  🟢 Encrypted Audio Call
                </Badge>
                <h3 className="text-2xl font-black">{companionAlias}</h3>
                <p className="text-xs text-zinc-400 font-mono font-bold">{formatTime(callSeconds)}</p>
              </div>

              {/* Animated Waveform Sound Bars */}
              <div className="flex items-center justify-center gap-1.5 h-16 my-4">
                {[40, 75, 55, 90, 60, 85, 45, 70, 95, 50].map((h, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: isMuted ? 10 : [20, h, 20] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
                    className="w-1.5 bg-emerald-500 rounded-full"
                  />
                ))}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    isMuted ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                  }`}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={handleEndCall}
                  className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/40"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    isSpeakerOn ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-200'
                  }`}
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Payment Modal */}
        {showPayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-2xl max-w-sm w-full p-6 space-y-4 text-center"
            >
              <h3 className="font-black text-gray-900 dark:text-zinc-100 text-base">Free Trial Expired</h3>
              <p className="text-xs text-gray-500 font-medium">Your free 5-minute anonymous trial has ended. Continue talking for just ₹49.</p>
              <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-900/40">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Session Continuation Fee</p>
                <p className="text-3xl font-black text-emerald-600 mt-1">₹49.00</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handlePayment} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs h-10 shadow-md shadow-emerald-600/20">
                  Pay &amp; Continue
                </Button>
                <Button onClick={() => { setShowPayModal(false); setShowExitModal(true); }} variant="outline" className="flex-1 rounded-xl text-xs h-10 font-bold">
                  End Session
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Exit Feedback Modal */}
        {showExitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-2xl max-w-sm w-full p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-900 pb-3">
                <h3 className="font-black text-gray-900 dark:text-zinc-100 text-sm">Conclude Peer Session</h3>
                <button onClick={() => setShowExitModal(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-900 text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">Rate this Companion</span>
                  <div className="flex gap-1 text-amber-500">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setRating(star)} className="text-lg focus:outline-none hover:scale-110 transition-transform">
                        {star <= rating ? "★" : "☆"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 dark:border-zinc-900 pt-3">
                  <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">Save as Favorite Companion?</span>
                  <button
                    onClick={() => setIsFavorited(!isFavorited)}
                    className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all ${
                      isFavorited ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {isFavorited ? "❤️ Saved" : "Save"}
                  </button>
                </div>
              </div>

              <Button onClick={handleConcludeSession} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs h-10 shadow-md shadow-red-600/20">
                Disconnect &amp; Exit Session
              </Button>
            </motion.div>
          </div>
        )}

        {/* Main Chat Container */}
        <div className="h-[calc(100vh-6.5rem)] flex flex-col max-w-4xl mx-auto bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
          {/* Header */}
          <div className="bg-gray-50/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-11 w-11 border-2 border-emerald-500/30">
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 font-black text-sm">PC</AvatarFallback>
                </Avatar>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-black text-gray-900 dark:text-zinc-100 text-sm">{companionAlias}</h2>
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 border-0 text-[10px] font-bold">
                    Anonymous Peer
                  </Badge>
                </div>
                <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3" /> End-to-End Encrypted Session
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handleStartCall} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9 px-3 gap-1.5 shadow-sm">
                <Phone className="w-3.5 h-3.5" /> Start Voice Call
              </Button>
              <div className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border flex items-center gap-1.5 ${
                isLocked ? 'bg-red-50 text-red-600 border-red-200' : 'bg-white dark:bg-zinc-950 border-gray-200 text-gray-600'
              }`}>
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                {formatTime(sessionTime)}
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowExitModal(true)} className="rounded-xl border-gray-200 text-xs font-bold text-red-600 h-9 px-3">
                Disconnect
              </Button>
            </div>
          </div>

          {/* Icebreaker Prompt Pills */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-2 border-b border-emerald-100 dark:border-emerald-900/30 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0">Quick Starters:</span>
            {ICEBREAKERS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                className="text-[11px] font-semibold bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 text-gray-700 dark:text-zinc-200 px-3 py-1 rounded-full shrink-0 hover:bg-emerald-100 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Chat Window */}
          <div className="flex-1 overflow-hidden">
            <ChatWindow
              messages={messages}
              onSendMessage={handleSendMessage}
              otherAvatar={""}
              otherName={companionAlias}
              onStartVoiceCall={handleStartCall}
            />
          </div>
        </div>
      </PageTransition>
    </AppLayout>
  );
}
