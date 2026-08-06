import { CognitiveContextPackage, ResponseStrategy } from "./types.ts";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) >>> 0;
  return result;
}

function isManglish(context: CognitiveContextPackage): boolean {
  return context.language.language === "manglish" || context.language.language === "mixed_ml_en";
}

function isMalayalam(context: CognitiveContextPackage): boolean {
  return context.language.language === "ml";
}

function pickFresh(context: CognitiveContextPackage, options: string[]): string {
  const priorAi = context.recentMessages
    .filter((message) => message.sender === "ai")
    .map((message) => normalize(message.text));
  const startingIndex = hash(`${context.userMessage}:${priorAi.length}`) % options.length;

  for (let offset = 0; offset < options.length; offset += 1) {
    const candidate = options[(startingIndex + offset) % options.length];
    const opening = normalize(candidate).split(" ").slice(0, 5).join(" ");
    if (!priorAi.some((response) => response.startsWith(opening))) return candidate;
  }
  return options[startingIndex];
}

function priorUserStatements(context: CognitiveContextPackage): string[] {
  const current = normalize(context.userMessage);
  const statements = context.recentMessages
    .filter((message) => message.sender === "user" && normalize(message.text) !== current)
    .map((message) => message.text.trim())
    .filter(Boolean);

  return statements.slice(-4);
}

function statementsToRecall(context: CognitiveContextPackage): string[] {
  const statements = priorUserStatements(context);
  const importantStatements = statements.filter((statement) => /\b(vayya|vayyaa|jeevikkan|marikkan|suicide|want to die|not want to live|hopeless|pressure|relationship)\b/i.test(statement));
  return (importantStatements.length ? importantStatements : statements).slice(-2);
}

export function crisisSafetyMessage(context: CognitiveContextPackage): string {
  if (isMalayalam(context)) {
    return "നിങ്ങൾ ഇപ്പോൾ സുരക്ഷിതനാണോ? സ്വയം ഉപദ്രവിക്കാൻ ഒരു പദ്ധതി ഉണ്ടോ? വിശ്വസിക്കാവുന്ന ഒരാളെ സമീപത്ത് ഉണ്ടാക്കാമോ? ഇന്ത്യയിൽ 112 അല്ലെങ്കിൽ Tele-MANAS 14416 / 1-800-891-4416-ൽ വിളിക്കാം.";
  }
  if (isManglish(context)) {
    return "Nee ippol safe aano? Ninne hurt cheyyaan oru plan undo? Viswasikkavunna oraaley ippol ninte aduth undaakkaan pattumo? India-il 112 allenkil Tele-MANAS 14416 / 1-800-891-4416-il vilikkoo.";
  }
  return "Are you safe right now? Do you have a plan to hurt yourself? Can you ask someone you trust to stay with you? In India, call 112 or Tele-MANAS at 14416 / 1-800-891-4416; otherwise contact local emergency services.";
}

function safetyCheckIn(context: CognitiveContextPackage): string {
  if (isMalayalam(context)) {
    return "നിങ്ങൾ ഇപ്പോൾ സുരക്ഷിതനാണോ? സ്വയം ഉപദ്രവിക്കാൻ ഒരു പദ്ധതി ഉണ്ടോ? വിശ്വസിക്കാവുന്ന ഒരാളെ ഇപ്പോൾ സമീപത്ത് ഉണ്ടാക്കാമോ?";
  }
  if (isManglish(context)) {
    return "Nee ippol safe aano? Ninne hurt cheyyaan oru plan undo? Viswasikkavunna oraaley ippol ninte aduth undaakkaan pattumo?";
  }
  return "Are you safe right now? Do you have a plan to hurt yourself? Can you ask someone you trust to stay with you?";
}

function requiresEmergencyGuidance(context: CognitiveContextPackage): boolean {
  return context.crisis.source === "current_message" && ["high", "critical"].includes(context.crisis.severity);
}

export function hasCrisisSafetyGuidance(response: string): boolean {
  const lower = response.toLowerCase();
  const asksSafety = /\b(safe|safety|suraksh|സുരക്ഷിത)/i.test(response);
  const emergencyRoute = /\b(112|988|emergency|helpline|emർജൻസി|എമർജൻസി)/i.test(lower);
  return asksSafety && emergencyRoute;
}

export function hasRequiredSafetyGuidance(response: string, context: CognitiveContextPackage): boolean {
  if (requiresEmergencyGuidance(context)) return hasCrisisSafetyGuidance(response);
  return /\b(safe|safety|suraksh|സുരക്ഷിത)\b/i.test(response);
}

export function ensureCrisisSafety(response: string, context: CognitiveContextPackage): string {
  const needsSafetyCheck = context.crisis.isCrisis || context.crisis.severity === "moderate";
  if (!needsSafetyCheck || hasRequiredSafetyGuidance(response, context)) return response;
  return `${response.trim()}\n\n${requiresEmergencyGuidance(context) ? crisisSafetyMessage(context) : safetyCheckIn(context)}`;
}

function crisisResponse(context: CognitiveContextPackage): string {
  const direct = context.crisis.source === "current_message";
  const checkInOnly = context.crisis.severity === "moderate" || context.crisis.source === "recent_conversation";
  if (isMalayalam(context)) {
    if (checkInOnly) return `നിങ്ങൾ പങ്കുവെച്ചത് പ്രധാനമാണ്. ${safetyCheckIn(context)}`;
    const acknowledgement = direct
      ? "ജീവിക്കാൻ തോന്നുന്നില്ലെന്ന് നിങ്ങൾ പറഞ്ഞത് ഞാൻ വളരെ ഗൗരവമായി എടുക്കുന്നു."
      : "മുമ്പ് പറഞ്ഞ സുരക്ഷാ ആശങ്കയുടെ പശ്ചാത്തലത്തിൽ ഇപ്പോൾ സുഖമില്ലെന്ന് പറയുന്നത് ഞാൻ ഗൗരവമായി എടുക്കുന്നു.";
    return `${acknowledgement} ${crisisSafetyMessage(context)}`;
  }
  if (isManglish(context)) {
    if (checkInOnly) return `Nee share cheythath valare important aanu. ${safetyCheckIn(context)}`;
    const acknowledgement = direct
      ? "Nee jeevikkan thonnunnilla ennu paranjath njan valare serious aayi edukkunnu."
      : "Nee munpe paranja safety concern-inte pinnil ippol sukhamillennu parayunnath njan serious aayi edukkunnu.";
    return `${acknowledgement} ${crisisSafetyMessage(context)}`;
  }
  if (checkInOnly) return `What you shared is important, and I want to check in. ${safetyCheckIn(context)}`;
  const acknowledgement = direct
    ? "You said that you do not feel like living, and I am taking that seriously."
    : "Given what you said earlier about not wanting to live, I am taking “not feeling well” seriously.";
  return `${acknowledgement} ${crisisSafetyMessage(context)}`;
}

function memoryResponse(context: CognitiveContextPackage): string {
  const statements = statementsToRecall(context);
  if (isMalayalam(context)) {
    const quoted = statements.length ? statements.slice(-2).map((statement) => `“${statement}”`).join(" എന്നും ") : "നിങ്ങൾ പങ്കുവെച്ച കാര്യങ്ങൾ";
    const response = statements.length
      ? `ഉണ്ട്. നിങ്ങൾ മുമ്പ് ${quoted} എന്ന് പറഞ്ഞിരുന്നു. അതുകൊണ്ട് നിങ്ങൾക്ക് വലിയ ബുദ്ധിമുട്ട് ഉണ്ടെന്ന് എനിക്ക് മനസ്സിലാകുന്നു.`
      : "ഉണ്ട്. ഈ ചാറ്റിൽ നിങ്ങൾ പങ്കുവെച്ച കാര്യങ്ങൾ ഞാൻ ശ്രദ്ധയിൽ വെച്ചിട്ടുണ്ട്.";
    return ensureCrisisSafety(response, context);
  }
  if (isManglish(context)) {
    const quoted = statements.length ? statements.slice(-2).map((statement) => `“${statement}”`).join(" ennum ") : "nee share cheytha karyangal";
    const response = statements.length
      ? `Undu. Nee munpe ${quoted} ennu paranjirunnu. Ath kond ninakku valiya budhimutt undennu enikk manassilaakunnu.`
      : "Undu. Ee chat-il nee share cheytha karyangal njan shradhichittund.";
    return ensureCrisisSafety(response, context);
  }
  const quoted = statements.length ? statements.slice(-2).map((statement) => `“${statement}”`).join(" and ") : "what you have shared in this chat";
  const response = statements.length
    ? `Yes. Earlier you told me ${quoted}. That tells me you have been carrying a lot.`
    : "Yes. I have kept track of what you have shared in this chat.";
  return ensureCrisisSafety(response, context);
}

function greetingResponse(context: CognitiveContextPackage): string {
  if (isMalayalam(context)) {
    return pickFresh(context, [
      "ഹായ് — ഇന്ന് നിങ്ങളുടെ മനസ്സിൽ എന്താണ് നടക്കുന്നത്?",
      "ഹലോ! ഇന്ന് നിങ്ങളെ ഏറ്റവും കൂടുതൽ ബാധിക്കുന്ന കാര്യം എന്താണ്?",
      "നമസ്കാരം. ഇന്ന് എങ്ങനെയുണ്ട് എന്ന് പറയാമോ?",
    ]);
  }
  if (isManglish(context)) {
    return pickFresh(context, [
      "Hi — innu ninte manassil entha nadakkunnath?",
      "Hello! Innu ninne ettavum kooduthal affect cheyyunnath entha?",
      "Hi, innu engane undennu parayaamo?",
    ]);
  }
  return pickFresh(context, [
    "Hi — I’m glad you dropped in. What has been on your mind today?",
    "Hello. How has your day been treating you so far?",
    "Hey — where would you like to start today?",
  ]);
}

function followUpResponse(context: CognitiveContextPackage, strategy: ResponseStrategy): string {
  const question = strategy.followUpQuestion || "Can you tell me a little more about that?";
  if (isMalayalam(context)) {
    return `${pickFresh(context, ["ഇത് ഇപ്പോൾ നിങ്ങൾക്ക് വളരെ ഭാരമായി തോന്നുന്നുണ്ടാകാം.", "നിങ്ങൾ ഇത് പറയുന്നത് പ്രധാനമാണ്.", "ഇതിൽ നിങ്ങൾ ഒറ്റയ്ക്കല്ല."])} ${question}`;
  }
  if (isManglish(context)) {
    return `${pickFresh(context, ["Ithu ippol ninakku valare heavy aayirikkam.", "Nee ithu paranjath valare important aanu.", "Ithil nee ottayalla."])} ${question}`;
  }
  return `${pickFresh(context, ["That sounds like it is weighing on you right now.", "I’m glad you named what is going on.", "This sounds genuinely difficult to carry alone."])} ${question}`;
}

function supportiveResponse(context: CognitiveContextPackage, strategy: ResponseStrategy): string {
  const emotion = context.emotion.dominant;
  if (isMalayalam(context)) {
    if (emotion === "lonely") return "ഒറ്റപ്പെടൽ അനുഭവപ്പെടുന്നത് വളരെ പ്രയാസമുള്ള കാര്യമാണ്. ഞാൻ ഇവിടെ നിങ്ങൾക്കൊപ്പമുണ്ട്. ഇപ്പോൾ മനസ്സിലുള്ളത് പങ്കുവെക്കാമോ?";
    if (emotion === "burnout") return "വളരെ തളർച്ച അനുഭവപ്പെടുന്നുണ്ടെന്ന് തോന്നുന്നു. കുറച്ച് സമയം വിശ്രമിക്കാൻ സ്വയം അനുവദിക്കൂ. ഇപ്പോൾ എന്താണ് കൂടുതൽ ഭാരമായി തോന്നുന്നത്?";
    if (emotion === "overwhelmed") return "എല്ലാം കൂടി ഒരുമിച്ച് താങ്ങാൻ ബുദ്ധിമുട്ടുന്നത് പോലെ തോന്നാം. ചെറിയ ഒരു ഭാഗത്ത് നിന്ന് നമുക്ക് ആരംഭിക്കാം. ഇപ്പോൾ ഏറ്റവും കൂടുതൽ അലട്ടുന്നത് ഏതാണ്?";
    if (emotion === "stressed") return "മനസ്സിൽ വലിയ സമ്മർദ്ദം ഉണ്ടെന്ന് തോന്നുന്നു. ആ ശ്വാസം ഒന്ന് അയച്ചു വിടൂ. ഇപ്പോൾ എന്താണ് ഈ പ്രഷറിന് കാരണം?";
    if (emotion === "anxiety") return "ഇത് നിങ്ങൾക്ക് ഉത്കണ്ഠയുണ്ടാക്കുന്നുവെന്ന് തോന്നുന്നു. ഒരു ചെറു ശ്വാസം എടുത്ത്, ഇപ്പോൾ ഏറ്റവും ബുദ്ധിമുട്ടിക്കുന്ന ഭാഗം ഏതാണ് എന്ന് പറയാമോ?";
    if (emotion === "sadness" || emotion === "depressed") return "ഇത് നിങ്ങൾക്ക് വളരെ കഠിനമായിരിക്കുമെന്ന് തോന്നുന്നു. ഇപ്പോൾ നിങ്ങളെ ഏറ്റവും കൂടുതൽ വേദനിപ്പിക്കുന്ന കാര്യം ഏതാണ്?";
    return "നമുക്ക് ഇത് ഒരുമിച്ച് ഒന്ന് നോക്കാം. ഇപ്പോൾ ഏറ്റവും പ്രധാനമായി പറയണമെന്ന് തോന്നുന്ന കാര്യം എന്താണ്?";
  }
  if (isManglish(context) || context.userMessage.includes("🎙️ Voice Message")) {
    if (emotion === "lonely") return "Ottakkennu thonnunnath valare heavy aayirikkam. Njan ninne kelkkan ivide undu. Ippo manassil entha ullath?";
    if (emotion === "burnout") return "Aake thalarchayum exhaustion-um thonnunnath pole und. Korachu vishramikkaan swayam samayam kodukkoo. Ippo entha kooduthal weight aayi thonnunnath?";
    if (emotion === "overwhelmed") return "Ellam koodi thaanan pattunnilla ennu thonnunnath natural aanu. Cheriya oru part-il ninnu namukku thudangaam. Ippo entha ettavum heavy?";
    if (emotion === "stressed") return "Nalla pressure-um stress-um thonnunnu undalloo. Oru cheriya break edukkoo. Ippo entha ee stress-inte main reason?";
    if (emotion === "anxiety") return "Ithu ninakku anxiety undaakkunnath pole thonnunnu. Oru cheriya shwaasam eduthu, ippol ettavum budhimuttunna bhaagam entha ennu parayaamo?";
    if (emotion === "sadness" || emotion === "depressed") return "Ithu ninakku valare kashtamaayirikkum. Ippo ninne ettavum vedhanippikkunna karyam entha?";
    return "Namukku ithu orumichu onnu nokkaam. Ippo parayan ettavum pradhanamennu thonnunna karyam entha?";
  }
  if (emotion === "lonely") return "Feeling lonely can be so heavy to carry. I'm right here with you. What’s feeling most isolated right now?";
  if (emotion === "burnout") return "It sounds like you are completely running on empty. Please be gentle with yourself. What is draining your energy the most?";
  if (emotion === "overwhelmed") return "When everything piles up at once, it’s completely understandable to feel overwhelmed. Let’s take it one step at a time. What’s taking up the most space right now?";
  if (emotion === "stressed") return "It sounds like there’s a lot of pressure on your shoulders. Let’s take a pause. What part of this feels most intense right now?";
  if (emotion === "anxiety") return "It sounds as though anxiety is taking up a lot of space right now. What part feels most urgent to unpack first?";
  if (emotion === "sadness" || emotion === "depressed") return "This sounds really hard to sit with. What is hurting the most right now?";
  if (strategy.strategy === "celebration") return "That is worth noticing. What do you think helped make that positive moment possible?";
  return "Let’s stay with that for a moment. What feels most important to talk through first?";
}

/**
 * Reliable offline response path and last-resort response after a failed Gemini
 * quality review. It is context-aware, language-aware, and deliberately varies
 * its opening based on recent AI turns.
 */
export function generateFallbackResponse(
  context: CognitiveContextPackage,
  strategy: ResponseStrategy
): string {
  if (strategy.strategy === "memory_reflection") return memoryResponse(context);
  if (context.crisis.isCrisis || strategy.strategy === "crisis_support") return crisisResponse(context);
  if (strategy.strategy === "greeting") return greetingResponse(context);
  if (strategy.strategy === "follow_up") return followUpResponse(context, strategy);
  return supportiveResponse(context, strategy);
}

/** A safe, language-aware final guard for the API if the full pipeline throws. */
export function createPipelineFailureResponse(userMessage: string, isCrisis: boolean): string {
  const lower = userMessage.toLowerCase();
  const isMalayalamMessage = /[\u0D00-\u0D7F]/.test(userMessage);
  const isManglishMessage = /\b(enikk|enikku|njan|njaan|vayya|thonnunn|jeevikkan|paranjath|orma|aano|illa|maduthu|maduth|vishamam|pediyund|thalarunnu|sangadam|kashtam|saramilla|ayyo|pattilla|illatto|ayache|vallatha|mattam|veruthe|onnum|nalla|kashtama|sankatam|chatha|pokan|vedhana|marikkan)\b/i.test(lower);

  if (isCrisis) {
    if (isMalayalamMessage) return "നിങ്ങൾ പറഞ്ഞത് വളരെ ഗൗരവമുള്ളതാണ്. നിങ്ങൾ ഇപ്പോൾ സുരക്ഷിതനാണോ? വിശ്വസിക്കാവുന്ന ഒരാളെ ഉടൻ സമീപിക്കൂ. അപകടസാധ്യതയുണ്ടെങ്കിൽ ഇന്ത്യയിൽ 112, യു.എസ്./കാനഡയിൽ 988, അല്ലെങ്കിൽ പ്രാദേശിക എമർജൻസി സേവനത്തെ ഇപ്പോൾ വിളിക്കൂ.";
    if (isManglishMessage) return "Nee paranjath valare serious aanu. Nee ippol safe aano? Viswasikkavunna oraaley udane sameepikkoo. Apakadasaadhyatha undengil India-il 112, US/Canada-il 988, allenkil local emergency service-ne ippo thanne vilikkoo.";
    return "What you said is serious, and I want to focus on your immediate safety. Are you safe right now? Please contact someone you trust and call local emergency services now if you may act on these thoughts — 112 in India or 988 in the US/Canada.";
  }

  if (isMalayalamMessage) return "ഞാൻ നിങ്ങളുടെ കൂടെയുണ്ട്. വിഷമിക്കേണ്ട, മനസ്സ് തുറന്ന് സംസാരിക്കൂ. ഇപ്പോൾ ഏറ്റവും കൂടുതൽ ബുദ്ധിമുട്ടിക്കുന്ന ഭാഗം എന്താണ്?";
  if (isManglishMessage) return "Njan ninne kelkkan ivide undu. Enthau pattiyath? Ningalude manassile vishamam enikk manassilaakunnu. Dhairyamaayi parayoo, ippo entha kooduthal budhimuttunnath?";
  return "I hear you, and I am here with you. Please take a deep breath and share whatever is on your mind — what is weighing on you most right now?";
}
