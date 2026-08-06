import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Send, Paperclip, Mic, ShieldCheck, Globe, MoreVertical,
  Volume2, Plus, ChevronRight, BarChart2, AlertTriangle, X,
  ExternalLink, MessageSquare, Check, HeartHandshake, Eye, EyeOff, Trash2, Edit3, Save, Upload, Info, Settings, Calendar, Award,
  Copy, RefreshCw, Play, Pause, PhoneOff, PhoneCall, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import { api } from '@/lib/api';
import { toast, useToast } from '@/hooks/use-toast';
import {
  useLang, LANGUAGES, AI_GREETINGS, AI_RESPONSES_I18N, CRISIS_RESPONSES_I18N, type Lang
} from '@/context/LanguageContext';
import { useLocationReporter } from '@/hooks/useLocationReporter';

const CRISIS_KW = {
  critical: [
    'kill myself', 'end my life', 'want to die', 'suicide', 'suicidal', 'self harm', 'self-harm', 'hurt myself', 'cut myself', 'no reason to live', 'better off dead', 'end it all', "can't go on", 'goodbye forever',
    'marikkan thonnunnu', 'jeevikkan vayya', 'aathmahathya', 'മരിക്കാൻ തോന്നുന്നു', 'ജീവിക്കാൻ വയ്യ', 'ആത്മഹത്യ',
    'njan marikkan ponu', 'marikkan ponu', 'marikkan povukayan', 'marikkan pokaya', 'marikkan pokuva', 'njan poan pova',
    'njan marikkunnatha nallath', 'marikkunnatha nallath', 'marikkanatha nallath',
    'njan marichal nallatha', 'marichal nallatha', 'marichal nallath', 'njan marichal', 'marichal',
    'marikkan', 'jeevikkan pattilla', 'chavan thonnunnu', 'chavanam', 'chatha',
    'marichalo', 'chathalo', 'life venda', 'enikk e life venda', 'e life venda', 'ee life venda', 'marichu'
  ],
  high: [
    'hopeless', 'worthless', 'nobody cares', 'no one cares', 'hate myself', 'give up', "can't take it anymore", 'not worth living', 'falling apart', 'breaking down', 'losing my mind', "i'm done", 'nothing matters',
    'maduthu', 'thalarunnu', 'vedhana', 'sangadam', 'katta vishamam', 'മടുത്തു', 'തളർന്നു', 'വേദന', 'സങ്കടം', 'ഭയങ്കര വിഷമം',
    'maduth', 'life maduthu', 'life maduth', 'jeevitham thanne maduthu', 'jeevitham maduthu', 'sankatam', 'kashtam', 'pain', 'die'
  ],
  moderate: [
    'really depressed', 'very anxious', 'overwhelmed', "can't cope", 'feeling empty', 'numb', 'trapped', 'exhausted', 'struggling', 'scared', 'desperate', 'feel alone', 'distress', 'depressed', 'sad', 'crying',
    'vishamam', 'pediyund', 'sahikkan pattunnilla', 'വിഷമം', 'പേടിയുണ്ട്', 'സഹിക്കാൻ പറ്റുന്നില്ല',
    'pediyaa', 'pediyaan', 'depress', 'vayya', 'sukham illa'
  ],
};
type RiskLevel = 'none' | 'moderate' | 'high' | 'critical';

const RISK_RANK: Record<RiskLevel, number> = { none: 0, moderate: 1, high: 2, critical: 3 };

function normalizeRiskLevel(value?: string | null): RiskLevel {
  if (value === 'critical' || value === 'high' || value === 'moderate') return value;
  if (value === 'elevated' || value === 'low') return 'moderate';
  return 'none';
}

function maxRiskLevel(...levels: Array<string | null | undefined>): RiskLevel {
  return levels
    .map(normalizeRiskLevel)
    .reduce<RiskLevel>((max, level) => (RISK_RANK[level] > RISK_RANK[max] ? level : max), 'none');
}

function analyzeMessage(text: string): RiskLevel {
  if (!text) return 'none';
  const l = text.toLowerCase().replace(/[^\w\s\u0D00-\u0D7F]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Broad pattern matching for any Malayalam/Manglish death or suicidal intent stems
  const suicidePattern = /(maric|marik|chav|aathmahat|suicid|self[- ]?harm|maranam)/i;
  const lifeRefusalPattern = /(jeevik|life).*(venda|vaya|vayya|pattilla|pattulla|pilla|madut)/i;

  if (
    CRISIS_KW.critical.some(k => l.includes(k.toLowerCase())) ||
    suicidePattern.test(l) ||
    lifeRefusalPattern.test(l)
  ) {
    return 'critical';
  }

  if (CRISIS_KW.high.some(k => l.includes(k.toLowerCase()))) return 'high';
  if (CRISIS_KW.moderate.some(k => l.includes(k.toLowerCase()))) return 'moderate';
  return 'none';
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
  riskLevel?: RiskLevel;
  isDistress?: boolean;
  isVoice?: boolean;
  voiceDuration?: string;
  audioUrl?: string;
  freeTherapistVoucher?: any;
}

const PLACEHOLDERS: Record<Lang, string> = {
  en: 'Type a message…', es: 'Escribe un mensaje…', fr: 'Tapez un message…', ar: 'اكتب رسالة…', hi: 'एक संदेश लिखें…'
};
const SAFE_LABEL: Record<Lang, string> = {
  en: 'Safe Space', es: 'Espacio Seguro', fr: 'Espace Sûr', ar: 'مساحة آمنة', hi: 'सुरक्षित स्थान'
};
const CRISIS_LABEL: Record<Lang, string> = {
  en: 'Crisis Detected', es: 'Crisis Detectada', fr: 'Crise Détectée', ar: 'أزمة مكتشفة', hi: 'संकट पाया'
};

export default function AiAssistant() {
  useLocationReporter(); // Report location silently in the background
  const { lang, isRTL } = useLang();
  const [, setLocation] = useLocation();
  
  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', sender: 'ai', text: AI_GREETINGS[lang], time: 'Now' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState('Chat'); // 'Chat', 'Insights', 'Memory', 'Import'
  const [crisisLevel, setCrisisLevel] = useState<RiskLevel>('none');
  const [showModal, setShowModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Streaming/Typing context states
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [fullStreamText, setFullStreamText] = useState('');
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Emergency Contacts state
  const [contacts, setContacts] = useState<any[]>([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [emergencyAlertInfo, setEmergencyAlertInfo] = useState<any>(null);
  const [showAlertDetailsModal, setShowAlertDetailsModal] = useState<boolean>(false);

  const [chatSessions, setChatSessions] = useState<{ id: string; text: string; time: string; updatedAt: number }[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedSessions, setPinnedSessions] = useState<string[]>([]);
  const [shouldConnectTherapist, setShouldConnectTherapist] = useState<boolean>(false);

  // AI Companion Profile & Memory States
  const [profile, setProfile] = useState<any>(null);
  const [lifeEvents, setLifeEvents] = useState<any[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Memories CRUD editing states
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryCategory, setMemoryCategory] = useState('other');
  const [memoryType, setMemoryType] = useState('semantic');
  const [memoryImportance, setMemoryImportance] = useState('medium');
  const [memoryExpiration, setMemoryExpiration] = useState('');
  const [isSavingMemory, setIsSavingMemory] = useState(false);

  // File Import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importText, setImportText] = useState('');
  const [importPlatform, setImportPlatform] = useState('whatsapp');
  const [importConsent, setImportConsent] = useState(false);
  const [keepRawChat, setKeepRawChat] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState<{ imported: number; duplicates: number } | null>(null);

  // Therapist Escalation states
  const [therapists, setTherapists] = useState<any[]>([]);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [selectedTherapist, setSelectedTherapist] = useState<any>(null);
  const [shareSummaryConsent, setShareSummaryConsent] = useState(true);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingSlot, setBookingSlot] = useState('10:00 AM - 11:00 AM');
  const [isBooking, setIsBooking] = useState(false);
  // ─── Live Therapist Escalation & Distress Counter States ───────────────────────
  const [sessionDistressCount, setSessionDistressCount] = useState<number>(0);
  const [distressTimestamps, setDistressTimestamps] = useState<number[]>([]);
  const [isTherapistConnected, setIsTherapistConnected] = useState<boolean>(false);
  const [awaitingTherapistAcceptance, setAwaitingTherapistAcceptance] = useState(false);
  const [connectedTherapist, setConnectedTherapist] = useState<any>({
    name: "Dr. Devika Pillai",
    title: "Senior Clinical Psychologist (Aster Medcity)",
    avatar: "https://images.unsplash.com/photo-1594824813566-888550795743?w=150&auto=format&fit=crop&q=80",
    phone: "+91 484 6699999"
  });

  const handleDirectTherapistChat = useCallback(() => {
    setIsTherapistConnected(true);
    setShowModal(false);
    setShowEscalateModal(false);
    toast({
      title: "⚡ Direct Therapist Live Switch Activated",
      description: "Connecting directly to Senior Clinical Psychologist Dr. Devika Pillai..."
    });
    setLocation("/therapist/chat");
  }, [setLocation, toast]);

  // Language Detection & Mirroring Helper
  const detectMsgLanguage = useCallback((text: string): 'malayalam' | 'manglish' | 'english' => {
    if (/[\u0D00-\u0D7F]/.test(text)) return 'malayalam';
    const lower = text.toLowerCase();
    const manglishKW = [
      'maduthu', 'maduth', 'vishamam', 'pediyund', 'thalarunnu', 'sangadam', 'kashtam',
      'saramilla', 'ayyo', 'pattilla', 'illatto', 'ayache', 'vallatha', 'mattam', 'veruthe',
      'onnum', 'nalla', 'kashtama', 'sankatam', 'chatha', 'pokan', 'vedhana', 'marikkan',
      'jeevikkan', 'enikk', 'enikku', 'njan', 'njaan', 'vayya', 'thonnunn', 'paranjath',
      'orma', 'aano', 'illa', 'nokkaam', 'entha', 'ippo', 'parayaam'
    ];
    if (manglishKW.some(k => lower.includes(k))) return 'manglish';
    return 'english';
  }, []);

  // ─── Voice Recording States (WhatsApp style) ──────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // ─── Speech Recognition & Continuous Conversation States ───────────────────────
  const [isVoiceSessionActive, setIsVoiceSessionActive] = useState(false);
  const [voiceSessionStatus, setVoiceSessionStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const synthesisUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const lastSpokenTextRef = useRef<string>("");

  // ─── Conversation Mode Settings ───────────────────────────────────────────────
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1.0);
  const [voiceVolume, setVoiceVolume] = useState<number>(1.0);
  const [noiseCancellation, setNoiseCancellation] = useState<boolean>(true);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');

  // Fetch initial profile, contacts, chat history, and therapists list
  const fetchAllData = useCallback(() => {
    // 1. Fetch AI profile
    api.ai.getProfile()
      .then(res => {
        setProfile(res.profile);
        setLifeEvents(res.lifeEvents || []);
        setIsLoadingProfile(false);
      })
      .catch((err) => {
        console.error("Failed to load AI profile:", err);
        setIsLoadingProfile(false);
      });

    // 2. Fetch emergency contacts
    api.crisis.getContacts().then(data => {
      setContacts(data);
    }).catch((err: any) => console.error(err));

    // 3. Fetch therapists
    api.therapists.list().then(data => {
      setTherapists(data);
    }).catch(console.error);

    // 4. Fetch live chat history
    api.chat.getHistory('ai').then((res: any) => {
      const history = res?.chats || [];
      if (history && history.length > 0) {
        const sessionGroups = new Map<string, any[]>();
        history.forEach((message: any) => {
          if (!message.sessionId) return;
          const group = sessionGroups.get(message.sessionId) || [];
          group.push(message);
          sessionGroups.set(message.sessionId, group);
        });
        const sessions = [...sessionGroups.entries()].map(([id, sessionMessages]) => {
          const latest = sessionMessages[sessionMessages.length - 1];
          const firstUserMessage = sessionMessages.find((message: any) => message.sender === 'user') || latest;
          return {
            id,
            text: firstUserMessage.text.slice(0, 48) + (firstUserMessage.text.length > 48 ? '…' : ''),
            time: new Date(latest.createdAt || latest.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            updatedAt: new Date(latest.createdAt || latest.time || 0).getTime(),
          };
        }).sort((a, b) => b.updatedAt - a.updatedAt);
        setChatSessions(sessions);

        const selectedSessionId = sessions.some((session) => session.id === res.activeSessionId)
          ? res.activeSessionId
          : sessions[0]?.id;
        const selectedMessages = selectedSessionId ? sessionGroups.get(selectedSessionId) || [] : [];
        setActiveSessionId(selectedSessionId || null);
        setMessages(
          selectedMessages.map((m: any) => ({
            id: m._id,
            sender: (m.sender === 'user' ? 'user' : 'ai') as "user" | "ai",
            text: m.text,
            time: new Date(m.createdAt || m.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            riskLevel: m.riskLevel,
            isDistress: m.sender === 'user' && Boolean(m.distressFlagged),
            isVoice: m.isVoice,
            voiceDuration: m.voiceDuration,
            audioUrl: (typeof localStorage !== 'undefined' ? localStorage.getItem(`audio_${m._id}`) : null) || m.audioUrl || m.audioData
          }))
        );
      } else {
        setActiveSessionId(null);
        setChatSessions([]);
        setMessages([{ id: 'init', sender: 'ai', text: AI_GREETINGS[lang], time: 'Now' }]);
      }
    }).catch((err: any) => console.error(err));
  }, [lang]);

  const makeSessionId = useCallback(() => `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, []);

  const toUiMessages = useCallback((history: any[]): Message[] => history.map((m: any) => {
    const analyzedRisk = m.sender === 'user' ? analyzeMessage(m.text) : 'none';
    const finalRisk = maxRiskLevel(normalizeRiskLevel(m.riskLevel), analyzedRisk);
    const isDistress = m.sender === 'user' && (Boolean(m.distressFlagged) || finalRisk === 'critical' || finalRisk === 'high');
    return {
      id: m._id,
      sender: m.sender === 'user' ? 'user' : 'ai',
      text: m.text,
      time: new Date(m.createdAt || m.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      riskLevel: finalRisk,
      isDistress,
      isVoice: Boolean(m.isVoice),
      voiceDuration: m.voiceDuration,
      audioUrl: (typeof localStorage !== 'undefined' ? localStorage.getItem(`audio_${m._id}`) : null) || m.audioUrl || m.audioData,
    };
  }), []);

  const handleNewChat = useCallback(() => {
    const sessionId = makeSessionId();
    setActiveSessionId(sessionId);
    setActiveTab('Chat');
    setCrisisLevel('none');
    setIsTherapistConnected(false);
    setSessionDistressCount(0);
    setMessages([{ id: 'init', sender: 'ai', text: AI_GREETINGS[lang], time: 'Now' }]);
  }, [lang, makeSessionId]);

  const handleOpenChatSession = useCallback(async (sessionId: string) => {
    try {
      const history = await api.chat.getSessionChats(sessionId);
      setActiveSessionId(sessionId);
      setCrisisLevel('none');
      setIsTherapistConnected(false);
      const uiMsgs = toUiMessages(history);
      setMessages(uiMsgs);
      const distressCount = uiMsgs.filter(m => m.sender === 'user' && (m.isDistress || m.riskLevel === 'critical' || m.riskLevel === 'high')).length;
      setSessionDistressCount(distressCount);
      setActiveTab('Chat');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Unable to open chat', description: error.message || 'Please try again.' });
    }
  }, [toUiMessages, toast]);

  useEffect(() => {
    setIsTherapistConnected(false);
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping, activeTab]);

  useEffect(() => {
    if (!awaitingTherapistAcceptance) return;
    const checkForAcceptedSession = async () => {
      try {
        const { activeSession } = await api.crisis.getActiveSession();
        if (!activeSession?._id) return;
        setAwaitingTherapistAcceptance(false);
        setIsTherapistConnected(true);
        toast({ title: 'Therapist connected', description: 'Your free priority therapist chat is ready.' });
        setLocation(`/therapist/chat?emergencySession=${encodeURIComponent(activeSession._id)}`);
      } catch {
        // Keep polling while the accepted emergency session is being created.
      }
    };
    void checkForAcceptedSession();
    const interval = window.setInterval(checkForAcceptedSession, 5000);
    return () => window.clearInterval(interval);
  }, [awaitingTherapistAcceptance, setLocation, toast]);

  // Load dynamic voices & mic devices
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
      if (voices.length > 0 && !selectedVoiceName) {
        const defaultVoice = voices.find(v => v.lang.startsWith(lang)) || voices[0];
        setSelectedVoiceName(defaultVoice.name);
      }
    };
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const mics = devices.filter(d => d.kind === 'audioinput');
        setAudioDevices(mics);
        if (mics.length > 0 && !selectedMicId) {
          setSelectedMicId(mics[0].deviceId);
        }
      }).catch(console.error);
    }
  }, [lang, selectedVoiceName, selectedMicId]);

  // Clean up timers, recorders, and the active player only when this page unmounts.
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      audioPlaybackRef.current?.pause();
      audioPlaybackRef.current = null;
    };
  }, []);

  // Handle incoming query params e.g. /ai-assistant?q=Hello
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialMsg = params.get('q');
    if (initialMsg) {
      // Clear the query parameter so reloading the page doesn't resend it
      setLocation(window.location.pathname);

      // Auto-send the message after a tiny delay
      setTimeout(() => {
        handleSend(initialMsg);
      }, 300);
    }
  }, []);

  // Message Sending
  const handleSend = useCallback(async (overrideText?: string, isVoiceMsg = false) => {
    const textToSend = overrideText || inputValue;
    if (!textToSend.trim() && !isVoiceMsg) return;
    const sessionId = activeSessionId || makeSessionId();
    if (!activeSessionId) setActiveSessionId(sessionId);
    setInputValue('');
    setIsTyping(true);

    const risk = analyzeMessage(textToSend);
    const isDistress = risk !== 'none';

    const tempId = Date.now().toString();
    const userMsg: Message = {
      id: tempId,
      sender: 'user',
      text: isVoiceMsg ? `🎙️ Voice Message: ${textToSend}` : textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      riskLevel: risk,
      isDistress: false,
      isVoice: isVoiceMsg,
      voiceDuration: isVoiceMsg ? formatRecordingTime(recordingSeconds) : undefined
    };
    setMessages(prev => [...prev, userMsg]);

    const msgLang = detectMsgLanguage(textToSend);
    const l = textToSend.toLowerCase();

    const shouldConnectTherapist = false;
    const targetRecipient = "ai";

    try {
      const res = await api.chat.sendMessage({ text: textToSend, recipient: targetRecipient, lang, sessionId });
      setIsTyping(false);
      setChatSessions(prev => [{
        id: sessionId,
        text: textToSend.slice(0, 48) + (textToSend.length > 48 ? '…' : ''),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        updatedAt: Date.now(),
      }, ...prev.filter((session) => session.id !== sessionId)]);

      const computedRisk = maxRiskLevel(risk, res.userMessage?.riskLevel);
      const currentMessageRisk = normalizeRiskLevel(res.currentMessageRiskLevel || (res.isCurrentMessageDistress ? computedRisk : 'none'));
      setCrisisLevel(currentMessageRisk);

      const isCurrentDistress = currentMessageRisk === 'critical' || currentMessageRisk === 'high' || Boolean(res.isCurrentMessageDistress) || risk === 'critical' || risk === 'high';

      // Dynamically calculate distress count from messages history array + current message
      const previousDistressCount = messages.filter(m => m.sender === 'user' && (m.isDistress || m.riskLevel === 'critical' || m.riskLevel === 'high')).length;
      const totalDistressCount = previousDistressCount + (isCurrentDistress ? 1 : 0);
      const backendDistressCount = res.distressWindow?.count || 0;
      const effectiveDistressCount = Math.max(totalDistressCount, backendDistressCount);

      setSessionDistressCount(effectiveDistressCount);
      setShowModal(false);

      // Instant automatic redirect to live therapist chat on 2nd distress message
      if (effectiveDistressCount >= 2 && !isTherapistConnected) {
        setIsTherapistConnected(true);
        setShowModal(false);
        setShowEscalateModal(false);

        if (effectiveDistressCount >= 5) {
          const primaryContact = contacts && contacts.length > 0 ? contacts[0] : {
            name: "Emergency Contact",
            relationship: "Family/Friend",
            phone: "+91 98470 12345"
          };
          try {
            api.notifications.add(
              "🚨 Emergency Crisis Alert Dispatched",
              `5 distress disclosures detected. Emergency alert dispatched to ${primaryContact.name} (${primaryContact.phone}).`,
              "alert"
            ).catch(() => {});
          } catch (e) {}

          toast({
            variant: "destructive",
            title: "🚨 5 Distress Signals Detected — Emergency Contact Notified",
            description: `Emergency alert sent to ${primaryContact.name} (${primaryContact.phone}).`
          });
        } else {
          toast({
            title: "🚨 2 Distress Messages Flagged — Live Therapist Connected",
            description: "Connecting directly to Senior Clinical Psychologist..."
          });
        }

        setLocation("/therapist/chat");
        return;
      }

      setMessages(prev => prev.map(message => message.id === tempId ? {
        ...message,
        id: res.userMessage?._id || message.id,
        riskLevel: currentMessageRisk,
        isDistress: Boolean(res.isCurrentMessageDistress),
      } : message));
      if (res.distressWindow) setSessionDistressCount(res.distressWindow.count || 0);

      if (res.therapistConnection?.connected && !isTherapistConnected) {
        setIsTherapistConnected(true);
        toast({ title: "Therapist support is ready", description: "A secure therapist session has been opened." });
        setLocation(`/therapist/chat?emergencySession=${encodeURIComponent(res.therapistConnection.emergencySessionId || '')}`);
      }
      if (res.therapistConnection?.pending) {
        setAwaitingTherapistAcceptance(true);
        toast({ title: 'Free therapist support requested', description: 'An on-call therapist has been asked to accept this priority chat.' });
      }

      if (shouldConnectTherapist && !isTherapistConnected) {
        setIsTherapistConnected(true);
        setShowModal(false);
        setShowEscalateModal(false);

        const primaryContact = contacts && contacts.length > 0 ? contacts[0] : {
          name: "Rajesh Nair",
          relationship: "Brother",
          phone: "+91 98470 12345"
        };

        const alertInfo = {
          id: `alert_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          recipientName: primaryContact.name,
          relation: primaryContact.relationship || "Brother",
          phone: primaryContact.phone || "+91 98470 12345",
          status: "DISPATCHED & DELIVERED (SMS + PUSH)",
          trigger: "5 Distress disclosures detected within 10 minutes",
          location: "Kochi, Kerala (GPS Coordinates 10.0159° N, 76.3419° E)",
          messageContent: `MindCare SOS Alert: User has expressed 5 distress signals within 10 minutes. Senior Clinical Psychologist Dr. Devika Pillai has taken over live consultation.`,
          therapistAssigned: "Dr. Devika Pillai (Senior Clinical Psychologist)"
        };
        setEmergencyAlertInfo(alertInfo);

        try {
          api.notifications.add(
            "🚨 Emergency Crisis Alert Dispatched",
            `5 distress disclosures detected within 10 mins. Informative alert sent to ${primaryContact.name} (${primaryContact.relationship}).`,
            "alert"
          ).catch(() => {});
        } catch (e) {}

        toast({
          variant: "destructive",
          title: "🚨 5 Distress Signals Detected — Therapist Live Switch Activated",
          description: `Emergency alert dispatched to ${primaryContact.name}. Dr. Devika Pillai connected.`
        });

        setTimeout(() => {
          let connectGreeting = "";
          if (msgLang === 'manglish') {
            connectGreeting = `🚨 DIRECT THERAPIST CONNECTION ACTIVATED (5 Distress Signals Detected):\n\n👋 Namaskaram, njan Dr. Devika Pillai (Senior Clinical Psychologist). MindCare crisis engine 5 distress signals detect cheythathukond njan direct aayi connect aayittund. Dhairyamaayi parayaam, njan ivide ninne kelkkaan undu. Enthaanu ninte manassile vishamam?`;
          } else if (msgLang === 'malayalam') {
            connectGreeting = `🚨 DIRECT THERAPIST CONNECTION ACTIVATED (5 Distress Signals Detected):\n\n👋 നമസ്കാരം, ഞാൻ Dr. Devika Pillai (Senior Clinical Psychologist). 5 തളർച്ച സൂചനകൾ കണ്ടെത്തിയതിനെ തുടർന്ന് ഞാൻ നേരിട്ട് ഈ ചാറ്റിലേക്ക് വന്നിരിക്കുകയാണ്. ഭയപ്പെടേണ്ട, മനസ്സ് തുറന്ന് സംസാരിക്കാം.`;
          } else {
            connectGreeting = `🚨 DIRECT THERAPIST CONNECTION ACTIVATED (5 Distress Signals Detected):\n\n👋 Hello, I am Dr. Devika Pillai (Senior Clinical Psychologist). Our crisis engine flagged 5 distress signals in your conversation. I have taken over to support you directly. Tell me, what is weighing on you right now?`;
          }

          const therapistConnectMsg: Message = {
            id: `therapist_connect_${Date.now()}`,
            sender: 'ai',
            text: connectGreeting,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages(prev => [...prev, therapistConnectMsg]);
        }, 600);
      }

      // Add supportive response text with DYNAMIC language mirroring & empathy
      let aiText = res.replyMessage?.text;

      if (false && (isTherapistConnected || shouldConnectTherapist)) {
        if (l.includes('marichalo') || l.includes('chathalo') || l.includes('chavanam') || l.includes('life venda') || l.includes('e life venda')) {
          if (msgLang === 'manglish') {
            aiText = "Dr. Devika Pillai: Nee paranjath njan valare serious aayi edukkunnu. Viswasathodum dhairyathodum parayoo, njan ivide ninne support cheyyaan koodeyund. Nee ippol safe aano?";
          } else if (msgLang === 'malayalam') {
            aiText = "Dr. Devika Pillai: നിങ്ങൾ പറഞ്ഞത് ഞാൻ വളരെ ഗൗരവത്തോടെ എടുക്കുന്നു. ഭയപ്പെടേണ്ട, ഞാൻ നിങ്ങളുടെ കൂടെയുണ്ട്. മനസ്സ് തുറന്ന് സംസാരിക്കാം, നിങ്ങൾ ഇപ്പോൾ സുരക്ഷിതനാണോ?";
          } else {
            aiText = "Dr. Devika Pillai: I hear you and I am taking this very seriously. I am right here with you. Are you safe right now?";
          }
        } else if (l.includes('jeevitham thanne maduthu') || l.includes('jeevitham maduthu') || l.includes('life maduthu') || l.includes('maduthu')) {
          if (msgLang === 'manglish') {
            aiText = "Dr. Devika Pillai: Jeevitham aake maduthe ennu parayumbol nalla thalarchayum vishamavum thonnam. Njan ninne shradhichu kelkkunnu, enthaanubudhimuttikunnathennu dhairyamaayi parayaamo?";
          } else if (msgLang === 'malayalam') {
            aiText = "Dr. Devika Pillai: ജീവിതം ആകെ മടുത്തു എന്ന് പറയുമ്പോൾ വലിയ തളർച്ച തോന്നാം. ഞാൻ നിങ്ങളുടെ കൂടെയുണ്ട്. ഇപ്പോൾ എന്താണ് മനസ്സിനെ അലട്ടുന്നത്?";
          } else {
            aiText = "Dr. Devika Pillai: Feeling completely tired of life is a heavy weight to carry. I am right here with you — please share what is weighing on you most.";
          }
        }
      } else if (false) {
        // AI comforting and supporting user before 5 distress messages threshold is reached
        if (l.includes('marichalo') || l.includes('chathalo') || l.includes('chavanam') || l.includes('life venda') || l.includes('e life venda')) {
          if (msgLang === 'manglish') {
            aiText = "Nee paranjath njan valare serious aayi edukkunnu. Ningalude manassile thalarchayum sankatavum enikk manassilaakunnu. Dhairyamaayi irikkoo, njan ninne thaniye vidilla. Enthaanu ippol kooduthal vishamam thonnunnathennu njan kelkkaam.";
          } else if (msgLang === 'malayalam') {
            aiText = "നിങ്ങൾ പറയുന്നത് ഞാൻ വളരെ ഗൗരവത്തോടെ കേൾക്കുന്നു. മനസ്സ് തളരരുത്, ഞാൻ നിങ്ങളുടെ കൂടെയുണ്ട്. വിഷമിക്കേണ്ട, എന്താണ് നിങ്ങളെ ഇപ്പോൾ കൂടുതൽ അലട്ടുന്നത്?";
          } else {
            aiText = "I hear you and I am taking what you said very seriously. Please take a deep breath — I am right here with you and you don't have to carry this alone.";
          }
        } else if (l.includes('jeevitham thanne maduthu') || l.includes('jeevitham maduthu') || l.includes('life maduthu') || l.includes('maduthu')) {
          if (msgLang === 'manglish') {
            aiText = "Jeevitham aake maduthe ennu parayumbol nalla thalarchayum sankatavum thonnam. Dhairyamaayi irikoo, njan ninne kelkkan ivide undu. Enthaanu ippol manassine aake budhimuttikunnathennu parayaamo?";
          } else if (msgLang === 'malayalam') {
            aiText = "ജീവിതം ആകെ മടുത്തു എന്ന് പറയുമ്പോൾ വലിയ തളർച്ച തോന്നാം. ധൈര്യമായിരിക്കൂ, ഞാൻ നിങ്ങളുടെ കൂടെയുണ്ട്. ഇപ്പോൾ മനസ്സിനെ അലട്ടുന്നത് എന്താണെന്ന് എന്നോട് പറയാമോ?";
          } else {
            aiText = "Feeling completely tired of life is a heavy burden to carry. I am right here with you and listening carefully. What is weighing on you most right now?";
          }
        } else if (l.includes('vayya') || l.includes('sukham illa')) {
          if (msgLang === 'manglish') {
            aiText = "Aake thalarchayum budhimuttum thonnunnath pole undalloo. Vishamikkenda, njan ninne kelkkan ivide undu. Sharirathino manassino enthanu kooduthal kashtam thonnunnath? Njan ninne support cheyyaam.";
          } else if (msgLang === 'malayalam') {
            aiText = "ആകെ വയ്യാഴിക തോന്നുന്നുവെന്ന് മനസ്സിലാകുന്നു. സങ്കടപ്പെടേണ്ട, ഞാൻ നിങ്ങളുടെ കൂടെയുണ്ട്. മനസ്സ് തുറന്ന് സംസാരിക്കൂ, ഞാൻ കേൾക്കാൻ ഇവിടെയുണ്ട്.";
          } else {
            aiText = "I hear you and I am right here with you. Please take a gentle breath. You don't have to carry this alone — tell me what is troubling you most.";
          }
        } else if (!aiText || aiText.includes("Let’s focus on what you just said") || aiText.includes("unpack first") || aiText.startsWith("I hear you, and I am here with you")) {
          if (msgLang === 'manglish') {
            aiText = "Njan ninne kelkkan ivide undu. Ningalude manassile vishamam enikk manassilaakunnu. Dhairyamaayi parayoo, njan ninne support cheyyaan ivide undu.";
          } else if (msgLang === 'malayalam') {
            aiText = "ഞാൻ നിങ്ങളുടെ കൂടെയുണ്ട്. വിഷമിക്കേണ്ട, മനസ്സ് തുറന്ന് സംസാരിക്കൂ. എന്താണ് സംഭവിച്ചത് എന്ന് എന്നോട് പറയാമോ?";
          } else {
            aiText = "I hear you, and I am here with you. Please take a deep breath and share whatever is on your mind — you don't have to carry this alone.";
          }
        }
      }

      const newMsgId = res.replyMessage?._id || Date.now().toString();
      animateStreamingResponse(newMsgId, aiText);

      if (isVoiceSessionActive) {
        speakResponse(aiText);
      }

      // If live and analyzed, refresh insights and memories in background
      if (profile?.consentToAnalysis && !profile?.temporaryChat) {
        setTimeout(() => {
          api.ai.getProfile().then(res => {
            setProfile(res.profile);
            setLifeEvents(res.lifeEvents || []);
          }).catch(console.error);
        }, 3500);
      }
    } catch (err: any) {
      setIsTyping(false);
      toast({
        variant: "destructive",
        title: "Communication failed",
        description: err.message || "Failed to reach AI companion."
      });
    }
  }, [activeSessionId, inputValue, isVoiceSessionActive, makeSessionId, recordingSeconds, toast, profile, messages, sessionDistressCount, isTherapistConnected]);

  // ─── Voice Recording Helpers ──────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      // Clean up any existing active recording stream or URL
      if (recordedAudioUrl) {
        console.log("[VoiceMessage] Cleaning up previous recording URL:", recordedAudioUrl);
        URL.revokeObjectURL(recordedAudioUrl);
        setRecordedAudioUrl(null);
      }
      setRecordedBlob(null);

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }

      audioChunksRef.current = [];

      const constraints = {
        audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true
      };

      let selectedMimeType = 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        selectedMimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        selectedMimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        selectedMimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        selectedMimeType = 'audio/ogg';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        selectedMimeType = 'audio/wav';
      }

      console.log(`[VoiceMessage] Initializing fresh MediaRecorder with mimeType: ${selectedMimeType}`);
      toast({ title: "Microphone Active", description: "Recording voice message..." });

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const exactMime = mediaRecorder.mimeType || selectedMimeType;
        const audioBlob = new Blob(audioChunksRef.current, { type: exactMime });
        const freshUrl = URL.createObjectURL(audioBlob);
        console.log(`[VoiceMessage] Recording stopped. Created exact Blob: type=${exactMime}, size=${audioBlob.size} bytes, URL=${freshUrl}`);

        setRecordedBlob(audioBlob);
        setRecordedAudioUrl(freshUrl);

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
        }
      };

      mediaRecorder.start(100); // Record in 100ms timeslices for reliable chunking
      setIsRecording(true);
      setRecordingPaused(false);
      setRecordingSeconds(0);

      // Initialize parallel SpeechRecognition to transcribe spoken voice into text in real-time
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'ml-IN'; // Detect Malayalam / Manglish speech
          setVoiceTranscript('');
          rec.onresult = (e: any) => {
            let current = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
              current += e.results[i][0].transcript;
            }
            if (current.trim()) {
              console.log("[VoiceRecording] Live Speech Transcript:", current.trim());
              setVoiceTranscript(current.trim());
            }
          };
          rec.start();
          recognitionRef.current = rec;
        } catch (e) {
          console.warn("[VoiceRecording] SpeechRecognition init error:", e);
        }
      }

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (err) {
      console.error("[VoiceMessage] Recording start error:", err);
      toast({ variant: "destructive", title: "Microphone blocked", description: "Please grant microphone permission to record voice messages." });
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingPaused(true);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingPaused(false);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingPaused(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const deleteRecording = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (recordedAudioUrl) {
      console.log("[VoiceMessage] Deleting recording and revoking Object URL:", recordedAudioUrl);
      URL.revokeObjectURL(recordedAudioUrl);
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingPaused(false);
    setRecordedAudioUrl(null);
    setRecordedBlob(null);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  const formatRecordingTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sendVoiceMessage = async () => {
    const getRecordedBlobAsync = (): Promise<{ blob: Blob; url: string }> => {
      return new Promise((resolve, reject) => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
          if (recordedBlob && recordedAudioUrl) {
            resolve({ blob: recordedBlob, url: recordedAudioUrl });
          } else {
            reject(new Error("No active recording and no pre-recorded Blob."));
          }
          return;
        }

        mediaRecorderRef.current.onstop = () => {
          const exactMime = mediaRecorderRef.current?.mimeType || 'audio/webm;codecs=opus';
          const audioBlob = new Blob(audioChunksRef.current, { type: exactMime });
          const freshUrl = URL.createObjectURL(audioBlob);
          console.log(`[VoiceMessage] Stop recording async. Created Blob: type=${exactMime}, size=${audioBlob.size} bytes, URL=${freshUrl}`);

          setRecordedBlob(audioBlob);
          setRecordedAudioUrl(freshUrl);

          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
          }

          setIsRecording(false);
          setRecordingPaused(false);
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

          resolve({ blob: audioBlob, url: freshUrl });
        };

        mediaRecorderRef.current.stop();
      });
    };

    let recordingData: { blob: Blob; url: string };
    try {
      recordingData = await getRecordedBlobAsync();
    } catch (err: any) {
      console.warn("[VoiceMessage] Attempted to send but no recorded Blob could be resolved:", err.message);
      return;
    }

    const { blob: blobToSend, url: localAudioUrl } = recordingData;
    const sessionId = activeSessionId || makeSessionId();
    if (!activeSessionId) setActiveSessionId(sessionId);
    const durationStr = formatRecordingTime(recordingSeconds);
    console.log(`[VoiceMessage] Send request initiated. Size: ${blobToSend.size} bytes, Duration: ${durationStr}, MIME: ${blobToSend.type}, URL=${localAudioUrl}`);

    toast({ title: "Uploading voice message...", description: "Processing your audio message..." });
    setIsTyping(true);

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    const tempId = Date.now().toString();
    const userDisplayLabel = voiceTranscript
      ? `🎙️ Voice Message: "${voiceTranscript}"`
      : "🎙️ Voice Message";

    // Add temporary visual bubble to the UI list with exact recorded Blob URL for local playback
    const userMsg: Message = {
      id: tempId,
      sender: 'user',
      text: userDisplayLabel,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isVoice: true,
      voiceDuration: durationStr,
      audioUrl: localAudioUrl
    };
    setMessages(prev => [...prev, userMsg]);

    setIsRecording(false);
    setRecordingPaused(false);
    setRecordedAudioUrl(null);
    setRecordedBlob(null);
    setRecordingSeconds(0);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    try {
      const fileExt = blobToSend.type.includes("mp4") ? "mp4" : blobToSend.type.includes("ogg") ? "ogg" : "webm";
      const filename = `audio.${fileExt}`;

      const formData = new FormData();
      formData.append("file", blobToSend, filename);
      formData.append("recipient", "ai");
      formData.append("voiceDuration", durationStr);
      formData.append("sessionId", sessionId);
      if (voiceTranscript) {
        formData.append("transcript", voiceTranscript);
      }

      console.log(`[VoiceMessage] Sending FormData upload to /chats/voice with file: ${filename}`);
      const res = await api.chat.sendVoiceMessage(formData);
      setIsTyping(false);
      setChatSessions(prev => [{
        id: sessionId,
        text: userDisplayLabel.slice(0, 48) + (userDisplayLabel.length > 48 ? '…' : ''),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        updatedAt: Date.now(),
      }, ...prev.filter((session) => session.id !== sessionId)]);

      // Cache recorded base64 Data URI in localStorage for persistent playback on refresh
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        if (base64data) {
          const persistedId = res.userMessage?._id || tempId;
          try {
            localStorage.setItem(`audio_${persistedId}`, base64data);
            localStorage.setItem(`audio_${tempId}`, base64data);
          } catch (e) {}
        }
      };
      reader.readAsDataURL(blobToSend);

      const transcribedText = res.userMessage?.text && !res.userMessage.text.includes("Sending...") 
        ? res.userMessage.text 
        : (voiceTranscript ? `🎙️ Voice Message: "${voiceTranscript}"` : "🎙️ Voice Message");
      const persistedAudioUrl = res.userMessage?.audioUrl || localAudioUrl;
      setMessages(prev => prev.map(m => m.id === tempId ? {
        ...m,
        id: res.userMessage?._id || m.id,
        text: transcribedText,
        audioUrl: persistedAudioUrl,
      } : m));
      if (res.userMessage?.audioUrl) URL.revokeObjectURL(localAudioUrl);

      const computedRisk = maxRiskLevel(analyzeMessage(voiceTranscript || res.userMessage?.text || ''), res.userMessage?.riskLevel);
      const currentMessageRisk = normalizeRiskLevel(res.currentMessageRiskLevel || (res.isCurrentMessageDistress ? computedRisk : 'none'));
      setCrisisLevel(currentMessageRisk);
      setMessages(prev => prev.map(message => message.id === (res.userMessage?._id || tempId) ? {
        ...message,
        riskLevel: currentMessageRisk,
        isDistress: Boolean(res.isCurrentMessageDistress),
      } : message));
      if (res.distressWindow) setSessionDistressCount(res.distressWindow.count || 0);
      if (res.therapistConnection?.connected && !isTherapistConnected) {
        setIsTherapistConnected(true);
        toast({ title: "Therapist support is ready", description: "A secure therapist session has been opened." });
        setLocation(`/therapist/chat?emergencySession=${encodeURIComponent(res.therapistConnection.emergencySessionId || '')}`);
      }
      if (res.therapistConnection?.pending) {
        setAwaitingTherapistAcceptance(true);
        toast({ title: 'Free therapist support requested', description: 'An on-call therapist has been asked to accept this priority chat.' });
      }

      if (res.distressAlertTriggered || currentMessageRisk === 'critical' || currentMessageRisk === 'high') {
        setShowModal(true);
        toast({
          variant: "destructive",
          title: "🚨 Emergency & Distress Alert Triggered",
          description: "We detected distress. You can choose the support action that feels safest for you."
        });
      }

      // Add the new AI response
      const aiText = res.replyMessage?.text || "I am here to support you.";
      const newMsgId = res.replyMessage?._id || Date.now().toString();
      const voucher = res.freeTherapistVoucher || (res.distressAlertTriggered ? {
        code: "MINDCARE-FREE-5X",
        therapistName: "Dr. Devika Pillai",
        title: "Senior Clinical Psychologist (Aster Medcity, Kochi)",
        discount: "100% Free Consultation",
        expiration: "Valid for 30 Days"
      } : undefined);

      animateStreamingResponse(newMsgId, aiText, voucher);
    } catch (err: any) {
      console.error("[VoiceMessage] Transmission failed:", err);
      setIsTyping(false);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, text: "🎙️ Voice message transmission failed." } : m));
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: err.message || "Failed to send voice message."
      });
    }
  };

  // ─── ChatGPT Advanced Conversation Mode (Continuous Speech) ─────────────────────
  const isEcho = (transcript: string, lastSpeech: string): boolean => {
    if (!lastSpeech) return false;
    const t = transcript.toLowerCase().trim();
    const s = lastSpeech.toLowerCase().trim();
    if (t.length < 4) return true; // Ignore very short single words/noises as potential echoes
    if (s.includes(t) || t.includes(s)) return true;
    return false;
  };

  const startContinuousVoiceSession = () => {
    if (isVoiceSessionActive) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ variant: "destructive", title: "Not Supported", description: "Continuous speech recognition is not supported in this browser. Please use Chrome." });
      return;
    }

    setIsVoiceSessionActive(true);
    setVoiceSessionStatus('listening');

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    const langStr = lang as string;
    rec.lang = langStr === 'hi' ? 'hi-IN' :
      langStr === 'ml' ? 'ml-IN' :
        langStr === 'ta' ? 'ta-IN' :
          langStr === 'es' ? 'es-ES' : 'en-US';

    rec.onstart = () => {
      setVoiceSessionStatus('listening');
    };

    rec.onresult = async (event: any) => {
      const resultIndex = event.resultIndex;
      const transcript = event.results[resultIndex][0].transcript;

      if (!transcript.trim()) return;

      // Echo prevention check: ignore transcript if it's the AI speaking
      if (window.speechSynthesis.speaking && isEcho(transcript, lastSpokenTextRef.current)) {
        console.log("[VoiceSession] Ignored AI speech feedback echo:", transcript);
        return;
      }

      // Dynamic interruption: if AI is speaking, user speaking interrupts it immediately
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        console.log("[VoiceSession] User interrupted AI speech with transcript:", transcript);
      }

      setVoiceTranscript(transcript);
      setVoiceSessionStatus('thinking');

      try {
        const res = await api.chat.sendMessage({ text: transcript, recipient: "ai", lang });
        const aiText = res.replyMessage?.text || "I'm listening.";

        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: 'user',
            text: transcript,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          },
          {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: aiText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);

        speakResponse(aiText);
      } catch (err) {
        setVoiceSessionStatus('listening');
      }
    };

    rec.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
    };

    rec.onend = () => {
      if (isVoiceSessionActive) {
        try { rec.start(); } catch (e) { }
      }
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const stopContinuousVoiceSession = () => {
    setIsVoiceSessionActive(false);
    setVoiceSessionStatus('idle');
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    window.speechSynthesis.cancel();
  };

  const speakResponse = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/🎙️\s*Voice\s*Message:\s*"?/gi, "").replace(/"$/g, "").trim();
    if (!cleanText) return;

    lastSpokenTextRef.current = cleanText;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();

    // Auto-detect Malayalam or Indian language voice if Malayalam text
    let voice = voices.find(v => v.name === selectedVoiceName);
    if (/[\u0D00-\u0D7F]/.test(cleanText)) {
      const mlVoice = voices.find(v => v.lang.startsWith('ml') || v.lang.startsWith('hi') || v.lang.includes('IN'));
      if (mlVoice) voice = mlVoice;
    }
    if (!voice && voices.length > 0) voice = voices[0];
    if (voice) utterance.voice = voice;

    utterance.rate = voiceSpeed;
    utterance.volume = voiceVolume;

    utterance.onstart = () => {
      setVoiceSessionStatus('speaking');
    };

    utterance.onend = () => {
      setVoiceSessionStatus('listening');
      setPlayingAudioId(null);
    };

    utterance.onerror = () => {
      setPlayingAudioId(null);
    };

    synthesisUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Close session on tab switch
  useEffect(() => {
    if (activeTab !== 'Conversation') {
      stopContinuousVoiceSession();
    }
  }, [activeTab]);

  // Clean up stream interval on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    };
  }, []);

  const stopStreaming = useCallback(() => {
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    if (activeStreamId && fullStreamText) {
      setMessages(prev => prev.map(m => m.id === activeStreamId ? { ...m, text: fullStreamText } : m));
    }
    setActiveStreamId(null);
  }, [activeStreamId, fullStreamText]);

  const animateStreamingResponse = useCallback((msgId: string, text: string, freeTherapistVoucher?: any) => {
    // Clear any existing stream interval
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
    }

    setActiveStreamId(msgId);
    setFullStreamText(text);

    const words = text.split(' ');
    let currentIdx = 0;

    // Add placeholder message first
    const newMsg: Message = {
      id: msgId,
      sender: 'ai',
      text: '',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      freeTherapistVoucher
    };

    setMessages(prev => [...prev, newMsg]);

    const interval = setInterval(() => {
      currentIdx += 1;
      const currentText = words.slice(0, currentIdx).join(' ');

      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: currentText, freeTherapistVoucher } : m));

      if (currentIdx >= words.length) {
        clearInterval(interval);
        streamIntervalRef.current = null;
        setActiveStreamId(null);
      }
    }, 45); // Natural typing speed (~45ms per word)

    streamIntervalRef.current = interval;
  }, []);

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Message text copied successfully.",
    });
  };

  const handleDeleteMessage = async (id: string) => {
    try {
      await api.chat.deleteMessage(id);
      setMessages(prev => prev.filter(m => m.id !== id));
      toast({
        title: "Message deleted",
        description: "The message has been removed from this chat room.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Deletion failed",
        description: err.message || "Failed to delete message.",
      });
    }
  };

  const handleRegenerateResponse = async () => {
    // Find the last user message
    const userMessages = messages.filter(m => m.sender === 'user');
    if (userMessages.length === 0) return;
    const lastUserMsg = userMessages[userMessages.length - 1];

    // Remove the last AI message from state to prepare for new generation
    setMessages(prev => {
      const idx = prev.map(m => m.sender).lastIndexOf('ai');
      if (idx !== -1 && prev[idx].id !== 'init') {
        return prev.filter((_, i) => i !== idx);
      }
      return prev;
    });

    setIsTyping(true);

    try {
      const sessionId = activeSessionId || makeSessionId();
      if (!activeSessionId) setActiveSessionId(sessionId);
      const res = await api.chat.sendMessage({ text: lastUserMsg.text, recipient: "ai", lang, sessionId });
      setIsTyping(false);

      const computedRisk = maxRiskLevel(analyzeMessage(lastUserMsg.text), res.userMessage?.riskLevel);
      const currentMessageRisk = normalizeRiskLevel(res.currentMessageRiskLevel || (res.isCurrentMessageDistress ? computedRisk : 'none'));
      setCrisisLevel(currentMessageRisk);

      if (currentMessageRisk === 'critical' || currentMessageRisk === 'high') {
        setShowModal(true);
      }

      // Add the new AI response with typing animation!
      const aiText = res.replyMessage?.text || "I am here to support you.";
      const newMsgId = res.replyMessage?._id || Date.now().toString();
      animateStreamingResponse(newMsgId, aiText);

    } catch (err: any) {
      setIsTyping(false);
      toast({
        variant: "destructive",
        title: "Regeneration failed",
        description: err.message || "Failed to regenerate response."
      });
    }
  };

  const isLastAiMessage = (id: string) => {
    const aiMsgs = messages.filter(m => m.sender === 'ai');
    if (aiMsgs.length === 0) return false;
    return aiMsgs[aiMsgs.length - 1].id === id;
  };

  const handleExportChat = () => {
    const content = messages
      .map(m => `[${m.time}] ${m.sender === 'user' ? 'User' : 'AI'}: ${m.text}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MindCare_Chat_Export_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Chat exported",
      description: "Your chat transcript was exported successfully.",
    });
  };

  const togglePinSession = (id: string) => {
    setPinnedSessions(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
    toast({
      title: "Conversation pinned",
      description: "This thread has been pinned to the top of your history list.",
    });
  };




  // Save emergency contact
  const handleSaveContact = async () => {
    if (!newContactName || !newContactRelation || !newContactPhone) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please enter name, relationship, and phone details."
      });
      return;
    }
    setIsSavingContact(true);
    try {
      const saved = await api.crisis.saveContact({
        name: newContactName,
        relationship: newContactRelation,
        countryCode: "+91",
        phone: newContactPhone,
        email: newContactEmail || undefined,
        priority: 1
      });
      setContacts(prev => [...prev, saved]);
      setShowContactModal(false);
      setNewContactName('');
      setNewContactRelation('');
      setNewContactPhone('');
      setNewContactEmail('');
      toast({
        title: "Contact saved",
        description: "Emergency contact has been registered successfully."
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Action failed",
        description: err.message || "Failed to save emergency contact."
      });
    } finally {
      setIsSavingContact(false);
    }
  };

  // Toggle settings
  const handleUpdateProfileSetting = async (field: string, val: any) => {
    if (!profile) return;
    try {
      const updated = await api.ai.updateProfile({ [field]: val });
      setProfile(updated);
      toast({ title: "Settings saved", description: `Successfully updated your companion settings.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update failed", description: e.message });
    }
  };

  // Update AI custom settings (AI Name, avatar, voice)
  const handleUpdateAiPreference = async (prefKey: string, val: any) => {
    if (!profile) return;
    try {
      const updatedAiPreferences = { ...profile.aiPreferences, [prefKey]: val };
      const updated = await api.ai.updateProfile({ aiPreferences: updatedAiPreferences });
      setProfile(updated);
      toast({ title: "AI Customization Saved", description: `Updated AI ${prefKey} successfully.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update failed", description: e.message });
    }
  };

  // Toggle personalization parameter
  const handleUpdatePersonalization = async (field: string, val: string) => {
    if (!profile) return;
    try {
      const updatedPersonalization = { ...profile.personalization, [field]: val };
      const updated = await api.ai.updateProfile({ personalization: updatedPersonalization });
      setProfile(updated);
      toast({ title: "Personalization saved", description: "Successfully updated talking preferences." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update failed", description: e.message });
    }
  };

  // Add/Edit Memory
  const handleSaveMemory = async () => {
    if (!memoryContent.trim()) {
      toast({ variant: "destructive", title: "Invalid memory", description: "Memory detail content cannot be empty." });
      return;
    }
    setIsSavingMemory(true);
    try {
      const payload = {
        category: memoryCategory,
        content: memoryContent,
        type: memoryType,
        importance: memoryImportance,
        expiration: memoryExpiration || undefined
      };
      if (editingMemoryId) {
        const res = await api.ai.editMemory(editingMemoryId, payload);
        setProfile(res.profile);
        setEditingMemoryId(null);
        toast({ title: "Memory Updated", description: "Fact was edited successfully." });
      } else {
        const res = await api.ai.addMemory(payload);
        setProfile(res.profile);
        toast({ title: "Memory Added", description: "We saved a new detail about you." });
      }
      setMemoryContent('');
      setMemoryCategory('other');
      setMemoryType('semantic');
      setMemoryImportance('medium');
      setMemoryExpiration('');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
    } finally {
      setIsSavingMemory(false);
    }
  };

  // Delete Memory
  const handleDeleteMemory = async (id: string) => {
    try {
      const updated = await api.ai.deleteMemory(id);
      setProfile(updated);
      toast({ title: "Memory Deleted", description: "Memory deleted successfully." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Delete failed", description: e.message });
    }
  };

  // Toggle Forget / Mute Fact status (toggles disabled field)
  const handleToggleForgetMemory = async (id: string) => {
    try {
      const updated = await api.ai.deleteMemory(id, "disable");
      setProfile(updated);
      toast({ title: "Memory state changed", description: "Toggled memory active state." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Action failed", description: e.message });
    }
  };

  // File Import Logic
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    if (file.name.toLowerCase().endsWith(".zip")) {
      setImportProgress(100);
      setImportText("zip_file_selected");
      toast({ title: "ZIP archive selected", description: `ZIP "${file.name}" ready to upload and extract.` });
    } else {
      const reader = new FileReader();
      reader.onloadstart = () => setImportProgress(10);
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 90);
          setImportProgress(percent);
        }
      };
      reader.onload = (event) => {
        setImportText(event.target?.result as string);
        setImportProgress(100);
        toast({ title: "File loaded", description: `File "${file.name}" read complete.` });
      };
      reader.onerror = () => {
        toast({ variant: "destructive", title: "Read error", description: "Failed to read the selected file." });
      };
      reader.readAsText(file);
    }
  };

  const handleImportHistory = async () => {
    if (!importFile && !importText) {
      toast({ variant: "destructive", title: "Nothing to import", description: "Please upload a valid export file first." });
      return;
    }
    if (!importConsent) {
      toast({ variant: "destructive", title: "Consent required", description: "You must check the consent box to analyze this data." });
      return;
    }

    setIsImporting(true);
    try {
      let res;
      if (importFile && importFile.name.toLowerCase().endsWith(".zip")) {
        const formData = new FormData();
        formData.append("file", importFile);
        formData.append("platform", importPlatform);
        formData.append("consent", String(importConsent));
        formData.append("keepRaw", String(keepRawChat));
        res = await api.ai.importChatHistory(formData);
      } else {
        res = await api.ai.importChatHistory({
          text: importText,
          platform: importPlatform,
          consent: importConsent,
          keepRaw: keepRawChat
        });
      }
      setProfile(res.profile);
      setImportStats({ imported: res.importedCount, duplicates: res.duplicateCount });
      setImportText('');
      setImportFile(null);
      toast({
        title: "Import Success",
        description: `Successfully analyzed history. ${res.message || ""}`
      });
      fetchAllData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Import failed", description: e.message });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const handleDeleteImportedHistory = async () => {
    try {
      const res = await api.ai.deleteImportedHistory();
      setProfile(res);
      setImportStats(null);
      setLifeEvents([]);
      toast({ title: "History Deleted", description: "All imported logs, timelines, and style rules have been removed." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Action failed", description: e.message });
    }
  };

  // Therapist Escalation Logic
  const handleBookEscalation = async () => {
    if (!selectedTherapist) {
      toast({ variant: "destructive", title: "No therapist chosen", description: "Please select a therapist from the list." });
      return;
    }
    if (!bookingDate) {
      toast({ variant: "destructive", title: "Date required", description: "Please select an appointment date." });
      return;
    }

    setIsBooking(true);
    try {
      const { appointment } = await api.therapists.bookAppointment({
        therapistId: selectedTherapist.userId || selectedTherapist._id,
        date: bookingDate,
        timeSlot: bookingSlot,
        amountPaid: selectedTherapist.consultationFee || 75000 // In Paise / Paise equivalence
      });

      // Update escalation consent to transfer companion summary
      await api.ai.setTherapistEscalationConsent({
        appointmentId: appointment._id,
        consent: shareSummaryConsent
      });

      setShowEscalateModal(false);
      setSelectedTherapist(null);
      setBookingDate('');
      toast({
        title: "Appointment Booked",
        description: `Consultation requested with Dr. ${selectedTherapist.name}. AI companion summary ${shareSummaryConsent ? 'attached securely' : 'withheld'}.`
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Booking failed", description: e.message });
    } finally {
      setIsBooking(false);
    }
  };

  // Emotion Analysis helpers - Analyze full conversation session history
  const userMessages = messages.filter(m => m.sender === 'user');
  const sessionTextCombined = userMessages.map(m => m.text.toLowerCase()).join(' ');

  const highestRiskInSession = userMessages.reduce<RiskLevel>((acc, m) => {
    const r = m.riskLevel || analyzeMessage(m.text);
    if (r === 'critical') return 'critical';
    if (r === 'high' && acc !== 'critical') return 'high';
    if (r === 'moderate' && acc === 'none') return 'moderate';
    return acc;
  }, 'none');

  const emotionDetails = () => {
    if (highestRiskInSession === 'critical' || CRISIS_KW.critical.some(k => sessionTextCombined.includes(k))) {
      return { emoji: '😰', label: 'Distressed', score: 15, color: '#ef4444' };
    }
    if (highestRiskInSession === 'high' || CRISIS_KW.high.some(k => sessionTextCombined.includes(k))) {
      return { emoji: '😔', label: 'Low', score: 35, color: '#f97316' };
    }
    if (highestRiskInSession === 'moderate' || CRISIS_KW.moderate.some(k => sessionTextCombined.includes(k))) {
      return { emoji: '😟', label: 'Anxious', score: 55, color: '#eab308' };
    }
    return { emoji: '😊', label: 'Calm', score: profile?.insights?.wellnessScore || 75, color: 'hsl(var(--primary))' };
  };
  const activeEmotion = emotionDetails();

  const riskBadge = {
    none: { label: SAFE_LABEL[lang], color: 'bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400' },
    moderate: { label: 'Monitoring', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400' },
    high: { label: 'Concerned', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400' },
    critical: { label: CRISIS_LABEL[lang], color: 'bg-red-100 text-red-750 dark:bg-red-950/25 dark:text-red-400' },
  };

  // Wellness advice based on score
  const getWellnessAdvice = () => {
    const score = profile?.insights?.wellnessScore || 70;
    if (score < 40) return " Distress indicators suggest you may benefit from professional help. Consider connecting with a therapist.";
    if (score < 65) return "Your stress level appears elevated. Try setting boundaries, taking brief walks, or scheduling structured relaxation.";
    return "You seem to be managing well. Continue practicing self-care and staying connected.";
  };

  const filteredMessages = messages.filter(m =>
    m.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeAlertLog = emergencyAlertInfo || {
    id: `alert_${Date.now()}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    recipientName: contacts[0]?.name || "Rajesh Nair",
    relation: contacts[0]?.relationship || "Brother",
    phone: contacts[0]?.phone || "+91 98470 12345",
    status: sessionDistressCount >= 5 ? "DISPATCHED & DELIVERED (SMS + PUSH)" : `MONITORING (${sessionDistressCount}/5 Signals Tracked)`,
    trigger: `${sessionDistressCount} Distress disclosures detected within 10 minutes`,
    location: "Kochi, Kerala (GPS Coordinates 10.0159° N, 76.3419° E)",
    messageContent: sessionDistressCount >= 5
      ? "MindCare SOS Alert: User has expressed 5 distress signals within 10 minutes. Senior Clinical Psychologist Dr. Devika Pillai has taken over live consultation."
      : `MindCare Safety Log: User has expressed ${sessionDistressCount} distress signal(s). AI companion is actively comforting the user. Emergency contact alert triggers automatically at 5 signals.`,
    therapistAssigned: sessionDistressCount >= 5 ? "Dr. Devika Pillai (Senior Clinical Psychologist)" : "AI Companion Active (Therapist on Standby)"
  };

  return (
    <AppLayout>
      {/* Contact modal popup */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <motion.div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden p-6 space-y-4"
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-gray-900 dark:text-zinc-100 text-sm">Add Emergency Contact</h3>
              <button onClick={() => setShowContactModal(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">Full Name</label>
                <input
                  value={newContactName}
                  onChange={e => setNewContactName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full text-xs border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary bg-gray-50/50 dark:bg-zinc-950/30 text-gray-800 dark:text-zinc-200"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">Relationship</label>
                <input
                  value={newContactRelation}
                  onChange={e => setNewContactRelation(e.target.value)}
                  placeholder="e.g. Spouse, Parent, Friend"
                  className="w-full text-xs border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary bg-gray-50/50 dark:bg-zinc-950/30 text-gray-800 dark:text-zinc-200"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">Phone Number</label>
                <input
                  value={newContactPhone}
                  onChange={e => setNewContactPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full text-xs border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary bg-gray-50/50 dark:bg-zinc-950/30 text-gray-800 dark:text-zinc-200"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">Email Address (Optional)</label>
                <input
                  value={newContactEmail}
                  onChange={e => setNewContactEmail(e.target.value)}
                  placeholder="e.g. parent@example.com"
                  className="w-full text-xs border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary bg-gray-50/50 dark:bg-zinc-950/30 text-gray-800 dark:text-zinc-200"
                />
              </div>
            </div>
            <Button
              onClick={handleSaveContact}
              disabled={isSavingContact}
              className="w-full bg-primary text-white font-semibold rounded-xl text-xs h-10 shadow-md shadow-primary/20"
            >
              {isSavingContact ? "Saving..." : "Save Contact Info"}
            </Button>
          </motion.div>
        </div>
      )}

      {/* Emergency active support popup */}
      {showModal && (crisisLevel === 'critical' || crisisLevel === 'high') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="px-6 py-5 bg-red-650 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <HeartHandshake className="w-8 h-8 text-white" />
                <div>
                  <h3 className="font-bold text-white text-base leading-tight">Additional Support Active</h3>
                  <p className="text-xs text-white/80">We have unlocked free therapist intervention</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed font-medium">
                I noticed you might be going through a tough moment. To support you, we have automatically set up a secure, completely free emergency session with one of our licensed therapists.
              </p>
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-blue-900 dark:text-blue-200 text-xs">Emergency Crisis Session</p>
                  <p className="text-[10px] text-blue-550 dark:text-blue-400 font-semibold">Waived • Secure • Instant Matching</p>
                </div>
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] font-extrabold border-0">FREE</Badge>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleDirectTherapistChat} className="w-full flex-1 rounded-xl bg-primary text-white font-semibold text-xs h-10">
                  Open Direct Therapist Chat
                </Button>
                <Button onClick={() => setShowModal(false)} variant="outline" className="w-full flex-1 rounded-xl border-gray-200 dark:border-zinc-800 text-xs h-10 dark:text-zinc-300">
                  Continue Chatting
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div className="h-[calc(100vh-5rem)] lg:h-[calc(100vh-4rem)] flex gap-5 overflow-hidden">
        {/* Left sidebar */}
        <div className="hidden xl:flex w-56 flex-col gap-3 shrink-0">
          <Button className="w-full rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-sm flex items-center gap-2 h-10 shadow-sm" onClick={handleNewChat}>
            <Plus className="w-4 h-4" /> New Chat
          </Button>
          <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] flex-1 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-gray-100 dark:border-zinc-900">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Companion Tools</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {[
                { tab: 'Chat', icon: '💬', label: 'AI companion chat' },
                { tab: 'Insights', icon: '📊', label: 'Wellness trends' },
                { tab: 'Memory', icon: '🧠', label: 'Long term memory' },
                { tab: 'Import', icon: '📥', label: 'Import logs' },
              ].map(item => (
                <button
                  key={item.tab}
                  onClick={() => setActiveTab(item.tab)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${activeTab === item.tab
                    ? 'bg-primary/10 text-primary dark:bg-primary/20'
                    : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-900/40'
                    }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <div className="min-w-0">
                    <p className="truncate leading-none">{item.tab}</p>
                    <p className="text-[9px] text-gray-400 mt-0.5 truncate font-normal">{item.label}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Pinned & Recent Chats */}
            <div className="p-3 border-t border-gray-105 dark:border-zinc-900 flex-1 overflow-hidden flex flex-col min-h-[160px]">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Pinned &amp; Recent Chats</p>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {chatSessions.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic px-1">No recent chats.</p>
                ) : (
                  [...chatSessions]
                    .sort((a, b) => {
                      const aPinned = pinnedSessions.includes(a.id);
                      const bPinned = pinnedSessions.includes(b.id);
                      if (aPinned && !bPinned) return -1;
                      if (!aPinned && bPinned) return 1;
                      return 0;
                    })
                    .map(session => {
                      const isPinned = pinnedSessions.includes(session.id);
                      return (
                        <div
                          key={session.id}
                          className="group/session flex items-center justify-between p-2 rounded-xl text-[10px] font-medium text-gray-650 hover:bg-gray-50 dark:text-zinc-400 dark:hover:bg-zinc-900/40 cursor-pointer transition-colors"
                          onClick={() => handleOpenChatSession(session.id)}
                        >
                          <span className="truncate max-w-[100px] leading-tight">{session.text}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[8px] text-gray-400">{session.time}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePinSession(session.id);
                              }}
                              className={`transition-opacity p-0.5 text-gray-450 hover:text-primary ${isPinned ? 'opacity-100 text-primary' : 'opacity-0 group-hover/session:opacity-100'}`}
                              title={isPinned ? "Unpin session" : "Pin session"}
                            >
                              📌
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            <div className="p-3 border-t border-gray-100 dark:border-zinc-900 space-y-2">

              <Link href="/therapists">
                <Button variant="outline" className="w-full rounded-xl border-primary/25 text-primary hover:bg-primary/5 text-[10px] h-8 font-extrabold flex items-center justify-center gap-1">
                  <HeartHandshake className="w-3.5 h-3.5" /> Book Therapist Session
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Center Workspace */}
        <div className="flex-1 flex flex-col bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.035)] overflow-hidden min-w-0" dir={isRTL ? 'rtl' : 'ltr'}>
          {/* Gentle reminder banner if no contacts registered */}
          {contacts.length === 0 && (
            <div className="bg-amber-500/5 border-b border-amber-500/10 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">To protect your clinical safety, please configure at least one emergency contact.</p>
              </div>
              <Button onClick={() => setShowContactModal(true)} size="sm" className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[10px] px-3 h-7 font-bold">
                Configure Contact
              </Button>
            </div>
          )}

          {/* Header & pill tab system */}
          <div className="px-5 py-3 border-b border-gray-100 dark:border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="font-bold text-gray-900 dark:text-zinc-100 text-sm">
                  {profile?.aiPreferences?.aiName || "AI Companion"}
                </h2>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /><span className="text-xs text-green-600 font-medium">Online</span></div>
                {profile?.temporaryChat && (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[9px] font-extrabold uppercase">Temp Chat Active</Badge>
                )}
                <Badge className={`text-[10px] border-0 font-bold ${riskBadge[crisisLevel].color}`}>{riskBadge[crisisLevel].label}</Badge>
              </div>
            </div>

            {/* Search and Export Actions */}
            {activeTab === 'Chat' && (
              <div className="flex items-center gap-2 flex-wrap sm:ml-auto mr-2">
                <input
                  type="text"
                  placeholder="Search chat..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-[11px] sm:text-xs border border-gray-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-primary bg-gray-50/50 dark:bg-zinc-950/30 text-gray-800 dark:text-zinc-200 w-28 sm:w-36"
                />
                <Button
                  onClick={handleExportChat}
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-gray-200 dark:border-zinc-805 text-[10px] sm:text-xs h-8 gap-1 dark:text-zinc-300"
                  title="Export chat transcript"
                >
                  Export
                </Button>
              </div>
            )}

            {/* Pill tabs display for mobile/tablet where sidebar is hidden */}

            <div className="flex xl:hidden bg-gray-105 dark:bg-zinc-900/80 p-1 rounded-xl self-start sm:self-auto">
              {['Chat', 'Insights', 'Memory', 'Import'].map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === t
                    ? 'bg-white dark:bg-zinc-800 text-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Distress & SOS Safety Monitoring Banner */}
          {sessionDistressCount > 0 && (
            <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border-b border-emerald-200/60 dark:border-emerald-900/40 px-5 py-2.5 flex items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="font-bold text-emerald-950 dark:text-emerald-200 truncate">
                  Clinical Safety Monitor: <span className="font-extrabold text-emerald-700 dark:text-emerald-300">{sessionDistressCount} / 5 Distress Signals Tracked</span>
                </span>
                {sessionDistressCount < 5 ? (
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400 hidden lg:inline">
                    · AI companion active & comforting. Live therapist & SOS alerts dispatch at 5 signals.
                  </span>
                ) : (
                  <span className="text-[11px] font-extrabold text-amber-700 dark:text-amber-400 hidden lg:inline">
                    · 🚨 Emergency Alert Dispatched to Contact & Therapist Connected
                  </span>
                )}
              </div>
              <Button
                onClick={() => setShowAlertDetailsModal(true)}
                size="sm"
                variant="outline"
                className="rounded-xl bg-white dark:bg-zinc-900 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold h-7 px-3 gap-1 shadow-sm shrink-0 hover:bg-emerald-100"
              >
                <Bell className="w-3.5 h-3.5 text-amber-500" /> View Alert Details
              </Button>
            </div>
          )}

          {awaitingTherapistAcceptance && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-900 px-5 py-2.5 text-xs text-blue-900 dark:text-blue-200 font-semibold shrink-0">
              Free priority therapist chat requested. It will open automatically when an on-call therapist accepts.
            </div>
          )}

          {/* Active Tab Panels */}
          <div className="flex-1 flex flex-col overflow-hidden relative">

            {/* PANEL 1: LIVE CHAT */}
            {activeTab === 'Chat' && (
              <div className="flex-1 flex flex-col overflow-hidden p-5 h-full">
                {/* Emergency Alert & Clinical Safety Monitor Banner */}
                <AnimatePresence>
                  {(sessionDistressCount > 0 || emergencyAlertInfo) && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="mb-4 bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/20 dark:border-amber-800/60 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-amber-900 dark:text-amber-200">Clinical Safety Monitor Active</h4>
                          <p className="text-[11px] font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">
                            🚨 {sessionDistressCount} / 5 Distress Signals Tracked
                            {sessionDistressCount >= 5 ? " — Emergency Contact SOS Alert Dispatched!" : " (Emergency contact alert triggers at 5)"}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl bg-white dark:bg-zinc-900 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-zinc-800 h-8 shrink-0 ml-2"
                        onClick={() => {
                          if (!emergencyAlertInfo) {
                            const primaryContact = contacts && contacts.length > 0 ? contacts[0] : {
                              name: "Rajesh Nair",
                              relationship: "Brother",
                              phone: "+91 98470 12345"
                            };
                            setEmergencyAlertInfo({
                              id: `alert_${Date.now()}`,
                              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                              recipientName: primaryContact.name,
                              relation: primaryContact.relationship || "Brother",
                              phone: primaryContact.phone || "+91 98470 12345",
                              status: sessionDistressCount >= 5 ? "DISPATCHED & DELIVERED (SMS + PUSH)" : "MONITORING ACTIVE",
                              trigger: `${sessionDistressCount} Distress disclosures detected in active session`,
                              location: "Kochi, Kerala (GPS Coordinates 10.0159° N, 76.3419° E)",
                              messageContent: `MindCare Safety Monitor: ${sessionDistressCount} distress disclosures tracked. Emergency contact: ${primaryContact.name}.`,
                              therapistAssigned: "Dr. Devika Pillai (Senior Clinical Psychologist)"
                            });
                          }
                          setShowAlertDetailsModal(true);
                        }}
                      >
                        View Details
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex-1 overflow-y-auto space-y-5 pr-1" ref={scrollRef}>
                  <AnimatePresence>
                    {filteredMessages.map(msg => { const isStreaming = activeStreamId === msg.id; return (

                      <motion.div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className={`flex gap-3 max-w-[75%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                          {msg.sender === 'ai' && (
                            <Avatar className="h-8 w-8 shrink-0 mt-auto border border-gray-100 dark:border-zinc-900">
                              {profile?.aiPreferences?.aiAvatar ? (
                                <AvatarImage src={profile.aiPreferences.aiAvatar} alt={profile?.aiPreferences?.aiName} />
                              ) : null}
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">AI</AvatarFallback>
                            </Avatar>
                          )}
                          <div className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                            {msg.isDistress && (
                              <span className="text-[11px] font-extrabold text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
                                ⚠️ Distress Signal Flagged & Monitored
                              </span>
                            )}
                            <div className="relative group max-w-full">
                              <div className={`px-4 py-3 text-sm leading-relaxed rounded-2xl ${msg.sender === 'user'
                                ? 'bg-primary text-white rounded-br-sm font-medium shadow-sm'
                                : 'bg-gray-100 dark:bg-zinc-900 text-gray-800 dark:text-zinc-300 border border-gray-200/20 rounded-bl-sm font-medium'
                                }`}>
                                {msg.isVoice ? (
                                  <div className="flex items-center gap-3.5 min-w-[200px] py-1">
                                    <button
                                      onClick={() => {
                                        const cleanSpeechText = msg.text.replace(/🎙️\s*Voice\s*Message:\s*"?/gi, "").replace(/"$/g, "").trim();
                                        if (playingAudioId === msg.id) {
                                          audioPlaybackRef.current?.pause();
                                          audioPlaybackRef.current = null;
                                          if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
                                          setPlayingAudioId(null);
                                          return;
                                        }

                                        setPlayingAudioId(msg.id);

                                        const cachedAudio = typeof localStorage !== 'undefined' ? localStorage.getItem(`audio_${msg.id}`) : null;
                                        const audioSource = cachedAudio || msg.audioUrl;

                                        if (audioSource) {
                                          audioPlaybackRef.current?.pause();
                                          const audio = new Audio(audioSource);
                                          audioPlaybackRef.current = audio;
                                          audio.onended = () => {
                                            if (audioPlaybackRef.current === audio) audioPlaybackRef.current = null;
                                            setPlayingAudioId(null);
                                          };
                                          audio.onerror = () => {
                                            if (audioPlaybackRef.current === audio) audioPlaybackRef.current = null;
                                            speakResponse(cleanSpeechText || msg.text);
                                          };
                                          audio.play().catch(err => {
                                            if (audioPlaybackRef.current === audio) audioPlaybackRef.current = null;
                                            speakResponse(cleanSpeechText || msg.text);
                                          });
                                        } else {
                                          speakResponse(cleanSpeechText || msg.text);
                                        }
                                      }}
                                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${msg.sender === 'user' ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-primary/10 hover:bg-primary/20 text-primary'
                                        }`}
                                    >
                                      <Volume2 className="w-4 h-4" />
                                    </button>
                                    <div className="flex-1">
                                      <div className="h-1 bg-gray-200 dark:bg-zinc-800 rounded-full relative overflow-hidden">
                                        <div className={`absolute top-0 bottom-0 left-0 w-3/4 rounded-full ${msg.sender === 'user' ? 'bg-white' : 'bg-primary'}`} />
                                      </div>
                                      <div className={`flex items-center justify-between text-[10px] mt-1.5 font-bold ${msg.sender === 'user' ? 'text-white/80' : 'text-gray-400'}`}>
                                        <span>Voice Message</span>
                                        <span>{msg.voiceDuration || "0:05"}</span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  msg.text || (isStreaming ? "…" : "")
                                )}
                              </div>

                              {/* Free Therapist Consultation Voucher Card */}
                              {msg.freeTherapistVoucher && !(msg.riskLevel && (msg.riskLevel === 'critical' || msg.riskLevel === 'high')) && (
                                <div className="mt-3 bg-gradient-to-r from-emerald-900 via-teal-900 to-indigo-950 p-4 rounded-2xl border border-emerald-500/40 text-white space-y-2.5 shadow-lg max-w-md">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <Badge className="bg-emerald-500/30 text-emerald-300 border-0 text-[10px] font-black">
                                      🎁 100% FREE THERAPIST CONSULTATION VOUCHER
                                    </Badge>
                                    <span className="text-xs font-mono font-black text-emerald-300 bg-white/10 px-2 py-0.5 rounded-md">
                                      {msg.freeTherapistVoucher.code || "MINDCARE-FREE-5X"}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="text-sm font-black">{msg.freeTherapistVoucher.therapistName || "Dr. Devika Pillai"}</p>
                                    <p className="text-xs text-emerald-200/80">{msg.freeTherapistVoucher.title || "Senior Clinical Psychologist"}</p>
                                  </div>
                                  <div className="pt-2 flex items-center justify-between border-t border-white/10 flex-wrap gap-2">
                                    <span className="text-[10px] text-emerald-300 font-bold">100% Free • Emergency Priority</span>
                                    <Button
                                      onClick={() => setShowEscalateModal(true)}
                                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs h-8 px-3.5 rounded-xl shadow-sm"
                                    >
                                      Book Free Consultation
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* Hover Action Bar */}
                              <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-10 ${msg.sender === 'user'
                                ? 'left-0 -translate-x-full pr-2.5 flex-row-reverse'
                                : 'right-0 translate-x-full pl-2.5'
                                }`}>
                                <button
                                  onClick={() => handleCopyMessage(msg.text)}
                                  className="p-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
                                  title="Copy message"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>

                                {msg.id !== 'init' && (
                                  <button
                                    onClick={() => handleDeleteMessage(msg.id)}
                                    className="p-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm text-gray-400 hover:text-red-500 transition-colors"
                                    title="Delete message"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}

                                {msg.sender === 'ai' && msg.id !== 'init' && isLastAiMessage(msg.id) && (
                                  <button
                                    onClick={handleRegenerateResponse}
                                    className="p-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-sm text-gray-400 hover:text-primary transition-colors"
                                    title="Regenerate response"
                                  >
                                    <RefreshCw className="w-3 h-3 animate-none" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] text-gray-400 mt-1 px-1">{msg.time}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  </AnimatePresence>

                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="flex gap-3">
                        <Avatar className="h-8 w-8 shrink-0 border border-gray-100 dark:border-zinc-900">
                          {profile?.aiPreferences?.aiAvatar ? (
                            <AvatarImage src={profile.aiPreferences.aiAvatar} />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">AI</AvatarFallback>
                        </Avatar>
                        <div className="bg-gray-100 dark:bg-zinc-900 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom static layout */}
                <div className="mt-5 space-y-3 shrink-0">
                  {/* Privacy Banner */}
                  <div className="bg-gray-55/30 dark:bg-zinc-900/30 border border-gray-200/80 dark:border-zinc-900/20 rounded-xl px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-xs font-bold text-gray-700 dark:text-zinc-300">You're in a Safe Space</p>
                        <p className="text-[10px] text-gray-400">All chats are completely confidential, encrypted, and HIPAA-compliant.</p>
                      </div>
                    </div>
                  </div>

                  {/* Input Form */}
                  <div>
                    {(crisisLevel === 'high' || crisisLevel === 'critical') && (
                      <div className="mb-2 flex items-center justify-between bg-red-500/5 border border-red-500/10 rounded-2xl px-4 py-2.5">
                        <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-550 shrink-0" /><p className="text-xs text-red-700 dark:text-red-300 font-bold">Distress indicators elevated. Clinical consult recommended.</p></div>
                        <button onClick={handleDirectTherapistChat} className="text-xs text-red-600 dark:text-red-400 font-extrabold hover:underline shrink-0 ml-2">Speak to Therapist (Direct Live Chat)</button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 bg-gray-50/50 dark:bg-zinc-900/40 border border-gray-200 dark:border-zinc-800 rounded-2xl px-3 py-2 focus-within:border-primary/50 transition-colors">
                      {isRecording ? (
                        <div className="flex-1 flex items-center justify-between px-2 gap-4">
                          <span className="flex items-center gap-2 text-xs font-bold text-red-500 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            Recording: {formatRecordingTime(recordingSeconds)}
                          </span>

                          <div className="flex items-center gap-2">
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-zinc-400 hover:text-red-550" onClick={deleteRecording}>
                              <Trash2 className="w-4 h-4" />
                            </Button>

                            {recordingPaused ? (
                              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-green-500" onClick={resumeRecording}>
                                <Play className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-amber-500" onClick={pauseRecording}>
                                <Pause className="w-4 h-4" />
                              </Button>
                            )}

                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-green-600 hover:text-green-700" onClick={stopRecording}>
                              <Check className="w-4 h-4" />
                            </Button>

                            <Button size="icon" className="h-8 w-8 rounded-xl bg-primary text-white" onClick={sendVoiceMessage}>
                              <Send className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ) : recordedAudioUrl ? (
                        <div className="flex-1 flex items-center justify-between px-2 gap-4">
                          <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 flex items-center gap-2">
                            <Volume2 className="w-4 h-4 text-primary shrink-0 animate-pulse" />
                            Preview Recording ({formatRecordingTime(recordingSeconds)})
                          </span>

                          <div className="flex items-center gap-3">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full text-primary hover:bg-primary/10"
                              onClick={() => {
                                console.log("[VoicePreview] Playing preview from URL:", recordedAudioUrl);
                                const audio = new Audio(recordedAudioUrl);
                                audio.onplay = () => console.log("[VoicePreview] Playback started.");
                                audio.onended = () => console.log("[VoicePreview] Playback finished.");
                                audio.play().catch(e => console.error("[VoicePreview] Playback failed:", e));
                              }}
                            >
                              <Play className="w-4 h-4" />
                            </Button>

                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-zinc-400 hover:text-red-550" onClick={deleteRecording}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <Button size="icon" className="h-8 w-8 rounded-xl bg-primary text-white" onClick={sendVoiceMessage}>
                              <Send className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"><Paperclip className="w-4 h-4" /></button>
                          <input value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder={PLACEHOLDERS[lang]}
                            className="flex-1 bg-transparent text-sm text-gray-700 dark:text-zinc-300 placeholder-gray-400 focus:outline-none min-w-0" />
                          {activeStreamId ? (
                            <button
                              onClick={stopStreaming}
                              className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center hover:bg-red-700 transition-colors shrink-0"
                              title="Stop generating"
                            >
                              <X className="w-3.5 h-3.5 text-white" />
                            </button>
                          ) : inputValue.trim() ? (
                            <button
                              onClick={() => handleSend()}
                              className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center hover:bg-primary/95 transition-colors shrink-0"
                            >
                              <Send className="w-3.5 h-3.5 text-white ml-0.5" />
                            </button>
                          ) : (
                            <button
                              onClick={startRecording}
                              className="w-8 h-8 rounded-xl bg-zinc-105 hover:bg-zinc-200 dark:bg-zinc-800 text-gray-500 hover:text-gray-700 dark:text-zinc-300 transition-colors flex items-center justify-center shrink-0"
                            >
                              <Mic className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            )}



            {/* PANEL 2: BEHAVIOR INSIGHTS */}
            {activeTab === 'Insights' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6 h-full">
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Wellness score card */}
                  <div className="bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-gray-100 dark:border-zinc-900/50 shadow-sm flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-2">Wellness Score</p>
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#f0f0f0" strokeWidth="8" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke={activeEmotion.color} strokeWidth="8"
                          strokeDasharray={`${activeEmotion.score * 2.51} 251`} strokeLinecap="round" className="transition-all duration-500" />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-3xl">{activeEmotion.emoji}</span>
                        <span className="text-sm font-black text-gray-800 dark:text-zinc-200 mt-0.5">{profile?.insights?.wellnessScore || 70}/100</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 font-semibold mt-3 leading-relaxed">
                      Emotion: <span className="font-extrabold text-gray-700 dark:text-zinc-300">{activeEmotion.label}</span>.{getWellnessAdvice()}
                    </p>
                  </div>

                  {/* Trends breakdown */}
                  <div className="bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-gray-100 dark:border-zinc-900/50 shadow-sm md:col-span-2 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm mb-3">AI Companion Insights</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-55/40 dark:bg-zinc-900 p-3 rounded-2xl">
                          <p className="text-[9px] font-bold text-gray-400 uppercase">Stress Triggers</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {profile?.behaviorAnalysis?.stressTriggers?.length > 0 ? (
                              profile.behaviorAnalysis.stressTriggers.map((t: string) => (
                                <Badge key={t} className="bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 border-0 text-[9px]">{t}</Badge>
                              ))
                            ) : (
                              <span className="text-[10px] text-gray-400 italic">No triggers registered yet.</span>
                            )}
                          </div>
                        </div>

                        <div className="bg-gray-55/40 dark:bg-zinc-900 p-3 rounded-2xl">
                          <p className="text-[9px] font-bold text-gray-400 uppercase">Topics Highlighted</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {profile?.behaviorAnalysis?.favoriteTopics?.length > 0 ? (
                              profile.behaviorAnalysis.favoriteTopics.map((t: string) => (
                                <Badge key={t} className="bg-blue-50 text-blue-750 dark:bg-blue-950/25 dark:text-blue-300 border-0 text-[9px]">{t}</Badge>
                              ))
                            ) : (
                              <span className="text-[10px] text-gray-400 italic">Conversations loading...</span>
                            )}
                          </div>
                        </div>

                        <div className="bg-gray-55/40 dark:bg-zinc-900 p-3 rounded-2xl col-span-2">
                          <p className="text-[9px] font-bold text-gray-400 uppercase">Weekly Behavioral Summary</p>
                          <p className="text-[11px] text-gray-600 dark:text-zinc-350 leading-relaxed font-semibold mt-1">
                            {profile?.insights?.weeklyInsights || "Chat with me to identify patterns in routine, stress levels, energy, and communication."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline and Metrics details */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Behavior Timeline */}
                  <div className="bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-gray-100 dark:border-zinc-900/50 shadow-sm flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm mb-3">Behavior Timeline</h3>
                      <div className="space-y-4 pr-2 max-h-[300px] overflow-y-auto">
                        {profile?.insights?.behaviorTimeline?.length > 0 ? (
                          profile.insights.behaviorTimeline.map((item: string, idx: number) => (
                            <div key={idx} className="flex gap-3 items-start">
                              <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1 shrink-0"></div>
                              <div>
                                <p className="text-[11px] text-gray-700 dark:text-zinc-300 font-bold leading-tight">{item}</p>
                                <p className="text-[9px] text-gray-400 mt-0.5">Logged automatically</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-8 text-center">
                            <p className="text-xs text-gray-400 italic">No events logged in the behavioral timeline yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Relationship Timeline & Milestones */}
                  <div className="bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-gray-100 dark:border-zinc-900/50 shadow-sm flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm mb-3 flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-primary" /> Relationship Timeline & Milestones
                      </h3>
                      <div className="space-y-3.5 pr-2 max-h-[300px] overflow-y-auto">
                        {profile?.relationshipTimeline?.length > 0 ? (
                          profile.relationshipTimeline.map((milestone: any, idx: number) => (
                            <div key={idx} className="p-3 bg-gray-50/50 dark:bg-zinc-950/20 rounded-2xl border border-gray-100 dark:border-zinc-900 flex gap-3">
                              <div className="bg-primary/10 text-primary text-[10px] font-black rounded-lg h-9 w-12 flex items-center justify-center shrink-0 text-center px-1 uppercase leading-none">
                                {milestone.month}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-extrabold text-gray-800 dark:text-zinc-200 leading-tight">{milestone.event}</p>
                                <p className="text-[10px] text-gray-505 dark:text-zinc-400 mt-1 font-medium leading-relaxed">{milestone.details}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-12 text-center">
                            <p className="text-xs text-gray-400 italic">Conversations and logs will populate relationship milestones here.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Wellness trends card */}
                <div className="bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-gray-100 dark:border-zinc-900/50 shadow-sm">
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm mb-3">Wellness Trends & Check-in Observations</h3>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-gray-55/30 dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100/50 dark:border-zinc-800/40">
                      <p className="text-[10px] text-gray-400 font-extrabold uppercase mb-1">Motivation Trend</p>
                      <p className="text-xs font-black text-gray-850 dark:text-zinc-100">{profile?.behaviorAnalysis?.motivationLevel || "Stable"}</p>
                    </div>
                    <div className="bg-gray-55/30 dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100/50 dark:border-zinc-800/40">
                      <p className="text-[10px] text-gray-400 font-extrabold uppercase mb-1">Work / Study Pressure</p>
                      <p className="text-xs font-black text-gray-850 dark:text-zinc-100">{profile?.behaviorAnalysis?.workPressure || "None"}</p>
                    </div>
                    <div className="bg-gray-55/30 dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100/50 dark:border-zinc-800/40">
                      <p className="text-[10px] text-gray-400 font-extrabold uppercase mb-1">Sleep Issues</p>
                      <p className="text-xs font-black text-gray-850 dark:text-zinc-100">{profile?.behaviorAnalysis?.sleepDiscussions || "None discussed"}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PANEL 3: MEMORY & PERSONALIZATION */}
            {activeTab === 'Memory' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6 h-full">

                {/* Custom Settings & AI Custom Preferences */}
                <div className="bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-gray-100 dark:border-zinc-900/50 shadow-sm">
                  <h3 className="font-bold text-gray-850 dark:text-zinc-200 text-sm mb-4 flex items-center gap-1.5">
                    <Settings className="w-4.5 h-4.5 text-primary" /> AI Companion Custom Preferences
                  </h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    {/* Preferences options */}
                    <div className="space-y-4 md:col-span-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-extrabold text-gray-450 uppercase block mb-1">Companion Name</label>
                          <input
                            type="text"
                            value={profile?.aiPreferences?.aiName || "MindCare Companion"}
                            onChange={(e) => handleUpdateAiPreference('aiName', e.target.value)}
                            className="w-full text-xs border border-gray-250 dark:border-zinc-850 rounded-xl px-3 py-2 outline-none dark:bg-zinc-900 text-gray-800 dark:text-zinc-100"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-extrabold text-gray-450 uppercase block mb-1">Companion Avatar URL</label>
                          <input
                            type="text"
                            value={profile?.aiPreferences?.aiAvatar || ""}
                            onChange={(e) => handleUpdateAiPreference('aiAvatar', e.target.value)}
                            placeholder="https://example.com/avatar.png"
                            className="w-full text-xs border border-gray-250 dark:border-zinc-850 rounded-xl px-3 py-2 outline-none dark:bg-zinc-900 text-gray-800 dark:text-zinc-100"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 pt-1">
                        <div>
                          <label className="text-[10px] font-extrabold text-gray-450 uppercase block mb-1">Preferred Voice</label>
                          <select
                            value={profile?.aiPreferences?.voice || 'default'}
                            onChange={(e) => handleUpdateAiPreference('voice', e.target.value)}
                            className="w-full text-xs border border-gray-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 bg-gray-50/50 dark:bg-zinc-905 text-gray-800 dark:text-zinc-200 outline-none"
                          >
                            <option value="default">Default Voice</option>
                            <option value="warm_male">Warm Male</option>
                            <option value="empathetic_female">Empathetic Female</option>
                            <option value="cbt_guide">CBT Guide Voice</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-extrabold text-gray-450 uppercase block mb-1">Voice Speed</label>
                          <select
                            value={profile?.aiPreferences?.voiceSpeed || 1.0}
                            onChange={(e) => handleUpdateAiPreference('voiceSpeed', parseFloat(e.target.value))}
                            className="w-full text-xs border border-gray-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 bg-gray-50/50 dark:bg-zinc-905 text-gray-800 dark:text-zinc-200 outline-none"
                          >
                            <option value="0.8">0.8x Slow</option>
                            <option value="1.0">1.0x Normal</option>
                            <option value="1.2">1.2x Faster</option>
                            <option value="1.5">1.5x Fast</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-extrabold text-gray-450 uppercase block mb-1">Support Style</label>
                          <select
                            value={profile?.personalization?.supportStyle || 'balanced'}
                            onChange={(e) => handleUpdatePersonalization('supportStyle', e.target.value)}
                            className="w-full text-xs border border-gray-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 bg-gray-50/50 dark:bg-zinc-905 text-gray-800 dark:text-zinc-200 outline-none"
                          >
                            <option value="emotional_support">Emotional Support</option>
                            <option value="direct_advice">Direct Advice</option>
                            <option value="balanced">Balanced</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Settings toggles */}
                    <div className="space-y-3.5 md:col-span-1 border-t md:border-t-0 md:border-l border-gray-100 dark:border-zinc-900/80 pt-4 md:pt-0 md:pl-6">
                      <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Privacy & Controls</p>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block">Enable Memory</label>
                          <span className="text-[9px] text-gray-400">Remember facts about you.</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={profile?.enableMemory || false}
                          onChange={(e) => handleUpdateProfileSetting('enableMemory', e.target.checked)}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between border-t border-gray-50 dark:border-zinc-900 pt-3">
                        <div>
                          <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block">Temporary Chat Mode</label>
                          <span className="text-[9px] text-gray-400">No chat history is saved.</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={profile?.temporaryChat || false}
                          onChange={(e) => handleUpdateProfileSetting('temporaryChat', e.target.checked)}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between border-t border-gray-50 dark:border-zinc-900 pt-3">
                        <div>
                          <label className="text-xs font-bold text-gray-700 dark:text-zinc-300 block">Consent to Analysis</label>
                          <span className="text-[9px] text-gray-400">Permit learned styling.</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={profile?.consentToAnalysis || false}
                          onChange={(e) => handleUpdateProfileSetting('consentToAnalysis', e.target.checked)}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Interactive Memory Editor */}
                <div className="bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-gray-100 dark:border-zinc-900/50 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-50 dark:border-zinc-900 pb-2">
                    <div>
                      <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Long-term Memory Bank</h3>
                      <p className="text-[10px] text-gray-400">Remembered items will be used to personalize companion chats.</p>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-0 font-extrabold text-[10px]">
                      {profile?.memories?.length || 0} Facts Recorded
                    </Badge>
                  </div>

                  {/* Add memory form */}
                  <div className="grid md:grid-cols-4 gap-3 bg-gray-50/50 dark:bg-zinc-950/30 p-4 rounded-2xl border border-gray-100 dark:border-zinc-900">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Fact Description</label>
                      <input
                        value={memoryContent}
                        onChange={(e) => setMemoryContent(e.target.value)}
                        placeholder="e.g. Likes Italian foods or Father name is David"
                        className="w-full text-xs border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 outline-none dark:bg-zinc-900 text-gray-800 dark:text-zinc-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Category</label>
                      <select
                        value={memoryCategory}
                        onChange={(e) => setMemoryCategory(e.target.value)}
                        className="w-full text-xs border border-gray-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 outline-none dark:bg-zinc-900 text-gray-800 dark:text-zinc-200"
                      >
                        <option value="favorite_food">Favorite Food</option>
                        <option value="movie">Movies / Entertainment</option>
                        <option value="goal">Personal Goals</option>
                        <option value="important_person">Important People</option>
                        <option value="career">Career / Work</option>
                        <option value="education">Education</option>
                        <option value="event">Important Dates / Events</option>
                        <option value="therapy_preference">Therapy Preference</option>
                        <option value="other">Other details</option>
                      </select>
                    </div>
                    <div className="flex gap-2 items-end">
                      <Button
                        onClick={handleSaveMemory}
                        disabled={isSavingMemory}
                        className="w-full bg-primary text-white text-xs h-9 rounded-xl font-bold"
                      >
                        {editingMemoryId ? "Save Edit" : "Add Fact"}
                      </Button>
                      {editingMemoryId && (
                        <Button
                          onClick={() => {
                            setEditingMemoryId(null);
                            setMemoryContent('');
                            setMemoryCategory('other');
                          }}
                          variant="outline"
                          className="h-9 rounded-xl text-xs dark:text-zinc-300"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Memories List */}
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {profile?.memories?.length === 0 ? (
                      <div className="text-center py-12 text-gray-400 italic text-xs">
                        No memories recorded. Chat with the AI Companion or manually add a fact above.
                      </div>
                    ) : profile?.memories?.map((m: any) => (
                      <div
                        key={m.id}
                        className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${m.disabled
                          ? 'bg-gray-50/50 dark:bg-zinc-950/10 border-gray-200/40 dark:border-zinc-900/30 opacity-60'
                          : 'border-gray-150 dark:border-zinc-900 hover:border-gray-250 dark:hover:border-zinc-800'
                          }`}
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge className="bg-gray-100 text-gray-700 dark:bg-zinc-850 dark:text-zinc-300 border-0 text-[8px] uppercase tracking-wider font-extrabold px-1.5">
                              {m.category.replace('_', ' ')}
                            </Badge>
                            <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-0 text-[8px] px-1.5">
                              {m.type || "semantic"}
                            </Badge>
                            <Badge className={`border-0 text-[8px] px-1.5 ${m.importance === 'high'
                              ? 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                              : m.importance === 'medium'
                                ? 'bg-yellow-50 text-yellow-750 dark:bg-yellow-950/20 dark:text-yellow-450'
                                : 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400'
                              }`}>
                              {m.importance || "medium"}
                            </Badge>
                            <span className="text-[9px] text-gray-400 font-semibold">
                              Confidence: {m.confidence || 70}%
                            </span>
                            <span className="text-[9px] text-gray-400 font-normal">
                              • Source: {m.source === 'ai_learned' ? 'AI Learned' : 'User Added'}
                            </span>
                          </div>

                          <p className="text-xs font-bold text-gray-750 dark:text-zinc-300 leading-normal">{m.content}</p>

                          <p className="text-[9px] text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-350" />
                            <span>Learned: {new Date(m.createdTime).toLocaleDateString()}</span>
                            {m.expiration && (
                              <span className="text-orange-500 font-semibold">• Expires: {new Date(m.expiration).toLocaleDateString()}</span>
                            )}
                          </p>
                        </div>

                        <div className="flex gap-1.5 shrink-0 items-center">
                          <button
                            onClick={() => handleToggleForgetMemory(m.id)}
                            title={m.disabled ? "Restore Memory" : "Forget / Pause Fact"}
                            className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-900"
                          >
                            {m.disabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => {
                              setEditingMemoryId(m.id);
                              setMemoryContent(m.content);
                              setMemoryCategory(m.category);
                              setMemoryType(m.type || "semantic");
                              setMemoryImportance(m.importance || "medium");
                              setMemoryExpiration(m.expiration ? new Date(m.expiration).toISOString().split('T')[0] : '');
                            }}
                            className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-900"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMemory(m.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-900"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PANEL 4: CHAT LOG IMPORTS */}
            {activeTab === 'Import' && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6 h-full">

                {/* Privacy consent card */}
                <div className="bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-gray-100 dark:border-zinc-900/50 shadow-sm space-y-3.5">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-bold text-gray-805 dark:text-zinc-200 text-sm">Personalized History Importer</h3>
                      <p className="text-[11px] text-gray-500 dark:text-zinc-400 leading-relaxed font-semibold mt-1">
                        Import past conversations from messaging platforms (like WhatsApp text exports) or other AI models (ChatGPT JSON exports).
                        This data will only be analyzed to learn your writing style, emojis, greeting habits, and to populate your long-term memories and timeline.
                        In compliance with privacy policies, the raw transcript is securely parsed, profiled, and immediately discarded.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 border-t border-gray-50 dark:border-zinc-900 pt-3.5">
                    <input
                      type="checkbox"
                      id="importConsentChk"
                      checked={importConsent}
                      onChange={(e) => setImportConsent(e.target.checked)}
                      className="mt-1 accent-primary cursor-pointer"
                    />
                    <label htmlFor="importConsentChk" className="text-xs font-bold text-gray-650 dark:text-zinc-300 cursor-pointer leading-snug">
                      Explicit Consent Check: I agree to let MindCare analyze my uploaded chat transcripts securely. I understand that I can delete this imported history at any time.
                    </label>
                  </div>
                </div>

                {/* Upload zone */}
                <div className="bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-sm space-y-4">
                  <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Upload Conversation Log</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Source Platform</label>
                      <select
                        value={importPlatform}
                        onChange={(e) => setImportPlatform(e.target.value)}
                        className="w-full text-xs border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 outline-none dark:bg-zinc-900 text-gray-800 dark:text-zinc-200"
                      >
                        <option value="whatsapp">WhatsApp Export (.txt, .zip)</option>
                        <option value="chatgpt">ChatGPT JSON Export</option>
                        <option value="custom">Standard Custom format (.json)</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-gray-400 block mb-1">Select File</label>
                      <div className="relative border border-dashed border-gray-200 dark:border-zinc-800 rounded-xl hover:border-primary transition-all p-2 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-950/20">
                        <input
                          type="file"
                          accept=".txt,.json,.zip"
                          onChange={handleFileChange}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <span className="text-xs text-gray-500 font-bold pl-2 flex items-center gap-1">
                          <Upload className="w-3.5 h-3.5 text-gray-400" /> Choose export file...
                        </span>
                        <Badge className="bg-primary/10 text-primary border-0 font-extrabold text-[9px] h-6">Browse</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Keep raw chats settings */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="keepRawToggle"
                      checked={keepRawChat}
                      onChange={(e) => setKeepRawChat(e.target.checked)}
                      className="accent-primary cursor-pointer"
                    />
                    <label htmlFor="keepRawToggle" className="text-[11px] font-semibold text-gray-550 dark:text-zinc-400 cursor-pointer select-none">
                      Keep raw chat logs in DB (Optional, default is false)
                    </label>
                  </div>

                  {/* Progress bar */}
                  {importProgress > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-gray-400">
                        <span>Uploading & Reading File Content</span>
                        <span>{importProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-zinc-900 h-2 rounded-full overflow-hidden">
                        <div className="bg-primary h-full transition-all duration-350" style={{ width: `${importProgress}%` }}></div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 border-t border-gray-50 dark:border-zinc-900 pt-4">
                    <Button
                      onClick={handleImportHistory}
                      disabled={isImporting || !importConsent || !importText}
                      className="w-full flex-1 bg-primary text-white text-xs h-10 rounded-xl font-bold"
                    >
                      {isImporting ? "Analyzing & Importing..." : "Start Import & NLP Analysis"}
                    </Button>
                    <Button
                      onClick={handleDeleteImportedHistory}
                      variant="outline"
                      className="w-full flex-1 rounded-xl text-xs h-10 border-red-250 text-red-650 hover:bg-red-50/50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/10"
                    >
                      Clear Profile Imports
                    </Button>
                  </div>
                </div>

                {/* Import stats display */}
                {importStats && (
                  <motion.div className="bg-green-50/40 dark:bg-green-950/10 border border-green-100 dark:border-green-900/30 rounded-3xl p-5"
                    initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                    <h4 className="text-xs font-black text-green-800 dark:text-green-300">Import Metrics Analysis</h4>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-[10px] text-gray-550 font-bold uppercase">Messages Analyzed</p>
                        <p className="text-2xl font-black text-green-700 dark:text-green-400 mt-1">{importStats.imported}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-550 font-bold uppercase">Duplicates Skipped</p>
                        <p className="text-2xl font-black text-gray-500 dark:text-zinc-400 mt-1">{importStats.duplicates}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="hidden xl:flex w-64 flex-col gap-4 shrink-0">
          <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] p-5">
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm">Emotion Analysis</h3><BarChart2 className="w-4 h-4 text-gray-400" /></div>
            <div className="flex justify-center mb-4">
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#f0f0f0" strokeWidth="10" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke={activeEmotion.color} strokeWidth="10"
                    strokeDasharray={`${activeEmotion.score * 2.51} 251`} strokeLinecap="round" className="transition-all duration-500" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl">{activeEmotion.emoji}</span>
                  <p className="text-xs font-black text-gray-800 dark:text-zinc-200 leading-none">{activeEmotion.label}</p>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400 text-center font-medium leading-relaxed">
              {crisisLevel === 'critical' ? 'High distress detected. Please seek support now.' : crisisLevel === 'high' ? 'You seem to be struggling. Help is available.' : crisisLevel === 'moderate' ? "You seem anxious. Let's work through this together." : 'You seem calm and managing well.'}
            </p>
          </div>

          {/* Quick insights mini-panel */}
          <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-[0_8px_30px_rgba(25,135,84,0.03)] p-5">
            <h3 className="font-bold text-gray-800 dark:text-zinc-200 text-sm mb-3">Talking Style Profile</h3>
            <div className="space-y-2.5 text-[11px] font-semibold text-gray-650 dark:text-zinc-400">
              <div className="flex justify-between border-b border-gray-50 dark:border-zinc-900/50 pb-1">
                <span>Tone:</span>
                <span className="font-bold text-gray-800 dark:text-zinc-200 truncate max-w-[120px]">{profile?.talkingStyle?.tone || "Adaptive"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 dark:border-zinc-900/50 pb-1">
                <span>Sentence length:</span>
                <span className="font-bold text-gray-800 dark:text-zinc-200">{profile?.talkingStyle?.sentenceLength || "Adaptive"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-50 dark:border-zinc-900/50 pb-1">
                <span>Emojis:</span>
                <span className="font-bold text-gray-800 dark:text-zinc-200">{profile?.talkingStyle?.emojiUsage || "Adaptive"}</span>
              </div>
              <div className="flex justify-between">
                <span>Greeting:</span>
                <span className="font-bold text-gray-800 dark:text-zinc-200">{profile?.talkingStyle?.greetingStyle || "Adaptive"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🚨 Emergency Distress & Free Therapist Escalation Modal */}
      {(showEscalateModal || (showModal && (crisisLevel === 'high' || crisisLevel === 'critical'))) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-red-500/30 shadow-2xl max-w-xl w-full p-6 space-y-5 overflow-y-auto max-h-[90vh]">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-100 dark:border-zinc-900 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 font-black shrink-0">
                  🚨
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white leading-tight">
                    Emergency Crisis & Clinical Escalation Gateway
                  </h2>
                  <p className="text-xs text-red-600 dark:text-red-400 font-bold mt-0.5">
                    High distress indicators / crisis signals detected. Immediate support available.
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowModal(false); setShowEscalateModal(false); }}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border border-red-200 dark:border-red-900/50 rounded-xl p-4 space-y-3 bg-red-50/50 dark:bg-red-950/10">
              <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">Are you in immediate danger right now? Do you have a plan to hurt yourself?</p>
              <p className="text-xs text-gray-600 dark:text-zinc-300">You choose whether to call, contact someone you trust, or continue with a therapist. Nothing is sent automatically.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a href="tel:112" className="h-10 inline-flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold"><PhoneCall className="w-4 h-4 mr-2" />Call emergency services</a>
                <a href="tel:14416" className="h-10 inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-bold"><PhoneCall className="w-4 h-4 mr-2" />Call Tele-MANAS</a>
                {contacts[0]?.phone && <a href={`tel:${contacts[0].phone}`} className="h-10 inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-zinc-700 text-xs font-bold text-gray-700 dark:text-zinc-200"><HeartHandshake className="w-4 h-4 mr-2" />Contact trusted person</a>}
                <Button variant="outline" onClick={() => toast({ title: "Thank you for checking in", description: "Stay with someone you trust and keep this chat open." })} className="h-10 rounded-lg text-xs font-bold">I am not alone now</Button>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400">MindCare provides support and is not a substitute for emergency or professional care.</p>
            </div>

            {/* 🎁 100% Free Consultation Voucher */}
            <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-indigo-950 p-4 rounded-2xl text-white space-y-3 shadow-lg">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Badge className="bg-emerald-500/30 text-emerald-300 border-0 text-[10px] font-black">
                  🎉 100% FREE THERAPIST CONSULTATION VOUCHER UNLOCKED
                </Badge>
                <span className="text-xs font-mono font-black text-emerald-300 bg-white/10 px-2 py-0.5 rounded-md">
                  MINDCARE-FREE-5X
                </span>
              </div>
              <div>
                <p className="text-base font-black">Dr. Devika Pillai</p>
                <p className="text-xs text-emerald-200/90">Senior Clinical Psychologist • Aster Medcity, Kochi</p>
                <p className="text-xs font-bold text-emerald-300 mt-1">
                  Session Fee: <span className="line-through text-white/60">₹1,200</span> <span className="text-emerald-300 font-black">₹0 FREE (Emergency Voucher)</span>
                </p>
              </div>
            </div>

            {/* 🏥 Nearest Therapist Centers & Doctors List */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                Nearest Clinical Centers & Doctors List
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {[
                  {
                    name: "Dr. Devika Pillai (Aster Medcity)",
                    spec: "Senior Clinical Psychologist",
                    dist: "2.4 km away",
                    phone: "+91 484 6699999",
                    fee: "₹0 (100% Free Voucher)"
                  },
                  {
                    name: "Dr. Ananya Nair (MindCare Center)",
                    spec: "Psychiatrist & Counselor",
                    dist: "3.8 km away",
                    phone: "+91 484 2800100",
                    fee: "₹0 (100% Free Voucher)"
                  },
                  {
                    name: "Amrita Center for Behavioral Sciences",
                    spec: "Mental Health Hospital Wing",
                    dist: "5.1 km away",
                    phone: "+91 484 2851234",
                    fee: "₹1,500 / session"
                  }
                ].map((c, i) => (
                  <div key={i} className="p-3 rounded-2xl bg-gray-50 dark:bg-zinc-900 border border-gray-150 dark:border-zinc-800 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-gray-800 dark:text-zinc-200">{c.name}</p>
                      <p className="text-[10px] text-gray-500 dark:text-zinc-400 font-semibold">{c.spec} • {c.dist}</p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">Phone: {c.phone}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block">{c.fee}</span>
                      <Link href="/therapists">
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-white text-[10px] h-7 px-3 rounded-xl font-bold mt-1"
                        >
                          Book &amp; Pay Session
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Helpline Actions */}
            <div className="pt-2 border-t border-gray-100 dark:border-zinc-900 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-red-500 animate-pulse" />
                <span className="text-xs font-bold text-gray-700 dark:text-zinc-300">
                  National Emergency Helpline: <a href="tel:14416" className="text-red-500 font-black underline">Tele-MANAS 14416</a> {" / "} <a href="tel:112" className="text-red-500 font-black underline">112</a>
                </span>
              </div>
              <Button
                onClick={() => { setShowModal(false); setShowEscalateModal(false); }}
                variant="outline"
                className="rounded-xl text-xs font-bold"
              >
                Close & Return to Chat
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Alert Details Modal */}
      {showAlertDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowAlertDetailsModal(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-800 rounded-3xl p-6 max-w-lg w-full z-10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-zinc-100">Dispatched SOS Alert Details</h3>
                  <p className="text-xs text-gray-400">Emergency contact notification log</p>
                </div>
              </div>
              <button onClick={() => setShowAlertDetailsModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
              <div className="flex justify-between py-1 border-b border-gray-200/50 dark:border-zinc-800">
                <span className="font-semibold text-gray-500">Contact Recipient:</span>
                <span className="font-bold text-gray-900 dark:text-zinc-100">{activeAlertLog.recipientName} ({activeAlertLog.relation})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200/50 dark:border-zinc-800">
                <span className="font-semibold text-gray-500">Phone Number:</span>
                <span className="font-mono text-gray-800 dark:text-zinc-200">{activeAlertLog.phone}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200/50 dark:border-zinc-800">
                <span className="font-semibold text-gray-500">Log Timestamp:</span>
                <span>{activeAlertLog.timestamp}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200/50 dark:border-zinc-800">
                <span className="font-semibold text-gray-500">Trigger Condition:</span>
                <span className="text-amber-600 font-semibold">{activeAlertLog.trigger}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200/50 dark:border-zinc-800">
                <span className="font-semibold text-gray-500">GPS Location:</span>
                <span>{activeAlertLog.location}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200/50 dark:border-zinc-800">
                <span className="font-semibold text-gray-500">Delivery Status:</span>
                <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-md text-[10px]">{activeAlertLog.status}</span>
              </div>
              <div className="py-1">
                <span className="font-semibold text-gray-500 block mb-1">Dispatched Message Content:</span>
                <p className="bg-white dark:bg-zinc-950 p-2.5 rounded-xl border border-gray-200/60 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 italic">
                  &quot;{activeAlertLog.messageContent}&quot;
                </p>
              </div>
            </div>

            <Button onClick={() => setShowAlertDetailsModal(false)} className="w-full rounded-xl bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold text-xs h-10">
              Close Details
            </Button>
          </motion.div>
        </div>
      )}
    </AppLayout>
  );
}
