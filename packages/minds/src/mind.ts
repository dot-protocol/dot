/**
 * mind.ts — The Mind class.
 *
 * A Mind is an AI entity with:
 * - Identity: an Ed25519 keypair (unique, cryptographic)
 * - Knowledge: primary source documents (real works, real quotes)
 * - Inference: a provider-agnostic backend (local template or live API)
 *
 * Minds are provider-agnostic. The same Mind object works identically
 * whether the InferenceProvider is LocalInference, Claude, GPT, or Llama.
 */

import { createIdentity, type Identity } from '@dot-protocol/core';
import type {
  MindConfig,
  MindResponse,
  MindState,
  InferenceProvider,
  Citation,
  Source,
} from './types.js';
import { LocalInference, extractKeywords } from './local-inference.js';

/**
 * A Mind — an AI entity with identity, knowledge, and the ability to respond.
 *
 * @example
 * const feynman = createFeynman();
 * const response = await feynman.respond("What is quantum mechanics?");
 * console.log(response.text);       // Feynman's answer
 * console.log(response.citations);  // Sources cited
 * console.log(response.confidence); // 0–1 based on knowledge match
 */
export class Mind {
  /** The Mind's configuration: name, era, domain, axiom, sources, prompt. */
  readonly config: MindConfig;

  /** Ed25519 keypair — the Mind's cryptographic identity. */
  readonly identity: Identity;

  /** The inference backend. Defaults to LocalInference if not provided. */
  readonly provider: InferenceProvider;

  /** Runtime state tracking activity. */
  state: MindState;

  constructor(config: MindConfig, identity: Identity, provider?: InferenceProvider) {
    this.config = config;
    this.identity = identity;
    this.provider = provider ?? new LocalInference(config.name, config.primarySources);
    this.state = {
      responsesGiven: 0,
      correlationsMade: 0,
      lastActive: 0,
    };
  }

  /**
   * Respond to a query using this Mind's knowledge and voice.
   *
   * Steps:
   * 1. Search the knowledge base for relevant sources
   * 2. Build a context-enriched prompt with relevant passages
   * 3. Generate a response via the inference provider
   * 4. Extract citations from matched sources
   * 5. Compute confidence from source match strength
   *
   * @param query - The question or topic to respond to
   * @returns A MindResponse with text, citations, confidence, and related minds
   */
  async respond(query: string): Promise<MindResponse> {
    const relevantSources = this.searchKnowledge(query);
    const confidence = computeConfidence(relevantSources, query);

    // Build an enriched prompt that includes relevant source passages
    const contextualPrompt = buildContextualPrompt(query, relevantSources, this.config);

    const text = await this.provider.generate(contextualPrompt, this.config.systemPrompt);

    const citations = buildCitations(relevantSources, query);

    this.state.responsesGiven++;
    this.state.lastActive = Date.now();

    return {
      text,
      citations,
      confidence,
      relatedMinds: undefined,
    };
  }

  /**
   * Given another Mind's response, find connections to this Mind's knowledge.
   *
   * Used for cross-mind synthesis: one mind builds on another's response.
   * Returns null if no relevant connection is found.
   *
   * @param otherResponse - A response from another Mind
   * @returns A correlated MindResponse, or null if no connection
   */
  async correlate(otherResponse: MindResponse): Promise<MindResponse | null> {
    // Extract keywords from the other response's text
    const keywords = extractKeywords(otherResponse.text);
    if (keywords.length === 0) return null;

    const relevantSources = this.searchKnowledge(otherResponse.text);

    // Only correlate if we have at least some relevant knowledge
    if (relevantSources.length === 0) return null;

    const confidence = computeConfidence(relevantSources, otherResponse.text);

    // Low confidence = not worth correlating (require meaningful signal)
    if (confidence < 0.25) return null;

    const correlationPrompt = `Responding to this thought: "${otherResponse.text.slice(0, 200)}"\n\nWhat connection does your knowledge offer?`;

    const text = await this.provider.generate(
      correlationPrompt,
      this.config.systemPrompt,
    );

    const citations = buildCitations(relevantSources, otherResponse.text);

    this.state.correlationsMade++;
    this.state.lastActive = Date.now();

    return {
      text,
      citations,
      confidence,
      relatedMinds: undefined,
    };
  }

  /**
   * Search the knowledge base for sources relevant to a query.
   *
   * Uses keyword matching across title, content, and source type.
   * Returns up to 3 most relevant sources, ranked by match score.
   *
   * @param query - The search query
   * @returns Array of matching Source objects (up to 3)
   */
  searchKnowledge(query: string): Source[] {
    const keywords = extractKeywords(query);
    if (keywords.length === 0) {
      return this.config.primarySources.slice(0, 1);
    }

    const scored = this.config.primarySources.map((source) => {
      const searchText = `${source.title} ${source.content} ${source.type} ${source.author}`.toLowerCase();
      const score = keywords.reduce((acc, kw) => {
        const kw_lower = kw.toLowerCase();
        // Count occurrences, not just presence
        const matches = (searchText.match(new RegExp(kw_lower, 'g')) ?? []).length;
        return acc + matches;
      }, 0);
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
 * Factory for creating a Mind with a freshly generated identity.
 * Async because Ed25519 key generation uses WebCrypto.
 */
export async function createMind(
  config: MindConfig,
  provider?: InferenceProvider,
): Promise<Mind> {
  const identity = await createIdentity();
  return new Mind(config, identity, provider);
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

/**
 * Build a context-enriched prompt that includes relevant source excerpts.
 * This gives the provider grounding in the Mind's actual knowledge.
 */
function buildContextualPrompt(
  query: string,
  sources: Source[],
  config: MindConfig,
): string {
  if (sources.length === 0) {
    return query;
  }

  const sourceContext = sources
    .slice(0, 2)
    .map((s) => {
      const excerpt = s.content.slice(0, 400).trim();
      return `From "${s.title}"${s.year ? ` (${s.year})` : ''}: ${excerpt}`;
    })
    .join('\n\n');

  return `Relevant knowledge from ${config.name}'s works:\n\n${sourceContext}\n\nQuery: ${query}`;
}

/**
 * Build citations from matched sources for a given query.
 */
function buildCitations(sources: Source[], query: string): Citation[] {
  const keywords = extractKeywords(query);

  return sources.map((source) => {
    // Find the most relevant sentence to quote
    const sentences = source.content
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.length > 20);

    const bestSentence = sentences
      .map((s) => ({
        sentence: s,
        score: keywords.filter((kw) => s.toLowerCase().includes(kw.toLowerCase())).length,
      }))
      .sort((a, b) => b.score - a.score)[0];

    const quote =
      bestSentence && bestSentence.score > 0
        ? bestSentence.sentence.slice(0, 200)
        : undefined;

    return {
      source: source.title,
      quote,
      relevance: `${source.author}'s work on ${source.type === 'paper' ? 'the subject' : source.type} directly addresses this topic`,
    };
  });
}

/**
 * Compute a confidence score based on how many sources were found
 * and how strongly they match the query.
 */
function computeConfidence(sources: Source[], query: string): number {
  if (sources.length === 0) return 0;

  const keywords = extractKeywords(query);
  if (keywords.length === 0) return 0.1;

  // Score based on: number of sources found + keyword density in top source
  const sourceScore = Math.min(sources.length / 3, 1); // 0–1 based on 0–3 sources

  const topSource = sources[0]!;
  const topText = topSource.content.toLowerCase();
  const matchedKeywords = keywords.filter((kw) => topText.includes(kw.toLowerCase()));
  const keywordScore = matchedKeywords.length / keywords.length;

  // Weighted average: source count matters more than individual keyword density
  return Math.round((sourceScore * 0.4 + keywordScore * 0.6) * 100) / 100;
}
