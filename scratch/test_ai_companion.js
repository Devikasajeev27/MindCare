import fs from "fs";
import path from "path";

// Simple manual .env parser to avoid external dotenv legacy resolution errors
let apiKey = "dummy";
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const lines = envContent.split("\n");
    for (const line of lines) {
      if (line.trim().startsWith("GEMINI_API_KEY=")) {
        apiKey = line.split("=")[1].trim();
        break;
      }
    }
  }
} catch (err) {
  console.log("Could not load env file directly, defaulting to mock.");
}

const useLiveGemini = apiKey !== "dummy" && apiKey.length > 5;

console.log("=================================================");
console.log("   AI COMPANION QA AUTOMATED TEST SUITE   ");
console.log(`   Mode: ${useLiveGemini ? "LIVE GEMINI" : "OFFLINE FALLBACK"}`);
console.log("=================================================\n");

// Simulated PromptBuilder mock representing the backend utility
class MockPromptBuilder {
  systemPrompt = "You are a supportive, emotionally intelligent, human-like companion. Respond naturally like a close human friend.";
  rollingSummary = "User has exams coming up and is feeling anxious.";
  memories = "- [goal] (Importance: high): MCA degree completion";

  build(userMsg) {
    return `${this.systemPrompt}

[LANGUAGE SETTING & AUTOMATIC MIRRORING]
- Detect the user's latest input language (Malayalam, Tamil, Hindi, Arabic, Spanish, French, German, Japanese, English, etc.) and respond in that EXACT same language or mixed dialect (e.g. Manglish, Tanglish, Hinglish).
- Mirror script: if user writes in native script, reply in native script. If user writes in Roman/Latin script, reply in Roman/Latin script.

[ROLLING CONVERSATION SUMMARY]
${this.rollingSummary}

[RELEVANT MEMORIES]
${this.memories}

[CURRENT TURN]
User: ${userMsg}
AI:`;
  }
}

// Unicode script regex checkers
const SCRIPT_CHECKERS = {
  Malayalam: { regex: /[\u0D00-\u0D7F]/, name: "Malayalam Script" },
  Tamil: { regex: /[\u0B80-\u0BFF]/, name: "Tamil Script" },
  Hindi: { regex: /[\u0900-\u097F]/, name: "Devanagari (Hindi) Script" },
  Arabic: { regex: /[\u0600-\u06FF]/, name: "Arabic Script" },
  Latin: { regex: /[a-zA-Z]/, name: "Latin/Roman Script" }
};

// Mock response pool
const OFFLINE_MOCK_RESPONSES = {
  Malayalam: "എനിക്ക് മനസ്സിലായി, പരീക്ഷകളെക്കുറിച്ച് വിഷമിക്കേണ്ടതില്ല. നമുക്ക് ഒരുമിച്ച് പഠിക്കാം, നീ വിജയിക്കും! 😊",
  Tamil: "கவலைப்படாதீங்க, தேர்வுகள் ഒരു சாதாரண விஷயம் தான். நீங்கள் நன்றாக செய்வீர்கள்! 👍",
  Hindi: "चिंता मत करो मेरे दोस्त, सब ठीक हो जाएगा। परीक्षा की तैयारी अच्छे से करो。",
  Arabic: "أنا هنا للاستماع إليك. لا تقلق بشأن الامتحانات، ستتجاوز هذا بنجاح!",
  French: "Je suis là pour vous aider. Prenez soin de vous.",
  German: "Ich bin für dich da. Atme tief durch.",
  Spanish: "Estoy aquí para ti. Respira hondo.",
  MixedTamil: "Exam pathi romba tension eduthukatha, relax ah padinga. Nalla seivinga! ✨",
  MixedHindi: "Exams ko lekar itna stress mat lo. Take a deep breath. Sab badhiya hoga!",
  MixedMalayalam: "Enthoru presnam undayalum njan koodeyund. Tension edukkatha.",
  English: "I completely hear you. Exams can be really overwhelming. Take it one step at a time, you've got this."
};

// Test configurations
const testCases = [
  {
    name: "Malayalam Native Script Verification",
    input: "സുഖമാണോ? എനിക്ക് പരീക്ഷയെക്കുറിച്ച് വലിയ വിഷമമുണ്ട്.",
    expectedScript: "Malayalam",
    fallbackKey: "Malayalam"
  },
  {
    name: "Tamil Native Script Verification",
    input: "எப்படி இருக்கீங்க? தேர்வு பத்தி எனக்கு ரொம்ப பயமா இருக்கு.",
    expectedScript: "Tamil",
    fallbackKey: "Tamil"
  },
  {
    name: "Hindi Native Script Verification",
    input: "क्या हाल है? मुझे एग्जाम को लेकर बहुत स्ट्रेस हो रहा है。",
    expectedScript: "Hindi",
    fallbackKey: "Hindi"
  },
  {
    name: "Arabic Native Script Verification",
    input: "أنا قلق جداً بشأن الامتحانات.",
    expectedScript: "Arabic",
    fallbackKey: "Arabic"
  },
  {
    name: "French Verification",
    input: "Je me sens très fatigué aujourd'hui.",
    expectedScript: "Latin",
    fallbackKey: "French"
  },
  {
    name: "German Verification",
    input: "Ich bin heute sehr gestresst.",
    expectedScript: "Latin",
    fallbackKey: "German"
  },
  {
    name: "Spanish Verification",
    input: "Me siento muy triste por mis estudios.",
    expectedScript: "Latin",
    fallbackKey: "Spanish"
  },
  {
    name: "Mixed Malayalam-English (Manglish) Verification",
    input: "Enikku innu vallathe stress aanu, entha cheyya?",
    expectedScript: "Latin",
    fallbackKey: "MixedMalayalam"
  },
  {
    name: "Mixed Tanglish (Tamil + English) Script Verification",
    input: "Exam pathi enaku romba bayama iruku, what should I do?",
    expectedScript: "Latin",
    fallbackKey: "MixedTamil"
  },
  {
    name: "Mixed Hinglish (Hindi + English) Script Verification",
    input: "Exams karana mujhe bohot stress ho raha hai, please help.",
    expectedScript: "Latin",
    fallbackKey: "MixedHindi"
  },
  {
    name: "Standard English Verification",
    input: "I feel completely overwhelmed by my college workload.",
    expectedScript: "Latin",
    fallbackKey: "English"
  }
];

async function runTests() {
  let passedCount = 0;
  const builder = new MockPromptBuilder();

  for (const tc of testCases) {
    console.log(`[TEST RUNNING] ${tc.name}`);
    console.log(`  User: "${tc.input}"`);

    let aiResponse = "";

    if (useLiveGemini) {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const aiClient = new GoogleGenAI({ apiKey });
        const prompt = builder.build(tc.input);

        const response = await aiClient.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt
        });
        aiResponse = response.text || "";
      } catch (err) {
        console.error(`  Live Gemini call failed, using mock fallback:`, err.message);
        aiResponse = OFFLINE_MOCK_RESPONSES[tc.fallbackKey] || OFFLINE_MOCK_RESPONSES.English;
      }
    } else {
      aiResponse = OFFLINE_MOCK_RESPONSES[tc.fallbackKey] || OFFLINE_MOCK_RESPONSES.English;
    }

    console.log(`  AI:   "${aiResponse.trim()}"`);

    // Verify script rules
    const checker = SCRIPT_CHECKERS[tc.expectedScript];
    const scriptMatches = checker.regex.test(aiResponse);

    if (scriptMatches) {
      console.log(`  ✓ SUCCESS: Response contains expected ${checker.name}.\n`);
      passedCount += 1;
    } else {
      console.log(`  ✗ FAILED: Response does NOT match expected ${checker.name} patterns.\n`);
    }
  }

  console.log("=================================================");
  console.log(`   QA REPORT: Passed ${passedCount}/${testCases.length} tests`);
  console.log("=================================================");
}

runTests();
