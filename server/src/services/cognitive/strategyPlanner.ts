import { CognitiveContextPackage, ResponseStrategy } from "./types.ts";

function isManglish(context: CognitiveContextPackage): boolean {
  return context.language.language === "manglish" || context.language.language === "mixed_ml_en";
}

function followUpFor(context: CognitiveContextPackage): string | undefined {
  const lower = context.userMessage.toLowerCase();
  const manglish = isManglish(context);
  const malayalam = context.language.language === "ml";

  if (/\b(vayya|vayyaa|sukham illa|sukhamilla|not feeling well|not well|unwell)\b/.test(lower)) {
    if (malayalam) return "ശരീരം സുഖമില്ലാത്തതാണോ, അതോ മനസ്സിന് ബുദ്ധിമുട്ടാണോ?";
    if (manglish) return "Shareeram aano sukhamillathath, atho manassinu budhimuttano?";
    return "Is your body feeling unwell, or is something weighing on you emotionally?";
  }

  if (/\b(office|work|boss|pressure|deadline|job)\b/.test(lower)) {
    if (malayalam) return "എത്ര നാളായി ജോലിയുടെ സമ്മർദ്ദം ഇങ്ങനെ തോന്നുന്നത്?";
    if (manglish) return "Ethra naal aayi office pressure ingane feel cheyyunnath?";
    return "How long has the pressure at work been feeling this intense?";
  }

  if (/\b(relationship|bandham|partner|breakup|family issue)\b/.test(lower)) {
    if (malayalam) return "അതിനെക്കുറിച്ച് കുറച്ച് കൂടി പറയാമോ?";
    if (manglish) return "Athine kurich kurach koodi parayaamo?";
    return "Would you like to tell me a little more about what is happening in the relationship?";
  }

  return undefined;
}

// Module 14: Response Strategy Planner
export function planResponseStrategy(context: CognitiveContextPackage): ResponseStrategy {
  const { crisis, emotion, intent } = context;
  const memoryQuestionDuringActiveRisk = intent === "memory_recall" && crisis.source === "recent_conversation";

  // A direct disclosure, or a normal message immediately following one, must
  // stay in the safety path. A recall question still receives a factual answer
  // first, with a safety check attached by the responder.
  if (crisis.isCrisis && crisis.source === "current_message" && !memoryQuestionDuringActiveRisk) {
    return {
      strategy: "crisis_support",
      instructions: "Respond immediately and specifically to the safety concern. Ask whether the person is safe right now, encourage a trusted person to stay with them, and give local emergency guidance (112 in India; 988 in the US/Canada). Do not use generic listening phrases or move to ordinary conversation.",
      tone: "Compassionate, calm, direct, and safety-focused",
      targetLength: "medium",
      includeCopingExercise: false,
    };
  }

  // A prior unresolved disclosure deserves a direct check-in, but repeating
  // emergency numbers on every ordinary follow-up is misleading and erodes
  // the meaning of an actual crisis route.
  if (crisis.isCrisis && crisis.source === "recent_conversation" && !memoryQuestionDuringActiveRisk) {
    return {
      strategy: "crisis_support",
      instructions: "Give a brief, direct safety check-in about the earlier concern. Ask whether the user is safe and has a plan. Do not repeat emergency numbers unless the current message indicates immediate danger or the user asks for them.",
      tone: "Compassionate, calm, and direct",
      targetLength: "short",
      includeCopingExercise: false,
    };
  }

  // Medium risk is not normal chat: make a direct, supportive safety check-in.
  if (crisis.severity === "moderate" && crisis.source === "current_message") {
    return {
      strategy: "crisis_support",
      instructions: "Use a brief supportive safety check-in. Ask directly whether the user is safe right now and whether they have a plan to hurt themselves. Do not diagnose, debate, or continue normal chat until they answer.",
      tone: "Compassionate, calm, and direct",
      targetLength: "short",
      includeCopingExercise: false,
    };
  }

  if (intent === "memory_recall") {
    return {
      strategy: "memory_reflection",
      instructions: `${memoryQuestionDuringActiveRisk ? "First answer the memory question with concrete, accurate prior statements. Then gently ask whether the person is safe right now because a recent message raised a safety concern." : "Answer the memory question with concrete, accurate prior statements from the supplied history. Never claim to remember anything not present in the context."} Do not use a generic acknowledgement.`,
      tone: "Attentive, factual, warm, and concise",
      targetLength: "medium",
      includeCopingExercise: false,
    };
  }

  if (intent === "small_talk") {
    return {
      strategy: "greeting",
      instructions: "Give a natural, varied greeting and invite a real check-in. Do not default to 'Thank you for sharing', 'I understand', or 'I am here to listen'.",
      tone: "Warm, welcoming, and human",
      targetLength: "short",
      includeCopingExercise: false,
    };
  }

  const followUpQuestion = followUpFor(context);
  if (followUpQuestion) {
    return {
      strategy: "follow_up",
      instructions: "Reflect the specific issue in the user's words, then ask the supplied focused follow-up question. Do not rush into advice or use a generic acknowledgement.",
      tone: "Warm, curious, and non-judgmental",
      targetLength: "short",
      includeCopingExercise: false,
      followUpQuestion,
    };
  }

  if (intent === "venting" || emotion.dominant === "anxiety" || emotion.dominant === "sadness") {
    return {
      strategy: emotion.dominant === "anxiety" ? "coaching" : "emotional_validation",
      instructions: "Name the specific emotion or situation first, then offer one gentle next step or an open question. Avoid canned empathy and avoid rushing to fix things.",
      tone: "Warm, empathetic, patient, non-judgmental",
      targetLength: "medium",
      includeCopingExercise: emotion.dominant === "anxiety",
      exerciseType: emotion.dominant === "anxiety" ? "4-7-8 Breathing" : undefined,
    };
  }

  if (intent === "coping_request") {
    return {
      strategy: "education",
      instructions: "Provide one clear, step-by-step coping technique that matches the request, then ask whether the user wants to try it together.",
      tone: "Encouraging, structured, guiding",
      targetLength: "medium",
      includeCopingExercise: true,
      exerciseType: "5-4-3-2-1 Grounding",
    };
  }

  if (intent === "journal_reflection") {
    return {
      strategy: "clarification",
      instructions: "Acknowledge the supplied reflection specifically and ask one thoughtful follow-up that encourages self-insight.",
      tone: "Reflective, inquisitive, gentle",
      targetLength: "medium",
      includeCopingExercise: false,
    };
  }

  if (emotion.dominant === "joy" || intent === "progress_check") {
    return {
      strategy: "celebration",
      instructions: "Celebrate the specific progress or positive emotion without exaggerating it, then invite the user to reflect on what helped.",
      tone: "Warm, joyful, affirming",
      targetLength: "short",
      includeCopingExercise: false,
    };
  }

  return {
    strategy: "active_listening",
    instructions: "Respond to the specific content of the message with a fresh opening and one useful follow-up question. Do not use a generic acknowledgement as the whole response.",
    tone: "Friendly, supportive, balanced",
    targetLength: "medium",
    includeCopingExercise: false,
  };
}
