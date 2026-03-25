/**
 * LocalCompiler — template-based compiler with no external LLM dependency.
 *
 * Uses Unicode range detection for language identification and simple
 * heuristics for claim/entity extraction. Not intelligent — but produces
 * real structured output for testing and offline use.
 *
 * Language detection covers:
 *   Latin scripts   → "en" (default for unrecognized Latin)
 *   Devanagari      → "hi" (Hindi, Sanskrit, etc.)
 *   Arabic          → "ar"
 *   CJK Unified     → "zh"
 *   Hangul          → "ko"
 *   Cyrillic        → "ru"
 *   Greek           → "el"
 *   Hebrew          → "he"
 *   Thai            → "th"
 *   Japanese kana   → "ja"
 */

import type { CompilerProvider, Claim, Entity } from './types.js';

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

/** Unicode range definitions for script detection. */
const SCRIPT_RANGES: Array<{ from: number; to: number; lang: string }> = [
  { from: 0x0900, to: 0x097f, lang: 'hi' },  // Devanagari
  { from: 0x0600, to: 0x06ff, lang: 'ar' },  // Arabic
  { from: 0x4e00, to: 0x9fff, lang: 'zh' },  // CJK Unified Ideographs
  { from: 0x3040, to: 0x309f, lang: 'ja' },  // Hiragana
  { from: 0x30a0, to: 0x30ff, lang: 'ja' },  // Katakana
  { from: 0xac00, to: 0xd7af, lang: 'ko' },  // Hangul syllables
  { from: 0x0400, to: 0x04ff, lang: 'ru' },  // Cyrillic
  { from: 0x0370, to: 0x03ff, lang: 'el' },  // Greek
  { from: 0x0590, to: 0x05ff, lang: 'he' },  // Hebrew
  { from: 0x0e00, to: 0x0e7f, lang: 'th' },  // Thai
];

/**
 * Detect the predominant language of a text string by scanning Unicode ranges.
 *
 * Returns a BCP-47 language tag. Falls back to "en" for Latin-script text
 * and unknown scripts.
 *
 * @param text - The input text to classify
 * @returns BCP-47 language tag
 */
export function detectLanguage(text: string): string {
  const counts = new Map<string, number>();

  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    for (const range of SCRIPT_RANGES) {
      if (cp >= range.from && cp <= range.to) {
        counts.set(range.lang, (counts.get(range.lang) ?? 0) + 1);
        break;
      }
    }
  }

  if (counts.size === 0) return 'en';

  // Return the language with the highest character count
  let topLang = 'en';
  let topCount = 0;
  for (const [lang, count] of counts) {
    if (count > topCount) {
      topCount = count;
      topLang = lang;
    }
  }
  return topLang;
}

// ---------------------------------------------------------------------------
// Claim extraction
// ---------------------------------------------------------------------------

/** Phrases that indicate opinion or uncertainty. */
const OPINION_MARKERS = [
  'i think',
  'i believe',
  'i feel',
  'i suspect',
  'in my opinion',
  'it seems',
  'apparently',
  'probably',
  'likely',
  'maybe',
  'perhaps',
  'possibly',
  'could be',
  'might be',
];

/** Phrases that indicate prediction. */
const PREDICTION_MARKERS = [
  'will',
  'will be',
  'is going to',
  'are going to',
  'shall',
  'is expected to',
  'are expected to',
  'forecast',
  'predict',
  'in the future',
  'next year',
  'soon',
];

/** Determine the claim type from a sentence. */
function classifyClaimType(sentence: string): 'fact' | 'opinion' | 'prediction' | 'question' {
  const lower = sentence.toLowerCase().trim();

  if (lower.endsWith('?')) return 'question';

  for (const marker of OPINION_MARKERS) {
    if (lower.includes(marker)) return 'opinion';
  }
  for (const marker of PREDICTION_MARKERS) {
    if (lower.includes(marker)) return 'prediction';
  }

  return 'fact';
}

/** Assign a certainty score based on claim type and hedge words. */
function scoreCertainty(sentence: string, type: 'fact' | 'opinion' | 'prediction' | 'question'): number {
  if (type === 'question') return 0.5;

  const lower = sentence.toLowerCase();
  const strongHedges = ['maybe', 'perhaps', 'possibly', 'could', 'might'];
  const weakHedges = ['probably', 'likely', 'seems', 'appears'];

  let score = type === 'fact' ? 0.9 : type === 'prediction' ? 0.6 : 0.7;

  for (const hedge of strongHedges) {
    if (lower.includes(hedge)) {
      score -= 0.2;
      break;
    }
  }
  for (const hedge of weakHedges) {
    if (lower.includes(hedge)) {
      score -= 0.1;
      break;
    }
  }

  return Math.max(0.1, Math.min(1.0, score));
}

/**
 * Extract claims from text by splitting into sentences and classifying each.
 *
 * @param text - Source text
 * @returns Array of Claim objects
 */
export function extractClaims(text: string): Claim[] {
  // Split on sentence-ending punctuation, keeping the delimiter
  const raw = text
    .replace(/([.!?])\s+/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return raw.map(sentence => {
    const type = classifyClaimType(sentence);
    const certainty = scoreCertainty(sentence, type);
    return {
      statement: sentence,
      type,
      certainty,
    } satisfies Claim;
  });
}

// ---------------------------------------------------------------------------
// Entity extraction
// ---------------------------------------------------------------------------

/** Patterns for numeric quantities with units. */
const QUANTITY_RE = /\b(\d+(?:\.\d+)?)\s*(kg|km|m|cm|mm|ml|l|°[CF]|%|USD|EUR|GBP|mph|kph)\b/gi;

/** Detect if a word is likely a proper noun (capitalized, not at sentence start). */
function isCapitalizedMidSentence(word: string, index: number, words: string[]): boolean {
  if (index === 0) return false; // first word — could be sentence start
  if (!/^[A-Z]/.test(word)) return false;
  // Skip common English words that are capitalised for other reasons
  const common = new Set(['I', 'The', 'A', 'An', 'It', 'He', 'She', 'They', 'We', 'You', 'This', 'That', 'These', 'Those']);
  return !common.has(word);
}

/** Categorise an entity by basic signals. */
function categorise(name: string): string {
  if (/\d/.test(name)) return 'number';
  if (/^(January|February|March|April|May|June|July|August|September|October|November|December)/i.test(name)) return 'date';
  // Simple heuristic: single proper noun vs multi-word
  const words = name.split(' ');
  if (words.length === 1) return 'concept';
  return 'entity';
}

/**
 * Extract named entities from text.
 *
 * Detects:
 *   - Capitalized words in mid-sentence position (proper nouns)
 *   - Quoted strings ("like this")
 *   - Numeric quantities with units (e.g. "5 km", "30%")
 *
 * @param text - Source text
 * @returns Array of Entity objects (deduplicated by name)
 */
export function extractEntities(text: string): Entity[] {
  const seen = new Map<string, Entity>();

  // 1. Quoted strings
  const quoted = text.match(/"([^"]+)"/g) ?? [];
  for (const q of quoted) {
    const name = q.replace(/"/g, '').trim();
    if (name && !seen.has(name)) {
      seen.set(name, { name, category: 'concept' });
    }
  }

  // 2. Numeric quantities with units
  let match: RegExpExecArray | null;
  const qRe = new RegExp(QUANTITY_RE.source, 'gi');
  while ((match = qRe.exec(text)) !== null) {
    const name = match[0].trim();
    if (!seen.has(name)) {
      seen.set(name, { name, category: 'number' });
    }
  }

  // 3. Capitalized proper nouns (mid-sentence)
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const raw = words[i]!.replace(/[^A-Za-z0-9'-]/g, '');
    if (raw.length < 2) continue;
    if (isCapitalizedMidSentence(raw, i, words)) {
      // Try to merge consecutive proper nouns (e.g. "New York")
      let name = raw;
      let j = i + 1;
      while (j < words.length) {
        const next = words[j]!.replace(/[^A-Za-z0-9'-]/g, '');
        if (next.length < 2 || !/^[A-Z]/.test(next)) break;
        name += ' ' + next;
        j++;
      }
      if (!seen.has(name)) {
        seen.set(name, { name, category: categorise(name) });
      }
    }
  }

  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// LocalCompiler — CompilerProvider implementation
// ---------------------------------------------------------------------------

/**
 * LocalCompiler provides compile/decompile/verify without an LLM.
 *
 * It uses deterministic heuristics and template rendering.  The output
 * is structurally valid but semantically shallow — useful for testing,
 * offline use, and as a fallback.
 */
export class LocalCompiler implements CompilerProvider {
  /**
   * Generate a response by parsing the prompt for compile/decompile/verify
   * requests and applying the corresponding heuristic.
   *
   * The prompt format used internally by compile.ts / decompile.ts /
   * verify.ts is JSON, so we parse that directly instead of using an LLM.
   */
  async generate(prompt: string, _systemPrompt: string): Promise<string> {
    // The compiler functions embed JSON in the prompt. Try to parse it.
    try {
      // Attempt to extract a JSON block from the prompt
      const jsonMatch = prompt.match(/```json\n([\s\S]*?)\n```/) ??
                        prompt.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const raw = jsonMatch[1] ?? jsonMatch[0];
        const parsed = JSON.parse(raw);

        // COMPILE request
        if (parsed.task === 'compile') {
          return this._handleCompile(parsed.text as string);
        }

        // DECOMPILE request
        if (parsed.task === 'decompile') {
          return this._handleDecompile(parsed.content, parsed.targetLanguage as string, parsed.audienceLevel as string);
        }

        // VERIFY request
        if (parsed.task === 'verify') {
          return this._handleVerify(parsed.content, parsed.rendering as string);
        }
      }
    } catch {
      // Fall through to plain-text extraction
    }

    // Fallback: treat the prompt as plain text to compile
    return this._handleCompile(prompt);
  }

  private _handleCompile(text: string): string {
    const claims = extractClaims(text);
    const entities = extractEntities(text);
    const lang = detectLanguage(text);

    const result = {
      sourceLanguage: lang,
      confidence: claims.length > 0 ? 0.75 : 0.4,
      citations: [] as Citation[],
      dot: {
        claims,
        entities,
        relationships: [],
        scope: {
          domain: 'general',
          certainty: claims.reduce((acc, c) => acc + c.certainty, 0) / Math.max(claims.length, 1),
          timeframe: 'current',
        },
        sentiment: undefined,
      },
    };

    return JSON.stringify(result);
  }

  private _handleDecompile(
    content: import('./types.js').StructuredContent,
    targetLanguage: string,
    audienceLevel: string,
  ): string {
    if (!content || !content.claims) {
      return JSON.stringify({ text: '', targetLanguage, audienceLevel, fidelity: 0 });
    }

    const sentences = content.claims.map(c => {
      if (c.type === 'question') return c.statement.endsWith('?') ? c.statement : c.statement + '?';
      if (c.type === 'opinion') return `It is believed that ${c.statement}`;
      if (c.type === 'prediction') return `It is predicted that ${c.statement}`;
      return c.statement.endsWith('.') || c.statement.endsWith('!') ? c.statement : c.statement + '.';
    });

    // Include citations (sources) from claims
    const citationParts: string[] = [];
    for (const claim of content.claims) {
      if (claim.source) {
        citationParts.push(`[Source: ${claim.source}]`);
      }
    }

    const allParts = [...sentences, ...citationParts];
    const text = allParts.join(' ').trim();

    return JSON.stringify({
      text,
      targetLanguage,
      audienceLevel: audienceLevel ?? 'general',
      fidelity: 0.85,
    });
  }

  private _handleVerify(
    content: import('./types.js').StructuredContent,
    rendering: string,
  ): string {
    if (!content || !content.claims) {
      return JSON.stringify({ fidelity: 0, issues: [], faithful: false });
    }

    const issues: import('./types.js').FidelityIssue[] = [];
    const renderLower = rendering.toLowerCase();

    // 1. Check each claim for presence in the rendering
    for (const claim of content.claims) {
      const keyWords = claim.statement.toLowerCase().split(/\W+/).filter(w => w.length > 4);

      if (keyWords.length === 0) continue;

      const presentCount = keyWords.filter(w => renderLower.includes(w)).length;
      const coverage = presentCount / keyWords.length;

      if (coverage < 0.4) {
        issues.push({
          type: 'dropped_claim',
          description: `Claim appears missing from rendering: "${claim.statement.slice(0, 80)}"`,
          severity: 'high',
        });
      } else if (coverage < 0.7) {
        issues.push({
          type: 'dropped_claim',
          description: `Claim may be partially missing: "${claim.statement.slice(0, 80)}"`,
          severity: 'medium',
        });
      }

      // Check certainty representation: high-certainty claim + softening hedges = issue
      if (claim.certainty > 0.85 && this._hasSofteningLanguage(rendering)) {
        issues.push({
          type: 'softened_language',
          description: 'High-certainty claim appears softened in the rendering.',
          severity: 'medium',
        });
      }

      // Check citations
      if (claim.source && !renderLower.includes(claim.source.toLowerCase())) {
        issues.push({
          type: 'missing_citation',
          description: `Citation "${claim.source}" not found in rendering.`,
          severity: 'low',
        });
      }
    }

    // 2. Detect added content: rendering contains many words not in any claim
    const claimWordSet = new Set(
      content.claims.flatMap(c => c.statement.toLowerCase().split(/\W+/).filter(w => w.length > 4)),
    );
    const renderWords = renderLower.split(/\W+/).filter(w => w.length > 4);
    if (renderWords.length > 5) {
      const unknownWords = renderWords.filter(w => !claimWordSet.has(w));
      if (unknownWords.length > renderWords.length * 0.35) {
        issues.push({
          type: 'added_content',
          description: 'Rendering contains significant content not present in the source claims.',
          severity: 'medium',
        });
      }
    }

    const penalties: Record<string, number> = { high: 0.25, medium: 0.12, low: 0.05 };
    const totalPenalty = issues.reduce((acc, issue) => acc + (penalties[issue.severity] ?? 0.1), 0);
    const fidelity = Math.max(0, Math.min(1, 1 - totalPenalty));
    return JSON.stringify({ fidelity, issues, faithful: fidelity > 0.8 });
  }

  private _hasSofteningLanguage(text: string): boolean {
    const lower = text.toLowerCase();
    const words = ['maybe', 'perhaps', 'possibly', 'might', 'could', 'uncertain', 'unclear', 'cannot be certain'];
    return words.some(w => lower.includes(w));
  }
}

// Import needed for the private helper types — keep TS happy
import type { Citation } from './types.js';
