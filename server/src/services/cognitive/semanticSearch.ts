import { KNOWLEDGE_BASE } from "./knowledgeBase.ts";
import { KnowledgeItem } from "./types.ts";
import { NlpService } from "../nlpService.ts";

export async function searchKnowledgeBase(
  query: string,
  categoryFilter?: string,
  maxResults = 3
): Promise<KnowledgeItem[]> {
  const normalizedQuery = query.toLowerCase();

  // 1. First attempt NLP service semantic ranking
  try {
    const docs = KNOWLEDGE_BASE.map((item) => ({ id: item.id, content: `${item.title} ${item.content} ${item.tags.join(" ")}` }));
    const nlpRanking = await NlpService.semanticPreprocess(query, docs);
    if (nlpRanking && nlpRanking.ranked && nlpRanking.ranked.length > 0) {
      const topIds = nlpRanking.ranked.slice(0, maxResults).map((r) => r.id);
      const matched = KNOWLEDGE_BASE.filter((k) => topIds.includes(k.id));
      if (matched.length > 0) return matched;
    }
  } catch (err) {
    // Graceful fallback to local TF-IDF style keyword scoring
  }

  // 2. Keyword & TF-IDF style similarity scoring
  const queryTokens = normalizedQuery.split(/\s+/).filter((t) => t.length > 2);

  const scored = KNOWLEDGE_BASE.map((item) => {
    let score = 0;
    if (categoryFilter && item.category === categoryFilter) {
      score += 5;
    }

    const itemText = `${item.title} ${item.content} ${item.tags.join(" ")}`.toLowerCase();

    for (const token of queryTokens) {
      if (item.tags.some((t) => t.toLowerCase().includes(token))) {
        score += 4;
      }
      if (item.title.toLowerCase().includes(token)) {
        score += 3;
      }
      if (itemText.includes(token)) {
        score += 1;
      }
    }

    return { item, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((s) => s.item);
}
