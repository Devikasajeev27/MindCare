import { GoogleGenAI } from "@google/genai";

const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy" });

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "arent", "as", "at", 
  "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "cant", "cannot", "could", 
  "did", "do", "does", "doing", "dont", "down", "during", "each", "few", "for", "from", "further", "had", "has", 
  "have", "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", 
  "into", "is", "it", "its", "itself", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off", 
  "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "she", 
  "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then", "there", 
  "these", "they", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "we", "were", 
  "what", "when", "where", "which", "while", "who", "whom", "why", "with", "would", "you", "your", "yours", "yourself"
]);

function offlineKeywordMatch(userMessage: string, memories: any[]): any[] {
  const words = userMessage
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter(w => w && !STOP_WORDS.has(w));

  if (words.length === 0) {
    return memories
      .filter(m => !m.disabled)
      .sort((a, b) => {
        const val: Record<string, number> = { high: 3, medium: 2, low: 1 };
        return (val[b.importance] || 2) - (val[a.importance] || 2);
      })
      .slice(0, 5);
  }

  const scoredMemories = memories
    .filter(m => !m.disabled)
    .map(memory => {
      const contentLower = memory.content.toLowerCase();
      let matchScore = 0;
      for (const word of words) {
        if (contentLower.includes(word)) {
          matchScore += 1;
        }
      }
      const importanceVal: Record<string, number> = { high: 1.5, medium: 1.0, low: 0.5 };
      const weight = importanceVal[memory.importance] || 1.0;
      return { memory, score: matchScore * weight };
    });

  return scoredMemories
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.memory)
    .slice(0, 5);
}

export async function retrieveRelevantMemories(userMessage: string, memories: any[]): Promise<any[]> {
  const activeMemories = memories.filter(m => !m.disabled);
  if (activeMemories.length === 0) return [];

  const useLiveGemini = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "dummy";

  if (!useLiveGemini) {
    return offlineKeywordMatch(userMessage, activeMemories);
  }

  try {
    const listForPrompt = activeMemories.map((m, idx) => ({
      index: idx,
      id: m.id,
      category: m.category,
      content: m.content
    }));

    const prompt = `You are a semantic memory retrieval system.
Given the User Message and a list of memories, select the top 5 most relevant memories that are highly contextual or directly related to the user message. 
If no memories are relevant, return an empty array.

User Message: "${userMessage}"
Memories List:
${JSON.stringify(listForPrompt)}

Return ONLY a JSON array of the indexes of the selected memories, e.g. [0, 2, 4]. Do not return markdown block wrappers, explanations, or other texts.`;

    const response = await aiClient.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const parsedIndexes = JSON.parse(response.text || "[]");
    if (Array.isArray(parsedIndexes)) {
      const selected = parsedIndexes
        .map((idx: number) => activeMemories[idx])
        .filter(Boolean);
      
      if (selected.length < 3) {
        const fallbacks = offlineKeywordMatch(userMessage, activeMemories);
        const selectedIds = new Set(selected.map(s => s.id));
        for (const fb of fallbacks) {
          if (!selectedIds.has(fb.id) && selected.length < 5) {
            selected.push(fb);
          }
        }
      }
      return selected.slice(0, 5);
    }
  } catch (error) {
    console.error("Semantic memory selection error, falling back to keyword match:", error);
  }

  return offlineKeywordMatch(userMessage, activeMemories);
}

/**
 * Automatically extracts new personal facts, goals, life events, or preferences
 * from the user's message and persists them to profile.memories in MongoDB.
 */
export async function extractAndStoreNewMemories(userMessage: string, profile: any): Promise<boolean> {
  if (!profile || !profile.enableMemory) return false;
  if (!userMessage || userMessage.trim().length < 12) return false;

  const useLiveGemini = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "dummy";
  if (!useLiveGemini) return false;

  try {
    const prompt = `Analyze this user message for significant personal facts, life events, goals, relationships, or preferences that are worth remembering long-term.
Message: "${userMessage}"

If there is a clear personal fact worth remembering (e.g., "I started learning piano", "My mother lives in Kochi", "I have an MCA exam next week"), return a JSON object with:
{
  "hasMemory": true,
  "category": "career" | "education" | "goal" | "important_person" | "event" | "other",
  "content": "Short concise fact in 3-8 words",
  "importance": "high" | "medium" | "low"
}

If the message is generic (e.g., "Hi", "How are you", "I feel sad today"), return:
{ "hasMemory": false }

Return ONLY the valid JSON object.`;

    const response = await aiClient.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const result = JSON.parse(response.text || "{}");
    if (result && result.hasMemory && result.content) {
      const existing = (profile.memories || []).map((m: any) => m.content.toLowerCase());
      if (!existing.includes(result.content.toLowerCase())) {
        const newMemory = {
          id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: "semantic",
          category: result.category || "other",
          content: result.content,
          importance: result.importance || "medium",
          confidence: 85,
          createdTime: new Date(),
          updatedTime: new Date(),
          source: "ai_learned",
          editable: true,
          disabled: false
        };

        if (!profile.memories) profile.memories = [];
        profile.memories.push(newMemory);
        await profile.save();
        console.log(`[MEMORY ENGINE] Extracted & saved memory to MongoDB: "${result.content}" (${result.category})`);
        return true;
      }
    }
  } catch (error) {
    console.error("[MEMORY ENGINE] Memory extraction failed:", error);
  }
  return false;
}
