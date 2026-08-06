import { User } from "../../models/User.ts";
import { Therapist } from "../../models/Therapist.ts";
import { EmergencyAlert } from "../../models/EmergencyAlert.ts";
import { EmergencyCase } from "../../models/EmergencyCase.ts";
import { EmergencySession } from "../../models/EmergencySession.ts";
import { EmergencyNotification } from "../../models/EmergencyNotification.ts";
import { EmergencyContact } from "../../models/EmergencyContact.ts";
import { INDIAN_MALE_NAMES, INDIAN_FEMALE_NAMES, RELATIONS } from "./constants.ts";

export async function generateEmergency(
  targetAlerts = 120,
  targetCases = 120,
  targetSessions = 50,
  targetNotifs = 120
) {
  console.log("Checking Emergency collections...");
  const clients = await User.find({ role: "user", verifiedCompanion: false });
  const therapists = await User.find({ role: "therapist" });
  const admins = await User.find({ role: "admin" });

  if (clients.length === 0 || therapists.length === 0) {
    console.log("No clients or therapists found. Skipping emergency seeding.");
    return;
  }

  // 1. Generate EmergencyContacts for every client user
  console.log("Generating EmergencyContacts...");
  const existingContacts = await EmergencyContact.find({});
  const contactPayloads = [];

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    const hasContact = existingContacts.some(c => c.userId.toString() === client._id.toString());
    if (!hasContact) {
      const isFemale = i % 2 === 0;
      const contactName = isFemale
        ? INDIAN_MALE_NAMES[(i + 7) % INDIAN_MALE_NAMES.length]
        : INDIAN_FEMALE_NAMES[(i + 7) % INDIAN_FEMALE_NAMES.length];

      contactPayloads.push({
        userId: client._id,
        name: `${contactName} ${i + 1}`,
        relationship: RELATIONS[i % RELATIONS.length],
        countryCode: "IN",
        phone: `+91${9600000000 + i}`,
        email: `${contactName.split(" ")[0].toLowerCase()}.${i + 1}@gmail.com`,
        priority: 1
      });
    }
  }
  if (contactPayloads.length > 0) {
    await EmergencyContact.insertMany(contactPayloads);
  }

  // 2. Generate EmergencyAlerts
  const existingAlertCount = await EmergencyAlert.countDocuments();
  let alerts = [];
  if (existingAlertCount < targetAlerts) {
    const needed = targetAlerts - existingAlertCount;
    console.log(`Seeding ${needed} EmergencyAlerts...`);
    const alertLogs = [];
    const triggers = ["severe hopelessness detected", "crisis keyword flag", "depression markers peak", "suicide intent scan"];
    const alertMsgs = [
      "I feel completely isolated and can't find any reason to keep pushing forward.",
      "Anxiety is taking over and my chest feels incredibly heavy. I need help.",
      "Everything is failing. I just want this mental pain to end right now.",
      "I'm experiencing a massive panic attack and my breathing is completely out of control."
    ];

    for (let i = 0; i < needed; i++) {
      const client = clients[i % clients.length];
      const admin = admins[i % admins.length];
      const isResolved = i % 2 === 0;

      alertLogs.push({
        userId: client._id,
        userName: client.name,
        detectedTrigger: triggers[i % triggers.length],
        messageContent: alertMsgs[i % alertMsgs.length],
        riskLevel: "critical",
        status: isResolved ? "resolved" : "active",
        resolvedBy: isResolved ? admin?._id : undefined,
        resolutionNotes: isResolved ? "Stabilized user via prompt contact and scheduled clinical consulting sessions." : "",
        respondedAt: isResolved ? new Date(Date.now() - 600000) : undefined,
        slaMinutes: 15,
        slaBreach: false,
        createdAt: new Date(Date.now() - (i % 60) * 24 * 60 * 60 * 1000)
      });
    }
    alerts = await EmergencyAlert.insertMany(alertLogs);
  } else {
    alerts = await EmergencyAlert.find({});
  }

  // 3. Generate EmergencyCases (must link to alerts)
  const existingCaseCount = await EmergencyCase.countDocuments();
  let cases = [];
  if (existingCaseCount < targetCases) {
    const needed = targetCases - existingCaseCount;
    console.log(`Seeding ${needed} EmergencyCases...`);
    const caseLogs = [];

    for (let i = 0; i < needed; i++) {
      const alert = alerts[i % alerts.length];
      const therapist = therapists[i % therapists.length];
      const isResolved = alert.status === "resolved";

      caseLogs.push({
        userId: alert.userId,
        therapistId: therapist._id,
        status: isResolved ? "resolved" : "active",
        riskScore: "critical",
        assignedAt: alert.createdAt,
        resolvedAt: isResolved ? new Date(alert.createdAt.getTime() + 15 * 60 * 1000) : undefined,
        resolutionNotes: isResolved ? "Distress mitigated. Client safe and reassigned to active clinical checks." : undefined
      });
    }
    cases = await EmergencyCase.insertMany(caseLogs);
  } else {
    cases = await EmergencyCase.find({});
  }

  // 4. Generate EmergencySessions (must link to resolved cases)
  const existingSessionCount = await EmergencySession.countDocuments();
  if (existingSessionCount < targetSessions) {
    const needed = targetSessions - existingSessionCount;
    console.log(`Seeding ${needed} EmergencySessions...`);
    const sessionLogs = [];
    const resolvedCases = cases.filter(c => c.status === "resolved");
    if (resolvedCases.length > 0) {
      for (let i = 0; i < needed; i++) {
        const c = resolvedCases[i % resolvedCases.length];
        sessionLogs.push({
          userId: c.userId,
          therapistId: c.therapistId,
          emergencyCaseId: c._id,
          price: 0,
          billingStatus: "Waived",
          sessionType: "Emergency Session",
          createdAt: c.assignedAt
        });
      }
      await EmergencySession.insertMany(sessionLogs);
    } else {
      console.log("No resolved emergency cases found. Skipping emergency sessions generation.");
    }
  }

  // 5. Generate EmergencyNotifications
  const existingNotifCount = await EmergencyNotification.countDocuments();
  if (existingNotifCount < targetNotifs) {
    const needed = targetNotifs - existingNotifCount;
    console.log(`Seeding ${needed} EmergencyNotifications...`);
    const notifLogs = [];

    for (let i = 0; i < needed; i++) {
      const client = clients[i % clients.length];
      notifLogs.push({
        userId: client._id,
        title: "Crisis Intervention System Alert",
        message: "Severe stress keywords were scanned in your latest dialogue. Please remain calm, a therapist is being assigned.",
        type: "emergency",
        read: i % 3 === 0,
        createdAt: new Date(Date.now() - (i % 60) * 24 * 60 * 60 * 1000)
      });
    }
    await EmergencyNotification.insertMany(notifLogs);
  }

  console.log("Emergency seeding process complete.");
}
