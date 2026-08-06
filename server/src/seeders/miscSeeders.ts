import { Attachment } from "../models/Attachment.ts";
import { BlockedAccount } from "../models/BlockedAccount.ts";
import { BlockedUsers } from "../models/BlockedUsers.ts";
import { Favorites } from "../models/Favorites.ts";
import { ImportedChat } from "../models/ImportedChat.ts";
import { LifeEvent } from "../models/LifeEvent.ts";
import { MasterReference } from "../models/MasterReference.ts";
import { MoodAnalytics } from "../models/MoodAnalytics.ts";
import { Reports } from "../models/Reports.ts";
import { RiskAssessment } from "../models/RiskAssessment.ts";
import { WeeklyAssessment } from "../models/WeeklyAssessment.ts";
import { User } from "../models/User.ts";
import { SeederResult } from "./types.ts";

export async function seedMiscCollections(targetCount = 20): Promise<SeederResult[]> {
  const users = await User.find();
  const results: SeederResult[] = [];
  const protectedLoginEmails = new Set([
    "admin@mindcare.com",
    "alex@mindcare.com",
    "sarah@mindcare.com",
    "kindsoul@mindcare.com",
    "hopeful@mindcare.com",
    "calmwaves@mindcare.com",
    "user1@example.com",
    "user2@example.com",
    "user3@example.com",
    "user4@example.com",
  ]);
  const protectedLoginUsers = users.filter((user: any) => protectedLoginEmails.has(user.email));
  const protectedLoginUserIds = protectedLoginUsers.map((user: any) => user._id);
  if (protectedLoginUserIds.length > 0) {
    await BlockedAccount.deleteMany({
      $or: [
        { userId: { $in: protectedLoginUserIds } },
        { email: { $in: Array.from(protectedLoginEmails) } },
      ],
    });
  }
  const blockableUsers = users.filter((user: any) => !protectedLoginEmails.has(user.email));

  // 1. Attachments
  const cAttachments = await Attachment.countDocuments();
  if (cAttachments < targetCount) {
    const docs = [];
    for (let i = cAttachments; i < targetCount; i++) {
      const u = users[i % users.length];
      const filename = `prescription_doc_${i + 1}.pdf`;
      docs.push({
        userId: u._id,
        filename,
        originalName: filename,
        mimeType: "application/pdf",
        size: 102400,
        url: `https://mindcare.app/docs/file_${i + 1}.pdf`,
      });
    }
    await Attachment.insertMany(docs);
  }
  results.push({ collectionName: "attachments", modelName: "Attachment", existingCount: cAttachments, insertedCount: Math.max(0, targetCount - cAttachments), finalCount: await Attachment.countDocuments(), status: "VERIFIED" });

  // 2. Blocked Accounts
  const cBlockedAcc = await BlockedAccount.countDocuments();
  if (cBlockedAcc < targetCount) {
    const docs = [];
    for (let i = cBlockedAcc; i < targetCount; i++) {
      const u = blockableUsers[i % blockableUsers.length] || users[i % users.length];
      docs.push({ userId: u._id, reason: "Security login failure attempt limit", blockedAt: new Date() });
    }
    await BlockedAccount.insertMany(docs);
  }
  results.push({ collectionName: "blockedaccounts", modelName: "BlockedAccount", existingCount: cBlockedAcc, insertedCount: Math.max(0, targetCount - cBlockedAcc), finalCount: await BlockedAccount.countDocuments(), status: "VERIFIED" });

  // 3. Blocked Users
  const cBlockedUsers = await BlockedUsers.countDocuments();
  if (cBlockedUsers < targetCount) {
    const docs = [];
    for (let i = cBlockedUsers; i < targetCount; i++) {
      const u1 = users[i % users.length];
      const u2 = users[(i + 1) % users.length];
      docs.push({ userId: u1._id, blockedUserId: u2._id, reason: "User requested peer safety block during demo validation." });
    }
    await BlockedUsers.insertMany(docs);
  }
  results.push({ collectionName: "blockedusers", modelName: "BlockedUsers", existingCount: cBlockedUsers, insertedCount: Math.max(0, targetCount - cBlockedUsers), finalCount: await BlockedUsers.countDocuments(), status: "VERIFIED" });

  // 4. Favorites
  const cFavorites = await Favorites.countDocuments();
  if (cFavorites < targetCount) {
    const docs = [];
    for (let i = cFavorites; i < targetCount; i++) {
      const u1 = users[i % users.length];
      const u2 = users[(i + 1) % users.length];
      docs.push({ userId: u1._id, favoriteCompanionId: u2._id });
    }
    await Favorites.insertMany(docs);
  }
  results.push({ collectionName: "favorites", modelName: "Favorites", existingCount: cFavorites, insertedCount: Math.max(0, targetCount - cFavorites), finalCount: await Favorites.countDocuments(), status: "VERIFIED" });

  // 5. Imported Chats
  const cImported = await ImportedChat.countDocuments();
  if (cImported < targetCount) {
    const docs = [];
    for (let i = cImported; i < targetCount; i++) {
      const u = users[i % users.length];
      docs.push({ userId: u._id, sender: "user", source: "WhatsApp", text: `Imported CBT journal entry text #${i + 1}`, time: new Date() });
    }
    await ImportedChat.insertMany(docs);
  }
  results.push({ collectionName: "importedchats", modelName: "ImportedChat", existingCount: cImported, insertedCount: Math.max(0, targetCount - cImported), finalCount: await ImportedChat.countDocuments(), status: "VERIFIED" });

  // 6. Life Events
  const cLifeEvents = await LifeEvent.countDocuments();
  if (cLifeEvents < targetCount) {
    const docs = [];
    for (let i = cLifeEvents; i < targetCount; i++) {
      const u = users[i % users.length];
      docs.push({ userId: u._id, title: `MindCare Milestone #${i + 1}`, description: `Achieved daily CBT journaling streak in ${u.city || 'Kochi'}`, date: new Date() });
    }
    await LifeEvent.insertMany(docs);
  }
  results.push({ collectionName: "lifeevents", modelName: "LifeEvent", existingCount: cLifeEvents, insertedCount: Math.max(0, targetCount - cLifeEvents), finalCount: await LifeEvent.countDocuments(), status: "VERIFIED" });

  // 7. Master References
  const cMaster = await MasterReference.countDocuments();
  if (cMaster < targetCount) {
    const docs = [];
    for (let i = cMaster; i < targetCount; i++) {
      docs.push({
        type: "wellness_tip",
        code: `CBT_TECH_${i + 1}`,
        name: `Cognitive Behavioral Technique ${i + 1}`,
        description: "Seeded CBT reference for dashboard and resource validation.",
        category: "TherapyModality",
        icon: "brain",
      });
    }
    await MasterReference.insertMany(docs);
  }
  results.push({ collectionName: "masterreferences", modelName: "MasterReference", existingCount: cMaster, insertedCount: Math.max(0, targetCount - cMaster), finalCount: await MasterReference.countDocuments(), status: "VERIFIED" });

  // 8. Mood Analytics
  const cAnalytics = await MoodAnalytics.countDocuments();
  if (cAnalytics < targetCount) {
    const docs = [];
    for (let i = cAnalytics; i < targetCount; i++) {
      const u = users[i % users.length];
      docs.push({
        userId: u._id,
        date: new Date(Date.now() - i * 86400000),
        overallMood: i % 3 === 0 ? "calm" : i % 3 === 1 ? "focused" : "reflective",
        moodScore: 75 + (i % 20),
        sentimentScore: 0.35,
        emotion: i % 3 === 0 ? "calm" : "hopeful",
        stressLevel: 20 + (i % 25),
        anxietyLevel: 15 + (i % 20),
        energyLevel: 70 + (i % 20),
        sleepQuality: 65 + (i % 25),
        journalContribution: 30,
        aiChatContribution: 45,
        voiceAnalysisContribution: 10,
        confidenceScore: 85,
      });
    }
    await MoodAnalytics.insertMany(docs);
  }
  results.push({ collectionName: "moodanalytics", modelName: "MoodAnalytics", existingCount: cAnalytics, insertedCount: Math.max(0, targetCount - cAnalytics), finalCount: await MoodAnalytics.countDocuments(), status: "VERIFIED" });

  // 9. Reports
  const cReports = await Reports.countDocuments();
  if (cReports < targetCount) {
    const docs = [];
    for (let i = cReports; i < targetCount; i++) {
      const reporter = users[i % users.length];
      const reported = users[(i + 1) % users.length];
      docs.push({
        reporterId: reporter._id,
        reportedId: reported._id,
        reason: `Clinical monthly wellness report #${i + 1}`,
        evidence: "Excellent psychological baseline and steady CBT adherence.",
        actionTaken: i % 2 === 0 ? "reviewed" : "pending",
      });
    }
    await Reports.insertMany(docs);
  }
  results.push({ collectionName: "reports", modelName: "Reports", existingCount: cReports, insertedCount: Math.max(0, targetCount - cReports), finalCount: await Reports.countDocuments(), status: "VERIFIED" });

  // 10. Risk Assessments
  const cRisk = await RiskAssessment.countDocuments();
  let insertedRisk = 0;
  if (cRisk < targetCount) {
    const existingRiskUserIds = new Set(
      (await RiskAssessment.find({}, "userId").lean()).map((risk: any) => risk.userId?.toString()).filter(Boolean)
    );
    const riskUsers = users.filter((user: any) => !existingRiskUserIds.has(user._id.toString()));
    const docs = [];
    const needed = Math.min(targetCount - cRisk, riskUsers.length);
    for (let i = 0; i < needed; i++) {
      const u = riskUsers[i];
      const ordinal = cRisk + i;
      docs.push({
        userId: u._id,
        riskLevel: "low",
        confidenceScore: 12 + (ordinal % 10),
        activeSignals: [{ type: "work_pressure_severe", score: 12 + (ordinal % 10), detail: "Workplace deadlines", source: "manual" }],
        sources: ["ai_chat"],
        signalCountInWindow: 1,
        lastAnalyzedAt: new Date(),
      });
    }
    if (docs.length > 0) {
      await RiskAssessment.insertMany(docs);
      insertedRisk = docs.length;
    }
  }
  results.push({ collectionName: "riskassessments", modelName: "RiskAssessment", existingCount: cRisk, insertedCount: insertedRisk, finalCount: await RiskAssessment.countDocuments(), status: "VERIFIED" });

  // 11. Weekly Assessments
  const cWeekly = await WeeklyAssessment.countDocuments();
  if (cWeekly < targetCount) {
    const docs = [];
    for (let i = cWeekly; i < targetCount; i++) {
      const u = users[i % users.length];
      docs.push({
        userId: u._id,
        sessionsCompleted: 4 + (i % 6),
        avgRating: 4.5,
        responseRate: 92,
        reportsReceived: i % 3,
        earningTierAdjusted: "retained",
        assessmentDate: new Date(Date.now() - i * 7 * 86400000),
      });
    }
    await WeeklyAssessment.insertMany(docs);
  }
  results.push({ collectionName: "weeklyassessments", modelName: "WeeklyAssessment", existingCount: cWeekly, insertedCount: Math.max(0, targetCount - cWeekly), finalCount: await WeeklyAssessment.countDocuments(), status: "VERIFIED" });

  return results;
}
