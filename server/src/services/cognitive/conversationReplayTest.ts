import assert from "node:assert/strict";
import { detectCrisis, detectEmotion, detectIntent, detectLanguage, resolveConversationCrisis } from "./detectors.ts";
import { generateFallbackResponse } from "./fallbackResponder.ts";
import { evaluateQuality } from "./qualityCritic.ts";
import { planResponseStrategy } from "./strategyPlanner.ts";
import { CognitiveContextPackage } from "./types.ts";
import { buildCognitivePrompt } from "../../utils/promptBuilder.ts";

type StoredMessage = { sender: string; text: string; time: Date };

const turns = ["hi", "enikk vayya", "enikk jeevikkan thonnunnilla", "im not feeling well", "njan paranjath ellam orma undo"];

function summarize(messages: StoredMessage[], current: string): string {
  const statements = [...messages, { sender: "user", text: current, time: new Date() }]
    .filter((message) => message.sender === "user")
    .slice(-4)
    .map((message) => `“${message.text}”`);
  return `Recent user statements: ${statements.join("; ")}.`;
}

async function buildTestContext(current: string, messages: StoredMessage[]): Promise<CognitiveContextPackage> {
  const [language, directCrisis, emotion] = await Promise.all([detectLanguage(current), detectCrisis(current), detectEmotion(current)]);
  const intent = detectIntent(current, directCrisis);
  const recentMessages = [...messages, { sender: "user", text: current, time: new Date() }];

  return {
    userMessage: current,
    language,
    intent,
    emotion,
    crisis: resolveConversationCrisis(directCrisis, current, recentMessages),
    profileSummary: { name: "Test User", role: "user", wellnessScore: 70, streak: 1, trustScore: 50, talkingStyle: {}, behaviorSummary: {} },
    longTermMemories: [],
    recentMessages,
    conversationSummary: summarize(messages, current),
    journalSummary: { recentCount: 0, topTopics: [], moodEstimate: 3 },
    moodAnalytics: { averageRating: 3.5, recentTrend: "stable", volatility: "normal" },
    retrievedKnowledge: [],
  };
}

async function runConversationReplay(): Promise<void> {
  const messages: StoredMessage[] = [];
  const responses: string[] = [];

  for (const [index, input] of turns.entries()) {
    const context = await buildTestContext(input, messages);
    const strategy = planResponseStrategy(context);
    const response = generateFallbackResponse(context, strategy);
    const quality = evaluateQuality(response, context, strategy);
    const prompt = buildCognitivePrompt(context, strategy);

    assert.equal(quality.passed, true, `Turn ${index + 1} failed quality: ${quality.feedback}`);
    assert.equal(quality.usesGenericDefault, false, `Turn ${index + 1} used a generic default`);
    assert.equal(responses.includes(response), false, `Turn ${index + 1} repeated a response`);
    assert.match(prompt, /\[CONVERSATION SUMMARY — FACTUAL\]/);
    assert.match(prompt, /\[RECENT CHAT HISTORY — FACTUAL\]/);
    assert.match(prompt, /\[RETRIEVED LONG-TERM MEMORIES — FACTUAL\]/);
    assert.match(prompt, /\[EMOTION, MOOD, AND JOURNAL CONTEXT\]/);
    assert.match(prompt, /\[RISK\]/);
    assert.match(prompt, new RegExp(input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    if (index === 1) {
      assert.equal(context.language.language, "manglish");
      assert.equal(strategy.strategy, "crisis_support");
      assert.match(response, /safe/i);
      assert.doesNotMatch(response, /\b(112|14416|988)\b/i);
    }
    if (index === 2) {
      assert.equal(context.crisis.severity, "critical");
      assert.equal(strategy.strategy, "crisis_support");
      assert.match(response, /safe.*112.*(tele-manas|14416)/i);
    }
    if (index === 3) {
      assert.equal(context.crisis.source, "recent_conversation");
      assert.equal(strategy.strategy, "crisis_support");
    }
    if (index === 4) {
      assert.equal(strategy.strategy, "memory_reflection");
      assert.match(response, /enikk vayya/i);
      assert.match(response, /jeevikkan thonnunnilla/i);
      assert.match(response, /safe/i);
      assert.doesNotMatch(response, /\b(112|14416|988)\b/i);
      const genericQuality = evaluateQuality("Thank you for sharing. I am here to listen.", context, strategy);
      assert.equal(genericQuality.passed, false, "Quality critic must reject a generic memory answer");
    }

    console.log(JSON.stringify({
      turn: index + 1,
      user: input,
      language: context.language.language,
      emotion: context.emotion.dominant,
      risk: `${context.crisis.severity}:${context.crisis.source}`,
      strategy: strategy.strategy,
      quality: quality.overallScore,
      response,
    }));

    messages.push({ sender: "user", text: input, time: new Date() });
    messages.push({ sender: "ai", text: response, time: new Date() });
    responses.push(response);
  }

  console.log("Conversation intelligence replay passed: 5/5 turns.");
}

runConversationReplay().catch((error) => {
  console.error("Conversation intelligence replay failed:", error);
  process.exitCode = 1;
});
