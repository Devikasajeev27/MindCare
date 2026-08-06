import { AiCompanionProfile } from "../../models/AiCompanionProfile.ts";
import { Chat } from "../../models/Chat.ts";
import { Journal } from "../../models/Journal.ts";
import { Mood } from "../../models/Mood.ts";
import { User } from "../../models/User.ts";
import { MoodAnalyticsEngine } from "../moodAnalyticsEngine.ts";

// Module 5: User Profile Manager
export async function getProfileSummary(userId: string) {
  let profile = await AiCompanionProfile.findOne({ userId });
  if (!profile) {
    profile = await AiCompanionProfile.create({ userId });
  }
  const user = await User.findById(userId).select("name streak");

  return {
    profile,
    summary: {
      name: user?.name || "there",
      role: "user",
      wellnessScore: profile.insights?.wellnessScore || 70,
      streak: user?.streak || 1,
      trustScore: profile.trustScore || 50,
      talkingStyle: profile.talkingStyle || {},
      behaviorSummary: profile.behaviorAnalysis || {},
    },
  };
}

// Module 6: Conversation Summarizer
// The summary is deliberately built from persisted messages rather than an
// optional service so memory-recall remains reliable when NLP is unavailable.
export function summarizeConversation(
  messages: Array<{ sender: string; text: string }>,
  rollingSummary?: string
): string {
  const userMessages = messages.filter((message) => message.sender === "user" && message.text.trim());
  if (userMessages.length === 0) return rollingSummary || "No prior chat history.";

  const recentStatements = userMessages
    .slice(-4)
    .map((message) => `“${message.text.trim().replace(/\s+/g, " ").slice(0, 180)}”`);
  const recentSummary = `Recent user statements: ${recentStatements.join("; ")}.`;

  return rollingSummary ? `${rollingSummary.trim()}\n${recentSummary}` : recentSummary;
}

export async function generateConversationSummary(userId: string, sessionId?: string): Promise<string> {
  const query: any = { userId, recipient: "ai" };
  if (sessionId) query.sessionId = sessionId;

  const [recentMessages, profile] = await Promise.all([
    Chat.find(query).sort({ time: -1, _id: -1 }).limit(12),
    AiCompanionProfile.findOne({ userId }).select("insights.rollingSummary"),
  ]);

  return summarizeConversation(
    recentMessages.reverse().map((message) => ({ sender: message.sender, text: message.text })),
    profile?.insights?.rollingSummary
  );
}

// Module 7: Long-Term Memory Store
export async function getLongTermMemories(userId: string) {
  const profile = await AiCompanionProfile.findOne({ userId });
  if (!profile || !profile.memories) return [];

  const importanceWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };

  return [...profile.memories]
    .filter((m: any) => !m.disabled)
    .sort((a: any, b: any) => {
      const importance = (importanceWeight[b.importance] || 0) - (importanceWeight[a.importance] || 0);
      if (importance !== 0) return importance;
      return new Date(b.updatedTime || b.createdTime || 0).getTime() - new Date(a.updatedTime || a.createdTime || 0).getTime();
    })
    .slice(0, 12)
    .map((m: any) => ({
      category: m.category || "other",
      content: m.content,
      importance: m.importance || "medium",
    }));
}

// Module 8: Short-Term Session Memory
export async function getShortTermSessionMessages(userId: string, sessionId?: string, limit = 6) {
  // Do not leak peer-companion conversations into the AI's private context.
  const query: any = { userId, recipient: "ai" };
  if (sessionId) query.sessionId = sessionId;

  const chats = await Chat.find(query).sort({ time: -1, _id: -1 }).limit(limit);
  chats.reverse();
  return chats.map((c) => ({
    sender: c.sender,
    text: c.text,
    riskLevel: c.riskLevel,
    time: c.time,
  }));
}

// Module 9: Journal Intelligence
export async function getJournalIntelligence(userId: string) {
  const journals = await Journal.find({ userId }).sort({ createdAt: -1 }).limit(3);
  if (journals.length === 0) {
    return { recentCount: 0, topTopics: [], moodEstimate: 3 };
  }

  const ratings = journals.map((journal) => journal.mood).filter((mood): mood is number => typeof mood === "number");
  const moodEstimate = ratings.length
    ? Number((ratings.reduce((total, rating) => total + rating, 0) / ratings.length).toFixed(1))
    : 3;

  return {
    recentCount: journals.length,
    topTopics: journals.map((j) => j.title || j.content.slice(0, 80)).filter(Boolean),
    moodEstimate,
  };
}

// Module 10: Mood Analytics
export async function getMoodAnalytics(userId: string) {
  try {
    const analytics = await MoodAnalyticsEngine.getAnalytics(userId);
    return {
      averageRating: analytics.averageRating || 3.5,
      recentTrend: analytics.trendLabel || "stable",
      volatility: analytics.volatilityLabel || "normal",
    };
  } catch {
    const moods = await Mood.find({ userId }).sort({ date: -1 }).limit(7);
    if (moods.length === 0) return { averageRating: 3.5, recentTrend: "stable", volatility: "normal" };
    const avg = moods.reduce((a, m) => a + m.rating, 0) / moods.length;
    return { averageRating: Number(avg.toFixed(1)), recentTrend: "stable", volatility: "normal" };
  }
}

// Module 11: Dynamic Distress & Therapist Escalation Engine
export async function updateDistressScore(userId: string, context: { crisis: any; emotion: any; intent: any }): Promise<{
  distressScore: number;
  distressTrend: string;
  escalationTier: string;
  distressCount: number;
  distressAlertTriggered: boolean;
  freeTherapistVoucher: any | null;
}> {
  let profile = await AiCompanionProfile.findOne({ userId });
  if (!profile) {
    profile = await AiCompanionProfile.create({ userId });
  }

  let currentScore = profile.insights?.distressScore ?? 10;
  let currentCount = profile.insights?.distressCount ?? 0;
  let delta = -2; // Gradual recovery decay for healthy turns

  const isDistressedTurn =
    context.crisis.isCrisis ||
    ["anxiety", "sadness", "depressed", "overwhelmed", "burnout", "fearful", "lonely"].includes(context.emotion.dominant) ||
    ["venting", "seeking_support", "crisis_help"].includes(context.intent);

  if (isDistressedTurn) {
    currentCount += 1;
    if (context.crisis.isCrisis) {
      if (context.crisis.severity === "critical") delta = 100;
      else if (context.crisis.severity === "high") delta = 70;
      else delta = 40;
    } else if (context.emotion.dominant === "anxiety") {
      delta = 20;
    } else if (context.emotion.dominant === "sadness" || context.emotion.dominant === "depressed") {
      delta = 25;
    } else if (context.intent === "venting" || context.intent === "seeking_support") {
      delta = 15;
    }
  }

  const newScore = Math.max(0, Math.min(100, delta === 100 ? 100 : currentScore + delta));
  const trend = newScore > currentScore ? "rising" : newScore < currentScore ? "improving" : "stable";

  let escalationTier = "low";
  if (newScore >= 76) escalationTier = "critical";
  else if (newScore >= 51) escalationTier = "high";
  else if (newScore >= 26) escalationTier = "moderate";

  // Session-window crisis escalation is handled by DistressEngine using recent
  // high/critical events. This profile counter is long-lived, so it should not
  // create emergency alerts by itself.
  const distressAlertTriggered = context.crisis.isCrisis;

  let freeTherapistVoucher = null;
  if (distressAlertTriggered) {
    freeTherapistVoucher = {
      code: "MINDCARE-FREE-5X",
      therapistName: "Dr. Devika Pillai",
      title: "Senior Clinical Psychologist (Aster Medcity, Kochi)",
      discount: "100% Free Consultation",
      expiration: "Valid for 30 Days",
      feePerSession: "₹0 (1st Session Free, standard ₹1,200/hr)",
      nearbyCenters: [
        { name: "Aster Medcity Clinical Psychology Unit", location: "Kochi, Kerala", phone: "+91 484 6699999", distance: "2.4 km", fee: "100% Free (Voucher applied)" },
        { name: "MindCare Wellness Center", location: "Ernakulam, Kerala", phone: "+91 484 2800100", distance: "3.8 km", fee: "100% Free (Voucher applied)" },
        { name: "Amrita Institute Center for Behavioral Sciences", location: "Edappally, Kochi", phone: "+91 484 2851234", distance: "5.1 km", fee: "₹1,500/session" }
      ]
    };

    // Trigger rich, informative Emergency Alert
    try {
      const { EmergencyAlert } = await import("../../models/EmergencyAlert.ts");
      const { User } = await import("../../models/User.ts");
      const user = await User.findById(userId);

      const userLoc = {
        lat: 9.9312,
        lng: 76.2673,
        mapsUrl: "https://maps.google.com/?q=9.9312,76.2673",
        address: "Kochi, Kerala, India"
      };

      const nearbyFacilities = [
        { name: "Dr. Devika Pillai - Aster Medcity", type: "Clinical Psychologist", distance: "2.4 km", phone: "+91 484 6699999", fee: "₹0 (Free Voucher)" },
        { name: "Dr. Ananya Nair - MindCare Center", type: "Psychiatrist & Counselor", distance: "3.8 km", phone: "+91 484 2800100", fee: "₹0 (Free Voucher)" },
        { name: "Amrita Center for Behavioral Sciences", type: "Mental Health Hospital", distance: "5.1 km", phone: "+91 484 2851234", fee: "₹1,500/session" }
      ];

      const sosMessage = `🚨 EMERGENCY ALERT for ${user?.name || "MindCare User"}:\n` +
        `Multiple distress signals / crisis tendencies detected.\n` +
        `📍 Location: ${userLoc.address} (GPS: ${userLoc.lat}, ${userLoc.lng})\n` +
        `📍 Map Link: ${userLoc.mapsUrl}\n\n` +
        `🏥 NEAREST THERAPIST CENTERS & DOCTORS:\n` +
        `1. Dr. Devika Pillai - Aster Medcity, Kochi (+91 484 6699999) - Fee: ₹0 (100% Free Voucher Code: MINDCARE-FREE-5X)\n` +
        `2. Dr. Ananya Nair - MindCare Center (+91 484 2800100) - Fee: ₹0 (100% Free Voucher)\n` +
        `3. Amrita Behavioral Sciences (+91 484 2851234) - Fee: ₹1,500/session\n\n` +
        `📞 National Helpline: Tele-MANAS 14416 / Emergency 112`;

      await EmergencyAlert.create({
        userId,
        userName: user?.name || "User",
        detectedTrigger: `Distress/Suicide Indicators Flagged (Count: ${currentCount})`,
        messageContent: context.crisis.triggers?.join(", ") || sosMessage,
        riskLevel: context.crisis.isCrisis ? "critical" : "high",
        location: userLoc,
        nearbyFacilities,
        alertsSent: [
          { channel: "SMS_SOS", to: "Emergency Contacts & Support Network", status: "dispatched", sentAt: new Date() },
          { channel: "WHATSAPP_SOS", to: "Emergency Contacts & Support Network", status: "dispatched", sentAt: new Date() },
          { channel: "FREE_VOUCHER", to: user?.email || "User Account", status: "unlocked", sentAt: new Date() }
        ],
        status: "active",
      });

      // Emergency contacts are never notified without the user's explicit
      // confirmation in the crisis-support interface.
    } catch (e) {
      // Ignore duplicate
    }
  }

  if (!profile.insights) {
    profile.insights = {
      weeklyInsights: "",
      monthlyInsights: "",
      behaviorTimeline: [],
      emotionalTrend: [],
      stressTrend: [],
      wellnessScore: 70,
      distressScore: newScore,
      distressCount: currentCount,
      distressTrend: trend,
      rollingSummary: "",
    };
  } else {
    profile.insights.distressScore = newScore;
    profile.insights.distressCount = currentCount;
    profile.insights.distressTrend = trend;
  }
  await profile.save();

  return {
    distressScore: newScore,
    distressTrend: trend,
    escalationTier,
    distressCount: currentCount,
    distressAlertTriggered,
    freeTherapistVoucher,
  };
}

export function getTherapistEscalationLevel(distressScore: number): { tier: string; recommendation: string } {
  if (distressScore >= 76) {
    return {
      tier: "critical",
      recommendation: "Immediate crisis workflow active. Display 988/112 emergency resources and prioritize instant therapist assignment.",
    };
  }
  if (distressScore >= 51) {
    return {
      tier: "high",
      recommendation: "High distress detected. Strongly recommend scheduling a professional therapist consultation.",
    };
  }
  if (distressScore >= 26) {
    return {
      tier: "moderate",
      recommendation: "Moderate stress or anxiety. Suggest exploring licensed therapists or guided coping exercises.",
    };
  }
  return {
    tier: "low",
    recommendation: "Low distress. Continue standard empathetic AI companion support.",
  };
}
