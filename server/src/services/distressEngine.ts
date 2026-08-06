import { DistressEventModel } from "../models/DistressEvent.ts";
import { CognitiveContextPackage } from "./cognitive/types.ts";
import { CrisisEscalation } from "./crisisEscalation.ts";
import { subMinutes } from "date-fns";
import { EmergencyContact } from "../models/EmergencyContact.ts";
import { EmergencyNotifier } from "./emergencyNotifier.ts";
import { User } from "../models/User.ts";

export interface DistressWindowStatus {
  count: number;
  threshold: number;
  windowMinutes: number;
  therapistConnection?: {
    connected: boolean;
    emergencySessionId?: string;
    therapist?: { id: string; name: string };
  };
  contactAlertTriggered?: boolean;
}

/**
 * DistressEngine records each message's distress assessment and evaluates
 * whether a continuous distress condition has been met.
 */
export class DistressEngine {
  /** Record a distress event for the current message */
  static async recordEvent(params: {
    userId: string;
    sessionId: string;
    messageId?: string;
    distressLevel: number; // 0‑4
    severityScore: number; // 0‑100
    emotions: Record<string, number>;
    riskFlags: string[];
    context?: CognitiveContextPackage;
    channel?: "ai" | "peer" | "therapist";
  }): Promise<DistressWindowStatus> {
    const { userId, sessionId, messageId, distressLevel, severityScore, emotions, riskFlags } = params;
    const channel = params.channel || "ai";
    await DistressEventModel.create({
      userId,
      sessionId,
      messageId,
      distressLevel,
      severityScore,
      emotions,
      riskFlags,
      channel,
    });
    try {
      // Immediate escalation for critical severity (suicide risk)
      if ((channel === "ai" && distressLevel >= 4) || (channel === "peer" && distressLevel >= 4)) {
        const therapistConnection = await CrisisEscalation.trigger(userId, sessionId, `${channel}_immediate_risk`);
        return { count: 1, threshold: 1, windowMinutes: 0, therapistConnection };
      }
      // After persisting, evaluate window for possible escalation
      return await this.evaluateWindow(userId, sessionId, channel);
    } catch (error: any) {
      console.error("[DistressEngine] Escalation workflow failed; preserving chat response:", error?.message || error);
      return { count: 0, threshold: Number(process.env.DISTRESS_HIGH_COUNT || "5"), windowMinutes: Number(process.env.DISTRESS_WINDOW_MINUTES || "10") };
    }
  }

  /**
   * Checks the last configured window (default 10 minutes) for 5+ HIGH/CRITICAL events.
   * If condition met, triggers CrisisEscalation.
   */
  static async evaluateWindow(userId: string, sessionId: string, channel: "ai" | "peer" | "therapist" = "ai"): Promise<DistressWindowStatus> {
    const windowMinutes = Number(process.env.DISTRESS_WINDOW_MINUTES || "10");
    const highCountThreshold = channel === "ai"
      ? Number(process.env.AI_THERAPIST_CONNECT_COUNT || "2")
      : channel === "peer"
        ? Number(process.env.PEER_DISTRESS_COUNT || "2")
        : Number(process.env.THERAPIST_CHAT_CONTACT_ALERT_COUNT || "5");
    const criticalCountThreshold = Number(process.env.DISTRESS_CRITICAL_COUNT || "5");
    const windowStart = subMinutes(new Date(), windowMinutes);

    // A sustained pattern of moderate, high, or critical distress needs a
    // therapist connection even when no single message is immediately critical.
    const events = await DistressEventModel.find({
      userId,
      sessionId,
      channel,
      timestamp: { $gte: windowStart },
    }).lean();
    const distressEvents = events.filter(e => e.distressLevel >= 2);
    const critical = events.filter(e => e.distressLevel === 4);

    const contactThreshold = channel === "peer"
      ? Number(process.env.PEER_CONTACT_ALERT_COUNT || "5")
      : Number(process.env.THERAPIST_CHAT_CONTACT_ALERT_COUNT || "5");
    let contactAlertTriggered = false;
    if ((channel === "peer" || channel === "therapist") && distressEvents.length >= contactThreshold) {
      const alreadyAlerted = await DistressEventModel.exists({ userId, sessionId, channel, contactAlertTriggered: true, timestamp: { $gte: windowStart } });
      if (!alreadyAlerted) {
        contactAlertTriggered = await this.dispatchContactAlert(userId, channel);
        if (contactAlertTriggered) await DistressEventModel.updateOne({ userId, sessionId, channel, timestamp: { $gte: windowStart } }, { $set: { contactAlertTriggered: true } }).sort({ timestamp: -1 });
      }
      if (channel === "therapist") return { count: distressEvents.length, threshold: contactThreshold, windowMinutes, contactAlertTriggered };
    }

    if ((channel === "ai" || channel === "peer") && (distressEvents.length >= highCountThreshold || critical.length >= criticalCountThreshold)) {
      // Trigger escalation only once per active session
      const therapistConnection = await CrisisEscalation.trigger(userId, sessionId, "continuous_distress");
      return { count: distressEvents.length, threshold: highCountThreshold, windowMinutes, therapistConnection, contactAlertTriggered };
    }

    return { count: distressEvents.length, threshold: highCountThreshold, windowMinutes, contactAlertTriggered };
  }

  private static async dispatchContactAlert(userId: string, channel: "peer" | "therapist"): Promise<boolean> {
    const user = await User.findById(userId);
    if (!user || user.notificationPreferences?.crisis === false) return false;
    const contacts = await EmergencyContact.find({ userId }).sort({ priority: 1 });
    if (!contacts.length) return false;
    // Contact content intentionally contains no chat quotation or diagnosis.
    await Promise.all(contacts.map(contact => EmergencyNotifier.dispatchAllAlerts(
      { name: user.name, email: user.email || undefined, phone: user.phone || undefined },
      { name: contact.name, phone: `${contact.countryCode}${contact.phone}`, email: contact.email || undefined },
      { score: 100, triggerText: "Repeated safety concern during a live support conversation", locationLink: "Location unavailable", nearbyText: "Call 112 or Tele-MANAS 14416 if immediate danger is suspected.", summary: `MindCare detected repeated safety concerns during a live ${channel === "peer" ? "peer" : "therapist"} conversation.` }
    )));
    return true;
  }
}
