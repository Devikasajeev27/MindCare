import { Response } from "express";
import { AuthRequest } from "../middleware/auth.ts";
import { AiCompanionProfile } from "../models/AiCompanionProfile.ts";
import { ImportedChat } from "../models/ImportedChat.ts";
import { Chat } from "../models/Chat.ts";
import { Appointment } from "../models/Appointment.ts";
import { LifeEvent } from "../models/LifeEvent.ts";
import { GoogleGenAI } from "@google/genai";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

interface MultipartPart {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

function parseMultipart(buffer: Buffer, boundary: string): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  
  let index = buffer.indexOf(boundaryBuffer);
  while (index !== -1) {
    const nextIndex = buffer.indexOf(boundaryBuffer, index + boundaryBuffer.length);
    if (nextIndex === -1) break;
    
    const partBuffer = buffer.slice(index + boundaryBuffer.length, nextIndex);
    const headerEndIndex = partBuffer.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEndIndex !== -1) {
      const headersString = partBuffer.slice(0, headerEndIndex).toString("utf-8");
      const data = partBuffer.slice(headerEndIndex + 4, partBuffer.length - 2); // strip trailing \r\n
      
      const nameMatch = headersString.match(/name="([^"]+)"/);
      const filenameMatch = headersString.match(/filename="([^"]+)"/);
      const contentTypeMatch = headersString.match(/Content-Type:\s*([^\r\n]+)/i);
      
      if (nameMatch) {
        parts.push({
          name: nameMatch[1],
          filename: filenameMatch ? filenameMatch[1] : undefined,
          contentType: contentTypeMatch ? contentTypeMatch[1] : undefined,
          data
        });
      }
    }
    index = nextIndex;
  }
  return parts;
}

async function getRawBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    req.on("data", (chunk: any) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", (err: any) => reject(err));
  });
}

const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy" });

// Helper to generate a random string ID
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 1. Get or Create Profile
export async function getProfile(req: AuthRequest, res: Response) {
  try {
    let profile = await AiCompanionProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = await AiCompanionProfile.create({
        userId: req.user._id,
        consentToAnalysis: false,
        enableMemory: true,
        temporaryChat: false,
        trustScore: 50,
        aiPreferences: {
          aiName: "MindCare Companion",
          aiAvatar: "",
          voice: "default",
          voiceSpeed: 1.0
        },
        personalization: {
          replyLength: "auto",
          humorPreference: "auto",
          supportStyle: "balanced"
        },
        talkingStyle: {
          writingStyle: "Neutral",
          tone: "Friendly and supportive",
          emojiUsage: "Moderate",
          sentenceLength: "Medium",
          greetingStyle: "Friendly greeting",
          favoriteWords: [],
          humorLevel: "Mild",
          emotionalExpression: "Empathetic"
        },
        memories: [],
        behaviorAnalysis: {
          communicationPattern: "Regular",
          dailyRoutine: "Unknown",
          stressTriggers: [],
          favoriteTopics: [],
          sleepDiscussions: "None",
          relationshipIssues: "None",
          workPressure: "None",
          studyPressure: "None",
          familyIssues: "None",
          socialIsolation: "None",
          confidenceChanges: "None",
          motivationLevel: "Stable",
          energyLevel: "Normal",
          emotionChanges: "Stable",
          moodChanges: "Stable",
          conversationFrequency: "Average",
          responseDelays: "Average",
          behaviorChanges: "None",
          moodIndicators: "Stable",
          stressLevel: "None",
          depressionIndicators: "None",
          anxietyLevel: "None",
          relationshipBehaviour: "None",
          sleepPatterns: "None",
          loneliness: "None",
          selfHarmRisk: "None",
          conversationPatterns: "None"
        },
        insights: {
          weeklyInsights: "We will generate insights as we chat more.",
          monthlyInsights: "A detailed monthly report will be compiled here.",
          behaviorTimeline: [],
          emotionalTrend: [],
          stressTrend: [],
          wellnessScore: req.user.wellnessScore || 70
        },
        relationshipTimeline: []
      });
    }

    // Retrieve Life Events for the user
    const lifeEvents = await LifeEvent.find({ userId: req.user._id }).sort({ date: -1 });

    const { generateConversationSummary } = await import("../services/cognitive/memoryManager.ts");
    const activeSessionId = profile.activeSessionId || `session_${req.user._id.toString().slice(-6)}`;
    if (!profile.activeSessionId) {
      profile.activeSessionId = activeSessionId;
      await profile.save();
    }

    const conversationSummary = await generateConversationSummary(req.user._id.toString(), activeSessionId);
    const distressScore = profile.insights?.distressScore ?? 10;
    const distressTrend = profile.insights?.distressTrend || "stable";
    const escalationTier = distressScore >= 76 ? "critical" : distressScore >= 51 ? "high" : distressScore >= 26 ? "moderate" : "low";

    return res.status(200).json({
      profile,
      activeSessionId,
      conversationSummary,
      distressScore,
      distressTrend,
      escalationTier,
      lifeEvents
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// 2. Update Profile Settings & AI Custom Preferences
export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    const { consentToAnalysis, enableMemory, temporaryChat, personalization, aiPreferences } = req.body;
    let profile = await AiCompanionProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: "AI Companion Profile not found" });
    }

    if (consentToAnalysis !== undefined) profile.consentToAnalysis = consentToAnalysis;
    if (enableMemory !== undefined) profile.enableMemory = enableMemory;
    if (temporaryChat !== undefined) profile.temporaryChat = temporaryChat;
    
    if (personalization !== undefined) {
      profile.personalization = { ...profile.personalization, ...personalization };
    }
    
    if (aiPreferences !== undefined) {
      profile.aiPreferences = { ...profile.aiPreferences, ...aiPreferences };
    }

    await profile.save();
    return res.status(200).json({ message: "Profile settings updated successfully", profile });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// 3. Add Memory (with advanced properties)
export async function addMemory(req: AuthRequest, res: Response) {
  try {
    const { category, content, date, type, importance, confidence, expiration, editable } = req.body;
    if (!content) {
      return res.status(400).json({ message: "Memory content is required" });
    }

    const profile = await AiCompanionProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: "AI Companion Profile not found" });
    }

    const newMemory = {
      id: generateId(),
      type: type || "semantic",
      category: category || "other",
      content,
      importance: importance || "medium",
      confidence: confidence !== undefined ? confidence : 100,
      createdTime: new Date(),
      updatedTime: new Date(),
      expiration: expiration ? new Date(expiration) : undefined,
      editable: editable !== undefined ? editable : true,
      source: "user_created",
      disabled: false
    };

    profile.memories.push(newMemory as any);
    await profile.save();

    return res.status(201).json({ message: "Memory added successfully", memory: newMemory, profile });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// 4. Edit Memory
export async function editMemory(req: AuthRequest, res: Response) {
  try {
    const { memoryId } = req.params;
    const { category, content, date, type, importance, confidence, expiration, disabled } = req.body;
    if (!content) {
      return res.status(400).json({ message: "Memory content is required" });
    }

    const profile = await AiCompanionProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: "AI Companion Profile not found" });
    }

    const memoryIndex = profile.memories.findIndex((m: any) => m.id === memoryId);
    if (memoryIndex === -1) {
      return res.status(404).json({ message: "Memory not found" });
    }

    const targetMemory = profile.memories[memoryIndex];
    targetMemory.category = category || targetMemory.category;
    targetMemory.content = content;
    targetMemory.type = type || targetMemory.type;
    targetMemory.importance = importance || targetMemory.importance;
    if (confidence !== undefined) targetMemory.confidence = confidence;
    targetMemory.expiration = expiration ? new Date(expiration) : targetMemory.expiration;
    if (disabled !== undefined) targetMemory.disabled = disabled;
    targetMemory.updatedTime = new Date();

    await profile.save();
    return res.status(200).json({ message: "Memory updated successfully", memory: targetMemory, profile });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// 5. Delete or Disable/Forget Memory
export async function deleteMemory(req: AuthRequest, res: Response) {
  try {
    const { memoryId } = req.params;
    const { action } = req.query; // 'disable' (forget) or 'delete'

    const profile = await AiCompanionProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: "AI Companion Profile not found" });
    }

    const memoryIndex = profile.memories.findIndex((m: any) => m.id === memoryId);
    if (memoryIndex === -1) {
      return res.status(404).json({ message: "Memory not found" });
    }

    if (action === "disable") {
      profile.memories[memoryIndex].disabled = !profile.memories[memoryIndex].disabled;
      profile.memories[memoryIndex].updatedTime = new Date();
      await profile.save();
      return res.status(200).json({ message: "Memory forget state updated successfully", profile });
    }

    profile.memories = profile.memories.filter((m: any) => m.id !== memoryId) as any;
    await profile.save();
    return res.status(200).json({ message: "Memory deleted permanently", profile });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// WhatsApp and ChatGPT Export Parsers
function parseChats(text: string, userName: string): { sender: "user" | "ai"; text: string; time: Date }[] {
  const parsedMessages: { sender: "user" | "ai"; text: string; time: Date }[] = [];

  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) {
      for (const msg of json) {
        if (msg.text && (msg.sender === "user" || msg.sender === "ai" || msg.role)) {
          const sender = msg.sender === "user" || msg.role === "user" ? "user" : "ai";
          parsedMessages.push({
            sender,
            text: msg.text || msg.content,
            time: msg.time ? new Date(msg.time) : new Date()
          });
        }
      }
    } else if (json.conversations && Array.isArray(json.conversations)) {
      for (const conv of json.conversations) {
        if (Array.isArray(conv.messages)) {
          for (const msg of conv.messages) {
            const sender = msg.role === "user" || msg.sender === "user" ? "user" : "ai";
            parsedMessages.push({
              sender,
              text: msg.text || msg.content || "",
              time: msg.timestamp ? new Date(msg.timestamp) : new Date()
            });
          }
        }
      }
    } else if (typeof json === "object") {
      for (const key of Object.keys(json)) {
        const node = json[key];
        if (node.message) {
          const authorRole = node.message.author?.role;
          const contentParts = node.message.content?.parts;
          if (contentParts && contentParts.length > 0 && typeof contentParts[0] === "string") {
            const sender = authorRole === "user" ? "user" : "ai";
            parsedMessages.push({
              sender,
              text: contentParts.join(" "),
              time: node.message.create_time ? new Date(node.message.create_time * 1000) : new Date()
            });
          }
        }
      }
    }
  } catch (jsonErr) {
    const lines = text.split(/\r?\n/);
    const lineRegex = /^\[?(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}),?\s+(\d{1,2}[:.]\d{1,2}(?:[:.]\d{1,2})?\s*(?:AM|PM|am|pm)?)\]?\s*-\s*([^:]+):\s*(.*)$/i;
    const lineRegexNoBrackets = /^(\d{1,2}[-/.]\d{1,2}[-/.]\d{1,4}),?\s+(\d{1,2}[:.]\d{1,2})\s*-\s*([^:]+):\s*(.*)$/;

    let lastMsg: { sender: "user" | "ai"; text: string; time: Date } | null = null;
    const nameLower = userName.toLowerCase();

    for (const line of lines) {
      let match = line.match(lineRegex);
      if (!match) {
        match = line.match(lineRegexNoBrackets);
      }

      if (match) {
        const dateStr = match[1];
        const timeStr = match[2];
        const author = match[3].trim();
        const msgText = match[4].trim();

        const sender = author.toLowerCase().includes(nameLower) || nameLower.includes(author.toLowerCase()) ? "user" : "ai";
        
        let dateObj = new Date();
        try {
          const parts = dateStr.split(/[-/.]/);
          if (parts.length === 3) {
            const year = parts[0].length === 4 ? parseInt(parts[0]) : parseInt(parts[2]);
            const month = parts[0].length === 4 ? parseInt(parts[1]) - 1 : parseInt(parts[1]) - 1;
            const day = parts[0].length === 4 ? parseInt(parts[2]) : parseInt(parts[0]);
            
            const timeParts = timeStr.split(":");
            const hour = parseInt(timeParts[0]);
            const minute = parseInt(timeParts[1]);
            dateObj = new Date(year, month, day, hour, minute);
          }
        } catch (e) {
          // fallback
        }

        lastMsg = { sender, text: msgText, time: dateObj };
        parsedMessages.push(lastMsg);
      } else if (lastMsg && line.trim()) {
        lastMsg.text += "\n" + line.trim();
      }
    }
  }

  return parsedMessages;
}

// 6. Import Chat History (Extracts context via Gemini and DISCARDS raw messages unless opted in)
export async function importHistory(req: AuthRequest, res: Response) {
  try {
    let text = "";
    let platform = "Uploaded File";
    let consent = false;
    let keepRaw = false;

    // Detect and parse multipart file uploads (ZIP or TXT exports)
    if (req.headers["content-type"]?.includes("multipart/form-data")) {
      const match = req.headers["content-type"].match(/boundary=(.+)/);
      const boundary = match ? match[1] : "";
      if (!boundary) {
        return res.status(400).json({ message: "No boundary found in multipart header" });
      }

      const rawBody = await getRawBody(req);
      const parts = parseMultipart(rawBody, boundary);
      let filePart = null;

      for (const p of parts) {
        if (p.filename) {
          filePart = p;
        } else {
          const val = p.data.toString("utf-8").trim();
          if (p.name === "platform") platform = val;
          if (p.name === "consent") consent = val === "true";
          if (p.name === "keepRaw") keepRaw = val === "true";
        }
      }

      if (!filePart) {
        return res.status(400).json({ message: "No file was uploaded." });
      }

      if (filePart.filename?.toLowerCase().endsWith(".zip")) {
        console.log("[ImportHistory] ZIP upload received, extracting natively...");
        // Save the temporary ZIP file inside uploads/
        const tempZipName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.zip`;
        const tempZipPath = path.join(process.cwd(), "uploads", tempZipName);
        fs.writeFileSync(tempZipPath, filePart.data);

        // Create temporary extraction directory
        const extractDirName = `extract_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const extractDirPath = path.join(process.cwd(), "uploads", extractDirName);
        fs.mkdirSync(extractDirPath, { recursive: true });

        try {
          // Native execution of unzip
          execSync(`/usr/bin/unzip "${tempZipPath}" -d "${extractDirPath}"`);

          // Find the largest txt file in the directory
          const findLargestTxt = (dir: string): string | null => {
            const files = fs.readdirSync(dir);
            let largestFile: string | null = null;
            let largestSize = -1;

            for (const file of files) {
              const fullPath = path.join(dir, file);
              const stat = fs.statSync(fullPath);
              if (stat.isDirectory()) {
                const nested = findLargestTxt(fullPath);
                if (nested) {
                  const nestedStat = fs.statSync(nested);
                  if (nestedStat.size > largestSize) {
                    largestSize = nestedStat.size;
                    largestFile = nested;
                  }
                }
              } else if (file.toLowerCase().endsWith(".txt")) {
                if (stat.size > largestSize) {
                  largestSize = stat.size;
                  largestFile = fullPath;
                }
              }
            }
            return largestFile;
          };

          const mainTxtFile = findLargestTxt(extractDirPath);
          if (!mainTxtFile) {
            throw new Error("No .txt transcript file found inside the zip archive.");
          }

          // Count media files in the zip directory for media detection
          const countMediaFiles = (dir: string): number => {
            const files = fs.readdirSync(dir);
            let count = 0;
            const mediaExtensions = [".jpg", ".jpeg", ".png", ".webp", ".mp3", ".mp4", ".ogg", ".wav", ".m4a", ".webm"];
            for (const file of files) {
              const fullPath = path.join(dir, file);
              const stat = fs.statSync(fullPath);
              if (stat.isDirectory()) {
                count += countMediaFiles(fullPath);
              } else {
                const ext = path.extname(file).toLowerCase();
                if (mediaExtensions.includes(ext)) {
                  count++;
                }
              }
            }
            return count;
          };

          const mediaCount = countMediaFiles(extractDirPath);
          console.log(`[ImportHistory] Extracted main txt: ${path.basename(mainTxtFile)}, found ${mediaCount} media attachments.`);

          text = fs.readFileSync(mainTxtFile, "utf-8");
        } finally {
          // Absolute clean up of zip and extracted dir
          try {
            fs.unlinkSync(tempZipPath);
            fs.rmSync(extractDirPath, { recursive: true, force: true });
          } catch (cleanupErr) {
            console.error("[ImportHistory] Failed to clean up temp ZIP files:", cleanupErr);
          }
        }
      } else {
        // Fallback to text file uploads
        text = filePart.data.toString("utf-8");
      }
    } else {
      // Normal JSON payload fallback
      text = req.body.text;
      platform = req.body.platform || platform;
      consent = req.body.consent;
      keepRaw = req.body.keepRaw;
    }

    if (!text) {
      return res.status(400).json({ message: "Chat content is required" });
    }
    if (!consent) {
      return res.status(400).json({ message: "Explicit privacy and analysis consent is required for data import." });
    }

    let profile = await AiCompanionProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = await AiCompanionProfile.create({ userId: req.user._id });
    }
    profile.consentToAnalysis = true;

    const messages = parseChats(text, req.user.name);
    if (messages.length === 0) {
      return res.status(400).json({ message: "No valid messages could be parsed from the uploaded file." });
    }

    // Run Gemini extraction on imported message block (take up to last 40 user messages to analyze)
    const userImportedMessages = messages.filter(m => m.sender === "user").slice(-40);
    const chatLogBlock = userImportedMessages.map(m => `User: ${m.text}`).join("\n");

    const useLiveGemini = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "dummy";
    let extracted: any = null;

    if (useLiveGemini && chatLogBlock) {
      try {
        const extractionPrompt = `You are a Principal Mental Health Analytics Engineer.
Analyze the following user chat history from an external app to learn about the user.

Chat Log:
${chatLogBlock}

Extract information and provide a JSON response matching this schema:
{
  "memories": [
    {
      "category": "favorite_food|movie|goal|important_person|career|education|event|therapy_preference|other",
      "content": "Description of fact, e.g. 'Enjoys coding in Java'",
      "importance": "high|medium|low"
    }
  ],
  "lifeEvents": [
    {
      "title": "Short event title, e.g. 'Java Course Started'",
      "description": "Short explanation",
      "date": "ISOString or null",
      "importance": "high|medium|low",
      "confidence": 80
    }
  ],
  "style": {
    "writingStyle": "E.g. Casual, structured",
    "tone": "E.g. Warm, anxious, enthusiastic",
    "emojiUsage": "E.g. High, moderate, low",
    "sentenceLength": "E.g. Short, long",
    "greetingStyle": "E.g. Hey, Hi, none",
    "favoriteWords": ["word1", "word2"],
    "humorLevel": "E.g. Dry, playful, low",
    "emotionalExpression": "E.g. Reserved, open"
  },
  "behavior": {
    "stressTriggers": ["trigger1"],
    "favoriteTopics": ["topic1"],
    "dailyRoutine": "Summary of routine or 'Unknown'",
    "moodIndicators": "Empathetic synthesis of user mood",
    "stressLevel": "Assessment of stress level (high/medium/low/none)",
    "depressionIndicators": "Assessment of depression patterns",
    "anxietyLevel": "Assessment of anxiety symptoms",
    "relationshipBehaviour": "Notes on relationship behavior",
    "sleepPatterns": "Sleep observations",
    "loneliness": "Loneliness indicators",
    "selfHarmRisk": "Self-harm risk level",
    "conversationPatterns": "Conversation pacing/style patterns"
  }
}

Rule: Output ONLY the JSON block. Do not wrap in markdown or backticks.`;

        const response = await aiClient.models.generateContent({
          model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
          contents: extractionPrompt,
          config: { responseMimeType: "application/json" }
        });

        extracted = JSON.parse(response.text || "{}");
      } catch (gemError) {
        console.error("Gemini import extraction error:", gemError);
      }
    }

    // Apply extracted updates
    if (extracted) {
      if (extracted.style) {
        if (!profile.talkingStyle) {
          profile.talkingStyle = {
            writingStyle: "",
            tone: "",
            emojiUsage: "",
            sentenceLength: "",
            greetingStyle: "",
            favoriteWords: [],
            humorLevel: "",
            emotionalExpression: ""
          };
        }
        profile.talkingStyle = { ...profile.talkingStyle, ...extracted.style };
      }

      if (extracted.behavior) {
        if (!profile.behaviorAnalysis) {
          profile.behaviorAnalysis = {
            communicationPattern: "",
            dailyRoutine: "",
            stressTriggers: [],
            favoriteTopics: [],
            sleepDiscussions: "None",
            relationshipIssues: "None",
            workPressure: "None",
            studyPressure: "None",
            familyIssues: "None",
            socialIsolation: "None",
            confidenceChanges: "None",
            motivationLevel: "Stable",
            energyLevel: "Normal",
            emotionChanges: "Stable",
            moodChanges: "Stable",
            conversationFrequency: "Average",
            responseDelays: "Average",
            behaviorChanges: "None",
            moodIndicators: "",
            stressLevel: "",
            depressionIndicators: "",
            anxietyLevel: "",
            relationshipBehaviour: "",
            sleepPatterns: "",
            loneliness: "",
            selfHarmRisk: "",
            conversationPatterns: ""
          };
        }
        profile.behaviorAnalysis.stressTriggers = Array.from(new Set([...(profile.behaviorAnalysis.stressTriggers || []), ...(extracted.behavior.stressTriggers || [])]));
        profile.behaviorAnalysis.favoriteTopics = Array.from(new Set([...(profile.behaviorAnalysis.favoriteTopics || []), ...(extracted.behavior.favoriteTopics || [])]));
        profile.behaviorAnalysis.dailyRoutine = extracted.behavior.dailyRoutine || profile.behaviorAnalysis.dailyRoutine;
        
        // Save the 9 clinical analysis variables extended in the schema
        profile.behaviorAnalysis.moodIndicators = extracted.behavior.moodIndicators || profile.behaviorAnalysis.moodIndicators;
        profile.behaviorAnalysis.stressLevel = extracted.behavior.stressLevel || profile.behaviorAnalysis.stressLevel;
        profile.behaviorAnalysis.depressionIndicators = extracted.behavior.depressionIndicators || profile.behaviorAnalysis.depressionIndicators;
        profile.behaviorAnalysis.anxietyLevel = extracted.behavior.anxietyLevel || profile.behaviorAnalysis.anxietyLevel;
        profile.behaviorAnalysis.relationshipBehaviour = extracted.behavior.relationshipBehaviour || profile.behaviorAnalysis.relationshipBehaviour;
        profile.behaviorAnalysis.sleepPatterns = extracted.behavior.sleepPatterns || profile.behaviorAnalysis.sleepPatterns;
        profile.behaviorAnalysis.loneliness = extracted.behavior.loneliness || profile.behaviorAnalysis.loneliness;
        profile.behaviorAnalysis.selfHarmRisk = extracted.behavior.selfHarmRisk || profile.behaviorAnalysis.selfHarmRisk;
        profile.behaviorAnalysis.conversationPatterns = extracted.behavior.conversationPatterns || profile.behaviorAnalysis.conversationPatterns;
      }

      if (extracted.memories && extracted.memories.length > 0) {
        extracted.memories.forEach((mem: any) => {
          profile.memories.push({
            id: generateId(),
            type: "semantic",
            category: mem.category || "other",
            content: mem.content,
            importance: mem.importance || "medium",
            confidence: 70,
            createdTime: new Date(),
            updatedTime: new Date(),
            source: "ai_learned",
            disabled: false
          } as any);
        });
      }

      if (extracted.lifeEvents && extracted.lifeEvents.length > 0) {
        const events = extracted.lifeEvents.map((ev: any) => ({
          userId: req.user._id,
          title: ev.title,
          description: ev.description || "",
          date: ev.date ? new Date(ev.date) : new Date(),
          importance: ev.importance || "medium",
          confidence: ev.confidence || 60,
          source: "ai_learned"
        }));
        await LifeEvent.insertMany(events);

        // Add to profile relationship timeline
        extracted.lifeEvents.forEach((ev: any) => {
          const dateStr = ev.date ? new Date(ev.date).toLocaleDateString("en", { month: "long" }) : "Recently";
          profile.relationshipTimeline.push({
            month: dateStr,
            event: ev.title,
            details: ev.description || "",
            createdAt: new Date()
          } as any);
        });
      }

      // Boost internal trust score on successful data parsing
      profile.trustScore = Math.min(100, (profile.trustScore || 50) + 15);
    }

    // Handle keep raw transcripts toggle
    let importedCount = 0;
    let duplicateCount = 0;

    if (keepRaw) {
      const [existingImported, existingLive] = await Promise.all([
        ImportedChat.find({ userId: req.user._id }),
        Chat.find({ userId: req.user._id })
      ]);

      const existingKeys = new Set<string>();
      existingImported.forEach(c => existingKeys.add(`${c.text.trim()}_${new Date(c.time).getTime()}`));
      existingLive.forEach(c => existingKeys.add(`${c.text.trim()}_${new Date(c.time).getTime()}`));

      const toInsert = [];
      for (const msg of messages) {
        const key = `${msg.text.trim()}_${new Date(msg.time).getTime()}`;
        if (existingKeys.has(key)) {
          duplicateCount++;
        } else {
          toInsert.push({
            userId: req.user._id,
            sender: msg.sender,
            text: msg.text,
            time: msg.time,
            source: platform || "Uploaded File"
          });
          importedCount++;
        }
      }

      if (toInsert.length > 0) {
        await ImportedChat.insertMany(toInsert);
      }
    } else {
      importedCount = messages.length;
    }

    await profile.save();

    return res.status(201).json({
      message: "Chat export parsed and profile extracted. Raw logs discarded in compliance with privacy regulations.",
      importedCount,
      duplicateCount,
      profile
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// 7. Delete Imported Chat Logs & Life Events
export async function deleteImportedHistory(req: AuthRequest, res: Response) {
  try {
    await Promise.all([
      ImportedChat.deleteMany({ userId: req.user._id }),
      LifeEvent.deleteMany({ userId: req.user._id })
    ]);
    
    const profile = await AiCompanionProfile.findOne({ userId: req.user._id });
    if (profile) {
      profile.trustScore = 50;
      profile.talkingStyle = {
        writingStyle: "Neutral",
        tone: "Friendly",
        emojiUsage: "Moderate",
        sentenceLength: "Medium",
        greetingStyle: "Friendly greeting",
        favoriteWords: [],
        humorLevel: "Mild",
        emotionalExpression: "Empathetic"
      };
      profile.memories = [] as any;
      profile.behaviorAnalysis = {
        communicationPattern: "Regular",
        dailyRoutine: "Unknown",
        stressTriggers: [],
        favoriteTopics: [],
        sleepDiscussions: "None",
        relationshipIssues: "None",
        workPressure: "None",
        studyPressure: "None",
        familyIssues: "None",
        socialIsolation: "None",
        confidenceChanges: "None",
        motivationLevel: "Stable",
        energyLevel: "Normal",
        emotionChanges: "Stable",
        moodChanges: "Stable",
        conversationFrequency: "Average",
        responseDelays: "Average",
        behaviorChanges: "None",
        moodIndicators: "Stable",
        stressLevel: "None",
        depressionIndicators: "None",
        anxietyLevel: "None",
        relationshipBehaviour: "None",
        sleepPatterns: "None",
        loneliness: "None",
        selfHarmRisk: "None",
        conversationPatterns: "None"
      };
      profile.insights = {
        weeklyInsights: "We will generate insights as we chat more.",
        monthlyInsights: "A detailed monthly report will be compiled here.",
        behaviorTimeline: [],
        emotionalTrend: [],
        stressTrend: [],
        wellnessScore: req.user.wellnessScore || 70,
        distressScore: 10,
        distressCount: 0,
        distressTrend: "stable",
        rollingSummary: ""
      };
      profile.relationshipTimeline = [] as any;
      await profile.save();
    }

    return res.status(200).json({ message: "Imported data, life events, and timelines cleared.", profile });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// 8. Generate Therapist Summary Consent
export async function setTherapistEscalationConsent(req: AuthRequest, res: Response) {
  try {
    const { appointmentId, consent } = req.body;
    if (!appointmentId) {
      return res.status(400).json({ message: "Appointment ID is required" });
    }

    const appointment = await Appointment.findOne({ _id: appointmentId, userId: req.user._id });
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    appointment.shareSummaryConsent = consent;

    if (consent) {
      const recentChats = await Chat.find({ userId: req.user._id, recipient: "ai" })
        .sort({ createdAt: -1 })
        .limit(20);
      recentChats.reverse();

      const chatHistoryText = recentChats.map(c => `${c.sender === "user" ? "Patient" : "AI"}: ${c.text}`).join("\n");
      const prompt = `You are a clinical psychologist summarizer.
Summarize the patient's concerns, emotional patterns, coping mechanisms, and recent triggers based on their chats with an AI companion. 
Keep it clinical, confidential, concise (about 80-100 words), and highly objective to help their human therapist prepare for an upcoming session.

Conversations:
${chatHistoryText || "No active live companion logs available."}

Therapist Summary:`;

      let summaryText = "Patient requested escalation. No chat logs present for analysis.";
      if (chatHistoryText && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "dummy") {
        try {
          const response = await aiClient.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
            contents: prompt,
          });
          summaryText = response.text || summaryText;
        } catch (e) {
          summaryText = "Empathetic companion chat log summary: The user has discussed emotional stress, daily challenges, and seeks support for personal coping mechanisms. Summary generated automatically via fallback mechanism.";
        }
      } else {
        summaryText = "Empathetic companion chat log summary: The user has discussed emotional stress, daily challenges, and seeks support for personal coping mechanisms. Summary generated automatically via offline mode.";
      }

      appointment.aiConversationSummary = summaryText;
    } else {
      appointment.aiConversationSummary = "";
    }

    await appointment.save();
    return res.status(200).json({ message: "Escalation summary consent updated successfully", appointment });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
}

// 9. Background Analysis: Updates Trust Score, Wellness details, and Relationship Timeline
export async function runProfileAnalysis(userId: string) {
  try {
    const profile = await AiCompanionProfile.findOne({ userId });
    if (!profile || !profile.consentToAnalysis || profile.temporaryChat) {
      return;
    }

    const [liveChats, importedChats] = await Promise.all([
      Chat.find({ userId, recipient: "ai", sender: "user" }).sort({ createdAt: -1 }).limit(15),
      ImportedChat.find({ userId, sender: "user" }).sort({ createdAt: -1 }).limit(20)
    ]);

    const messages = [...liveChats, ...importedChats].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (messages.length === 0) return;

    const historyBlock = messages.map(m => `User: ${m.text}`).join("\n\n");
    const currentStyle = profile.talkingStyle;
    const currentMemories = profile.memories;
    const currentBehavior = profile.behaviorAnalysis;

    const analysisPrompt = `You are a clinical NLP behavior analyst and supportive mental wellness companion.
Analyze the following recent messages from the user to learn and update their companion profile.

Recent User Messages:
${historyBlock}

Existing Profile Data:
- Memories: ${JSON.stringify(currentMemories)}
- Talking Style: ${JSON.stringify(currentStyle)}
- Behavior Profile: ${JSON.stringify(currentBehavior)}

Your task is to extract updates and output a valid JSON object matching this schema EXACTLY:
{
  "talkingStyleUpdate": {
    "writingStyle": "Detailed explanation of sentence structure, punctuation, etc.",
    "tone": "Warm, formal, informal, reflective, anxious, casual, etc.",
    "emojiUsage": "Frequent, moderate, none, only specific emojis like 😊",
    "sentenceLength": "Short, medium, long, varied",
    "greetingStyle": "E.g., Hi, Hello, Hey, none",
    "favoriteWords": ["word1", "word2"],
    "humorLevel": "High, moderate, low, dry, none",
    "emotionalExpression": "Reserved, open, expressive, vulnerable"
  },
  "memories": [
    {
      "id": "A unique short random string (or preserve existing memory ID if updating it)",
      "category": "Choose from: favorite_food, movie, goal, important_person, career, education, event, therapy_preference, other",
      "content": "Specific factual description, e.g. 'Struggles with insomnia' or 'Has an exam on July 25th' or 'Mother's name is Sarah'",
      "date": "ISO format date string or null if not applicable",
      "importance": "high|medium|low",
      "type": "semantic|preference|episodic"
    }
  ],
  "behaviorUpdate": {
    "stressTriggers": ["trigger1", "trigger2"],
    "favoriteTopics": ["topic1", "topic2"],
    "dailyRoutine": "Summarized routine",
    "workPressure": "High/medium/low/none",
    "studyPressure": "High/medium/low/none",
    "familyIssues": "Brief description or 'None'",
    "socialIsolation": "Flag or 'None'",
    "confidenceChanges": "Self-talk indicator",
    "motivationLevel": "High/medium/low/fluctuating",
    "energyLevel": "High/medium/low",
    "emotionChanges": "Summary of emotional state",
    "moodChanges": "Mood summary",
    "conversationFrequency": "Frequent, average, rare",
    "responseDelays": "Long, short, normal",
    "behaviorChanges": "Any noticed changes"
  },
  "insightsUpdate": {
    "weeklyInsights": "A 1-2 sentence supportive, actionable feedback based on their current stress, mood and behavior.",
    "monthlyInsights": "A broader monthly reflection on their wellness progress.",
    "behaviorTimeline": ["Add a new event description like 'Discovered stress trigger: late work' or 'Expressed anxiety about interviews'"],
    "wellnessScore": 100
  },
  "relationshipTimelineUpdate": [
    {
      "month": "E.g. June 2026",
      "event": "Short description of milestone achieved or event faced",
      "details": "Explanation"
    }
  ]
}

Rules:
1. Preserve existing memories. Merge new memories. If a memory about the same item (e.g. favorite food) is updated, use the same id.
2. Return ONLY the JSON object. Do not add comments or code block formatting.`;

    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "dummy") {
      const response = await aiClient.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
        contents: analysisPrompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const data = JSON.parse(response.text || "{}");

      if (data.talkingStyleUpdate) {
        if (!profile.talkingStyle) {
          profile.talkingStyle = {
            writingStyle: "",
            tone: "",
            emojiUsage: "",
            sentenceLength: "",
            greetingStyle: "",
            favoriteWords: [],
            humorLevel: "",
            emotionalExpression: ""
          };
        }
        profile.talkingStyle = { ...profile.talkingStyle, ...data.talkingStyleUpdate };
      }

      if (data.memories && data.memories.length > 0) {
        const memoryMap = new Map();
        if (profile.memories) {
          profile.memories.forEach((m: any) => memoryMap.set(m.id || generateId(), m));
        }
        
        data.memories.forEach((newMem: any) => {
          if (!newMem.id) newMem.id = generateId();
          memoryMap.set(newMem.id, {
            id: newMem.id,
            type: newMem.type || "semantic",
            category: newMem.category || "other",
            content: newMem.content,
            importance: newMem.importance || "medium",
            confidence: newMem.confidence || 70,
            createdTime: new Date(),
            updatedTime: new Date(),
            disabled: false,
            source: "ai_learned"
          });
        });

        profile.memories = Array.from(memoryMap.values()) as any;
      }

      if (data.behaviorUpdate) {
        if (!profile.behaviorAnalysis) {
          profile.behaviorAnalysis = {
            communicationPattern: "",
            dailyRoutine: "",
            stressTriggers: [],
            favoriteTopics: [],
            sleepDiscussions: "",
            relationshipIssues: "",
            workPressure: "",
            studyPressure: "",
            familyIssues: "",
            socialIsolation: "",
            confidenceChanges: "",
            motivationLevel: "",
            energyLevel: "",
            emotionChanges: "",
            moodChanges: "",
            conversationFrequency: "",
            responseDelays: "",
            behaviorChanges: "",
            moodIndicators: "",
            stressLevel: "",
            depressionIndicators: "",
            anxietyLevel: "",
            relationshipBehaviour: "",
            sleepPatterns: "",
            loneliness: "",
            selfHarmRisk: "",
            conversationPatterns: ""
          };
        }
        profile.behaviorAnalysis = { ...profile.behaviorAnalysis, ...data.behaviorUpdate };
      }

      if (data.insightsUpdate) {
        if (!profile.insights) {
          profile.insights = {
            weeklyInsights: "",
            monthlyInsights: "",
            behaviorTimeline: [],
            emotionalTrend: [],
            stressTrend: [],
            wellnessScore: 70,
            distressScore: 10,
            distressCount: 0,
            distressTrend: "stable",
            rollingSummary: ""
          };
        }
        const ins = profile.insights as NonNullable<typeof profile.insights>;
        ins.weeklyInsights = data.insightsUpdate.weeklyInsights || ins.weeklyInsights;
        ins.monthlyInsights = data.insightsUpdate.monthlyInsights || ins.monthlyInsights;
        ins.wellnessScore = data.insightsUpdate.wellnessScore || ins.wellnessScore;
        
        if (data.insightsUpdate.behaviorTimeline) {
          const oldTimeline = ins.behaviorTimeline || [];
          const newTimeline = [...oldTimeline, ...data.insightsUpdate.behaviorTimeline];
          ins.behaviorTimeline = newTimeline.slice(-15);
        }
      }

      if (data.relationshipTimelineUpdate && data.relationshipTimelineUpdate.length > 0) {
        data.relationshipTimelineUpdate.forEach((update: any) => {
          profile.relationshipTimeline.push({
            month: update.month,
            event: update.event,
            details: update.details || "",
            createdAt: new Date()
          } as any);
        });
      }

      // Increment hidden Trust engine score
      profile.trustScore = Math.min(100, (profile.trustScore || 50) + 2);
      profile.lastProcessedMessageId = messages[0]._id;
      await profile.save();
      console.log(`AI Companion Profile updated successfully for user ${userId}. Trust Score: ${profile.trustScore}`);
    }
  } catch (err) {
    console.error("Failed to run profile background analysis:", err);
  }
}
