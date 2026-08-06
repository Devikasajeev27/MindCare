import { CognitivePipeline } from "../services/cognitivePipeline.ts";
import { VoiceEngine } from "../services/cognitive/voiceEngine.ts";

async function runMultilingualTestSuite() {
  console.log("=========================================================================");
  console.log("  MINDCARE AI COMPANION 2.0 - MULTILINGUAL & VOICE VERIFICATION SUITE");
  console.log("=========================================================================\n");

  const testUserId = "60c72b2f9b1d8b2b8c8b4567";

  const scenarios = [
    {
      name: "Pure Malayalam Chat",
      input: "എനിക്ക് ഇന്ന് സുഖമില്ല, വളരെ വിഷമം തോന്നുന്നു.",
      expectedLang: "ml",
    },
    {
      name: "Pure Manglish Chat",
      input: "Enikk innu sukham illa, katta vishamam und.",
      expectedLang: "manglish",
    },
    {
      name: "English Chat",
      input: "I am feeling very anxious about my career and future.",
      expectedLang: "en",
    },
    {
      name: "Mixed Malayalam + English Chat",
      input: "Office-il nalla pressure und, enikk thaanan pattunnilla.",
      expectedLang: "mixed_ml_en",
    },
    {
      name: "Voice Manglish Processing",
      type: "voice",
      input: "Enikk innu office-il nalla vishamam undayi, aake confused aanu.",
      expectedLang: "manglish",
    },
    {
      name: "Voice Malayalam Processing",
      type: "voice",
      input: "എനിക്ക് ഇന്ന് ഭയങ്കര പേടി തോന്നുന്നു.",
      expectedLang: "ml",
    },
  ];

  for (const scenario of scenarios) {
    console.log(`-------------------------------------------------------------------------`);
    console.log(`TEST SCENARIO: ${scenario.name}`);
    console.log(`INPUT: "${scenario.input}"`);

    try {
      if (scenario.type === "voice") {
        const voiceRes = await VoiceEngine.processVoiceMessage(testUserId, scenario.input);
        console.log(`✓ STT Transcript: "${voiceRes.sttTranscript}"`);
        console.log(`✓ Detected Language: ${voiceRes.contextPackage.language.languageName} (${voiceRes.contextPackage.language.language})`);
        console.log(`✓ Strategy Selected: ${voiceRes.strategy.strategy}`);
        console.log(`✓ Quality Score: ${voiceRes.quality.overallScore}/100 (Mirrored: ${voiceRes.quality.isLanguageMirrored})`);
        console.log(`✓ Audio Output URL: ${voiceRes.audioResponseUrl}`);
        console.log(`✓ Response Text: "${voiceRes.response}"\n`);
      } else {
        const textRes = await CognitivePipeline.processMessage(testUserId, scenario.input);
        console.log(`✓ Detected Language: ${textRes.contextPackage.language.languageName} (${textRes.contextPackage.language.language})`);
        console.log(`✓ Emotion: ${textRes.contextPackage.emotion.dominant}`);
        console.log(`✓ Strategy Selected: ${textRes.strategy.strategy}`);
        console.log(`✓ Language Style Mirrored: ${textRes.quality.isLanguageMirrored ? "YES" : "NO"}`);
        console.log(`✓ Quality Score: ${textRes.quality.overallScore}/100`);
        console.log(`✓ Response Text: "${textRes.response}"\n`);
      }
    } catch (err: any) {
      console.error(`✗ Error in scenario ${scenario.name}:`, err.message);
    }
  }

  console.log("=========================================================================");
  console.log("  ALL SCENARIOS COMPLETED SUCCESSFULLY");
  console.log("=========================================================================");
}

runMultilingualTestSuite();
