/**
 * verifyFidelity() — Score how faithfully a rendering represents structured content.
 *
 * Compares a text rendering against the source StructuredContent and reports:
 *   - An overall fidelity score (0–1)
 *   - A list of specific issues (dropped claims, added content, softened language, etc.)
 *   - A boolean `faithful` flag (fidelity > 0.8)
 *
 * The provider is asked to do semantic comparison; if it fails or returns
 * bad JSON, we fall back to keyword-based heuristics.
 */

import type { VerifyResult, FidelityIssue, CompilerProvider, StructuredContent } from './types.js';

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const VERIFY_SYSTEM_PROMPT = `You are a fidelity auditor for content rendering.

Given a structured content specification and a text rendering of it, check whether the rendering is faithful.

Check for these issue types:
  - "dropped_claim":       A claim from the spec is missing or paraphrased away.
  - "added_content":       The rendering introduces information not in the spec.
  - "softened_language":   Strong claims are weakened (e.g. "definitely" → "maybe").
  - "missing_citation":    A citation from the spec is absent from the rendering.
  - "changed_certainty":   A claim's certainty level is misrepresented.

For each issue:
  - type: one of the above strings
  - description: specific description of the issue
  - severity: "low" | "medium" | "high"

Respond ONLY with valid JSON:
{
  "fidelity": number,
  "issues": [{ "type": string, "description": string, "severity": string }],
  "faithful": boolean
}`;

// ---------------------------------------------------------------------------
// verifyFidelity()
// ---------------------------------------------------------------------------

/**
 * Score the fidelity of a rendering against its source structured content.
 *
 * @param original - The StructuredContent that was (supposedly) rendered
 * @param rendering - The text rendering to evaluate
 * @param provider - The compiler backend
 * @returns VerifyResult with score, issues, and faithful flag
 *
 * @example
 * const result = await verifyFidelity(content, "The temp is 82 degrees.", provider);
 * result.faithful // true or false
 * result.fidelity // 0.0 – 1.0
 */
export async function verifyFidelity(
  original: StructuredContent,
  rendering: string,
  provider: CompilerProvider,
): Promise<VerifyResult> {
  const prompt = buildVerifyPrompt(original, rendering);

  let raw: string;
  try {
    raw = await provider.generate(prompt, VERIFY_SYSTEM_PROMPT);
  } catch {
    return heuristicVerify(original, rendering);
  }

  return parseVerifyResponse(raw, original, rendering);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildVerifyPrompt(content: StructuredContent, rendering: string): string {
  return JSON.stringify({ task: 'verify', content, rendering });
}

function parseVerifyResponse(
  raw: string,
  original: StructuredContent,
  rendering: string,
): VerifyResult {
  const jsonStr = extractJson(raw);
  if (!jsonStr) {
    return heuristicVerify(original, rendering);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const issues: FidelityIssue[] = asIssueArray(parsed.issues);
    const fidelity = typeof parsed.fidelity === 'number' ? clamp(parsed.fidelity) : scoreFromIssues(issues);
    return {
      fidelity,
      issues,
      faithful: fidelity > 0.8,
    };
  } catch {
    return heuristicVerify(original, rendering);
  }
}

// ---------------------------------------------------------------------------
// Heuristic fallback
// ---------------------------------------------------------------------------

/**
 * Keyword-based fidelity check when the provider is unavailable.
 *
 * Logic:
 *   - For each claim, compute word-coverage of key words (>4 chars) in the rendering.
 *   - Low coverage → dropped_claim issue.
 *   - Check for citations in the rendering.
 *   - Check for added superlatives/hedges not in the original.
 */
function heuristicVerify(original: StructuredContent, rendering: string): VerifyResult {
  const issues: FidelityIssue[] = [];
  const renderLower = rendering.toLowerCase();

  // 1. Check each claim
  for (const claim of original.claims ?? []) {
    const keyWords = claim.statement
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 4);

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

    // Check certainty representation
    if (claim.certainty > 0.85 && hasSofteningLanguage(rendering)) {
      issues.push({
        type: 'softened_language',
        description: `High-certainty claim appears softened in the rendering.`,
        severity: 'medium',
      });
    }
  }

  // 2. Check citations
  for (const claim of original.claims ?? []) {
    if (claim.source && !renderLower.includes(claim.source.toLowerCase())) {
      issues.push({
        type: 'missing_citation',
        description: `Citation "${claim.source}" not found in rendering.`,
        severity: 'low',
      });
    }
  }

  // 3. Detect content added beyond the claims
  const claimWordSet = new Set(
    (original.claims ?? [])
      .flatMap(c => c.statement.toLowerCase().split(/\W+/).filter(w => w.length > 4)),
  );
  const renderWords = renderLower.split(/\W+/).filter(w => w.length > 4);
  const unknownWords = renderWords.filter(w => !claimWordSet.has(w));
  if (unknownWords.length > renderWords.length * 0.4 && renderWords.length > 10) {
    issues.push({
      type: 'added_content',
      description: 'Rendering contains significant content not present in the source claims.',
      severity: 'medium',
    });
  }

  const fidelity = scoreFromIssues(issues);
  return { fidelity, issues, faithful: fidelity > 0.8 };
}

const SOFTENING_WORDS = ['maybe', 'perhaps', 'possibly', 'might', 'could', 'uncertain', 'unclear'];
function hasSofteningLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return SOFTENING_WORDS.some(w => lower.includes(w));
}

function scoreFromIssues(issues: FidelityIssue[]): number {
  const penalties: Record<string, number> = { high: 0.25, medium: 0.12, low: 0.05 };
  const totalPenalty = issues.reduce((acc, issue) => acc + (penalties[issue.severity] ?? 0.1), 0);
  return Math.max(0, Math.min(1, 1 - totalPenalty));
}

// ---------------------------------------------------------------------------
// Coercion helpers
// ---------------------------------------------------------------------------

function asIssueArray(raw: unknown): FidelityIssue[] {
  if (!Array.isArray(raw)) return [];
  const validTypes = new Set(['dropped_claim', 'added_content', 'softened_language', 'missing_citation', 'changed_certainty']);
  const validSeverities = new Set(['low', 'medium', 'high']);
  return raw.filter(Boolean).map(item => ({
    type: (validTypes.has(item.type) ? item.type : 'dropped_claim') as FidelityIssue['type'],
    description: String(item.description ?? ''),
    severity: (validSeverities.has(item.severity) ? item.severity : 'medium') as FidelityIssue['severity'],
  }));
}

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

export type { VerifyResult } from './types.js';
