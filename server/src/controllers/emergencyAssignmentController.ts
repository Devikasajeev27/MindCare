import { Response } from "express";
import { AuthRequest } from "../middleware/auth.ts";
import { EmergencyCase } from "../models/EmergencyCase.ts";
import { Therapist } from "../models/Therapist.ts";
import { CrisisEscalation } from "../services/crisisEscalation.ts";
import { EmergencyAssignmentService } from "../services/emergencyAssignmentService.ts";

export async function triggerManualSOS(req: AuthRequest, res: Response) {
  const assignment = await CrisisEscalation.trigger(String(req.user._id), `manual-${Date.now()}`, "manual_sos");
  return res.status(202).json({ assignment });
}

export async function updateEmergencyOnCall(req: AuthRequest, res: Response) {
  const onCall = req.body?.onCall === true;
  if (!onCall) {
    const activeCase = await EmergencyCase.exists({ therapistId: req.user._id, status: "active" });
    if (activeCase) {
      return res.status(409).json({ message: "End or transfer the active emergency case before leaving emergency on-call duty." });
    }
  }
  const current = await Therapist.findOne({ userId: req.user._id, verificationStatus: "Verified" });
  if (!current) return res.status(404).json({ message: "A verified therapist profile is required for emergency on-call duty." });
  const profile = await Therapist.findOneAndUpdate(
    { userId: req.user._id, verificationStatus: "Verified" },
    { $set: { emergencyOnCall: onCall, emergencyStatus: onCall ? (current.emergencyStatus === "busy" ? "busy" : "available") : "offline" } },
    { new: true }
  );
  return res.status(200).json({ onCall: profile!.emergencyOnCall, status: profile!.emergencyStatus });
}

export async function getEmergencyAssignments(req: AuthRequest, res: Response) {
  const cases = await EmergencyCase.find({ therapistId: req.user._id, status: { $in: ["pending", "active"] } })
    .populate("userId", "name")
    .sort({ createdAt: -1 });
  return res.status(200).json({ cases });
}

export async function acceptEmergencyAssignment(req: AuthRequest, res: Response) {
  const assignment = await EmergencyAssignmentService.acceptCase(req.params.caseId, String(req.user._id));
  if (!assignment) return res.status(409).json({ message: "This emergency offer has expired, been reassigned, or is no longer available." });
  return res.status(200).json({ assignment });
}

export async function declineEmergencyAssignment(req: AuthRequest, res: Response) {
  const assignment = await EmergencyAssignmentService.declineCase(req.params.caseId, String(req.user._id));
  if (!assignment) return res.status(409).json({ message: "This emergency offer is no longer available." });
  return res.status(200).json({ assignment });
}
