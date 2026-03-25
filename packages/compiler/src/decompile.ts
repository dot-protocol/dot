/**
 * decompile() — Structured DOT content → natural language.
 *
 * Accepts a StructuredContent (languageless) and renders it into
 * human-readable text in the requested target language and at the
 * appropriate audience level.
 *
 * Steps:
 *   1. Build a rendering prompt with the structured content + parameters
 *   2. Call the provider
 *   3. Parse the response into DecompileResult
 *   4. Fall back to template rendering if parsing fails
 */

import type { DecompileResult, CompilerProvider, StructuredContent } from './types.js';

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const DECOMPILE_SYSTEM_PROMPT = `You are a multilingual rendering engine.

Given structured, language-neutral content, render it as natural text in the requested language.

Rules:
- Render ALL claims faithfully — do not drop, summarise away, or alter meaning.
- Preserve citations — include them in the output (parenthetical or footnote style).
- Match the requested audience level:
  - "child":   Short sentences, common words, explain concepts simply.
  - "general": Clear prose, moderate vocabulary.
  - "expert":  Precise technical language, full nuance.
- Render in the EXACT target language requested (BCP-47 tag).
- Report fidelity (0.0–1.0) — how faithfully you rendered all content.

Respond ONLY with valid JSON:
{
  "text": string,
  "targetLanguage": string,
  "audienceLevel": string,
  "fidelity": number
}`;

// ---------------------------------------------------------------------------
// decompile()
// ---------------------------------------------------------------------------

/**
 * Render structured content into natural language.
 *
 * @param content - The languageless StructuredContent to render
 * @param targetLang - BCP-47 language tag (e.g. "en", "es", "fr", "zh")
 * @param provider - The compiler backend
 * @param options - Optional rendering parameters
 * @returns DecompileResult with the rendered text and metadata
 *
 * @example
 * const result = await decompile(content, "es", provider, { audienceLevel: "child" });
 * result.text // "La temperatura es 82°F en el sensor 7."
 */
export async function decompile(
  content: StructuredContent,
  targetLang: string,
  provider: CompilerProvider,
  options?: { audienceLevel?: 'child' | 'general' | 'expert' },
): Promise<DecompileResult> {
  const audienceLevel = options?.audienceLevel ?? 'general';
  const prompt = buildDecompilePrompt(content, targetLang, audienceLevel);

  let raw: string;
  try {
    raw = await provider.generate(prompt, DECOMPILE_SYSTEM_PROMPT);
  } catch {
    return templateFallback(content, targetLang, audienceLevel);
  }

  return parseDecompileResponse(raw, targetLang, audienceLevel, content);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDecompilePrompt(
  content: StructuredContent,
  targetLang: string,
  audienceLevel: string,
): string {
  return JSON.stringify({
    task: 'decompile',
    targetLanguage: targetLang,
    audienceLevel,
    content,
  });
}

function parseDecompileResponse(
  raw: string,
  targetLang: string,
  audienceLevel: 'child' | 'general' | 'expert',
  content: StructuredContent,
): DecompileResult {
  const jsonStr = extractJson(raw);
  if (!jsonStr) {
    return templateFallback(content, targetLang, audienceLevel);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      text: typeof parsed.text === 'string' ? parsed.text : '',
      targetLanguage: typeof parsed.targetLanguage === 'string' ? parsed.targetLanguage : targetLang,
      audienceLevel: resolveAudienceLevel(parsed.audienceLevel) ?? audienceLevel,
      fidelity: typeof parsed.fidelity === 'number' ? clamp(parsed.fidelity) : 0.8,
    };
  } catch {
    return templateFallback(content, targetLang, audienceLevel);
  }
}

/**
 * Template-based fallback renderer — works without LLM.
 * Reassembles sentences from claim statements.
 */
function templateFallback(
  content: StructuredContent,
  targetLang: string,
  audienceLevel: 'child' | 'general' | 'expert',
): DecompileResult {
  if (!content.claims || content.claims.length === 0) {
    return { text: '', targetLanguage: targetLang, audienceLevel, fidelity: 0 };
  }

  const sentences = content.claims.map(claim => {
    const stmt = claim.statement;
    if (claim.type === 'question') {
      return stmt.endsWith('?') ? stmt : stmt + '?';
    }
    if (claim.type === 'opinion') {
      return audienceLevel === 'expert'
        ? `It is asserted (opinion) that ${stmt}`
        : `It is believed that ${stmt}`;
    }
    if (claim.type === 'prediction') {
      return audienceLevel === 'child'
        ? `People think ${stmt} will happen.`
        : `It is predicted that ${stmt}`;
    }
    // fact
    return stmt.endsWith('.') || stmt.endsWith('!') ? stmt : stmt + '.';
  });

  // Add citations if present
  const citationParts: string[] = [];
  if (content.claims.some(c => c.source)) {
    for (const claim of content.claims) {
      if (claim.source) {
        citationParts.push(`[Source: ${claim.source}]`);
      }
    }
  }

  const allParts = [...sentences, ...citationParts];
  const text = allParts.join(' ').trim();

  return {
    text,
    targetLanguage: targetLang,
    audienceLevel,
    fidelity: 0.8,
  };
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function extractJson(text: string): string | null {
  const mdMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  if (mdMatch) return mdMatch[1]!;
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return null;
}

function clamp(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function resolveAudienceLevel(v: unknown): 'child' | 'general' | 'expert' | null {
  if (v === 'child' || v === 'general' || v === 'expert') return v;
  return null;
}

export type { DecompileResult } from './types.js';
