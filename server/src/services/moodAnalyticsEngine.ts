import mongoose from "mongoose";
import { Mood } from "../models/Mood.ts";
import { Journal } from "../models/Journal.ts";
import { Chat } from "../models/Chat.ts";
import { CompanionSession } from "../models/CompanionSession.ts";
import { RiskAssessment } from "../models/RiskAssessment.ts";
import { MoodAnalytics } from "../models/MoodAnalytics.ts";

export class MoodAnalyticsEngine {
  /**
   * Normalizes a date to the start of the day (00:00:00.000 UTC/local match)
   */
  private static normalizeToStartOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Calculates a single daily MoodAnalytics record for a user and date.
   * Leverages real application logs in MongoDB to derive calculations.
   */
  public static async calculateDailyMood(userId: mongoose.Types.ObjectId | string, date: Date): Promise<any> {
    const startOfDay = this.normalizeToStartOfDay(date);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    const userObjId = new mongoose.Types.ObjectId(userId.toString());

    // 1. Gather all raw Mongoose records for the day in parallel
    const [moodLogs, journalEntries, chatLogs, sessions, riskRecord] = await Promise.all([
      Mood.find({ userId: userObjId, date: { $gte: startOfDay, $lte: endOfDay } }),
      Journal.find({ userId: userObjId, date: { $gte: startOfDay, $lte: endOfDay } }),
      Chat.find({ userId: userObjId, createdAt: { $gte: startOfDay, $lte: endOfDay }, sender: "user" }),
      CompanionSession.find({ userId: userObjId, createdAt: { $gte: startOfDay, $lte: endOfDay } }),
      RiskAssessment.findOne({ userId: userObjId }),
    ]);

    // 2. Initialize scores & data sources state
    let moodRatingSum = 0;
    let journalRatingSum = 0;
    let chatSentimentSum = 0;
    let voiceCount = 0;

    let totalAvailableWeight = 0;
    let weightedScoreSum = 0;

    // A. Daily Mood Logs (30% weight)
    let journalContrib = 0;
    let chatContrib = 0;
    let voiceContrib = 0;

    if (moodLogs.length > 0) {
      moodRatingSum = moodLogs.reduce((sum, m) => sum + (m.rating || 3), 0) / moodLogs.length;
      const moodLogScore = moodRatingSum * 20; // Scale 1-5 to 20-100
      weightedScoreSum += moodLogScore * 0.30;
      totalAvailableWeight += 0.30;
    }

    // B. Journal Entries Analysis (20% weight)
    if (journalEntries.length > 0) {
      // Use existing rating if journal has rating/mood score, else perform keyword sentiment fallback
      let journalScoreTotal = 0;
      for (const j of journalEntries) {
        if (j.mood) {
          journalScoreTotal += j.mood * 20; // scale 1-5 to 20-100
        } else {
          // Sentiment analysis from text
          const score = this.analyzeTextSentiment(j.content || "");
          journalScoreTotal += Math.round((score + 1) * 50); // Scale -1..1 to 0..100
        }
      }
      journalRatingSum = journalScoreTotal / journalEntries.length;
      journalContrib = journalRatingSum;
      weightedScoreSum += journalRatingSum * 0.20;
      totalAvailableWeight += 0.20;
    }

    // C. AI Companion Chat logs (20% weight)
    if (chatLogs.length > 0) {
      let chatScoreTotal = 0;
      for (const c of chatLogs) {
        const textScore = this.analyzeTextSentiment(c.text || "");
        let multiplier = 1.0;
        // Moderate/High risk chats drop sentiment
        if (c.riskLevel === "critical") multiplier = 0.2;
        else if (c.riskLevel === "high") multiplier = 0.4;
        else if (c.riskLevel === "moderate") multiplier = 0.7;

        chatScoreTotal += Math.round((textScore + 1) * 50 * multiplier);
      }
      chatSentimentSum = chatScoreTotal / chatLogs.length;
      chatContrib = chatSentimentSum;
      weightedScoreSum += chatSentimentSum * 0.20;
      totalAvailableWeight += 0.20;
    }

    // D. Voice Analysis / Companion Sessions (15% weight)
    // Gather matching voice calls or sessions
    if (sessions.length > 0) {
      voiceCount = sessions.length;
      // Derived score: completed calls improve connection score, longer durations are positive
      let sessionScoreTotal = 0;
      for (const s of sessions) {
        let score = 70; // baseline
        if (s.status === "completed") score += 15;
        if (s.duration && s.duration > 15) score += 15;
        sessionScoreTotal += Math.min(100, score);
      }
      const voiceScore = sessionScoreTotal / sessions.length;
      voiceContrib = voiceScore;
      weightedScoreSum += voiceScore * 0.15;
      totalAvailableWeight += 0.15;
    }

    // E. Sleep Quality (10% weight)
    // If user has a mood log, correlate sleep with mood, otherwise use baseline
    let sleepQual = 72;
    if (moodLogs.length > 0) {
      sleepQual = Math.round(moodRatingSum * 18 + 10); // rating 5 -> 100, 1 -> 28
    }
    // Check if journal content mentioned sleep issues
    const combinedJournalText = journalEntries.map(j => `${j.title} ${j.content}`).join(" ").toLowerCase();
    if (combinedJournalText.includes("insomnia") || combinedJournalText.includes("couldn't sleep") || combinedJournalText.includes("tired")) {
      sleepQual = Math.max(20, sleepQual - 30);
    }
    weightedScoreSum += sleepQual * 0.10;
    totalAvailableWeight += 0.10;

    // F. Stress/Anxiety Indicators (5% weight)
    // Derived from RiskAssessment model
    let stressScore = 20; // baseline low stress
    let anxietyScore = 20;

    if (riskRecord) {
      // Risk level mapping
      if (riskRecord.riskLevel === "critical") {
        stressScore = 95;
        anxietyScore = 90;
      } else if (riskRecord.riskLevel === "high") {
        stressScore = 80;
        anxietyScore = 75;
      } else if (riskRecord.riskLevel === "elevated") {
        stressScore = 60;
        anxietyScore = 55;
      } else if (riskRecord.riskLevel === "low") {
        stressScore = 40;
        anxietyScore = 35;
      }
    }
    // Check journal triggers
    if (combinedJournalText.includes("stress") || combinedJournalText.includes("burnout") || combinedJournalText.includes("pressure")) {
      stressScore = Math.min(100, stressScore + 25);
    }
    if (combinedJournalText.includes("anxious") || combinedJournalText.includes("panic") || combinedJournalText.includes("worry")) {
      anxietyScore = Math.min(100, anxietyScore + 25);
    }

    // Weight represents emotional wellness (100 - stress)
    const wellnessStressContribution = 100 - stressScore;
    weightedScoreSum += wellnessStressContribution * 0.05;
    totalAvailableWeight += 0.05;

    // 3. Final weighted calculation (Redistribute if some sources are missing)
    const moodScore = totalAvailableWeight > 0 
      ? Math.min(100, Math.max(0, Math.round(weightedScoreSum / totalAvailableWeight)))
      : 70;

    // 4. Derive overall label, primary emotion and sentiment
    let overallMood = "Neutral";
    let emotion = "neutral";
    let sentimentScore = Number(((moodScore - 50) / 50).toFixed(2)); // Map 0-100 to -1..1

    if (moodScore >= 85) {
      overallMood = "Excellent";
      emotion = "happy";
    } else if (moodScore >= 65) {
      overallMood = "Good";
      emotion = "calm";
    } else if (moodScore >= 45) {
      overallMood = "Neutral";
      emotion = "neutral";
    } else if (stressScore > 65) {
      overallMood = "Stressed";
      emotion = "stressed";
    } else if (anxietyScore > 65) {
      overallMood = "Anxious";
      emotion = "anxious";
    } else {
      overallMood = "Sad";
      emotion = "sad";
    }

    // Confidence score based on data availability
    const confidenceScore = Math.round(totalAvailableWeight * 100);

    const energyLevel = Math.round((sleepQual * 0.6) + (moodScore * 0.4));

    // 5. Save or Update in database
    const analyticsRecord = await MoodAnalytics.findOneAndUpdate(
      { userId: userObjId, date: startOfDay },
      {
        userId: userObjId,
        date: startOfDay,
        overallMood,
        moodScore,
        sentimentScore,
        emotion,
        stressLevel: stressScore,
        anxietyLevel: anxietyScore,
        energyLevel,
        sleepQuality: sleepQual,
        journalContribution: Math.round(journalContrib),
        aiChatContribution: Math.round(chatSentimentSum),
        voiceAnalysisContribution: Math.round(voiceContrib),
        confidenceScore: Math.max(20, confidenceScore),
      },
      { upsert: true, new: true }
    );

    return analyticsRecord;
  }

  /**
   * Helper to recalculate a user's daily record asynchronously.
   */
  public static async updateAnalyticsForDate(userId: mongoose.Types.ObjectId | string, date: Date): Promise<void> {
    try {
      await this.calculateDailyMood(userId, date);
    } catch (err: any) {
      console.error("[MOOD-ANALYTICS] Failed to update analytics:", err.message);
    }
  }

  /**
   * Returns recent analytics summary for cognitive pipeline memory manager
   */
  public static async getAnalytics(userId: mongoose.Types.ObjectId | string): Promise<any> {
    const userObjId = new mongoose.Types.ObjectId(userId.toString());
    const records = await MoodAnalytics.find({ userId: userObjId }).sort({ date: -1 }).limit(7);
    if (records.length === 0) {
      return { averageRating: 3.5, trendLabel: "stable", volatilityLabel: "normal" };
    }

    const avgScore = records.reduce((acc, r) => acc + (r.moodScore || 60), 0) / records.length;
    const averageRating = Number((avgScore / 20).toFixed(1)); // Scale 0-100 to 1-5

    let trendLabel = "stable";
    if (records.length >= 2) {
      const latest = records[0].moodScore || 60;
      const previous = records[records.length - 1].moodScore || 60;
      if (latest - previous > 10) trendLabel = "improving";
      else if (previous - latest > 10) trendLabel = "declining";
    }

    return {
      averageRating,
      trendLabel,
      volatilityLabel: "normal",
      records
    };
  }

  /**
   * Generates a realistic 30-day timeline of seeded MoodAnalytics data
   * containing weekend improvements, mid-week stress, recovery loops, etc.
   */
  public static async seedMoodHistory(userId: mongoose.Types.ObjectId | string): Promise<void> {
    const userObjId = new mongoose.Types.ObjectId(userId.toString());
    const count = await MoodAnalytics.countDocuments({ userId: userObjId });
    if (count > 0) return; // Seeding is already present

    console.log(`[MOOD-ANALYTICS] Seeding 30-day timeline for user: ${userId}`);

    const payloads = [];
    const now = new Date();

    // Generate last 30 days chronologically
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const startOfDay = this.normalizeToStartOfDay(date);

      const dayOfWeek = startOfDay.getDay(); // 0 = Sunday, 6 = Saturday

      // Baseline mood score
      let moodScore = 65; // stable baseline
      let stressLevel = 25;
      let anxietyLevel = 20;
      let sleepQuality = 75;

      // Cycle patterns:
      // Weekends (Fri, Sat, Sun) are positive/relaxing
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        moodScore += 15;
        stressLevel -= 10;
        sleepQuality += 10;
      }
      // Mid-week stress spike around Wednesday (day 3)
      if (dayOfWeek === 3) {
        moodScore -= 15;
        stressLevel += 25;
        anxietyLevel += 15;
        sleepQuality -= 12;
      }
      // Stress recovery loop on Thursday (day 4)
      if (dayOfWeek === 4) {
        moodScore += 5;
        stressLevel -= 10;
        sleepQuality += 5;
      }

      // Introduce random daily micro-fluctuations (-8 to 8)
      const randomShift = Math.floor(Math.random() * 17) - 8;
      moodScore = Math.min(100, Math.max(10, moodScore + randomShift));
      stressLevel = Math.min(100, Math.max(5, stressLevel - randomShift));
      anxietyLevel = Math.min(100, Math.max(5, anxietyLevel - Math.floor(randomShift * 0.5)));
      sleepQuality = Math.min(100, Math.max(20, sleepQuality + Math.floor(randomShift * 0.8)));

      let overallMood = "Neutral";
      let emotion = "neutral";
      if (moodScore >= 85) {
        overallMood = "Excellent";
        emotion = "happy";
      } else if (moodScore >= 65) {
        overallMood = "Good";
        emotion = "calm";
      } else if (moodScore >= 45) {
        overallMood = "Neutral";
        emotion = "neutral";
      } else if (stressLevel > 60) {
        overallMood = "Stressed";
        emotion = "stressed";
      } else if (anxietyLevel > 60) {
        overallMood = "Anxious";
        emotion = "anxious";
      } else {
        overallMood = "Sad";
        emotion = "sad";
      }

      const sentimentScore = Number(((moodScore - 50) / 50).toFixed(2));
      const energyLevel = Math.round((sleepQuality * 0.6) + (moodScore * 0.4));

      payloads.push({
        userId: userObjId,
        date: startOfDay,
        overallMood,
        moodScore,
        sentimentScore,
        emotion,
        stressLevel,
        anxietyLevel,
        energyLevel,
        sleepQuality,
        journalContribution: Math.round(moodScore * 0.9),
        aiChatContribution: Math.round(moodScore * 0.85),
        voiceAnalysisContribution: Math.round(moodScore * 0.8),
        confidenceScore: 90, // high confidence for seeded records
      });
    }

    await MoodAnalytics.insertMany(payloads);
    console.log(`[MOOD-ANALYTICS] Seeding completed for user: ${userId}`);
  }

  /**
   * Performs quick client-side keyword sentiment lookup to gauge emotion.
   * Returns a score between -1.0 (very negative) and 1.0 (very positive).
   */
  private static analyzeTextSentiment(text: string): number {
    const lower = text.toLowerCase();
    
    // Weighted keywords lists
    const positiveWords = ["happy", "good", "great", "excellent", "glad", "wonderful", "excited", "calm", "relax", "peace", "love", "smile", "content", "joy", "productive", "better"];
    const negativeWords = ["sad", "depressed", "anxious", "panic", "stressed", "exhausted", "burnout", "angry", "worry", "fear", "hate", "tired", "lonely", "awful", "bad", "ruin", "worst", "die", "hurt", "pain"];

    let score = 0;
    positiveWords.forEach(w => {
      const regex = new RegExp(`\\b${w}\\b`, "g");
      const matches = lower.match(regex);
      if (matches) score += matches.length;
    });
    
    negativeWords.forEach(w => {
      const regex = new RegExp(`\\b${w}\\b`, "g");
      const matches = lower.match(regex);
      if (matches) score -= matches.length;
    });

    if (score === 0) return 0;
    if (score > 3) return 1.0;
    if (score < -3) return -1.0;
    return score / 3.0; // scale
  }
}
