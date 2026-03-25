/**
 * Type definitions for @dot-protocol/compiler.
 *
 * The compiler translates between natural language (any human language)
 * and structured DOT content (languageless semantic representation).
 *
 * Three operations:
 *   compile   — natural language → StructuredContent
 *   decompile — StructuredContent → natural language
 *   verify    — score fidelity of a rendering against StructuredContent
 */

// ---------------------------------------------------------------------------
// Core content types
// ---------------------------------------------------------------------------

/** A named thing referenced in the text. */
export interface Entity {
  /** The entity's canonical name. */
  name: string;
  /** Category (person, place, org, concept, number, date, etc.). */
  category: string;
  /** Variants/aliases seen in the text. */
  aliases?: string[];
}

/** A factual or opinion assertion. */
export interface Claim {
  /** Languageless assertion (English used as semantic intermediate). */
  statement: string;
  /** The logical type of this claim. */
  type: 'fact' | 'opinion' | 'prediction' | 'question';
  /** Confidence 0–1 that this claim is asserted as true. */
  certainty: number;
  /** Original source reference, if cited in the text. */
  source?: string;
}

/** A directional connection between two entities. */
export interface Relationship {
  /** Subject entity name. */
  from: string;
  /** Relationship verb/label. */
  relation: string;
  /** Object entity name. */
  to: string;
}

/** A citation extracted from the text. */
export interface Citation {
  /** The citation text as it appeared in the source. */
  text: string;
  /** The claim(s) it supports. */
  supports?: string[];
}

/** Domain and certainty framing for the content. */
export interface Scope {
  /** Domain category (e.g. "science", "finance", "politics", "personal"). */
  domain: string;
  /** Overall certainty of the content 0–1. */
  certainty: number;
  /** Time frame ("current", "historical", "future", "timeless"). */
  timeframe: string;
}

// ---------------------------------------------------------------------------
// StructuredContent — the languageless representation
// ---------------------------------------------------------------------------

/**
 * The languageless semantic representation of a piece of text.
 *
 * This is what compile() produces and decompile() consumes.
 * It encodes meaning without encoding language.
 */
export interface StructuredContent {
  /** Factual assertions and opinions extracted from the text. */
  claims: Claim[];
  /** Named entities referenced in the text. */
  entities: Entity[];
  /** Connections between entities. */
  relationships: Relationship[];
  /** Domain, certainty, and time scope. */
  scope: Scope;
  /** Emotional tone if discernible. */
  sentiment?: string;
}

// ---------------------------------------------------------------------------
// Compiler operation results
// ---------------------------------------------------------------------------

/** Result of a compile() call. */
export interface CompileResult {
  /** The languageless semantic representation. */
  dot: StructuredContent;
  /** BCP-47 language tag detected (e.g. "en", "hi", "ar", "zh"). */
  sourceLanguage: string;
  /** 0–1 confidence in the extraction quality. */
  confidence: number;
  /** Citations found in the source text. */
  citations: Citation[];
}

/** Result of a decompile() call. */
export interface DecompileResult {
  /** The rendered text in the target language. */
  text: string;
  /** BCP-47 tag of the language used. */
  targetLanguage: string;
  /** Audience level used for rendering. */
  audienceLevel: 'child' | 'general' | 'expert';
  /** 0–1 how faithful the rendering is to the input StructuredContent. */
  fidelity: number;
}

/** A single fidelity problem found during verify(). */
export interface FidelityIssue {
  /** Category of the problem. */
  type:
    | 'dropped_claim'
    | 'added_content'
    | 'softened_language'
    | 'missing_citation'
    | 'changed_certainty';
  /** Human-readable description of the specific issue. */
  description: string;
  /** How bad this issue is. */
  severity: 'low' | 'medium' | 'high';
}

/** Result of a verifyFidelity() call. */
export interface VerifyResult {
  /** Overall fidelity score 0–1. */
  fidelity: number;
  /** Individual issues found. */
  issues: FidelityIssue[];
  /** True when fidelity > 0.8 — considered a faithful rendering. */
  faithful: boolean;
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

/**
 * The interface that all compiler backends must implement.
 *
 * Implementations can use an LLM, a template engine, or a rule-based system.
 * The compiler functions (compile, decompile, verify) are agnostic to the
 * underlying provider.
 */
export interface CompilerProvider {
  /**
   * Generate a response given a user prompt and system prompt.
   *
   * @param prompt - The user-facing content/instruction
   * @param systemPrompt - The system-level context/persona
   * @returns The generated text response
   */
  generate(prompt: string, systemPrompt: string): Promise<string>;
}
