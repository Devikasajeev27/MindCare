import { Types } from "mongoose";
import { EmergencyCase } from "../models/EmergencyCase.ts";
import { EmergencySession } from "../models/EmergencySession.ts";
import { Notification } from "../models/Notification.ts";
import { Therapist } from "../models/Therapist.ts";
import { User } from "../models/User.ts";

const OFFER_TIMEOUT_MS = Number(process.env.EMERGENCY_ACCEPT_TIMEOUT_SECONDS || "120") * 1000;

export type EmergencyAssignmentResult = {
  connected: boolean;
  pending: boolean;
  emergencyCaseId?: string;
  emergencySessionId?: string;
  offerExpiresAt?: Date;
  therapist?: { id: string; name: string };
  reason?: "no_on_call_therapist";
};

/**
 * Keeps emergency duty independent from a therapist's normal appointment hours.
 * A clinician is reserved only while considering an offer and an emergency
 * session is created only after their explicit acceptance.
 */
export class EmergencyAssignmentService {
  private static async reserveNextTherapist(excludedIds: string[] = []) {
    const candidates = await Therapist.find({
      verificationStatus: "Verified",
      emergencyOnCall: true,
      emergencyStatus: "available",
      userId: { $exists: true, $ne: null, $nin: excludedIds.map(id => new Types.ObjectId(id)) },
    }).sort({ patientsCount: 1, updatedAt: 1 });

    for (const candidate of candidates) {
      const reserved = await Therapist.findOneAndUpdate(
        { _id: candidate._id, emergencyOnCall: true, emergencyStatus: "available" },
        { $set: { emergencyStatus: "busy" } },
        { new: true }
      );
      if (!reserved?.userId) continue;

      const user = await User.findById(reserved.userId).select("name role status");
      if (user?.role === "therapist" && user.status === "approved") {
        return { profile: reserved, user };
      }

      await Therapist.findByIdAndUpdate(reserved._id, { $set: { emergencyStatus: "available" } });
    }
    return null;
  }

  private static async releaseTherapist(therapistId?: Types.ObjectId | string | null) {
    if (!therapistId) return;
    await Therapist.findOneAndUpdate(
      { userId: therapistId, emergencyOnCall: true, emergencyStatus: "busy" },
      { $set: { emergencyStatus: "available" } }
    );
  }

  private static async notifyOffer(caseDoc: any, therapist: any) {
    await Notification.create({
      userId: therapist._id,
      title: "Emergency case awaiting acceptance",
      message: "An emergency support case is waiting for your response. Accept only when you can begin supporting the person now.",
      type: "alert",
    });
    return caseDoc;
  }

  static async offerCase(userId: string, reason: string): Promise<EmergencyAssignmentResult> {
    const existing = await EmergencyCase.findOne({ userId, status: { $in: ["pending", "active"] } }).sort({ createdAt: -1 });
    if (existing?.status === "active") {
      const session = await EmergencySession.findOne({ userId, emergencyCaseId: existing._id });
      const therapist = existing.therapistId ? await User.findById(existing.therapistId).select("name") : null;
      return {
        connected: Boolean(session && therapist),
        pending: false,
        emergencyCaseId: String(existing._id),
        emergencySessionId: session?._id ? String(session._id) : undefined,
        therapist: therapist ? { id: String(therapist._id), name: therapist.name } : undefined,
      };
    }
    if (existing?.status === "pending") {
      const therapist = existing.therapistId ? await User.findById(existing.therapistId).select("name") : null;
      return {
        connected: false,
        pending: true,
        emergencyCaseId: String(existing._id),
        offerExpiresAt: existing.offerExpiresAt || undefined,
        therapist: therapist ? { id: String(therapist._id), name: therapist.name } : undefined,
      };
    }

    const reserved = await this.reserveNextTherapist();
    if (!reserved) {
      const unassigned = await EmergencyCase.create({
        userId: new Types.ObjectId(userId),
        status: "unassigned",
        riskScore: "critical",
        assignmentAttempts: 0,
      });
      return { connected: false, pending: false, emergencyCaseId: String(unassigned._id), reason: "no_on_call_therapist" };
    }

    const offerExpiresAt = new Date(Date.now() + OFFER_TIMEOUT_MS);
    const caseDoc = await EmergencyCase.create({
      userId: new Types.ObjectId(userId),
      therapistId: reserved.user._id,
      status: "pending",
      riskScore: "critical",
      assignedAt: new Date(),
      offerExpiresAt,
      assignmentAttempts: 1,
      attemptedTherapistIds: [reserved.user._id],
    });
    await this.notifyOffer(caseDoc, reserved.user);
    return {
      connected: false,
      pending: true,
      emergencyCaseId: String(caseDoc._id),
      offerExpiresAt,
      therapist: { id: String(reserved.user._id), name: reserved.user.name },
    };
  }

  static async acceptCase(caseId: string, therapistId: string): Promise<EmergencyAssignmentResult | null> {
    const emergencyCase = await EmergencyCase.findOneAndUpdate(
      { _id: caseId, therapistId, status: "pending", offerExpiresAt: { $gt: new Date() } },
      { $set: { status: "active", acceptedAt: new Date() } },
      { new: true }
    );
    if (!emergencyCase) return null;

    const session = await EmergencySession.findOneAndUpdate(
      { userId: emergencyCase.userId, emergencyCaseId: emergencyCase._id },
      { $setOnInsert: { therapistId, price: 0, billingStatus: "Waived", sessionType: "Emergency Session" } },
      { upsert: true, new: true }
    );
    const therapist = await User.findById(therapistId).select("name");
    await Notification.create({
      userId: emergencyCase.userId,
      title: "Emergency therapist connected",
      message: "A crisis therapist has accepted your request and is ready to support you.",
      type: "alert",
    });
    return {
      connected: true,
      pending: false,
      emergencyCaseId: String(emergencyCase._id),
      emergencySessionId: String(session._id),
      therapist: therapist ? { id: String(therapist._id), name: therapist.name } : undefined,
    };
  }

  static async declineCase(caseId: string, therapistId: string) {
    const emergencyCase = await EmergencyCase.findOneAndUpdate(
      { _id: caseId, therapistId, status: "pending" },
      { $set: { status: "unassigned", offerExpiresAt: undefined } },
      { new: true }
    );
    if (!emergencyCase) return null;
    await this.releaseTherapist(therapistId);
    return this.reassignCase(emergencyCase);
  }

  static async reassignCase(caseDoc: any): Promise<EmergencyAssignmentResult> {
    if (caseDoc.status === "pending" && caseDoc.offerExpiresAt && caseDoc.offerExpiresAt > new Date()) {
      return { connected: false, pending: true, emergencyCaseId: String(caseDoc._id), offerExpiresAt: caseDoc.offerExpiresAt };
    }
    await this.releaseTherapist(caseDoc.therapistId);
    const attempted = (caseDoc.attemptedTherapistIds || []).map((id: any) => String(id));
    const reserved = await this.reserveNextTherapist(attempted);
    if (!reserved) {
      const unassigned = await EmergencyCase.findByIdAndUpdate(caseDoc._id, {
        $set: { status: "unassigned", therapistId: undefined, offerExpiresAt: undefined },
      }, { new: true });
      if (unassigned) {
        await Notification.create({
          userId: unassigned.userId,
          title: "No on-call therapist is available",
          message: "Please call 112 or Tele-MANAS at 14416 now. The emergency request remains recorded for follow-up.",
          type: "alert",
        });
      }
      return { connected: false, pending: false, emergencyCaseId: String(caseDoc._id), reason: "no_on_call_therapist" };
    }

    const offerExpiresAt = new Date(Date.now() + OFFER_TIMEOUT_MS);
    const reassigned = await EmergencyCase.findByIdAndUpdate(caseDoc._id, {
      $set: { therapistId: reserved.user._id, status: "pending", assignedAt: new Date(), offerExpiresAt },
      $inc: { assignmentAttempts: 1 },
      $addToSet: { attemptedTherapistIds: reserved.user._id },
    }, { new: true });
    await this.notifyOffer(reassigned, reserved.user);
    return {
      connected: false,
      pending: true,
      emergencyCaseId: String(reassigned?._id),
      offerExpiresAt,
      therapist: { id: String(reserved.user._id), name: reserved.user.name },
    };
  }

  static async reassignExpiredOffers() {
    const expiredCases = await EmergencyCase.find({ status: "pending", offerExpiresAt: { $lte: new Date() } });
    for (const emergencyCase of expiredCases) {
      const claimed = await EmergencyCase.findOneAndUpdate(
        { _id: emergencyCase._id, status: "pending", offerExpiresAt: { $lte: new Date() } },
        { $set: { status: "unassigned" } },
        { new: true }
      );
      if (claimed) await this.reassignCase(claimed);
    }
  }
}
