/**
 * MindCare — Central Mental Health Risk Engine
 *
 * Multi-factor, confidence-scored risk detection across all communication channels.
 * Never triggers emergency based on a single message.
 * Maintains a 24-hour rolling window per user.
 * Deduplication: no new emergency workflow within 30 minutes of the last.
 */

import mongoose from "mongoose";
import { RiskAssessment } from "../models/RiskAssessment.ts";
import { Mood } from "../models/Mood.ts";
import { Chat } from "../models/Chat.ts";
import { Journal } from "../models/Journal.ts";
import { User } from "../models/User.ts";
import { EmergencyContact } from "../models/EmergencyContact.ts";
import { EmergencyEvent } from "../models/EmergencyEvent.ts";
import { EmergencyAlert } from "../models/EmergencyAlert.ts";
import { Notification } from "../models/Notification.ts";
import { LocationService } from "./locationService.ts";
import { EmergencyNotifier } from "./emergencyNotifier.ts";
import { CrisisEscalation } from "./crisisEscalation.ts";
import { logActivity } from "../utils/auditLogger.ts";

// ─── Signal Score Table ──────────────────────────────────────────────────────
const SIGNAL_SCORES: Record<string, number> = {
  direct_suicidal_statement: 65,
  self_harm_reference:       52,
  hopelessness:              28,
  worthlessness:             25,
  social_isolation:          18,
  severe_mood_crash:         22,
  journal_distress:          22,
  peer_chat_crisis:          45,
  voice_distress:            20,
  behavioral_pattern:        15,
  repeated_crisis_signal:    12,   // per repeat beyond first
  academic_pressure_severe:  15,
  work_pressure_severe:      15,
  relationship_crisis:       18,
  sleep_crisis:              12,
  family_crisis:             18,
  panic_expression:          20,
};

// ─── Critical Patterns (language-aware) ─────────────────────────────────────
const SUICIDAL_PATTERNS = [
  // English
  /\b(i want to|i'm going to|i will|i'm planning to|i've decided to)\s+(kill myself|end my life|take my life|die|not live|commit suicide)\b/i,
  /\b(kill myself|end my life|take my life|want to die|don't want to live|no reason to live|better off dead|should just die|wish i was dead|wish i were dead)\b/i,
  /\b(suicide|suicidal|hang myself|overdose myself|jump off|slit my wrists|bleed out)\b/i,
  // Hindi / Hinglish
  /\b(marna chahta|marna chahti|jeena nahi|zindagi khatam|suicide karna|khud ko maar)\b/i,
  // Spanish
  /\b(quiero morir|voy a suicidarme|matarme|suicidarme|sin razón para vivir)\b/i,
  // Generic despair
  /\b(no point in living|life is meaningless|nothing left to live for|everyone would be better without me)\b/i,
];

const SELF_HARM_PATTERNS = [
  /\b(cut myself|cutting myself|hurt myself|harm myself|burn myself|bruise myself|scratch myself|hit myself)\b/i,
  /\b(self[- ]harm|self[- ]hurt|self[- ]injur)\b/i,
  /\b(razorblade|razor blade|knife on my|pills to hurt)\b/i,
];

const HOPELESSNESS_PATTERNS = [
  /\b(no hope|hopeless|pointless|nothing matters|nothing will get better|never get better|it's useless|things will never change|i can't go on|i give up|i've given up)\b/i,
  /\b(no future|can't see a future|don't see the point|what's the point|why bother|why even try)\b/i,
];

const WORTHLESSNESS_PATTERNS = [
  /\b(i'm worthless|i am worthless|i'm a burden|i am a burden|no one cares|nobody cares|no one would miss me|nobody would miss me|i'm useless|i am useless|i hate myself|i'm a failure|i am a failure)\b/i,
];

const SOCIAL_ISOLATION_PATTERNS = [
  /\b(so alone|completely alone|no one to talk to|nobody to talk to|no friends|no one loves me|nobody loves me|isolated|cut off from everyone|abandoned by everyone)\b/i,
];

const PANIC_PATTERNS = [
  /\b(can't breathe|cant breathe|heart racing|shaking uncontrollably|having a breakdown|falling apart|losing my mind|going crazy|losing control)\b/i,
];

const ABUSE_VIOLENCE_PATTERNS = [
  /\b(hit me|beat me|abused|abusing|abusive|assaulted|threatened to hurt|domestic violence|physical abuse|sexual abuse)\b/i,
];

const TRAUMA_PATTERNS = [
  /\b(flashbacks|nightmares|trauma|traumatized|can't forget what happened|haunted by)\b/i,
];

const BURNOUT_PATTERNS = [
  /\b(completely burnt out|burnout|exhausted mentally|can't function|drained|no energy to live|total exhaustion)\b/i,
];

const JOURNAL_DISTRESS_PATTERNS = [
  /\b(don't want to wake up|didn't want to wake up|today was my last|goodbye to everyone|leaving everything behind|can't do this anymore|i'm done|i'm finished|end it all)\b/i,
  ...HOPELESSNESS_PATTERNS,
  ...WORTHLESSNESS_PATTERNS,
];

export interface RiskSignal {
  type: string;
  score: number;
  detail: string;
  source: string;
}

export interface RiskAnalysisResult {
  signals: RiskSignal[];
  totalScore: number;
  riskLevel: "none" | "low" | "elevated" | "high" | "critical";
  shouldTriggerEmergency: boolean;
  isDuplicate: boolean;
  record?: any;
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text));
}

function scoreToLevel(score: number): "none" | "low" | "elevated" | "high" | "critical" {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 30) return "elevated";
  if (score >= 10) return "low";
  return "none";
}

export function extractTextSignals(text: string, source: string): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const t = text.trim();

  if (matchesAny(t, SUICIDAL_PATTERNS)) {
    signals.push({ type: "direct_suicidal_statement", score: SIGNAL_SCORES.direct_suicidal_statement, detail: `Suicidal expression detected`, source });
  }

  if (matchesAny(t, SELF_HARM_PATTERNS)) {
    signals.push({ type: "self_harm_reference", score: SIGNAL_SCORES.self_harm_reference, detail: `Self-harm reference detected`, source });
  }

  if (matchesAny(t, HOPELESSNESS_PATTERNS)) {
    signals.push({ type: "hopelessness", score: SIGNAL_SCORES.hopelessness, detail: `Hopelessness expression detected`, source });
  }

  if (matchesAny(t, WORTHLESSNESS_PATTERNS)) {
    signals.push({ type: "worthlessness", score: SIGNAL_SCORES.worthlessness, detail: `Worthlessness/burden expression detected`, source });
  }

  if (matchesAny(t, SOCIAL_ISOLATION_PATTERNS)) {
    signals.push({ type: "social_isolation", score: SIGNAL_SCORES.social_isolation, detail: `Social isolation detected`, source });
  }

  if (matchesAny(t, PANIC_PATTERNS)) {
    signals.push({ type: "panic_expression", score: SIGNAL_SCORES.panic_expression, detail: `Panic/breakdown expression detected`, source });
  }

  if (source === "peer_chat" && matchesAny(t, [...SUICIDAL_PATTERNS, ...SELF_HARM_PATTERNS])) {
    signals.push({ type: "peer_chat_crisis", score: SIGNAL_SCORES.peer_chat_crisis, detail: `Crisis phrase in peer chat`, source });
  }

  return signals;
}

export function extractJournalSignals(content: string): RiskSignal[] {
  const signals: RiskSignal[] = [];
  if (matchesAny(content, JOURNAL_DISTRESS_PATTERNS)) {
    signals.push({ type: "journal_distress", score: SIGNAL_SCORES.journal_distress, detail: `Distress signals in journal entry`, source: "journal" });
  }
  if (matchesAny(content, SUICIDAL_PATTERNS)) {
    signals.push({ type: "direct_suicidal_statement", score: SIGNAL_SCORES.direct_suicidal_statement, detail: `Suicidal expression in journal`, source: "journal" });
  }
  if (matchesAny(content, SELF_HARM_PATTERNS)) {
    signals.push({ type: "self_harm_reference", score: SIGNAL_SCORES.self_harm_reference, detail: `Self-harm reference in journal`, source: "journal" });
  }
  return signals;
}

export async function analyzeMoodTrend(userId: string): Promise<RiskSignal[]> {
  const signals: RiskSignal[] = [];
  try {
    const recentMoods = await Mood.find({ userId }).sort({ date: -1 }).limit(7);
    if (recentMoods.length >= 3) {
      const lastThree = recentMoods.slice(0, 3);
      const allCrash = lastThree.every((m: any) => m.rating <= 2);
      const avgScore = recentMoods.reduce((acc: number, m: any) => acc + m.rating, 0) / recentMoods.length;

      if (allCrash) {
        signals.push({
          type: "severe_mood_crash",
          score: SIGNAL_SCORES.severe_mood_crash,
          detail: `Three consecutive mood ratings ≤ 2 (${lastThree.map((m: any) => m.rating).join(", ")})`,
          source: "mood",
        });
      } else if (avgScore < 2.5) {
        signals.push({
          type: "severe_mood_crash",
          score: 12,
          detail: `7-day average mood score critically low: ${avgScore.toFixed(1)}`,
          source: "mood",
        });
      }
    }
  } catch (err) {
    console.error("[RiskEngine] Mood trend analysis error:", err);
  }
  return signals;
}

export class MentalHealthRiskEngine {
  private static readonly EMERGENCY_THRESHOLD = 75;
  private static readonly DEDUP_WINDOW_MS = 30 * 60 * 1000;
  private static readonly SIGNAL_WINDOW_MS = 24 * 60 * 60 * 1000;

  static async analyzeMessage(
    userId: string,
    text: string,
    source: "ai_chat" | "peer_chat" | "imported_chat"
  ): Promise<RiskAnalysisResult> {
    const newSignals = extractTextSignals(text, source);
    return this._processSignals(userId, newSignals, source);
  }

  static async analyzeJournal(userId: string, content: string): Promise<RiskAnalysisResult> {
    const newSignals = extractJournalSignals(content);
    return this._processSignals(userId, newSignals, "journal");
  }

  static async analyzeMoods(userId: string): Promise<RiskAnalysisResult> {
    const newSignals = await analyzeMoodTrend(userId);
    return this._processSignals(userId, newSignals, "mood");
  }

  static async analyzeVoiceTranscript(
    userId: string,
    transcript: string,
    emotions: { despair?: number; panic?: number; anger?: number } = {}
  ): Promise<RiskAnalysisResult> {
    const newSignals = extractTextSignals(transcript, "voice_message");

    if ((emotions.despair || 0) > 0.65) {
      newSignals.push({ type: "voice_distress", score: SIGNAL_SCORES.voice_distress, detail: `High despair score in voice: emotions.despair`, source: "voice_message" });
    }
    if ((emotions.panic || 0) > 0.65) {
      newSignals.push({ type: "panic_expression", score: SIGNAL_SCORES.panic_expression, detail: `High panic score in voice: emotions.panic`, source: "voice_message" });
    }

    return this._processSignals(userId, newSignals, "voice_message");
  }

  static async getCurrentRisk(userId: string): Promise<{ score: number; level: string; record: any }> {
    const record = await RiskAssessment.findOne({ userId });
    if (!record) return { score: 0, level: "none", record: null };
    return {
      score: record.confidenceScore,
      level: record.riskLevel,
      record,
    };
  }

  static async updateLocation(userId: string, lat: number, lng: number, accuracy?: number) {
    await RiskAssessment.findOneAndUpdate(
      { userId },
      {
        $set: {
          "lastKnownLocation.lat": lat,
          "lastKnownLocation.lng": lng,
          "lastKnownLocation.accuracy": accuracy,
          "lastKnownLocation.capturedAt": new Date(),
        },
      },
      { upsert: true }
    );
  }

  /**
   * Helper that triggers the fully automated crisis response system workflow.
   * Invoked internally when confidence threshold is breached.
   */
  static async triggerEmergencyWorkflow(
    userId: string,
    triggerSource: string,
    triggerText: string,
    riskResult: RiskAnalysisResult
  ) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const trigger = riskResult.signals[0]?.type || "Severe crisis indicators detected";

      // 1. Get primary EmergencyContact
      let primaryContact = await EmergencyContact.findOne({ userId }).sort({ priority: 1 });
      if (!primaryContact && user.emergencyContact?.phone) {
        primaryContact = {
          name: user.emergencyContact.name || "Emergency Contact",
          relationship: user.emergencyContact.relation || "Family/Friend",
          phone: user.emergencyContact.phone,
          countryCode: "+91",
          email: undefined,
        } as any;
      }

      // 2. Fetch nearby support facilities
      const userLoc = riskResult.record?.lastKnownLocation;
      const nearbySupport = await LocationService.findNearbySupport(userLoc?.lat, userLoc?.lng);
      const mapsUrl = LocationService.getGoogleMapsLink(userLoc?.lat, userLoc?.lng);

      // 3. Dispatch Alerts to Emergency Contact (SMS, Email, WhatsApp)
      let dispatchResults: any[] = [];
      if (primaryContact) {
        dispatchResults = await EmergencyNotifier.dispatchAllAlerts(
          { name: user.name, email: user.email || undefined, phone: user.phone || undefined },
          { name: primaryContact.name, phone: `${primaryContact.countryCode}${primaryContact.phone}`, email: primaryContact.email || undefined },
          {
            score: riskResult.totalScore,
            triggerText,
            locationLink: mapsUrl,
            nearbyText: nearbySupport.slice(0, 3).map(f => `• ${f.name} (${f.distance}) - Phone: ${f.phone}`).join("\n"),
            summary: `Our proactive monitoring has flagged distress signals matching ${trigger}.`
          }
        );
      }

      // 4. Create permanent audit log Event
      const emergencyEvent = await EmergencyEvent.create({
        userId,
        userName: user.name,
        userEmail: user.email,
        userPhone: user.phone,
        triggerSource,
        triggerText,
        confidenceScore: riskResult.totalScore,
        riskFactors: riskResult.signals.map(s => ({
          type: s.type,
          score: s.score,
          detail: s.detail,
          source: s.source
        })),
        locationSnapshot: userLoc ? {
          lat: userLoc.lat,
          lng: userLoc.lng,
          accuracy: userLoc.accuracy,
          mapsUrl,
          address: "Reported coordinates"
        } : undefined,
        nearbyFacilities: nearbySupport,
        alertsSent: dispatchResults,
        conversationSummary: `Risk Engine detected severe crisis indicators via ${triggerSource}.`
      });

      // 5. Create EmergencyAlert
      const alert = await EmergencyAlert.create({
        userId,
        userName: user.name,
        detectedTrigger: trigger,
        messageContent: triggerText,
        riskLevel: riskResult.totalScore >= 75 ? "critical" : "high",
        confidenceScore: riskResult.totalScore,
        riskFactors: riskResult.signals,
        source: triggerSource as any,
        location: userLoc ? { lat: userLoc.lat, lng: userLoc.lng, mapsUrl } : undefined,
        nearbyFacilities: nearbySupport,
        alertsSent: dispatchResults,
        emergencyEventId: emergencyEvent._id
      });

      // 6. Broadcast via Sockets to Admin Room
      try {
        const { getIO } = await import("./socketService.ts");
        getIO().to("admin_room").emit("new_emergency_alert", alert);
      } catch (wsError) {
        console.log("No socket server available for broadcast.");
      }

      // Use the same explicit on-call offer/accept flow as chat SOS. The prior
      // implementation marked a random approved therapist as active before
      // they had confirmed availability, which could strand a person in crisis.
      const assignment = await CrisisEscalation.trigger(String(userId), `risk-${Date.now()}`, "risk_engine_critical");
      emergencyEvent.emergencyCaseId = assignment.emergencyCaseId as any;
      emergencyEvent.assignedTherapistId = assignment.therapist?.id as any;
      emergencyEvent.assignedTherapistName = assignment.therapist?.name;
      emergencyEvent.workflowStatus = assignment.connected ? "escalated" : "active";
      await emergencyEvent.save();

      // 8. Send standard notifications
      const admins = await User.find({ role: "admin" });
      for (const admin of admins) {
        await Notification.create({
          userId: admin._id,
          title: "EMERGENCY: High Risk Detected",
          message: `User ${user.name} has exceeded crisis threshold (${riskResult.totalScore}/100).`,
          type: "alert",
        });
      }

      await Notification.create({
        userId,
        title: "Please seek immediate help",
        message: "You are not alone. Please consider talking to a crisis line counsellor or calling emergency services.",
        type: "alert",
      });

      console.log(`[MentalHealthRiskEngine] Proactive crisis workflow complete for user: ${user.name}`);
    } catch (err) {
      console.error("[MentalHealthRiskEngine] Fatal error in emergency workflow execution:", err);
    }
  }

  private static async _processSignals(
    userId: string,
    newSignals: RiskSignal[],
    source: string
  ): Promise<RiskAnalysisResult> {
    if (newSignals.length === 0) {
      const existing = await RiskAssessment.findOne({ userId });
      return {
        signals: [],
        totalScore: existing?.confidenceScore || 0,
        riskLevel: (existing?.riskLevel as any) || "none",
        shouldTriggerEmergency: false,
        isDuplicate: false,
      };
    }

    let record = await RiskAssessment.findOne({ userId });
    if (!record) {
      record = await RiskAssessment.create({ userId });
    }

    const now = new Date();

    if (!record.windowStart || (now.getTime() - record.windowStart.getTime()) > this.SIGNAL_WINDOW_MS) {
      record.activeSignals = [] as any;
      record.signalCountInWindow = 0;
      record.windowStart = now;
    }

    const existingCriticalTypes = new Set(record.activeSignals.map((s: any) => s.type));
    const hasRepeat = newSignals.some(s => existingCriticalTypes.has(s.type));

    if (hasRepeat) {
      newSignals.push({
        type: "repeated_crisis_signal",
        score: SIGNAL_SCORES.repeated_crisis_signal,
        detail: "Repeated crisis signal detected within 24h window",
        source,
      });
    }

    const signalMap = new Map<string, any>();
    for (const s of record.activeSignals as any[]) {
      signalMap.set(s.type, s);
    }
    for (const s of newSignals) {
      const existing = signalMap.get(s.type);
      if (!existing || s.score > existing.score) {
        signalMap.set(s.type, { ...s, detectedAt: now });
      }
    }
    record.activeSignals = Array.from(signalMap.values()) as any;
    record.signalCountInWindow += newSignals.length;

    const totalScore = Math.min(
      100,
      Array.from(signalMap.values()).reduce((sum, s) => sum + (s.score || 0), 0)
    );
    record.confidenceScore = totalScore;
    record.riskLevel = scoreToLevel(totalScore) as any;
    record.lastAnalyzedAt = now;

    if (!record.sources.includes(source as any)) {
      record.sources.push(source as any);
    }

    const isDuplicate =
      record.lastEmergencyAt !== null &&
      record.lastEmergencyAt !== undefined &&
      now.getTime() - new Date(record.lastEmergencyAt).getTime() < this.DEDUP_WINDOW_MS;

    const shouldTriggerEmergency = totalScore >= this.EMERGENCY_THRESHOLD && !isDuplicate;

    if (shouldTriggerEmergency) {
      record.lastEmergencyAt = now;
      record.suppressUntil = new Date(now.getTime() + this.DEDUP_WINDOW_MS);
      record.totalEmergenciesTriggered = (record.totalEmergenciesTriggered || 0) + 1;
    }

    await record.save();

    const result = {
      signals: newSignals,
      totalScore,
      riskLevel: scoreToLevel(totalScore),
      shouldTriggerEmergency,
      isDuplicate,
      record
    };

    // If trigger is validated, run the helper asynchronously in background
    if (shouldTriggerEmergency) {
      // Use setTimeout to run non-blocking in background
      setTimeout(() => {
        MentalHealthRiskEngine.triggerEmergencyWorkflow(userId, source, newSignals[0]?.detail || "Distress indicator", result);
      }, 0);
    }

    return result;
  }
}
