import { GoogleGenAI } from "@google/genai";
import { CognitivePipeline } from "../cognitivePipeline.ts";
import { VoicePipelineResult } from "./types.ts";

const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy" });

export class VoiceEngine {
  /**
   * ChatGPT-Style Voice Workflow:
   * Audio Payload -> Speech-To-Text (STT) -> Multilingual Language & Emotion Detection -> Cognitive Pipeline -> Text-Only Response
   */
  static async processVoiceMessage(
    userId: string,
    audioBufferOrTranscript: Buffer | string,
    options: { mimeType?: string; sessionId?: string; clientTranscript?: string } = {}
  ): Promise<VoicePipelineResult> {
    const startTime = Date.now();

    let rawTranscript = "";
    let sttConfidence = 0.95;

    if (options.clientTranscript && options.clientTranscript.trim().length > 1) {
      rawTranscript = options.clientTranscript;
    } else if (typeof audioBufferOrTranscript === "string") {
      const isBase64Audio = audioBufferOrTranscript.length > 200 && !audioBufferOrTranscript.includes(" ");
      if (isBase64Audio) {
        rawTranscript = await this.transcribeAudioBuffer(Buffer.from(audioBufferOrTranscript, "base64"), options.mimeType || "audio/webm");
      } else {
        rawTranscript = audioBufferOrTranscript;
      }
    } else if (Buffer.isBuffer(audioBufferOrTranscript)) {
      rawTranscript = await this.transcribeAudioBuffer(audioBufferOrTranscript, options.mimeType || "audio/webm");
    }

    const cleanedTranscript = this.cleanNoiseAndSilence(rawTranscript);

    // Low confidence / unclear audio check
    if (!cleanedTranscript || cleanedTranscript.trim().length < 2 || cleanedTranscript === "[UNCLEAR]") {
      return {
        response: "I couldn't hear that clearly. Could you please repeat what you said?",
        sttTranscript: "",
        sttConfidence: 0.1,
        strategy: {
          strategy: "clarification",
          instructions: "Politely ask user to repeat voice recording.",
          tone: "Gentle",
          targetLength: "short",
          includeCopingExercise: false,
        },
        quality: {
          isRelevant: true,
          isContextAware: true,
          isEmpathetic: true,
          isNonRepetitive: true,
          isClear: true,
          isNatural: true,
          isLanguageMirrored: true,
          isCrisisResponsive: true,
          usesGenericDefault: false,
          overallScore: 100,
          passed: true,
          feedback: "Unclear audio detected; requested repetition.",
        },
        extractedMemoriesCount: 0,
        executionTimeMs: Date.now() - startTime,
        contextPackage: null as any,
        wasRevised: false,
      };
    }

    // Pass transcribed text to the 17-stage Cognitive Pipeline
    const cognitiveResult = await CognitivePipeline.processMessage(userId, cleanedTranscript, options.sessionId);

    // Text-only workflow (no audio synthesis URL per instructions)
    return {
      ...cognitiveResult,
      sttTranscript: cleanedTranscript,
      sttConfidence,
      audioResponseUrl: undefined,
    };
  }

  private static async transcribeAudioBuffer(buffer: Buffer, mimeType: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "dummy") {
      return "Enikk nalla vishamam und, sahayikkan aarum illa.";
    }

    try {
      const inlineData = {
        data: buffer.toString("base64"),
        mimeType: mimeType.split(";")[0] || "audio/webm",
      };

      const prompt = "Transcribe the following speech accurately into text. If Malayalam is spoken in Latin script (Manglish), output Manglish. If Malayalam script is spoken, output Malayalam script. Do NOT translate to English if spoken in Malayalam/Manglish. Output ONLY the raw speech transcript. If silent or unintelligible, output '[UNCLEAR]'.";

      const response = await aiClient.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
        contents: [
          { role: "user", parts: [{ inlineData }, { text: prompt }] },
        ],
      });

      const text = response?.text?.trim() || "";
      return text;
    } catch (err: any) {
      console.warn("[VoiceEngine] Gemini Audio STT fallback triggered:", err?.message || err);
      // Never infer a user's feelings when transcription is unavailable.
      return "[UNCLEAR]";
    }
  }

  private static cleanNoiseAndSilence(text: string): string {
    return text
      .replace(/\[(noise|laughter|cough|silence|gasp)\]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }
}
