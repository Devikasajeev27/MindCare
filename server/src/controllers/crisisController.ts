import { Response } from "express";
import { AuthRequest } from "../middleware/auth.ts";
import { EmergencyContact } from "../models/EmergencyContact.ts";
import { EmergencySession } from "../models/EmergencySession.ts";
import { EmergencyCase } from "../models/EmergencyCase.ts";
import { logActivity } from "../utils/auditLogger.ts";

export async function getEmergencyContacts(req: AuthRequest, res: Response) {
  try {
    let contacts = await EmergencyContact.find({ userId: req.user._id }).sort({ priority: 1 });

    // Auto-sync from User profile emergencyContact if no specific EmergencyContact document exists yet
    if (contacts.length === 0 && req.user._id) {
      const { User } = await import("../models/User.ts");
      const user = await User.findById(req.user._id);
      if (user && user.emergencyContact && user.emergencyContact.name && user.emergencyContact.phone) {
        const created = await EmergencyContact.create({
          userId: user._id,
          name: user.emergencyContact.name,
          relationship: user.emergencyContact.relation || "Family / Emergency",
          countryCode: "+91",
          phone: user.emergencyContact.phone,
          priority: 1
        });
        contacts = [created];
      }
    }

    return res.status(200).json({ contacts });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function saveEmergencyContact(req: AuthRequest, res: Response) {
  try {
    const { name, relationship, countryCode, phone, email, priority } = req.body;
    if (!name || !relationship || !countryCode || !phone) {
      return res.status(400).json({ message: "Please provide name, relationship, country code, and phone number" });
    }

    const contact = await EmergencyContact.create({
      userId: req.user._id,
      name,
      relationship,
      countryCode,
      phone,
      email,
      priority: Number(priority) || 1,
    });

    try {
      const { User } = await import("../models/User.ts");
      const user = await User.findById(req.user._id);
      if (user) {
        user.emergencyContact = {
          name,
          phone,
          relation: relationship
        };
        await user.save();
      }
    } catch (syncErr: any) {
      console.error("[EmergencySync] Failed to sync back to User emergencyContact:", syncErr.message);
    }

    await logActivity({
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: req.user.email,
      role: req.user.role,
      action: "EMERGENCY_CONTACT_ADD",
      status: "success",
      details: `Added emergency contact: ${name} (${relationship})`,
      req,
    });

    return res.status(201).json({ contact });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

export async function getActiveEmergencySession(req: AuthRequest, res: Response) {
  try {
    const activeCase = await EmergencyCase.findOne(
      req.user.role === "therapist"
        ? { therapistId: req.user._id, status: "active" }
        : { userId: req.user._id, status: "active" }
    );
    if (!activeCase) {
      return res.status(200).json({ activeSession: null });
    }

    const activeSession = await EmergencySession.findOne({ emergencyCaseId: activeCase._id })
      .populate("userId", "name avatar")
      .populate("therapistId", "name avatar");

    return res.status(200).json({ activeSession, activeCase });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}
