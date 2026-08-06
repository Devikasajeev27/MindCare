import { AiCompanionProfile } from "../models/AiCompanionProfile.ts";
import { User } from "../models/User.ts";
import { SeederResult } from "./types.ts";

export async function seedAiCompanionProfiles(targetCount = 20): Promise<SeederResult> {
  const existingCount = await AiCompanionProfile.countDocuments();
  if (existingCount >= targetCount) {
    return { collectionName: "aicompanions", modelName: "AiCompanionProfile", existingCount, insertedCount: 0, finalCount: existingCount, status: "SKIPPED" };
  }

  const users = await User.find({ role: "user" });
  const allUsers = users.length > 0 ? users : await User.find();

  const existingUserIds = new Set((await AiCompanionProfile.find({}, { userId: 1 })).map(p => p.userId.toString()));
  const needed = targetCount - existingCount;
  const docsToInsert = [];

  for (let i = 0; i < allUsers.length; i++) {
    const user = allUsers[i];
    if (existingUserIds.has(user._id.toString())) continue;
    existingUserIds.add(user._id.toString());

    docsToInsert.push({
      userId: user._id,
      consentToAnalysis: true,
      enableMemory: true,
      trustScore: 85 + (i % 12),
      aiPreferences: { aiName: "MindCare Companion", voice: "calm_malayalam", voiceSpeed: 1.0 },
      personalization: { replyLength: "auto", humorPreference: "auto", supportStyle: "balanced" },
      memories: [
        { id: `mem_${i}_1`, type: "semantic", category: "career", content: `Working in ${user.city || 'Kochi'} Kerala`, importance: "high", confidence: 95 },
        { id: `mem_${i}_2`, type: "preference", category: "therapy", content: "Prefers 4-7-8 breathing exercises and daily CBT journaling", importance: "high", confidence: 90 }
      ],
      behaviorAnalysis: {
        communicationPattern: "Reflective, attentive, and engaged",
        dailyRoutine: `Morning walks in ${user.city || 'Kochi'}, evening journaling`,
        stressTriggers: ["Work deadline pressure", "Disrupted sleep"],
        favoriteTopics: ["Mindfulness", "Kerala Travel", "Technology"],
        stressLevel: "Low to Moderate",
        moodIndicators: "Stable",
        anxietyLevel: "Low"
      },
      insights: {
        weeklyInsights: "Consistent daily mood tracking maintained a high wellness score.",
        monthlyInsights: "Overall mood stability is excellent.",
        behaviorTimeline: ["Joined MindCare", "Started 4-7-8 Breathing", "Completed 10 Mood Logs"],
        emotionalTrend: ["Calm", "Optimistic", "Focused"],
        stressTrend: ["Stable"],
        wellnessScore: user.wellnessScore || 82,
        distressScore: 10,
        distressTrend: "stable",
        rollingSummary: `Patient maintains a healthy routine in ${user.city || 'Kochi'} with regular mindfulness practice.`
      }
    });

    if (docsToInsert.length >= needed) break;
  }

  if (docsToInsert.length > 0) {
    await AiCompanionProfile.insertMany(docsToInsert);
  }

  const finalCount = await AiCompanionProfile.countDocuments();
  return { collectionName: "aicompanions", modelName: "AiCompanionProfile", existingCount, insertedCount: docsToInsert.length, finalCount, status: "VERIFIED" };
}
