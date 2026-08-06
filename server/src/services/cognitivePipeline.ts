import { GoogleGenAI } from "@google/genai";
import { buildCognitiveContext } from "./cognitive/contextBuilder.ts";
import { generateFallbackResponse } from "./cognitive/fallbackResponder.ts";
import { extractAndStoreMemories, recordCognitiveAnalytics } from "./cognitive/postProcessor.ts";
import { evaluateQuality, reviewSafety } from "./cognitive/qualityCritic.ts";
import { planResponseStrategy } from "./cognitive/strategyPlanner.ts";
import { CognitiveContextPackage, CognitivePipelineResult, ResponseStrategy } from "./cognitive/types.ts";
import { DistressEngine } from "../services/distressEngine.ts";
import { buildCognitivePrompt } from "../utils/promptBuilder.ts";

const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy" });

interface GeneratedResponse {
  text: string;
  source: "gemini" | "fallback";
}

export class CognitivePipeline {
  private static trace(traceId: string, stage: string, details: Record<string, unknown> = {}): void {
    // Intentionally log metadata rather than raw chat text; crisis disclosures
    // are sensitive, but each stage must remain operationally traceable.
    console.info("[ConversationTrace]", JSON.stringify({ traceId, stage, ...details }));
  }

  /**
   * Master entry point for the existing Modules 1–19 pipeline.
   */
  static async processMessage(
    userId: string,
    userMessage: string,
    sessionId?: string
  ): Promise<CognitivePipelineResult> {
    const startTime = Date.now();
    const traceId = `${userId.slice(-6)}-${startTime.toString(36)}`;
    // Keep direct callers safe too: distress events are session-scoped in MongoDB.
    const effectiveSessionId = sessionId || `session_${Date.now()}`;
    this.trace(traceId, "PIPELINE_RECEIVED", { sessionScoped: Boolean(sessionId), messageLength: userMessage.length });

    // ── STAGE 1: Context Builder (Modules 1–13) ──
    const context = await buildCognitiveContext(userId, userMessage, effectiveSessionId);
    // Record distress event and evaluate escalation
    const severityMap: Record<string, number> = { none: 0, low: 1, elevated: 2, moderate: 2, high: 3, critical: 4 };
    // Previous risk keeps the responder safety-aware, but it must not count as
    // a new distress disclosure or create a duplicate visual flag.
    const distressLevel = context.crisis.source === "current_message"
      ? (severityMap[context.crisis.severity] ?? 0)
      : 0;
    const distressWindow = await DistressEngine.recordEvent({
      userId,
      sessionId: effectiveSessionId,
      distressLevel,
      severityScore: context.crisis.riskScore ?? 0,
      emotions: context.emotion.scores,
      riskFlags: context.crisis.triggers,
      context,
      channel: "ai",
    });
    this.trace(traceId, "MEMORY_RETRIEVAL", {
      recentMessages: context.recentMessages.length,
      longTermMemories: context.longTermMemories.length,
      hasConversationSummary: Boolean(context.conversationSummary),
      journalEntries: context.journalSummary.recentCount,
    });
    this.trace(traceId, "EMOTION_ENGINE", {
      dominant: context.emotion.dominant,
      sentiment: context.emotion.sentimentLabel,
      confidence: context.emotion.confidence,
    });
    this.trace(traceId, "RISK_DETECTION", {
      isCrisis: context.crisis.isCrisis,
      severity: context.crisis.severity,
      source: context.crisis.source,
      triggerCount: context.crisis.triggers.length,
    });
    this.trace(traceId, "CONTEXT_BUILDER", {
      language: context.language.language,
      intent: context.intent,
      moodTrend: context.moodAnalytics.recentTrend,
    });

    // ── STAGE 2: Strategy Planner (Module 14) ──
    const strategy: ResponseStrategy = planResponseStrategy(context);
    this.trace(traceId, "STRATEGY_PLANNER", {
      strategy: strategy.strategy,
      hasFollowUp: Boolean(strategy.followUpQuestion),
      targetLength: strategy.targetLength,
    });

    // ── STAGE 3: Prompt Builder + Gemini (Module 15) ──
    const prompt = buildCognitivePrompt(context, strategy);
    this.trace(traceId, "PROMPT_BUILDER", {
      promptLength: prompt.length,
      includedHistory: context.recentMessages.length > 0,
      includedMemory: context.longTermMemories.length > 0,
      includedMood: true,
      includedEmotion: true,
      includedRisk: true,
      includedLanguage: true,
      includedJournalSummary: true,
    });

    let generated = await this.generateWithGemini(prompt, context, strategy);
    let rawResponse = generated.text;
    this.trace(traceId, "GEMINI", { source: generated.source, responseLength: rawResponse.length });

    // ── STAGE 4: Quality Critic & Revision Loop (Module 16) ──
    let quality = evaluateQuality(rawResponse, context, strategy);
    let wasRevised = false;
    this.trace(traceId, "QUALITY_CRITIC", { passed: quality.passed, score: quality.overallScore, feedback: quality.feedback });

    if (!quality.passed && generated.source === "gemini") {
      wasRevised = true;
      const revisedStrategy: ResponseStrategy = {
        ...strategy,
        instructions: `${strategy.instructions}\nREVISION: Address the user's actual message and prior context. Do not repeat prior AI wording. Follow the language and crisis rules exactly. ${quality.feedback}`,
      };
      const revisedPrompt = buildCognitivePrompt(context, revisedStrategy);
      generated = await this.generateWithGemini(revisedPrompt, context, revisedStrategy);
      rawResponse = generated.text;
      quality = evaluateQuality(rawResponse, context, strategy);
      this.trace(traceId, "QUALITY_REVISION", { source: generated.source, passed: quality.passed, score: quality.overallScore });
    }

    // Gemini is never allowed to win a failed critic review. The context-aware
    // fallback is deterministic and is also used when Gemini is unavailable.
    if (!quality.passed) {
      wasRevised = true;
      rawResponse = generateFallbackResponse(context, strategy);
      quality = evaluateQuality(rawResponse, context, strategy);
      this.trace(traceId, "QUALITY_FALLBACK", { passed: quality.passed, score: quality.overallScore, responseLength: rawResponse.length });
    }

    // ── STAGE 5: Safety Review (Module 17) ──
    const safetyResult = reviewSafety(rawResponse, context);
    const finalResponse = safetyResult.sanitizedResponse;
    quality = evaluateQuality(finalResponse, context, strategy);
    this.trace(traceId, "SAFETY_REVIEW", {
      safe: safetyResult.safe,
      crisisResponsive: quality.isCrisisResponsive,
      finalResponseLength: finalResponse.length,
    });

    // ── STAGE 6: Memory Extraction (Module 18) ──
    let extractedMemoriesCount = 0;
    try {
      extractedMemoriesCount = await extractAndStoreMemories(userId, userMessage, context);
      this.trace(traceId, "MEMORY_PERSISTED", { extractedMemoriesCount });
    } catch (error: any) {
      this.trace(traceId, "MEMORY_PERSIST_FAILED", { error: error?.message || "unknown" });
    }

    const executionTimeMs = Date.now() - startTime;
    const result: CognitivePipelineResult = {
      response: finalResponse,
      strategy,
      quality,
      extractedMemoriesCount,
      executionTimeMs,
      contextPackage: context,
      wasRevised,
      distressWindow,
    };

    // ── STAGE 7: Analytics Engine (Module 19) ──
    try {
      await recordCognitiveAnalytics(userId, result);
      this.trace(traceId, "ANALYTICS_PERSISTED");
    } catch (error: any) {
      this.trace(traceId, "ANALYTICS_PERSIST_FAILED", { error: error?.message || "unknown" });
    }

    this.trace(traceId, "PIPELINE_COMPLETED", {
      executionTimeMs,
      language: context.language.language,
      strategy: strategy.strategy,
      quality: quality.overallScore,
    });
    return result;
  }

  private static async generateWithGemini(
    prompt: string,
    context: CognitiveContextPackage,
    strategy: ResponseStrategy
  ): Promise<GeneratedResponse> {
    const useLiveGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "dummy");
    if (!useLiveGemini) return { text: generateFallbackResponse(context, strategy), source: "fallback" };

    try {
      const response = await aiClient.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
        contents: prompt,
      });
      if (response?.text?.trim()) return { text: response.text.trim(), source: "gemini" };
    } catch (error: any) {
      console.error("[CognitivePipeline] Gemini API call failed; using context-aware fallback:", error?.message || error);
    }

    return { text: generateFallbackResponse(context, strategy), source: "fallback" };
  }
}
