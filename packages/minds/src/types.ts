/**
 * types.ts — Provider-agnostic Mind interfaces for DOT Protocol.
 *
 * A Mind is an AI entity with identity (keypair), knowledge (primary sources),
 * and the ability to observe and respond. The InferenceProvider interface
 * decouples the Mind from any specific AI backend — Claude, GPT, Llama,
 * or a deterministic rule engine all work identically from the Mind's perspective.
 */

// ─── Knowledge Sources ────────────────────────────────────────────────────────

/** The type of primary source a Mind draws from. */
export type SourceType = 'book' | 'lecture' | 'letter' | 'paper' | 'poem' | 'diary';

/**
 * A primary source document in a Mind's knowledge base.
 * These are real works — actual text, actual quotes, actual content.
 */
export interface Source {
  /** Title of the work. */
  title: string;
  /** Author of the work. */
  author: string;
  /** Year of publication or composition. */
  year?: number;
  /** The actual text content — full excerpt or representative passages. */
  content: string;
  /** Type classification for the source. */
  type: SourceType;
}

// ─── Mind Configuration ───────────────────────────────────────────────────────

/**
 * Full configuration for a Mind — its identity, knowledge base, and voice.
 * The systemPrompt defines how this Mind thinks and expresses itself.
 */
export interface MindConfig {
  /** Unique identifier for this mind. e.g. "feynman", "rumi", "shannon" */
  id: string;
  /** Display name. e.g. "Richard Feynman", "Rumi", "Claude Shannon" */
  name: string;
  /** Life span or active era. e.g. "1918-1988", "1207-1273" */
  era: string;
  /** Knowledge domains this mind covers. e.g. ["physics", "education", "humor"] */
  domain: string[];
  /** Core belief — one sentence that captures this mind's fundamental worldview. */
  axiom: string;
  /** Primary source documents this mind draws from. */
  primarySources: Source[];
  /**
   * System prompt defining how this mind thinks, speaks, and approaches problems.
   * Passed to the InferenceProvider as the system/persona context.
   */
  systemPrompt: string;
}

// ─── Response Types ───────────────────────────────────────────────────────────

/**
 * A citation linking a response claim to a primary source.
 */
export interface Citation {
  /** Title of the source being cited. */
  source: string;
  /** Exact quote from the source, if applicable. */
  quote?: string;
  /** Why this source is relevant to the response. */
  relevance: string;
}

/**
 * The structured output of a Mind responding to a query.
 */
export interface MindResponse {
  /** The response text in the Mind's voice. */
  text: string;
  /** Citations linking the response to primary sources. */
  citations: Citation[];
  /**
   * Confidence score 0–1 based on how many relevant sources were found.
   * 0 = no matching knowledge, 1 = strong match across multiple sources.
   */
  confidence: number;
  /** IDs of other minds that might have relevant perspectives on this topic. */
  relatedMinds?: string[];
}

// ─── Inference Provider ───────────────────────────────────────────────────────

/** Options for controlling inference generation. */
export interface InferenceOptions {
  /** Maximum tokens to generate. */
  maxTokens?: number;
  /** Temperature for sampling (0 = deterministic, 1 = creative). */
  temperature?: number;
  /** Stop generation at these sequences. */
  stopSequences?: string[];
}

/**
 * Provider-agnostic inference interface.
 *
 * Implement this to plug any AI backend (Claude, GPT, Llama, Mistral,
 * or a deterministic rule engine) into a Mind without changing the Mind's logic.
 *
 * @example
 * // Claude implementation
 * class ClaudeProvider implements InferenceProvider {
 *   async generate(prompt, systemPrompt) {
 *     const msg = await anthropic.messages.create({
 *       model: 'claude-opus-4-5',
 *       system: systemPrompt,
 *       messages: [{ role: 'user', content: prompt }]
 *     });
 *     return msg.content[0].text;
 *   }
 * }
 */
export interface InferenceProvider {
  /**
   * Generate a text response given a user prompt and system context.
   *
   * @param prompt - The user's query or input text
   * @param systemPrompt - The persona/system context for this Mind
   * @param options - Optional generation parameters
   * @returns The generated response text
   */
  generate(
    prompt: string,
    systemPrompt: string,
    options?: InferenceOptions,
  ): Promise<string>;
}

// ─── Mind State ───────────────────────────────────────────────────────────────

/**
 * Runtime state accumulated by a Mind over its lifetime.
 * Tracks activity for observability and debugging.
 */
export interface MindState {
  /** Total number of responses generated. */
  responsesGiven: number;
  /** Total number of cross-mind correlations made. */
  correlationsMade: number;
  /** Unix timestamp (ms) of the last response. 0 if never active. */
  lastActive: number;
}
