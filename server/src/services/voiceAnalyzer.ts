import { extractTextSignals, RiskSignal } from "./riskEngine.ts";
import { GoogleGenAI } from "@google/genai";

const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy" });

export interface VoiceAnalysisResult {
  transcript: string;
  emotions: {
    despair: number;      // 0 to 1
    panic: number;        // 0 to 1
    anger: number;        // 0 to 1
    crying: boolean;
    longPauses: boolean;
  };
  signals: RiskSignal[];
}

export class VoiceAnalyzer {
  /**
   * Analyze voice call transcripts or voice message text to identify clinical markers.
   * If a real Gemini key is available, it analyzes the transcript text to extract clinical metrics.
   */
  static async analyzeVoiceTranscript(
    transcript: string,
    providedEmotions?: VoiceAnalysisResult["emotions"]
  ): Promise<VoiceAnalysisResult> {
    const defaultEmotions = {
      despair: 0,
      panic: 0,
      anger: 0,
      crying: false,
      longPauses: false,
    };

    let emotions = providedEmotions || defaultEmotions;

    const useLiveGemini = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "dummy";

    if (useLiveGemini && !providedEmotions) {
      try {
        const prompt = `You are a clinical speech NLP analyst.
Analyze this transcript of a voice message or voice call for emotional states.
Output a JSON response matching this schema:
{
  "despair": 0.0, // float between 0 and 1 indicating hopelessness/despondency
  "panic": 0.0,   // float between 0 and 1 indicating fear/breathlessness/anxiety
  "anger": 0.0,   // float between 0 and 1 indicating agitation/irritability
  "crying": false, // boolean if indicators of sobbing or weeping are verbally expressed or noted
  "longPauses": false // boolean if text shows signs of stuttering, severe hesitation or gaps
}

Transcript:
"${transcript}"

Output only raw JSON, no markdown formatting.`;

        const response = await aiClient.models.generateContent({
          model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });

        const parsed = JSON.parse(response.text || "{}");
        emotions = {
          despair: Number(parsed.despair) || 0,
          panic: Number(parsed.panic) || 0,
          anger: Number(parsed.anger) || 0,
          crying: !!parsed.crying,
          longPauses: !!parsed.longPauses
        };
      } catch (err) {
        console.error("[VoiceAnalyzer] Gemini analysis failed, using fallback:", err);
      }
    }

    // Extract risk signals from transcript text
    const textSignals = extractTextSignals(transcript, "voice_message");

    // Augment text signals with voice emotion indicators
    if (emotions.despair > 0.65) {
      textSignals.push({
        type: "voice_distress",
        score: Math.round(emotions.despair * 25),
        detail: `Despair level detected in voice transcript: ${(emotions.despair * 100).toFixed(0)}%`,
        source: "voice_message"
      });
    }

    if (emotions.panic > 0.65) {
      textSignals.push({
        type: "panic_expression",
        score: Math.round(emotions.panic * 20),
        detail: `Panic markers detected in voice transcript: ${(emotions.panic * 100).toFixed(0)}%`,
        source: "voice_message"
      });
    }

    if (emotions.crying) {
      textSignals.push({
        type: "voice_distress",
        score: 30,
        detail: "Verbal cues or markers indicating sobbing/crying during voice call/message",
        source: "voice_message"
      });
    }

    return {
      transcript,
      emotions,
      signals: textSignals
    };
  }
}
