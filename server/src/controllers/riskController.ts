import { Response } from "express";
import { AuthRequest } from "../middleware/auth.ts";
import { RiskAssessment } from "../models/RiskAssessment.ts";
import { EmergencyEvent } from "../models/EmergencyEvent.ts";
import { EmergencyAlert } from "../models/EmergencyAlert.ts";
import { MentalHealthRiskEngine } from "../services/riskEngine.ts";
import { LocationService } from "../services/locationService.ts";
import { logActivity } from "../utils/auditLogger.ts";

/**
 * Frontend silent geolocator reporting receiver.
 */
export async function reportLocation(req: AuthRequest, res: Response) {
  try {
    const { lat, lng, accuracy } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ message: "Latitude and longitude required" });
    }

    await MentalHealthRiskEngine.updateLocation(req.user._id.toString(), lat, lng, accuracy);

    // If there is an active emergency event, update its location snapshot as well
    const activeEvent = await EmergencyEvent.findOne({
      userId: req.user._id,
      workflowStatus: "active"
    }).sort({ createdAt: -1 });

    if (activeEvent && !activeEvent.locationSnapshot?.lat) {
      const nearbySupport = await LocationService.findNearbySupport(lat, lng);
      const mapsUrl = LocationService.getGoogleMapsLink(lat, lng);

      activeEvent.locationSnapshot = {
        lat,
        lng,
        accuracy,
        mapsUrl,
        address: "Location reported via client GPS"
      };
      activeEvent.nearbyFacilities = nearbySupport as any;
      await activeEvent.save();

      // Also update any active EmergencyAlerts linked
      await EmergencyAlert.updateMany(
        { userId: req.user._id, status: "active" },
        {
          $set: {
            "location.lat": lat,
            "location.lng": lng,
            "location.mapsUrl": mapsUrl,
            nearbyFacilities: nearbySupport
          }
        }
      );
    }

    return res.status(200).json({ message: "Location updated successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

/**
 * Retrieve current user risk assessment details.
 */
export async function getRiskScore(req: AuthRequest, res: Response) {
  try {
    const assessment = await RiskAssessment.findOne({ userId: req.user._id });
    if (!assessment) {
      return res.status(200).json({ score: 0, level: "none", activeSignals: [] });
    }
    return res.status(200).json({
      score: assessment.confidenceScore,
      level: assessment.riskLevel,
      activeSignals: assessment.activeSignals,
      lastAnalyzedAt: assessment.lastAnalyzedAt
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

/**
 * Admin: Get list of all EmergencyEvents.
 */
export async function getEmergencyEvents(req: AuthRequest, res: Response) {
  try {
    const events = await EmergencyEvent.find()
      .sort({ createdAt: -1 })
      .populate("userId", "name email phone role");
    return res.status(200).json({ events });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

/**
 * Admin/Therapist: Mark an active EmergencyEvent as resolved.
 */
export async function resolveEmergencyEvent(req: AuthRequest, res: Response) {
  try {
    const { eventId } = req.params;
    const { notes, status } = req.body; // status can be "resolved" or "false_positive"

    const event = await EmergencyEvent.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: "Emergency event not found" });
    }

    const newStatus = status === "false_positive" ? "false_positive" : "resolved";

    event.workflowStatus = newStatus;
    event.resolvedBy = req.user._id;
    event.resolvedAt = new Date();
    event.resolutionNotes = notes || "Resolved via admin dashboard panel";
    event.workflowCompletedAt = new Date();
    event.responseTimeMs = new Date().getTime() - event.workflowStartedAt.getTime();

    // Check SLA breach (15 minutes)
    const diffMin = event.responseTimeMs / (60 * 1000);
    event.slaBreach = diffMin > (event.slaMinutes || 15);

    await event.save();

    // Also resolve matching EmergencyAlert
    await EmergencyAlert.updateMany(
      { userId: event.userId, status: "active" },
      {
        $set: {
          status: "resolved",
          resolvedBy: req.user._id,
          resolutionNotes: event.resolutionNotes,
          respondedAt: new Date(),
          slaBreach: event.slaBreach
        }
      }
    );

    // Reset the RiskAssessment confidence levels to cooldown/none
    await RiskAssessment.findOneAndUpdate(
      { userId: event.userId },
      {
        $set: {
          confidenceScore: 0,
          riskLevel: "none",
          activeSignals: [],
          signalCountInWindow: 0
        }
      }
    );

    await logActivity({
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: req.user.email,
      role: req.user.role,
      action: "EMERGENCY_EVENT_RESOLVED",
      status: "success",
      details: `Resolved emergency event for user ${event.userName} as: ${newStatus}`,
      req,
    });

    return res.status(200).json({ message: "Emergency event resolved successfully", event });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}
