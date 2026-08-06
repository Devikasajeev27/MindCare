import { Types } from "mongoose";
import { EmergencyEvent } from "../models/EmergencyEvent.ts";
import { User } from "../models/User.ts";
import { logActivity } from "../utils/auditLogger.ts";
import { EmergencyAssignmentResult, EmergencyAssignmentService } from "./emergencyAssignmentService.ts";

/** Coordinates crisis audit records with the explicit emergency on-call workflow. */
export class CrisisEscalation {
  static async trigger(userId: string, sessionId: string, reason = "auto"): Promise<EmergencyAssignmentResult> {
    const assignment = await EmergencyAssignmentService.offerCase(userId, reason);
    const user = await User.findById(userId);

    const event = await EmergencyEvent.create({
      userId: new Types.ObjectId(userId),
      sessionId,
      emergencyCaseId: assignment.emergencyCaseId,
      triggerSource: reason === "manual_sos" ? "manual" : "ai_chat",
      triggerText: reason,
      confidenceScore: 100,
      riskFactors: [{ type: "crisis_escalation", score: 100, detail: reason, source: "ai_chat" }],
      workflowStatus: assignment.connected ? "escalated" : "active",
      locationSnapshot: null,
      assignedTherapistId: assignment.therapist?.id,
      assignedTherapistName: assignment.therapist?.name,
    });

    if (user) {
      await logActivity({
        userId,
        userName: user.name,
        userEmail: user.email,
        role: user.role,
        action: "CRISIS_ESCALATION_TRIGGERED",
        status: "success",
        details: `Reason: ${reason}, assignment: ${assignment.connected ? "accepted" : assignment.pending ? "pending" : "unassigned"}, event: ${event._id}`,
        req: null as any,
      });
    }
    return assignment;
  }
}
