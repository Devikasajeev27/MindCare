import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { TimeRangeSelect } from '@/components/TimeRangeSelect';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  Users, Calendar, Coins, Star, MessageSquare, Clock,
  AlertOctagon, FileText, BookOpen, ShieldCheck, ChevronRight, X, Sparkles, UserCheck,
  Search, Send, Trash2, Heart, Award, ArrowUpRight, IndianRupee, Download, Settings, Phone, Mail,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '@/context/CurrencyContext';
import { api } from '@/lib/api';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

const PIE_COLORS = ['#10b981', '#6366f1', '#3b82f6'];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: [0.25, 0.46, 0.45, 0.94] as const }
});

export default function TherapistDashboard() {
  const [location, setLocation] = useLocation();
  const { format } = useCurrency();
  const { toast } = useToast();
  let content: React.ReactNode = null;
  const [alerts, setAlerts] = useState<any[]>([]);
  const [statsData, setStatsData] = useState<any>(null);
  const [localSchedule, setLocalSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bioText, setBioText] = useState('');
  const [qualificationText, setQualificationText] = useState('');
  const [consultationFeeText, setConsultationFeeText] = useState('');
  const [specializationsText, setSpecializationsText] = useState('');
  const [activeResource, setActiveResource] = useState<any>(null);
  const [clinicalResources, setClinicalResources] = useState<any[]>([]);
  const [emergencyOnCall, setEmergencyOnCall] = useState(false);
  const [emergencyCases, setEmergencyCases] = useState<any[]>([]);

  // Search and Filter states
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [appointmentFilter, setAppointmentFilter] = useState<'all' | 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'cancelled' | 'expired'>('all');
  const [selectedWeekDay, setSelectedWeekDay] = useState<string>('All');
  const [analyticsTimeframe, setAnalyticsTimeframe] = useState<'7 Days' | '30 Days' | 'Quarterly' | 'Yearly'>('30 Days');
  
  // Interactive Chat states
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, any[]>>({});
  const [messageableAppointmentIds, setMessageableAppointmentIds] = useState<Record<string, string>>({});
  const [chatPatientNames, setChatPatientNames] = useState<Record<string, string>>({});
  const [typedMessage, setTypedMessage] = useState('');

  // Interactive Availability states
  const [weeklyAvailability, setWeeklyAvailability] = useState<Record<string, { active: boolean; hours: string }>>({
    Monday: { active: false, hours: "" }, Tuesday: { active: false, hours: "" },
    Wednesday: { active: false, hours: "" }, Thursday: { active: false, hours: "" },
    Friday: { active: false, hours: "" }, Saturday: { active: false, hours: "" },
    Sunday: { active: false, hours: "" }
  });

  // Helper to parse availability from MongoDB
  const parseAvailability = (avail: any): Record<string, { active: boolean; hours: string }> => {
    const defaultAvail: Record<string, { active: boolean; hours: string }> = {
      Monday: { active: false, hours: "" }, Tuesday: { active: false, hours: "" },
      Wednesday: { active: false, hours: "" }, Thursday: { active: false, hours: "" },
      Friday: { active: false, hours: "" }, Saturday: { active: false, hours: "" },
      Sunday: { active: false, hours: "" }
    };

    if (!avail) return defaultAvail;

    if (typeof avail === 'object' && !Array.isArray(avail)) {
      return { ...defaultAvail, ...avail };
    }

    if (typeof avail === 'string') {
      try {
        const parsed = JSON.parse(avail);
        if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
          return { ...defaultAvail, ...parsed };
        }
      } catch (_) {}

      if (avail.includes(":") || avail.includes("|")) {
        const newAvail = { ...defaultAvail };
        Object.keys(newAvail).forEach(day => {
          newAvail[day] = { active: false, hours: "" };
        });

        const parts = avail.split("|");
        parts.forEach((part: string) => {
          const [day, hours] = part.split(":").map(s => s.trim());
          if (day && newAvail[day]) {
            const isOff = hours ? (hours.toLowerCase().includes("off") || hours.toLowerCase().includes("closed")) : false;
            newAvail[day] = {
              active: !isOff,
              hours: hours || ""
            };
          }
        });
        return newAvail;
      }
    }

    return defaultAvail;
  };

  useEffect(() => {
    api.therapists.getDashboardStats(analyticsTimeframe)
      .then(res => { 
        setStatsData(res.stats); 
        setAlerts(res.stats.alerts || []);
        setLocalSchedule(res.stats.schedule || []);
        setBioText(res.stats.bio || '');
        setQualificationText(res.stats.qualification || '');
        setConsultationFeeText(res.stats.consultationFee ? String(res.stats.consultationFee) : '');
        setSpecializationsText(res.stats.specializations ? res.stats.specializations.join(', ') : '');
        setEmergencyOnCall(Boolean(res.stats.emergencyOnCall));
        
        if (res.stats.availability) {
          setWeeklyAvailability(parseAvailability(res.stats.availability));
        }

        // The conversation endpoint remains the authorization boundary.  Check
        // every appointment so an in-progress consultation is not accidentally
        // omitted from the clinician's inbox.
        Promise.all((res.stats.schedule || []).map(async (appointment: any) => ({ appointment, data: await api.appointments.getConversation(appointment._id) }))).then(conversations => {
          const msgMap: Record<string, any[]> = {};
          const appointmentMap: Record<string, string> = {};
          const patientNameMap: Record<string, string> = {};
          conversations.forEach(({ appointment, data }) => {
            // The API is authoritative: only paid, approved, unblocked
            // appointments can appear in the therapist's message channels.
            if (!data.messagingAllowed) return;
            const channelId = appointment._id;
            msgMap[channelId] = data.messages.map((message: any) => ({
              sender: String(message.senderId) === String(data.conversation.therapistId) ? 'therapist' : 'patient',
              text: message.text,
              time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }));
            appointmentMap[channelId] = appointment._id;
            patientNameMap[channelId] = appointment.name;
          });
          setChatMessages(msgMap);
          setMessageableAppointmentIds(appointmentMap);
          setChatPatientNames(patientNameMap);
          setLoading(false);
        }).catch(() => setLoading(false));
      })
      .catch(() => setLoading(false));
  }, [analyticsTimeframe]);

  useEffect(() => {
    api.therapists.getEmergencyCases().then(({ cases }) => setEmergencyCases(cases)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!location.endsWith('/resources')) return;
    api.resources.list().then(({ resources }) => setClinicalResources(resources)).catch(() => setClinicalResources([]));
  }, [location]);

  const currentTab = location.split('/').pop() || 'dashboard';

  const therapistName     = statsData?.therapistName     || 'Therapist';
  const therapistInitials = statsData?.therapistInitials || 'T';
  const therapistAvatar   = statsData?.therapistAvatar   || '';
  const schedule          = localSchedule;
  const todaySchedule     = statsData?.todaySchedule || [];
  const sessionData       = statsData?.sessionData || [];
  const sessionTypes = statsData?.sessionTypes || [];
  const recentMessages = statsData?.recentMessages || [];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // ─── HANDLERS ─────────────────────────────────────────────────────────────
  const handleResolveAlert = async (id: string) => {
    try {
      await api.admin.resolveEmergencyAlert(id, "Resolved by clinical provider from therapist dashboard.");
      setAlerts(prev => prev.filter(a => a._id !== id));
      toast({
        title: "Alert Resolved",
        description: "The emergency alert has been successfully marked as resolved.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Action Failed",
        description: err.message || "Failed to resolve emergency alert.",
      });
    }
  };

  const handleEmergencyOnCall = async (onCall: boolean) => {
    try {
      await api.therapists.updateEmergencyOnCall(onCall);
      setEmergencyOnCall(onCall);
      toast({ title: onCall ? "Emergency on-call enabled" : "Emergency on-call disabled", description: onCall ? "You can now receive one emergency offer at a time." : "You will not receive new emergency offers." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not update emergency duty", description: err.message || "Please try again." });
    }
  };

  const respondToEmergencyCase = async (caseId: string, accept: boolean) => {
    try {
      await (accept ? api.therapists.acceptEmergencyCase(caseId) : api.therapists.declineEmergencyCase(caseId));
      setEmergencyCases(prev => prev.filter(item => item._id !== caseId));
      toast({ title: accept ? "Emergency case accepted" : "Emergency case reassigned", description: accept ? "The support session is now active." : "The case was offered to the next eligible on-call therapist." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Emergency response unavailable", description: err.message || "This offer may have expired." });
    }
  };

  const handleSaveSettings = async () => {
    try {
      const splitSpecs = specializationsText.split(',').map(s => s.trim()).filter(Boolean);
      await api.auth.updateProfile({ 
        bio: bioText,
        qualification: qualificationText,
        consultationFee: Number(consultationFeeText),
        specializations: splitSpecs
      });

      setStatsData((prev: any) => prev ? {
        ...prev,
        bio: bioText,
        qualification: qualificationText,
        consultationFee: Number(consultationFeeText),
        specializations: splitSpecs
      } : null);

      toast({
        title: "Settings Saved",
        description: "Your professional profile details have been updated successfully.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err.message || "Failed to update professional settings.",
      });
    }
  };

  const handleSendMessage = async () => {
    const activeName = activeChatUserId && messageableAppointmentIds[activeChatUserId]
      ? activeChatUserId
      : Object.keys(messageableAppointmentIds)[0];
    const appointmentId = activeName ? messageableAppointmentIds[activeName] : undefined;
    if (!typedMessage.trim() || !activeName || !appointmentId) {
      toast({ variant: 'destructive', title: 'Messaging unavailable', description: 'Select a patient with an approved and paid appointment to send a message.' });
      return;
    }

    const therapistText = typedMessage.trim();
    setTypedMessage('');

    try {
      const { message } = await api.appointments.sendMessage(appointmentId, therapistText);
      setChatMessages(prev => ({
        ...prev,
        [activeName]: [...(prev[activeName] || []), {
          sender: 'therapist', text: message.text,
          time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]
      }));
    } catch (error: any) {
      setTypedMessage(therapistText);
      toast({ variant: 'destructive', title: 'Message not sent', description: error.message || 'Please try again.' });
    }
  };

  const handleUpdateAvailability = async () => {
    try {
      // Persist structured weekly availability object into MongoDB
      await api.therapists.updateAvailability(weeklyAvailability);
      
      const activeShifts = Object.entries(weeklyAvailability)
        .filter(([_, data]) => data.active)
        .map(([day, data]) => `${day}: ${data.hours}`);
      
      const availabilityString = activeShifts.length > 0 ? activeShifts.join(" | ") : "Unavailable";
      
      setStatsData((prev: any) => prev ? { ...prev, availability: JSON.stringify(weeklyAvailability) } : null);
      
      toast({
        title: "Availability Schedule Saved",
        description: "Your shift hours have been permanently updated in MongoDB.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: err.message || "Failed to update availability shifts.",
      });
    }
  };



  const handleCancelSession = (idx: number) => {
    setLocalSchedule(prev => prev.map((s, i) => i === idx ? { ...s, status: 'cancelled' } : s));
    toast({
      title: "Session Cancelled",
      description: "The patient has been notified of the cancellation, and a refund has been initiated.",
    });
  };

  const handleDownloadInvoice = (s: any, i: number) => {
    const invoiceNum = 1000 + i;
    const cleanName = (s.name || '').replace(/[()]/g, '');
    const cleanType = (s.type || '').replace(/[()]/g, '');
    const cleanDuration = (s.duration || '').replace(/[()]/g, '');
    const cleanTime = (s.time || '').replace(/[()]/g, '');
    
    // Strip the raw rupee symbol to draw it as a clean PDF vector to avoid font corruption
    const rawFeeDigits = format(s.fee).replace(/[^0-9.,]/g, '').trim();
    const dateStr = new Date().toLocaleDateString();

    const pdfLines = [
      '%PDF-1.4',
      '1 0 obj',
      '<< /Type /Catalog /Pages 2 0 R >>',
      'endobj',
      '2 0 obj',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      'endobj',
      '3 0 obj',
      '<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 595 842] /Contents 5 0 R >>',
      'endobj',
      '4 0 obj',
      '<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >>',
      'endobj',
      '5 0 obj',
      '<< /Length 2000 >>',
      'stream',
      // Outer border vector outline
      '0.93 0.93 0.93 RG',
      '1.5 w',
      '40 40 515 762 re',
      'S',
      // Logo box container (Rounded light emerald background: bg-primary/10)
      '0.90 0.96 0.92 rg',
      '70 738 38 38 re',
      'f',
      '0.80 0.90 0.83 RG',
      '1 w',
      '70 738 38 38 re',
      'S',
      // Precise Lucide Brain Icon vector drawing inside box
      '0.16 0.52 0.29 RG',
      '1.6 w',
      // Left Brain Hemisphere
      '89 766 m 83 766 77 761 77 755 c 77 750 81 747 84 747 c 87 747 89 750 89 753 c S',
      '82 763 m 85 759 81 753 78 753 c S',
      // Right Brain Hemisphere
      '91 766 m 97 766 103 761 103 755 c 103 750 99 747 96 747 c 93 747 91 750 91 753 c S',
      '98 763 m 95 759 99 753 102 753 c S',
      // Brain Central Stem & Neural Folds
      '89 766 m 89 746 91 746 91 766 c S',
      '85 755 m 95 755 l S',
      // MindCare Brand Typography (Mind + Care)
      'BT',
      '/F2 20 Tf',
      '0.07 0.09 0.15 rg',
      '118 758 Td',
      '(Mind) Tj',
      'ET',
      'BT',
      '/F2 20 Tf',
      '0.16 0.52 0.29 rg',
      '168 758 Td',
      '(Care) Tj',
      'ET',
      // Subtitle tagline
      'BT',
      '/F1 8.5 Tf',
      '0.55 0.55 0.55 rg',
      '118 745 Td',
      '(AI-Powered Mental Wellness) Tj',
      'ET',
      // Header Divider Line
      '0.9 0.9 0.9 RG',
      '1 w',
      '60 722 m',
      '535 722 l',
      'S',
      // Metadata Details
      'BT',
      '/F2 10 Tf',
      '0.2 0.2 0.2 rg',
      '60 696 Td',
      `(Invoice: MC-${invoiceNum}) Tj`,
      'ET',
      'BT',
      '/F1 9.5 Tf',
      '0.4 0.4 0.4 rg',
      '240 696 Td',
      `(Issued: ${dateStr}) Tj`,
      'ET',
      'BT',
      '/F2 9.5 Tf',
      '0.1 0.6 0.1 rg',
      '420 696 Td',
      '(Status: Settled & Paid) Tj',
      'ET',
      // Section 1: Case details Box
      '0.92 0.92 0.92 RG',
      '0.98 0.99 1.0 rg',
      '60 540 475 130 re',
      'B',
      // Case Title
      'BT',
      '/F2 11 Tf',
      '0.09 0.44 0.82 rg',
      '75 650 Td',
      '(1. CONSULTATION CASE DETAILS) Tj',
      'ET',
      // Case details body
      'BT',
      '/F1 9.5 Tf',
      '0.3 0.3 0.3 rg',
      '75 628 Td',
      '17 TL',
      `(Patient Name:          ${cleanName}) Tj T*`,
      `(Clinical Service:       ${cleanType}) Tj T*`,
      `(Consultation Time:      ${cleanTime}) Tj T*`,
      `(Session Duration:      ${cleanDuration}) Tj T*`,
      'ET',
      // Section 2: Revenue details Box
      '0.92 0.92 0.92 RG',
      '0.98 0.99 1.0 rg',
      '60 370 475 145 re',
      'B',
      // Revenue Title
      'BT',
      '/F2 11 Tf',
      '0.09 0.44 0.82 rg',
      '75 495 Td',
      '(2. REVENUE LEDGER SUMMARY) Tj',
      'ET',
      // Revenue body: Gross Consultation fee line
      'BT',
      '/F1 9.5 Tf',
      '0.3 0.3 0.3 rg',
      '75 473 Td',
      '(Gross consultation fee:  ) Tj',
      'ET',
      'BT',
      '/F1 9.5 Tf',
      '0.3 0.3 0.3 rg',
      '184 473 Td',
      `(${rawFeeDigits}) Tj`,
      'ET',
      // Vector Rupee symbol before gross fee digits
      '0.3 0.3 0.3 RG',
      '0.75 w',
      '175 481 m 181 481 l S',
      '175 478.5 m 180.5 478.5 l S',
      '176.5 481 m 176.5 473 l S',
      '176.5 480.5 m 179 480.5 l 180.5 479.5 l 180.5 478 l 179 477 l 176.5 477 l S',
      '178 477 m 180.5 473 l S',
      // Revenue body: Platform cut fee line
      'BT',
      '/F1 9.5 Tf',
      '0.3 0.3 0.3 rg',
      '75 456 Td',
      '(MindCare Platform commission:   ) Tj',
      'ET',
      'BT',
      '/F1 9.5 Tf',
      '0.3 0.3 0.3 rg',
      '221 456 Td',
      '(0.00 (0.0% promotional discount)) Tj',
      'ET',
      // Vector Rupee symbol before platform cut digits
      '0.3 0.3 0.3 RG',
      '212 464 m 218 464 l S',
      '212 461.5 m 217.5 461.5 l S',
      '213.5 464 m 213.5 456 l S',
      '213.5 463.5 m 216 463.5 l 217.5 462.5 l 217.5 461 l 216 460 l 213.5 460 l S',
      '215 460 m 217.5 456 l S',
      // Total Highlight Box inside revenue section
      '0.95 0.97 1.0 rg',
      '75 385 445 28 re',
      'f',
      // Revenue body: Net Clinician Payout line
      'BT',
      '/F2 10.5 Tf',
      '0.09 0.44 0.82 rg',
      '90 395 Td',
      '(Net Clinician Payout:   ) Tj',
      'ET',
      'BT',
      '/F2 10.5 Tf',
      '0.09 0.44 0.82 rg',
      '203 395 Td',
      `(${rawFeeDigits}) Tj`,
      'ET',
      // Vector Rupee symbol before net payout digits
      '0.09 0.44 0.82 RG',
      '0.75 w',
      '194 403 m 200 403 l S',
      '194 400.5 m 199.5 400.5 l S',
      '195.5 403 m 195.5 395 l S',
      '195.5 402.5 m 198 402.5 l 199.5 401.5 l 199.5 400 l 198 399 l 195.5 399 l S',
      '197 399 m 199.5 395 l S',
      // Footer Divider Line
      '0.9 0.9 0.9 RG',
      '60 340 m',
      '535 340 l',
      'S',
      // Footer Text
      'BT',
      '/F1 8.5 Tf',
      '0.5 0.5 0.5 rg',
      '60 315 Td',
      '13 TL',
      '(Thank you for supporting mental healthcare access across our integrated networks.) Tj T*',
      '(MindCare Health Group - HIPAA & HITECH Certified Clinical Network System) Tj T*',
      'ET',
      'endstream',
      'endobj',
      'xref',
      '0 6',
      '0000000000 65535 f ',
      '0000000009 00000 n ',
      '0000000058 00000 n ',
      '0000000115 00000 n ',
      '0000000214 00000 n ',
      '0000000293 00000 n ',
      'trailer',
      '<< /Size 6 /Root 1 0 R >>',
      'startxref',
      '450',
      '%%EOF'
    ];

    const blob = new Blob([pdfLines.join('\n')], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-MC-${invoiceNum}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Invoice Downloaded",
      description: `Receipt receipt-MC-${invoiceNum}.pdf generated successfully.`,
    });
  };

  const handleApproveAppointment = async (apptId: string) => {
    try {
      await api.therapists.approveAppointment(apptId);
      setLocalSchedule(prev => prev.map(s => s._id === apptId ? { ...s, status: 'APPROVED' } : s));
      toast({
        title: "Appointment Approved 🎉",
        description: "The patient has been notified. Session status updated to Approved.",
      });
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.message || "Failed to approve appointment.",
      });
    }
  };

  const handleRejectAppointment = async (apptId: string) => {
    const reason = prompt("Optional: Provide a reason for declining this booking request:");
    try {
      const res = await api.therapists.rejectAppointment(apptId, reason || undefined);
      setLocalSchedule(prev => prev.map(s => s._id === apptId ? { ...s, status: 'CANCELLED', paymentStatus: 'REFUNDED', refundStatus: 'COMPLETED' } : s));
      toast({
        title: "Appointment Declined & Refunded 🔄",
        description: "Appointment cancelled and full refund automatically processed to patient.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Action Failed",
        description: err.message || "Failed to reject appointment.",
      });
    }
  };

const handleCancelApproved = async (apptId: string) => {
  const reason = prompt("Optional: Provide a reason for cancelling this approved appointment:");
  try {
    await api.therapists.cancelAppointment(apptId, reason || undefined);
    setLocalSchedule(prev => prev.map(s => s._id === apptId ? { ...s, status: 'CANCELLED', paymentStatus: 'REFUNDED', refundStatus: 'COMPLETED' } : s));
    toast({
      title: "Appointment Cancelled & Refunded 🔄",
      description: "Approved appointment cancelled and refund processed.",
    });
  } catch (err: any) {
    toast({
      variant: "destructive",
      title: "Action Failed",
      description: err.message || "Failed to cancel appointment.",
    });
  }
};

  const handleRescheduleSession = (idx: number) => {
    setLocalSchedule(prev => prev.map((s, i) => i === idx ? { ...s, time: s.time + " (Rescheduled)" } : s));
    toast({
      title: "Reschedule Request Sent",
      description: "Proposed reschedule slot details have been sent to patient for approval.",
    });
  };

  // Filter schedules
  const filteredSchedule = schedule.filter((s: any) => {
    if (appointmentFilter === 'pending_approval') return s.status === 'PENDING_APPROVAL';
    if (appointmentFilter === 'approved') return s.status === 'APPROVED';
    if (appointmentFilter === 'in_progress') return s.status === 'IN_PROGRESS';
    if (appointmentFilter === 'completed') return s.status === 'COMPLETED';
    if (appointmentFilter === 'cancelled') return s.status === 'CANCELLED';
    if (appointmentFilter === 'expired') return s.status === 'EXPIRED';
    return true;
  }).filter((s: any) => {
    if (selectedWeekDay === 'All') return true;
    const dayName = new Date(s.date || s.createdAt).toLocaleDateString([], { weekday: 'long' });
    return dayName === selectedWeekDay;
  });

  // The API returns one roster record per patient id.  Do not merge by name:
  // distinct patients can legitimately have the same display name.
  const patientRoster = statsData?.patientRoster || [];
  const filteredUniquePatients = patientRoster.filter((p: any) =>
    `${p.name || ''} ${p.email || ''}`.toLowerCase().includes(patientSearch.toLowerCase())
  );

  // ─── SUB-PAGE: appointments ────────────────────────────────────────────────
  if (currentTab === 'appointments') {
    const totalSlots = schedule.length;
    const activeSlots = schedule.filter(s => s.status === 'APPROVED' || s.status === 'IN_PROGRESS').length;
    const settledPayouts = statsData?.totalEarnings ?? 0;

    const weekDays = ['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    content = (
      <AppLayout variant="therapist">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 pb-10">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100 mb-0.5">Clinical Schedule</h1>
              <p className="text-sm text-gray-500">Manage patient timelines, upcoming consultations, and clinical sessions.</p>
            </div>
            
            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-1 bg-gray-100 dark:bg-zinc-800 p-1.5 rounded-2xl border border-gray-200/50 self-start md:self-auto">
              {(['all', 'pending_approval', 'approved', 'in_progress', 'completed', 'cancelled', 'expired'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setAppointmentFilter(filter)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all capitalize ${
                    appointmentFilter === filter 
                      ? 'bg-white dark:bg-zinc-900 text-gray-950 dark:text-zinc-50 shadow-sm border border-gray-200/40' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {filter === 'pending_approval' ? 'Pending Requests ⏳' : filter === 'approved' ? 'Approved' : filter}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-950 p-4 border border-gray-100 dark:border-zinc-900/50 rounded-2xl shadow-sm">
              <span className="text-[9px] font-bold text-gray-450 uppercase tracking-widest block">Total Caseload Slots</span>
              <p className="text-xl font-black text-gray-850 dark:text-zinc-100 mt-1">{totalSlots}</p>
            </div>
            <div className="bg-white dark:bg-zinc-950 p-4 border border-gray-100 dark:border-zinc-900/50 rounded-2xl shadow-sm">
              <span className="text-[9px] font-bold text-gray-455 uppercase tracking-widest block">Active Sessions</span>
              <p className="text-xl font-black text-blue-600 mt-1">{activeSlots}</p>
            </div>
            <div className="bg-white dark:bg-zinc-950 p-4 border border-gray-100 dark:border-zinc-900/50 rounded-2xl shadow-sm">
              <span className="text-[9px] font-bold text-gray-455 uppercase tracking-widest block">Settled payouts</span>
              <p className="text-xl font-black text-green-600 mt-1">{format(settledPayouts)}</p>
            </div>
          </div>

          {/* Week Selector Ribbon */}
          <div className="bg-white dark:bg-zinc-950 p-3 border border-gray-100/90 dark:border-zinc-900/50 rounded-2xl shadow-sm flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none">
            {weekDays.map((day) => {
              const isActive = selectedWeekDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedWeekDay(day)}
                  className={`text-xs font-bold px-4 py-2.5 rounded-xl transition-all ${
                    isActive 
                      ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]' 
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Agenda Session List */}
          <div className="space-y-4">
            {filteredSchedule.length === 0 ? (
              <div className="bg-white p-10 border border-gray-100 rounded-3xl text-center">
                <Calendar className="w-9 h-9 text-gray-200 mx-auto mb-2 animate-pulse" />
                <p className="text-xs text-gray-400">No appointments scheduled for {selectedWeekDay === 'All' ? 'the selected filter' : selectedWeekDay}.</p>
              </div>
            ) : filteredSchedule.map((s: any, idx: number) => {
              // Find the index in localSchedule array to update it correctly
              const actualIndex = localSchedule.findIndex(item => item.name === s.name && item.time === s.time);
              return (
                <motion.div 
                  key={idx}
                  variants={itemVariants}
                  className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100/90 dark:border-zinc-900/50 shadow-sm p-5 space-y-4 hover:border-primary/10 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 border border-gray-200/50">
                        <AvatarImage src={s.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{(s.name || 'P')[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-gray-800 dark:text-zinc-200 text-sm">{s.name}</h4>
                          <Badge className="bg-primary/5 text-primary text-[9px] border-0 font-bold px-2 py-0.5">{s.type}</Badge>
                        </div>
                        <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1"><Clock className="w-3.5 h-3.5 text-primary" /> {s.time} · {s.duration}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="text-right pr-2">
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Gross Fee</p>
                        <p className="text-xs font-bold text-green-600">{format(s.fee)}</p>
                      </div>
                      
                      {s.status === 'PENDING_APPROVAL' ? (
                        <Badge className="bg-amber-100 text-amber-800 text-xs font-bold border-0 px-3 py-1 rounded-full">Pending Approval ⏳</Badge>
                      ) : s.status === 'APPROVED' ? (
                        <Badge className="bg-blue-100 text-blue-800 text-xs font-bold border-0 px-3 py-1 rounded-full">Approved</Badge>
                      ) : s.status === 'REJECTED' ? (
                        <Badge className="bg-rose-100 text-rose-800 text-xs font-bold border-0 px-3 py-1 rounded-full">Rejected</Badge>
                      ) : s.status === 'COMPLETED' ? (
                        <Badge className="bg-emerald-100 text-emerald-800 text-xs font-bold border-0 px-3 py-1 rounded-full">Completed 🏁</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 text-xs font-bold border-0 px-3 py-1 rounded-full">Cancelled</Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions depending on status */}
                  {s.status === 'PENDING_APPROVAL' && (
                    <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-zinc-900">
                      <Button
                        onClick={() => handleApproveAppointment(s._id || s.id)}
                        className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold h-10 shadow-sm"
                      >
                        Approve Request
                      </Button>
                      <Button
                        onClick={() => handleRejectAppointment(s._id || s.id)}
                        variant="outline"
                        className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold h-10 px-4"
                      >
                        Reject Request
                      </Button>
                    </div>
                  )}

                  {/* Removed obsolete payment panel for approved appointments; payment is completed during booking */}

                  {s.status === 'IN_PROGRESS' && (
                    <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-zinc-900">
                      <Button 
                        onClick={() => {
                          toast({
                            title: "Voice Consultation starting",
                            description: `Establishing secure audio consultation with ${s.name}...`,
                          });
                        }} 
                        className="flex-1 rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-bold gap-1.5 h-10 shadow-sm shadow-primary/20"
                      >
                        <Phone className="w-4 h-4" /> Start Voice Call
                      </Button>
                      <Button 
                        onClick={() => {
                          setLocation('/therapist-chat');
                        }}
                        variant="outline" 
                        className="flex-1 rounded-xl border-primary/30 text-primary text-xs font-bold gap-1.5 h-10"
                      >
                        <MessageSquare className="w-4 h-4" /> Start Chat
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </AppLayout>
    );
  }

  // ─── SUB-PAGE: patients ────────────────────────────────────────────────────
  if (currentTab === 'patients') {
    content = (
      <AppLayout variant="therapist">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 pb-10">
          
          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 p-6 md:p-8 text-white shadow-xl">
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold px-3 py-1 uppercase tracking-wider">
                    Clinical Caseload Directory
                  </Badge>
                  <span className="text-xs text-emerald-200/60">· {filteredUniquePatients.length} Active Patients</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-2">
                  Patient Roster &amp; EHR Records
                </h1>
                <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed">
                  Monitor patient wellness progress, CBT assignments, emergency risk indicators, and clinical session logs.
                </p>
              </div>

              {/* Caseload Search */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search by patient name or email..." 
                  className="pl-10 h-11 rounded-2xl border-white/10 bg-white/10 text-white placeholder:text-slate-400 focus:bg-white/20 focus:border-emerald-400 text-xs font-semibold backdrop-blur-md" 
                />
              </div>
            </div>
          </div>

          {/* Patients Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredUniquePatients.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100/90 dark:border-zinc-900 p-12 text-center shadow-sm">
                <Users className="w-10 h-10 text-gray-300 dark:text-zinc-700 mx-auto mb-2 animate-pulse" />
                <p className="text-xs font-bold text-gray-500 dark:text-zinc-400">No patients match your search criteria.</p>
              </div>
            ) : filteredUniquePatients.map((p: any) => {
              const wellnessScore = typeof p.wellnessScore === 'number' ? Math.max(0, Math.min(100, p.wellnessScore)) : null;
              const appointmentId = schedule.find((appointment: any) => String(appointment.userId) === String(p.userId) && messageableAppointmentIds[appointment._id])?._id;
              return (
                <motion.div 
                  key={p.userId}
                  variants={itemVariants}
                  className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100/90 dark:border-zinc-900/80 shadow-sm p-6 space-y-4 hover:border-emerald-500/30 hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <Avatar className="h-12 w-12 border-2 border-emerald-500/20 shadow-sm">
                        <AvatarImage src={p.avatar} />
                        <AvatarFallback className="bg-emerald-500/10 text-emerald-600 font-black text-sm">{p.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-extrabold text-gray-900 dark:text-zinc-100 text-sm leading-tight group-hover:text-emerald-600 transition-colors">{p.name}</h4>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: MC-PAT-{String(p.userId).slice(-6).toUpperCase()}</p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-0 text-[10px] font-extrabold px-2.5 py-1">
                      Active Client
                    </Badge>
                  </div>

                  {/* Metrics Bar */}
                  <div className="bg-slate-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-900 rounded-2xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500 dark:text-zinc-400 font-semibold flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> Wellness Index</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{wellnessScore === null ? 'Not recorded' : `${wellnessScore}%`}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${wellnessScore ?? 0}%` }} />
                    </div>
                    <p className="text-gray-600 dark:text-zinc-400 flex items-center gap-1.5 text-[11px] pt-1 truncate">
                      <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {p.email || 'Email not recorded'}
                    </p>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button 
                      onClick={() => {
                        if (appointmentId) {
                          setActiveChatUserId(appointmentId);
                          setLocation("/therapist/messages");
                        } else {
                          toast({ title: 'Messaging unavailable', description: 'This patient does not have an approved, paid messaging channel.' });
                        }
                      }}
                      variant="outline" 
                      className="flex-1 rounded-xl h-10 text-xs font-bold gap-1.5 border-gray-200 hover:border-emerald-500/30 hover:bg-emerald-50/50"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> Chat
                    </Button>
                    <Button 
                      onClick={() => setSelectedPatient(p)}
                      className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white h-10 text-xs font-extrabold shadow-sm"
                    >
                      EHR Profile
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Patient Detail Modal */}
        <AnimatePresence>
          {selectedPatient && (
            <motion.div 
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPatient(null)}
            >
              <motion.div 
                className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-100/80 dark:border-zinc-800 p-6 space-y-4"
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
                  <h3 className="font-black text-gray-900 dark:text-zinc-100 text-lg flex items-center gap-2"><UserCheck className="w-5 h-5 text-primary" /> Patient Clinical Profile</h3>
                  <button onClick={() => setSelectedPatient(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-4 py-2">
                  <Avatar className="h-14 w-14 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-base">{selectedPatient.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="text-base font-black text-gray-800 dark:text-zinc-100">{selectedPatient.name}</h4>
                    <p className="text-xs text-gray-500">Case ID: MC-PAT-{selectedPatient.userId ? selectedPatient.userId.slice(-6).toUpperCase() : 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-50 dark:bg-zinc-900/40 p-3 rounded-xl border border-gray-100">
                    <span className="text-gray-400 block font-semibold uppercase tracking-wider text-[9px]">Last Session Type</span>
                    <span className="font-bold text-gray-700 dark:text-zinc-300 mt-0.5 block">{selectedPatient.lastSessionType === 'chat' ? 'Chat Consultation' : selectedPatient.lastSessionType === 'voice' ? 'Voice Consultation' : 'Not recorded'}</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-zinc-900/40 p-3 rounded-xl border border-gray-100">
                    <span className="text-gray-400 block font-semibold uppercase tracking-wider text-[9px]">Average Mood score</span>
                    <span className="font-bold text-gray-700 dark:text-zinc-300 mt-0.5 block">{typeof selectedPatient.wellnessScore === 'number' ? `${(selectedPatient.wellnessScore / 10).toFixed(1)} / 10.0` : 'Not recorded'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Clinical Notes & Diagnostics</label>
                  <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3 text-xs leading-relaxed text-gray-600 space-y-1.5">
                    <p className="font-bold">Completed consultations: {selectedPatient.completedSessions || 0}</p>
                    <p>{selectedPatient.lastAppointmentAt ? `Last appointment: ${new Date(selectedPatient.lastAppointmentAt).toLocaleDateString()}.` : 'No appointment history recorded.'}</p>
                  </div>
                </div>

                <Button onClick={() => setSelectedPatient(null)} className="w-full h-11 rounded-xl bg-primary text-white font-bold text-xs shadow-sm mt-2">
                  Close Profile Details
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AppLayout>
    );
  }

  // ─── SUB-PAGE: messages ────────────────────────────────────────────────────
  if (currentTab === 'messages') {
    const channelIds = Object.keys(messageableAppointmentIds);
    const activeChannelId = activeChatUserId && messageableAppointmentIds[activeChatUserId]
      ? activeChatUserId
      : channelIds[0] || '';
    const activeName = chatPatientNames[activeChannelId] || '';
    const messages = chatMessages[activeChannelId] || [];

    content = (
      <AppLayout variant="therapist">
        <div className="space-y-6 pb-10">
          
          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 p-6 md:p-8 text-white shadow-xl">
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold px-3 py-1 uppercase tracking-wider">
                    256-Bit Encrypted Messenger
                  </Badge>
                  <span className="text-xs text-emerald-200/60">· HIPAA &amp; HITECH Compliant</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-1">
                  Clinical Communication Console
                </h1>
                <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed">
                  Engage in real-time, secure messaging sessions with your assigned patient caseload.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-950 border border-gray-100 dark:border-zinc-900/80 rounded-3xl shadow-sm overflow-hidden flex h-[620px]">
            {/* Left sidebar: channels */}
            <div className="w-72 border-r border-gray-100 dark:border-zinc-900 flex flex-col bg-slate-50/50 dark:bg-zinc-900/30">
              <div className="p-4 border-b border-gray-100 dark:border-zinc-900 flex items-center justify-between">
                <span className="text-xs font-black text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Patient Channels</span>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold text-[10px]">
                  {channelIds.length} Active
                </Badge>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100/60 dark:divide-zinc-900/40">
                {channelIds.map((channelId: string) => {
                  const name = chatPatientNames[channelId] || 'Patient';
                  const isActive = activeChannelId === channelId;
                  return (
                    <div 
                      key={channelId}
                      onClick={() => setActiveChatUserId(channelId)}
                      className={`p-4 flex items-center gap-3.5 cursor-pointer transition-all ${
                        isActive 
                          ? 'bg-white dark:bg-zinc-900 border-l-4 border-emerald-500 shadow-sm' 
                          : 'hover:bg-gray-100/50 dark:hover:bg-zinc-900/50'
                      }`}
                    >
                      <Avatar className="h-10 w-10 shrink-0 border border-emerald-500/20">
                        <AvatarFallback className="text-xs bg-emerald-500/10 text-emerald-600 font-black">{name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-extrabold text-gray-900 dark:text-zinc-100 truncate">{name}</p>
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">Secure</span>
                        </div>
                        <p className="text-[10px] text-gray-400 truncate mt-0.5 font-medium">Click to view clinical chat</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right chat panel */}
            <div className="flex-1 flex flex-col bg-slate-50/20 dark:bg-zinc-950">
              {activeName ? (
                <>
                  {/* Chat header */}
                  <div className="p-4 border-b border-gray-100 dark:border-zinc-900 bg-white dark:bg-zinc-900 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-emerald-500/20">
                        <AvatarFallback className="text-xs bg-emerald-500/10 text-emerald-600 font-black">{activeName[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="text-sm font-extrabold text-gray-900 dark:text-zinc-100">{activeName}</h4>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wide flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Clinical Session
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-bold text-[10px] flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> End-to-End Encrypted
                    </Badge>
                  </div>

                  {/* Message feed */}
                  <div className="flex-1 p-6 overflow-y-auto space-y-4 flex flex-col justify-end">
                    {messages.map((m: any, idx: number) => {
                      const isDoctor = m.sender === 'therapist';
                      return (
                        <div 
                          key={idx} 
                          className={`flex flex-col max-w-[70%] space-y-1 ${
                            isDoctor ? 'align-self-end self-end items-end' : 'align-self-start self-start items-start'
                          }`}
                        >
                          <div 
                            className={`p-4 rounded-2xl text-xs leading-relaxed ${
                              isDoctor 
                                ? 'bg-emerald-600 text-white rounded-tr-none shadow-sm' 
                                : 'bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 rounded-tl-none border border-gray-100 dark:border-zinc-800 shadow-sm'
                            }`}
                          >
                            {m.text}
                          </div>
                          <span className="text-[9px] text-gray-400 font-semibold px-1">{m.time}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Input panel */}
                  <div className="p-4 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-900 flex items-center gap-3">
                    <Input 
                      value={typedMessage}
                      onChange={(e) => setTypedMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type secure response to patient..." 
                      className="h-11 rounded-2xl text-xs border-gray-200 dark:border-zinc-800 focus:bg-white dark:focus:bg-zinc-950 font-medium" 
                    />
                    <Button 
                      onClick={handleSendMessage}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 px-5 rounded-2xl shrink-0 shadow-md shadow-emerald-500/20 flex items-center gap-1.5 text-xs"
                    >
                      <Send className="w-4 h-4" /> Send
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                  <MessageSquare className="w-10 h-10 text-gray-300 dark:text-zinc-700 mb-2 animate-pulse" />
                  <p className="text-xs text-gray-400">Select active channel to start conversation.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ─── SUB-PAGE: analytics ──────────────────────────────────────────────────
  if (currentTab === 'analytics') {
    const analyticsTimeframes = ['7 Days', '30 Days', 'Quarterly', 'Yearly'];
    const sessionTypeColors = ['#10b981', '#6366f1', '#f59e0b', '#ec4899'];

    const diagnosticData = statsData?.reasonBreakdown || [];
    const revenueData = statsData?.monthlyRevenue || [];
    const patientOutcomeMatrix = statsData?.patientOutcomes || [];

    content = (
      <AppLayout variant="therapist">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 pb-12">
          
          {/* Header Banner with Premium Gradient & Controls */}
          <div className="bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-emerald-800/30">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold px-3 py-1 backdrop-blur-md">
                    <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-400 animate-pulse" /> Clinical Analytics Intelligence
                  </Badge>
                  <span className="text-xs text-emerald-200/60 font-medium">Real-time MongoDB Sync</span>
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight text-white">Clinical Analytics &amp; Outcomes</h1>
                <p className="text-sm text-emerald-100/70 mt-1 max-w-xl">
                  Deep-dive analysis of patient recovery indices, consultation volume, therapeutic outcomes, and revenue metrics.
                </p>
              </div>

              {/* Controls: Timeframe Ribbon & Export Button */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-emerald-950/80 p-1.5 rounded-2xl border border-emerald-800/50 flex items-center gap-1 backdrop-blur-md">
                  {analyticsTimeframes.map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setAnalyticsTimeframe(tf as typeof analyticsTimeframe)}
                      className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all ${
                        analyticsTimeframe === tf
                          ? 'bg-emerald-500 text-emerald-950 shadow-md font-extrabold scale-[1.02]'
                          : 'text-emerald-200/70 hover:text-white'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                <Button 
                  onClick={() => {
                    toast({
                      title: "Exporting Executive Report",
                      description: "Downloading HIPAA-compliant Clinical Analytics PDF summary...",
                    });
                  }}
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl text-xs font-bold h-10 px-4 gap-2 backdrop-blur-md transition-all shadow-sm"
                >
                  <Download className="w-4 h-4" /> Export Executive PDF
                </Button>
              </div>
            </div>
          </div>

          {/* Key Metric Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: "Completed Consultations",
                val: String(statsData?.completedSessions ?? 0),
                trend: statsData?.completedSessions ? "Paid, completed sessions" : "No data available",
                icon: Heart,
                color: "text-emerald-600 dark:text-emerald-400",
                bg: "bg-emerald-500/10 border-emerald-500/20",
                sub: "Successful settled consultations"
              },
              {
                title: "Gross Clinical Revenue",
                val: format(statsData?.monthlyEarnings ?? 0),
                trend: statsData?.monthlyEarnings ? "Current month" : "No data available",
                icon: Coins,
                color: "text-blue-600 dark:text-blue-400",
                bg: "bg-blue-500/10 border-blue-500/20",
                sub: "Settled payouts via Razorpay"
              },
              {
                title: "Clinical Satisfaction",
                val: `${Number(statsData?.averageRating ?? 0).toFixed(1)} / 5.0`,
                trend: `${statsData?.reviewsCount ?? 0} verified reviews`,
                icon: Star,
                color: "text-amber-500 dark:text-amber-400",
                bg: "bg-amber-500/10 border-amber-500/20",
                sub: "From submitted patient reviews"
              },
              {
                title: "Active Caseload",
                val: `${statsData?.activePatients ?? 0} Patients`,
                trend: statsData?.activePatients ? "Approved active consultations" : "No data available",
                icon: Users,
                color: "text-violet-600 dark:text-violet-400",
                bg: "bg-violet-500/10 border-violet-500/20",
                sub: `${statsData?.totalPatients ?? 0} total patients`
              }
            ].map((card, idx) => (
              <motion.div
                key={idx}
                variants={itemVariants}
                className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100/90 dark:border-zinc-900/60 p-5 shadow-sm hover:shadow-md hover:border-emerald-500/20 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{card.title}</span>
                  <div className={`p-2.5 rounded-2xl border ${card.bg}`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-black text-gray-900 dark:text-zinc-100 tracking-tight">{card.val}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50 dark:border-zinc-900 text-[11px]">
                  <span className="text-emerald-600 font-extrabold flex items-center gap-0.5">
                    <ArrowUpRight className="w-3.5 h-3.5" /> {card.trend}
                  </span>
                  <span className="text-gray-400 font-medium truncate max-w-[120px]">{card.sub}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Interactive Visualizations Row 1: Patient Outcome Area Chart + Diagnostic Donut Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Monthly Mood Recovery Curve */}
            <motion.div variants={itemVariants} className="lg:col-span-2 bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-900 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-extrabold text-gray-900 dark:text-zinc-100 text-base flex items-center gap-2">
                    <AreaChart className="w-4 h-4 text-emerald-500" /> Patient Recovery &amp; Wellness Progression
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Monthly settled consultation revenue and completed session volume</p>
                </div>
                <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0 text-xs font-bold">
                  {revenueData.length ? "Database activity" : "No data available"}
                </Badge>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', background: '#0f172a', color: '#fff' }}
                      formatter={(val: any) => [format(Number(val)), 'Settled revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#emeraldGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Diagnostic Categories Donut Chart */}
            <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-900 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-gray-900 dark:text-zinc-100 text-base mb-1">Diagnostic Breakdown</h3>
                <p className="text-xs text-gray-400 mb-4">Distribution of recorded consultation reasons</p>
                
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={diagnosticData} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={50} 
                        outerRadius={75} 
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {diagnosticData.map((_: any, i: number) => (
                          <Cell key={i} fill={sessionTypeColors[i % sessionTypeColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', background: '#0f172a', color: '#fff', border: 'none' }}
                        formatter={(val: any) => [val, 'Consultations']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-2 mt-2 pt-3 border-t border-gray-100 dark:border-zinc-900">
                {diagnosticData.map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-md" style={{ background: sessionTypeColors[i % sessionTypeColors.length] }} />
                      <span className="text-gray-700 dark:text-zinc-300">{d.name}</span>
                    </div>
                    <span className="font-bold text-gray-900 dark:text-zinc-100">{d.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Therapeutic Outcomes Matrix Table */}
          <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-900 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-gray-900 dark:text-zinc-100 text-base flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Completed Patient Consultations
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Only successful, completed consultations are shown.</p>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border-0 text-xs px-3 py-1 self-start sm:self-auto">
                {patientOutcomeMatrix.length ? `${patientOutcomeMatrix.length} completed patients` : "No data available"}
              </Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-zinc-900 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Patient Profile</th>
                    <th className="py-3 px-4">Consultation Focus</th>
                    <th className="py-3 px-4">Completed Sessions</th>
                    <th className="py-3 px-4">Last Consultation</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-900/60 font-medium">
                  {patientOutcomeMatrix.length === 0 ? (
                    <tr><td colSpan={5} className="py-10 px-4 text-center text-gray-400">No data available.</td></tr>
                  ) : patientOutcomeMatrix.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50/60 dark:hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-extrabold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                        <Avatar className="w-7 h-7 border border-emerald-500/20">
                          <AvatarFallback className="bg-emerald-500/10 text-emerald-600 font-black text-xs">{row.patient[0]}</AvatarFallback>
                        </Avatar>
                        {row.patient}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 dark:text-zinc-400">{row.clinicalFocus}</td>
                      <td className="py-3.5 px-4 text-gray-500 font-semibold">{row.completedSessions}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-600">{new Date(row.lastConsultationAt).toLocaleDateString()}</td>
                      <td className="py-3.5 px-4 text-right">
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold border-0 text-[10px] px-2.5 py-0.5 rounded-full">
                          Completed
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

        </motion.div>
      </AppLayout>
    );
  }

  // ─── SUB-PAGE: availability ────────────────────────────────────────────────
  if (currentTab === 'availability') {
    const activeDaysCount = Object.values(weeklyAvailability).filter((d: any) => d.active).length;
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayShift = weeklyAvailability[todayName];
    const isTodayActive = todayShift?.active;
    const todayHours = todayShift?.hours || '';

    content = (
      <AppLayout variant="therapist">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 pb-10">
          
          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 p-6 md:p-8 text-white shadow-xl">
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold px-3 py-1 uppercase tracking-wider">
                    Shift &amp; Capacity Planner
                  </Badge>
                  <span className="text-xs text-emerald-200/60">· Live Booking Slots Active</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-1">
                  Availability &amp; Shift Management
                </h1>
                <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed">
                  Define your weekly clinical availability, consultation slot durations, and vacation overrides.
                </p>
              </div>
            </div>
          </div>

          <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100/90 dark:border-zinc-900/80 shadow-sm p-6 space-y-6">
            
            {/* Live Shift Summary Card */}
            <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 dark:text-zinc-400 font-extrabold uppercase tracking-wider">Live Shift Summary</span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold">· {activeDaysCount} Active Days / Week</span>
                  </div>
                  <p className="text-sm font-extrabold text-gray-900 dark:text-zinc-100 mt-0.5">
                    Today ({todayName}): {isTodayActive ? `${todayHours} (Shift Active 🟢)` : 'Off Shift 💤'}
                  </p>
                </div>
              </div>
              <Badge className={`font-extrabold text-xs px-3 py-1 rounded-full shadow-sm ${isTodayActive ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                {isTodayActive ? 'Accepting New Patients' : 'Not accepting new patients today'}
              </Badge>
            </div>

            {/* Availability Checklist Grid */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Weekly Shift Schedule</h3>
              {Object.entries(weeklyAvailability).map(([day, data]) => {
                const timeOptions = [
                  "07:00 AM", "08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
                  "12:00 PM", "12:30 PM", "01:00 PM", "01:30 PM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM",
                  "04:30 PM", "05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM", "08:30 PM", "09:00 PM"
                ];

                const parseStart = (hoursStr: string) => {
                  if (!hoursStr || !hoursStr.includes("-")) return "09:00 AM";
                  const start = hoursStr.split("-")[0].trim();
                  return timeOptions.find(t => t.toLowerCase() === start.toLowerCase()) || start || "09:00 AM";
                };

                const parseEnd = (hoursStr: string) => {
                  if (!hoursStr || !hoursStr.includes("-")) return "05:00 PM";
                  const end = hoursStr.split("-")[1].trim();
                  return timeOptions.find(t => t.toLowerCase() === end.toLowerCase()) || end || "05:00 PM";
                };

                const currentStart = parseStart(data.hours);
                const currentEnd = parseEnd(data.hours);

                return (
                  <div key={day} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-50/60 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-900 rounded-2xl transition-colors hover:border-emerald-500/20">
                    <div className="flex items-center gap-3.5">
                      <Checkbox 
                        checked={data.active} 
                        onCheckedChange={(checked) => setWeeklyAvailability(prev => ({
                          ...prev,
                          [day]: { ...prev[day], active: checked === true }
                        }))}
                        className="border-gray-300 rounded-lg h-5 w-5 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-extrabold text-sm text-gray-900 dark:text-zinc-100 w-24">{day}</span>
                    </div>
                    
                                        <TimeRangeSelect
                      active={data.active}
                      start={currentStart}
                      end={currentEnd}
                      onChange={(newStart, newEnd) => {
                        const newHours = `${newStart} - ${newEnd}`;
                        setWeeklyAvailability(prev => ({
                          ...prev,
                          [day]: { ...prev[day], hours: newHours },
                        }));
                      }}
                     />

                      <Badge className={`text-[10px] font-extrabold border-0 px-3 py-1.5 rounded-full ${data.active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-gray-100 text-gray-400 dark:bg-zinc-800'}`}>
                        {data.active ? `${data.hours}` : 'Off Duty'}
                      </Badge>
               </div>
                  
                );
              })}
            </div>

            <Button 
              onClick={handleUpdateAvailability}
              className="rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold h-12 px-8 shadow-md shadow-emerald-500/20 text-xs gap-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Save Clinical Shift Schedule
            </Button>
          </motion.div>
        </motion.div>
      </AppLayout>
    );
  }

  // ─── SUB-PAGE: earnings ────────────────────────────────────────────────────
  if (currentTab === 'earnings') {
    const settledSchedule = schedule.filter((appointment: any) => appointment.status === 'COMPLETED' && appointment.paymentStatus === 'SUCCESS');
    const settledConsultations = statsData?.completedSessions ?? 0;
    const totalSettledRevenue = statsData?.totalEarnings ?? 0;
    content = (
      <AppLayout variant="therapist">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 pb-10">
          
          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 p-6 md:p-8 text-white shadow-xl">
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold px-3 py-1 uppercase tracking-wider">
                    Financial Payout Ledger
                  </Badge>
                  <span className="text-xs text-emerald-200/60">· Settlements are shown only after payment and consultation completion</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-1">
                  Earnings &amp; Billing Invoices
                </h1>
                <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed">
                  Track gross settled consultation revenue and download receipts for completed, paid sessions.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100/90 dark:border-zinc-900 p-6 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gross Settled Revenue (This Month)</span>
              <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 my-3 tracking-tight">{format(statsData?.monthlyEarnings || 0)}</p>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-extrabold bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                <ArrowUpRight className="w-4 h-4" /> Revenue calculated strictly from confirmed &amp; settled payments
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100/90 dark:border-zinc-900 p-6 flex flex-col justify-between shadow-sm">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payout Summary</span>
              <div>
                <p className="text-sm font-extrabold text-gray-900 dark:text-zinc-100 mt-2">{settledConsultations} completed paid consultations</p>
                <p className="text-xs text-gray-400 mt-1 font-mono">{format(totalSettledRevenue)} gross settled revenue recorded.</p>
              </div>
              <Badge className="mt-4 self-start bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold border-0 text-[10px] px-3 py-1">Database settlement summary</Badge>
            </div>
          </div>

          {/* Earnings ledger table */}
          <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100/90 dark:border-zinc-900 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-zinc-900 flex items-center justify-between">
              <span className="text-xs font-black text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Official Billing Receipts</span>
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold border-0 text-[10px] px-3 py-1">
                Verified &amp; Tax Compliant
              </Badge>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-900 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-4">Patient Name</th>
                    <th className="p-4">Date &amp; Time</th>
                    <th className="p-4">Payment Status</th>
                    <th className="p-4">Gross Payout</th>
                    <th className="p-4 text-center">Export Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-zinc-900/60 font-medium">
                  {settledSchedule.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400">No settled consultations recorded yet.</td>
                    </tr>
                  ) : settledSchedule.map((s: any, i: number) => {
                    const isPaid = true;

                    return (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/40 transition-colors">
                        <td className="p-4 font-extrabold text-gray-900 dark:text-zinc-100">{s.name}</td>
                        <td className="p-4 text-gray-500 dark:text-zinc-400">{s.time}</td>
                        <td className="p-4">
                          {isPaid ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold border-0 text-[10px] px-2.5 py-0.5">
                              Payment Settled
                            </Badge>
                          ) : null}
                        </td>
                        <td className="p-4 font-extrabold">
                          {isPaid ? (
                            <span className="text-emerald-600">+{format(s.amountPaid || s.fee)}</span>
                          ) : null}
                        </td>
                        <td className="p-4 text-center">
                          <Button 
                            disabled={!isPaid}
                            onClick={() => isPaid && handleDownloadInvoice(s, i)}
                            size="sm" 
                            variant="outline" 
                            className={`h-9 px-3 rounded-xl text-xs font-bold gap-1 ${
                              isPaid 
                                ? 'border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-gray-700 dark:text-zinc-300 cursor-pointer' 
                                : 'border-gray-100 text-gray-300 opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-600" /> {isPaid ? 'PDF Receipt' : 'Unpaid'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </motion.div>
      </AppLayout>
    );
  }

  // ─── SUB-PAGE: resources ───────────────────────────────────────────────────
  if (currentTab === 'resources') {
    content = (
      <AppLayout variant="therapist">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 pb-10">
          
          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 p-6 md:p-8 text-white shadow-xl">
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold px-3 py-1 uppercase tracking-wider">
                    Clinical Resource Hub
                  </Badge>
                  <span className="text-xs text-emerald-200/60">· Evidence-Based Handbooks</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-1">
                  Therapist Worksheets &amp; Protocols
                </h1>
                <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed">
                  Review clinical handbooks, counseling framework guides, and crisis response worksheets.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {clinicalResources.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100/90 dark:border-zinc-900 p-12 text-center shadow-sm">
                <BookOpen className="w-10 h-10 text-gray-300 dark:text-zinc-700 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-500 dark:text-zinc-400">No clinical resources are available.</p>
              </div>
            ) : clinicalResources.map((resource: any) => {
              const res = { ...resource, desc: resource.meta || resource.category || '', content: resource.content || resource.meta || '' };
              return (
              <motion.div 
                key={res._id} 
                variants={itemVariants}
                onClick={() => setActiveResource(res)}
                className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100/90 dark:border-zinc-900 shadow-sm p-6 hover:border-emerald-500/30 hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between min-h-[180px]"
              >
                <div>
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-3">
                    <BookOpen className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h4 className="font-extrabold text-gray-900 dark:text-zinc-100 text-sm group-hover:text-emerald-600 transition-colors">{res.title}</h4>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1.5 font-medium leading-relaxed">{res.desc}</p>
                </div>
                <div className="flex items-center justify-end pt-4 border-t border-gray-50 dark:border-zinc-900 mt-4">
                  <span className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wider flex items-center gap-1">View Handbook <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" /></span>
                </div>
              </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Dynamic Resource Modal */}
        <AnimatePresence>
          {activeResource && (
            <motion.div 
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveResource(null)}
            >
              <motion.div 
                className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-gray-100/80 dark:border-zinc-800 p-6 space-y-4"
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 pb-3">
                  <h3 className="font-black text-gray-900 dark:text-zinc-100 text-base flex items-center gap-2"><Sparkles className="w-5 h-5 text-emerald-600" /> {activeResource.title}</h3>
                  <button onClick={() => setActiveResource(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs font-extrabold text-emerald-600 uppercase tracking-widest">{activeResource.desc}</p>
                <div className="bg-slate-50 dark:bg-zinc-950 border border-gray-200/50 dark:border-zinc-800 rounded-2xl p-4 text-xs text-gray-700 dark:text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap max-h-72 overflow-y-auto">
                  {activeResource.content || 'No additional resource content has been recorded.'}
                </div>
                <Button onClick={() => setActiveResource(null)} className="w-full h-11 rounded-2xl bg-emerald-600 text-white font-extrabold text-xs shadow-md shadow-emerald-500/20 mt-2">
                  Acknowledge Guidelines
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AppLayout>
    );
  }

  // ─── SUB-PAGE: settings ────────────────────────────────────────────────────
  if (currentTab === 'settings') {
    const liveBadges = specializationsText.split(',').map(s => s.trim()).filter(Boolean);
    const verificationStatus = statsData?.verificationStatus || 'Pending';

    content = (
      <AppLayout variant="therapist">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 pb-10">
          
          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-emerald-950 p-6 md:p-8 text-white shadow-xl">
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold px-3 py-1 uppercase tracking-wider">
                    Therapist Profile &amp; Billing Rates
                  </Badge>
                  <span className="text-xs text-emerald-200/60">· Verification: {verificationStatus}</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-1">
                  Professional Practice Settings
                </h1>
                <p className="text-xs md:text-sm text-slate-300 max-w-xl leading-relaxed">
                  Update your clinical credentials, session billing rates in INR (₹), and specialization focus areas.
                </p>
              </div>
            </div>
          </div>
          
          <motion.div variants={itemVariants} className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100/90 dark:border-zinc-900 shadow-sm p-6 space-y-5">
            <div>
              <label className="text-[10px] font-extrabold text-gray-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">Clinical Bio &amp; Professional Summary</label>
              <textarea 
                value={bioText} 
                onChange={(e) => setBioText(e.target.value)}
                placeholder="Write a brief bio outlining your experience, therapeutic approach, and certification background..."
                className="w-full text-xs font-semibold border border-gray-200 dark:border-zinc-800 rounded-2xl px-4 py-3 bg-slate-50/50 dark:bg-zinc-900/40 h-28 focus:outline-none focus:border-emerald-500 text-gray-800 dark:text-zinc-200 transition-colors" 
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-extrabold text-gray-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">Qualifications &amp; Degrees</label>
                <div className="relative">
                  <Award className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    type="text" 
                    value={qualificationText} 
                    onChange={(e) => setQualificationText(e.target.value)}
                    placeholder="e.g. M.Phil in Clinical Psychology (NIMHANS), Ph.D" 
                    className="pl-10 h-11 rounded-2xl text-xs font-semibold border-gray-200 dark:border-zinc-800 focus:bg-white" 
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-gray-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">Consultation Rate (₹ per 50-min session)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                  <Input 
                    type="number" 
                    value={consultationFeeText} 
                    onChange={(e) => setConsultationFeeText(e.target.value)}
                    placeholder="e.g. 1200" 
                    className="pl-10 h-11 rounded-2xl text-xs font-extrabold border-gray-200 dark:border-zinc-800 focus:bg-white text-emerald-600" 
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-extrabold text-gray-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">Specialization Focus (Comma-separated)</label>
              <Input 
                type="text" 
                value={specializationsText} 
                onChange={(e) => setSpecializationsText(e.target.value)}
                placeholder="e.g. Anxiety, Depression, CBT, DBT, Stress Management" 
                className="h-11 rounded-2xl text-xs font-semibold border-gray-200 dark:border-zinc-800 focus:bg-white mb-3" 
              />
              {liveBadges.length > 0 && (
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Specializations Preview:</span>
                  <div className="flex flex-wrap gap-2">
                    {liveBadges.map((s: string) => (
                      <Badge key={s} className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-extrabold px-3 py-1 rounded-full">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button 
              onClick={handleSaveSettings}
              className="rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold h-12 px-8 shadow-md shadow-emerald-500/20 text-xs gap-2 mt-2"
            >
              <CheckCircle2 className="w-4 h-4" /> Save Professional Profile Settings
            </Button>
          </motion.div>
        </motion.div>
      </AppLayout>
    );
  }

  // ─── MAIN DASHBOARD ───────────────────────────────────────────────────────
  if (!content) content = (
    <AppLayout variant="therapist">
      <div className="space-y-6 pb-12">

        {/* Hero Welcome Banner */}
        <div className="bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-emerald-800/30">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <motion.div {...fade(0)}>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold px-3 py-1 backdrop-blur-md">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Active Clinical Shift &amp; Consultation Node
                </Badge>
                <span className="text-xs text-emerald-200/60 font-medium">HIPAA &amp; HITECH Compliant</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                {greeting}, {therapistName}! 👋
              </h1>
              <p className="text-sm text-emerald-100/70 mt-1 max-w-xl">
                {loading ? 'Fetching clinical schedule…' : `You have ${statsData?.sessionsToday ?? schedule.length} sessions scheduled today across video and chat consultations.`}
              </p>
            </motion.div>

            <motion.div {...fade(0.04)} className="flex items-center gap-3 self-start md:self-auto">
              <Button
                onClick={() => setLocation('/therapist/appointments')}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-extrabold h-10 px-4 rounded-2xl shadow-lg shadow-emerald-500/20 gap-1.5"
              >
                <Calendar className="w-4 h-4" /> View Clinical Calendar
              </Button>
              <Avatar className="h-12 w-12 border-2 border-emerald-400/30 shrink-0 shadow-md">
              <AvatarImage src={therapistAvatar} />
                <AvatarFallback className="bg-emerald-500/20 text-emerald-300 font-black text-sm">{therapistInitials}</AvatarFallback>
              </Avatar>
            </motion.div>
          </div>
        </div>

        {/* Emergency duty is separate from normal appointment availability. */}
        <motion.div {...fade(0.06)} className="bg-red-50/70 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-red-800 dark:text-red-200 text-sm flex items-center gap-2"><AlertOctagon className="w-4 h-4" /> Emergency on-call duty</h3>
            <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1">Enable only while you can immediately accept and support an emergency case. Appointment hours are unaffected.</p>
          </div>
          <Button onClick={() => handleEmergencyOnCall(!emergencyOnCall)} variant={emergencyOnCall ? "destructive" : "outline"} className="rounded-xl h-10 text-xs font-bold shrink-0">
            {emergencyOnCall ? "End emergency duty" : "Start emergency duty"}
          </Button>
        </motion.div>

        {emergencyCases.filter(item => item.status === 'pending').map((emergencyCase: any) => (
          <motion.div key={emergencyCase._id} {...fade(0.07)} className="bg-red-600 text-white rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
            <div>
              <h3 className="font-extrabold text-sm">Emergency support request awaiting acceptance</h3>
              <p className="text-xs text-red-100 mt-1">Respond only when you can begin support now. This offer expires automatically.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button onClick={() => respondToEmergencyCase(emergencyCase._id, false)} variant="outline" className="bg-white/10 border-white/40 text-white hover:bg-white/20 rounded-xl text-xs font-bold">Decline</Button>
              <Button onClick={() => respondToEmergencyCase(emergencyCase._id, true)} className="bg-white text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold">Accept now</Button>
            </div>
          </motion.div>
        ))}

        {/* Emergency Alerts Ribbon */}
        {alerts.length > 0 && (
          <motion.div {...fade(0.08)} className="bg-red-500/5 dark:bg-red-950/20 border border-red-500/20 rounded-3xl p-5 space-y-3 backdrop-blur-sm shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
                <AlertOctagon className="w-4.5 h-4.5 text-red-600 animate-bounce" /> Critical Emergency Alerts ({alerts.length})
              </h3>
              <Badge className="bg-red-600 text-white font-extrabold border-0 text-[10px] animate-pulse px-3 py-1 rounded-full">Immediate Action Required</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {alerts.map((a: any) => (
                <div key={a._id} className="bg-white/90 dark:bg-zinc-900/60 border border-red-100 dark:border-zinc-800/50 rounded-2xl p-4 flex justify-between items-start gap-4 shadow-sm hover:border-red-300 transition-colors">
                  <div className="space-y-1.5 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-zinc-100 text-xs flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-red-500" /> {a.userName}</p>
                    <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Trigger: {a.detectedTrigger}</p>
                    <p className="text-xs text-gray-600 dark:text-zinc-400 italic">"{a.messageContent}"</p>
                  </div>
                  <Button 
                    onClick={() => handleResolveAlert(a._id)}
                    size="sm" 
                    className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold h-8 px-3 rounded-xl shadow-sm shrink-0"
                  >
                    Resolve Alert
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Stats KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'TOTAL ACTIVE CASELOAD', icon: Users, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', value: loading ? '—' : `${statsData?.activePatients ?? 0} Patients`, sub: `${statsData?.totalPatients ?? 0} total approved patients` },
            { label: 'SESSIONS TODAY', icon: Calendar, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', value: loading ? '—' : `${statsData?.sessionsToday ?? 0} Active`, sub: `${statsData?.completedToday ?? 0} completed` },
            { label: 'MONTHLY EARNINGS', icon: Coins, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10 border-green-500/20', value: loading ? '—' : format(statsData?.monthlyEarnings ?? 0), sub: `${statsData?.completedSessions ?? 0} settled consultations` },
            { label: 'CLINICAL RATING', icon: Star, color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', value: loading ? '—' : `${Number(statsData?.averageRating ?? 0).toFixed(1)} / 5.0`, sub: `${statsData?.reviewsCount ?? 0} verified reviews` }
          ].map((s, i) => (
            <motion.div key={i} {...fade(0.10 + i * 0.05)}
              className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100/90 dark:border-zinc-900/60 shadow-sm p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">{s.label}</p>
                <div className={`p-2 rounded-xl border ${s.bg}`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
              </div>
              <p className="text-2xl font-black text-gray-900 dark:text-zinc-100 leading-none">{s.value}</p>
              <p className="text-[11px] font-extrabold mt-3 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> {s.sub}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Left Column — Today's Agenda + Sessions Chart */}
          <div className="xl:col-span-2 space-y-6">

            {/* Today's Schedule */}
            <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-900 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-gray-900 dark:text-zinc-100 text-base">Today's Clinical Agenda</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Upcoming patient appointments &amp; consultation slots</p>
                </div>
                <Button 
                  onClick={() => setLocation('/therapist/appointments')}
                  variant="outline" 
                  size="sm" 
                  className="rounded-xl border-gray-200 text-xs font-bold h-8 px-3"
                >
                  View Full Agenda
                </Button>
              </div>

              {todaySchedule.length === 0 ? (
                <div className="py-10 text-center bg-gray-50/50 dark:bg-zinc-900/30 rounded-2xl border border-gray-100">
                  <Calendar className="w-8 h-8 text-gray-300 dark:text-zinc-700 mx-auto mb-2 animate-pulse" />
                  <p className="text-xs text-gray-400">No appointments scheduled for today.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todaySchedule.slice(0, 5).map((s: any, i: number) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-50/60 dark:bg-zinc-900/40 border border-gray-100 dark:border-zinc-900/50 rounded-2xl hover:border-emerald-500/20 transition-all">
                      <div className="flex items-center gap-3.5">
                        <Avatar className="h-11 w-11 border-2 border-emerald-500/20 shrink-0">
                          <AvatarImage src={s.avatar} />
                          <AvatarFallback className="bg-emerald-500/10 text-emerald-600 font-black text-sm">{(s.name || 'P')[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-gray-900 dark:text-zinc-100 text-sm">{s.name}</h4>
                            <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0 text-[10px] font-bold px-2 py-0.5">{s.type}</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-1 font-medium">
                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-emerald-500" /> {s.time}</span>
                            <span>•</span>
                            <span className="font-bold text-emerald-600">{format(s.fee)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {s.status === 'COMPLETED' ? (
                          <Badge className="bg-gray-100 text-gray-600 dark:bg-zinc-900 dark:text-zinc-400 border-0 text-xs font-bold px-3 py-1.5 rounded-xl">Completed</Badge>
                        ) : (
                          <Button 
                            onClick={() => {
                              toast({
                                title: "Starting Consultation",
                                description: `Connecting secure video consultation room with ${s.name}...`,
                              });
                            }}
                            size="sm" 
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-1.5 h-9 px-4 shadow-sm shadow-emerald-500/20"
                          >
                            <Phone className="w-3.5 h-3.5" /> Join Consultation
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sessions Volume Chart */}
            <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-900 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-gray-900 dark:text-zinc-100 text-base">Weekly Consultation Trends</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Session volume and completion metrics across days of the week</p>
                </div>
                <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-0 text-xs font-bold">
                  {sessionData.length ? `Peak: ${sessionData.reduce((peak: any, item: any) => item.sessions > peak.sessions ? item : peak, sessionData[0]).day} (${Math.max(...sessionData.map((item: any) => item.sessions))} Sessions)` : 'No data available'}
                </Badge>
              </div>

              <div className="h-56">
                {sessionData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-gray-400">No data available.</div>
                ) : <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sessionData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                    <defs>
                      <linearGradient id="sessionTrendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '14px', border: 'none', background: '#0f172a', color: '#fff' }}
                      formatter={(val: any) => [`${val} Consultations`, 'Sessions']}
                    />
                    <Area type="monotone" dataKey="sessions" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#sessionTrendGradient)" />
                  </AreaChart>
                </ResponsiveContainer>}
              </div>
            </div>
          </div>

          {/* Right Column — Session Types + Recent Messages */}
          <div className="space-y-6">

            {/* Session Types Distribution */}
            <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-900 shadow-sm p-6 space-y-4">
              <h3 className="font-extrabold text-gray-900 dark:text-zinc-100 text-base">Modality Distribution</h3>
              <div className="h-44">
                {sessionTypes.length === 0 ? <div className="h-full flex items-center justify-center text-xs text-gray-400">No data available.</div> : <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sessionTypes} cx="50%" cy="50%" innerRadius={45} outerRadius={68} paddingAngle={4} dataKey="value">
                      {sessionTypes.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', background: '#0f172a', color: '#fff', border: 'none' }} />
                  </PieChart>
                </ResponsiveContainer>}
              </div>
              <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-zinc-900">
                {sessionTypes.map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-md" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-gray-700 dark:text-zinc-300">{d.name}</span>
                    </div>
                    <span className="font-extrabold text-gray-900 dark:text-zinc-100">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Messages Quick Feed */}
            <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-gray-100 dark:border-zinc-900 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-gray-900 dark:text-zinc-100 text-base">Patient Messages</h3>
                <Button 
                  onClick={() => setLocation('/therapist/messages')}
                  variant="ghost" 
                  size="sm" 
                  className="text-xs font-bold text-emerald-600 hover:bg-emerald-50 h-7 px-2"
                >
                  Open Inbox
                </Button>
              </div>

              <div className="space-y-3">
                {recentMessages.length === 0 ? <p className="py-5 text-center text-xs text-gray-400">No messages yet.</p> : recentMessages.map((t: any, i: number) => (
                  <div 
                    key={i} 
                    onClick={() => {
                      setActiveChatUserId(t.name);
                      setLocation("/therapist/messages");
                    }}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 dark:border-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-900/50 cursor-pointer transition-all"
                  >
                    <Avatar className="h-9 w-9 shrink-0 border border-emerald-500/20">
                      <AvatarFallback className="text-xs bg-emerald-500/10 text-emerald-600 font-bold">{(t.name || 'P')[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-900 dark:text-zinc-100 truncate">{t.name}</p>
                        <span className="text-[10px] text-gray-400 font-medium">{new Date(t.time).toLocaleString()}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate mt-0.5">{t.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );

  return content;
}
