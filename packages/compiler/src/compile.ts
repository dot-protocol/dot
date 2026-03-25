/**
 * compile() — Natural language → structured DOT content.
 *
 * Accepts text in any human language and returns a StructuredContent
 * representation that is language-agnostic.
 *
 * Steps:
 *   1. Build a structured extraction prompt
 *   2. Call the provider
 *   3. Parse the JSON response into CompileResult
 *   4. Fall back gracefully if parsing fails
 */

import type { CompileResult, CompilerProvider, StructuredContent, Claim, Entity, Relationship, Citation } from './types.js';
import { detectLanguage, extractClaims, extractEntities } from './local-compiler.js';

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const COMPILE_SYSTEM_PROMPT = `You are a semantic extraction engine.

Given text in ANY human language, extract its meaning into a language-neutral JSON structure.

Rules:
- Extract CLAIMS: factual assertions, opinions, predictions, and questions.
  - type: "fact" | "opinion" | "prediction" | "question"
  - certainty: 0.0–1.0 (facts ~0.9, opinions ~0.7, predictions ~0.6)
  - Preserve citations/sources in the claim's "source" field
- Extract ENTITIES: named things (people, orgs, places, concepts, numbers).
- Extract RELATIONSHIPS: directional connections between entities.
- Determine SCOPE: domain, overall certainty, timeframe.
- Detect SENTIMENT if present: "positive", "negative", "neutral", "mixed".
- Detect SOURCE LANGUAGE using BCP-47 tag (e.g. "en", "hi", "ar", "zh").
- Report CONFIDENCE in your extraction quality (0.0–1.0).

Respond ONLY with valid JSON matching this schema:
{
  "sourceLanguage": string,
  "confidence": number,
  "citations": [{ "text": string, "supports"?: string[] }],
  "dot": {
    "claims": [{ "statement": string, "type": string, "certainty": number, "source"?: string }],
    "entities": [{ "name": string, "category": string, "aliases"?: string[] }],
    "relationships": [{ "from": string, "relation": string, "to": string }],
    "scope": { "domain": string, "certainty": number, "timeframe": string },
    "sentiment"?: string
  }
}`;

// ---------------------------------------------------------------------------
// compile()
// ---------------------------------------------------------------------------

/**
 * Compile natural language text into a structured, languageless representation.
 *
 * @param text - Input text in any human language
 * @param provider - The compiler backend (LLM or LocalCompiler)
 * @returns CompileResult with the structured content and metadata
 *
 * @example
 * const result = await compile("The temperature is 82°F at sensor 7.", provider);
 * result.sourceLanguage // "en"
 * result.dot.claims[0].type // "fact"
 */
export async function compile(text: string, provider: CompilerProvider): Promise<CompileResult> {
  const prompt = buildCompilePrompt(text);

  let raw: string;
  try {
    raw = await provider.generate(prompt, COMPILE_SYSTEM_PROMPT);
  } catch (err) {
    // Provider failed — fall back to local heuristics
    return localFallback(text);
  }

  return parseCompileResponse(raw, text);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCompilePrompt(text: string): string {
  return JSON.stringify({ task: 'compile', text });
}

function parseCompileResponse(raw: string, originalText: string): CompileResult {
  // Try to extract JSON from the response (LLMs sometimes wrap in markdown)
  const jsonStr = extractJson(raw);
  if (!jsonStr) {
    return localFallback(originalText);
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Validate and coerce fields
    const dot: StructuredContent = {
      claims: asClaimArray(parsed.dot?.claims),
      entities: asEntityArray(parsed.dot?.entities),
      relationships: asRelationshipArray(parsed.dot?.relationships),
      scope: asScope(parsed.dot?.scope),
      sentiment: typeof parsed.dot?.sentiment === 'string' ? parsed.dot.sentiment : undefined,
    };

    return {
      dot,
      sourceLanguage: typeof parsed.sourceLanguage === 'string' ? parsed.sourceLanguage : detectLanguage(originalText),
      confidence: typeof parsed.confidence === 'number' ? clamp(parsed.confidence) : 0.7,
      citations: asCitationArray(parsed.citations),
    };
  } catch {
    return localFallback(originalText);
  }
}

/** Fall back to local heuristic extraction when the provider fails or returns garbage. */
function localFallback(text: string): CompileResult {
  const claims = extractClaims(text);
  const entities = extractEntities(text);
  const sourceLanguage = detectLanguage(text);

  return {
    dot: {
      claims,
      entities,
      relationships: [],
      scope: {
        domain: 'general',
        certainty: avgCertainty(claims),
        timeframe: 'current',
      },
    },
    sourceLanguage,
    confidence: 0.5,
    citations: [],
  };
}

// ---------------------------------------------------------------------------
// Coercion helpers
// ---------------------------------------------------------------------------

function extractJson(text: string): string | null {
  // Try to find ```json ... ``` block
  const mdMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  if (mdMatch) return mdMatch[1]!;

  // Try to find raw JSON object
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];

  return null;
}

function asClaimArray(raw: unknown): Claim[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean).map(item => ({
    statement: String(item.statement ?? ''),
    type: (['fact', 'opinion', 'prediction', 'question'].includes(item.type) ? item.type : 'fact') as Claim['type'],
    certainty: typeof item.certainty === 'number' ? clamp(item.certainty) : 0.8,
    source: typeof item.source === 'string' ? item.source : undefined,
  }));
}

function asEntityArray(raw: unknown): Entity[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean).map(item => ({
    name: String(item.name ?? ''),
    category: String(item.category ?? 'entity'),
    aliases: Array.isArray(item.aliases) ? item.aliases.map(String) : undefined,
  }));
}

function asRelationshipArray(raw: unknown): Relationship[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean).map(item => ({
    from: String(item.from ?? ''),
    relation: String(item.relation ?? ''),
    to: String(item.to ?? ''),
  }));
}

function asScope(raw: unknown): import('./types.js').Scope {
  if (!raw || typeof raw !== 'object') {
    return { domain: 'general', certainty: 0.7, timeframe: 'current' };
  }
  const r = raw as Record<string, unknown>;
  return {
    domain: typeof r.domain === 'string' ? r.domain : 'general',
    certainty: typeof r.certainty === 'number' ? clamp(r.certainty) : 0.7,
    timeframe: typeof r.timeframe === 'string' ? r.timeframe : 'current',
  };
}

function asCitationArray(raw: unknown): Citation[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean).map(item => ({
    text: String(item.text ?? ''),
    supports: Array.isArray(item.supports) ? item.supports.map(String) : undefined,
  }));
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, v));
}

function avgCertainty(claims: Claim[]): number {
  if (claims.length === 0) return 0.7;
  return claims.reduce((acc, c) => acc + c.certainty, 0) / claims.length;
}

// Re-export for convenience
export type { CompileResult } from './types.js';
