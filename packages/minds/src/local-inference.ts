/**
 * local-inference.ts — Template-based inference requiring no API.
 *
 * This is NOT intelligent AI generation. It is a lookup + template system:
 * 1. Parse the query for keywords
 * 2. Find matching knowledge passages in the provided sources
 * 3. Produce a structured response using a fill-in template
 *
 * The value: produces REAL responses with REAL citations from REAL knowledge bases,
 * with zero API cost and zero latency. A Claude/GPT provider produces dramatically
 * better responses, but LocalInference proves the Mind interface works offline
 * and makes the system fully testable without network access.
 */

import type { InferenceProvider, InferenceOptions, Source } from './types.js';

/**
 * Template-based inference provider.
 *
 * Instantiate with the Mind's sources so the provider can search them.
 * The Mind passes its sources at construction time when using LocalInference.
 */
export class LocalInference implements InferenceProvider {
  private readonly sources: Source[];
  private readonly mindName: string;

  constructor(mindName: string, sources: Source[]) {
    this.mindName = mindName;
    this.sources = sources;
  }

  /**
   * Generate a response by finding matching knowledge and filling a template.
   *
   * @param prompt - The user query
   * @param systemPrompt - Unused in local mode (no LLM to pass it to)
   * @param _options - Unused in local mode
   * @returns A templated response with real citations
   */
  async generate(
    prompt: string,
    _systemPrompt: string,
    _options?: InferenceOptions,
  ): Promise<string> {
    const keywords = extractKeywords(prompt);
    const matches = this.findMatchingSources(keywords);

    if (matches.length === 0) {
      return `${this.mindName} considered the question carefully but found no direct passage in the known works that addresses "${prompt}" explicitly. The question may touch on territory beyond the recorded texts.`;
    }

    const primary = matches[0]!;
    const excerpt = extractRelevantExcerpt(primary, keywords);

    let response = `${this.mindName} observed: "${excerpt}" — ${primary.title}`;

    if (primary.year) {
      response += ` (${primary.year})`;
    }

    if (matches.length > 1) {
      const secondary = matches[1]!;
      const secondExcerpt = extractRelevantExcerpt(secondary, keywords);
      response += `\n\nThis connects to another thought: "${secondExcerpt}" — ${secondary.title}`;
      if (secondary.year) {
        response += ` (${secondary.year})`;
      }
    }

    return response;
  }

  /**
   * Find sources from the knowledge base that match the given keywords.
   * Returns sources ranked by number of keyword matches.
   */
  findMatchingSources(keywords: string[]): Source[] {
    if (keywords.length === 0) return this.sources.slice(0, 1);

    const scored = this.sources.map((source) => {
      const text = `${source.title} ${source.content} ${source.type}`.toLowerCase();
      const score = keywords.filter((kw) => text.includes(kw.toLowerCase())).length;
      return { source, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((s) => s.source);
  }
}

/**
 * Extract meaningful keywords from a query string.
 * Filters out common stop words to focus on content-bearing terms.
 */
export function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'about', 'what', 'how', 'why', 'when', 'where', 'who', 'which',
    'and', 'or', 'but', 'if', 'in', 'on', 'at', 'to', 'for', 'of',
    'with', 'by', 'from', 'up', 'down', 'out', 'off', 'over', 'under',
    'think', 'thought', 'say', 'said', 'tell', 'told', 'know', 'knew',
    'your', 'my', 'his', 'her', 'its', 'our', 'their', 'this', 'that',
    'these', 'those', 'it', 'he', 'she', 'we', 'they', 'i', 'you',
    'me', 'him', 'us', 'them', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'between', 'each', 'more', 'most',
    'other', 'than', 'then', 'so', 'yet', 'both', 'either', 'neither',
  ]);

  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

/**
 * Extract a relevant excerpt from a source based on keyword proximity.
 * Returns the sentence(s) most likely to contain the matched keywords.
 */
function extractRelevantExcerpt(source: Source, keywords: string[]): string {
  const content = source.content;

  // Split into sentences
  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  if (sentences.length === 0) {
    // Fallback: return up to 200 chars of content
    return content.slice(0, 200).trim();
  }

  // Score sentences by keyword matches
  const scored = sentences.map((sentence) => {
    const lower = sentence.toLowerCase();
    const score = keywords.filter((kw) => lower.includes(kw)).length;
    return { sentence, score };
  });

  const best = scored.sort((a, b) => b.score - a.score)[0]!;

  // If no sentence matches keywords, return the first sentence
  if (best.score === 0) {
    return sentences[0]!.slice(0, 200);
  }

  return best.sentence.slice(0, 300);
}
