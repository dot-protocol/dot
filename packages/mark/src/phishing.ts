/**
 * phishing.ts — Zero-depth identity detection for DOT-MARK.
 *
 * Analyzes a DOT for phishing risk based on:
 * - Absence of signature → high risk
 * - Chain depth 0 (genesis) → medium risk
 * - Chain depth < 5 → low risk
 * - Ephemeral identity → medium risk
 * - No chain base at all → medium risk
 */

import type { DOT } from '@dot-protocol/core';
import { sanitize } from './sanitizer.js';

/** Phishing risk level. */
export type PhishingRisk = 'none' | 'low' | 'medium' | 'high';

/** Result of a phishing check. */
export interface PhishingResult {
  risk: PhishingRisk;
  reasons: string[];
}

/**
 * Checks a DOT for phishing risk signals.
 *
 * Rules applied in order (worst risk wins):
 * - No signature at all → high
 * - Ephemeral identity level → medium
 * - No chain base → medium
 * - Chain depth === 0 (genesis) → medium
 * - Chain depth < 5 → low
 *
 * @param dot - The DOT to inspect
 * @returns PhishingResult with risk level and reasons
 */
export function checkPhishing(dot: DOT): PhishingResult {
  const reasons: string[] = [];
  let risk: PhishingRisk = 'none';

  // Rule 1: No signature → high risk
  if (dot.sign?.signature === undefined) {
    reasons.push('No cryptographic signature — identity cannot be verified');
    risk = 'high';
  }

  // Rule 2: Ephemeral identity → medium risk (only escalate, never downgrade)
  if (dot.sign?.level === 'ephemeral') {
    reasons.push('Ephemeral identity — observer is not persistent');
    if (risk === 'none' || risk === 'low') risk = 'medium';
  }

  // Rule 3: No chain base → medium risk
  if (dot.chain === undefined) {
    reasons.push('No chain base — observation has no causal history');
    if (risk === 'none' || risk === 'low') risk = 'medium';
  } else {
    // Rule 4: Genesis DOT (depth 0) → medium risk
    if ((dot.chain.depth ?? 0) === 0) {
      reasons.push('Chain depth 0 — genesis observation, no established history');
      if (risk === 'none' || risk === 'low') risk = 'medium';
    } else if ((dot.chain.depth ?? 0) < 5) {
      // Rule 5: Very shallow chain → low risk
      reasons.push(`Chain depth ${dot.chain.depth} — shallow history (< 5)`);
      if (risk === 'none') risk = 'low';
    }
  }

  return { risk, reasons };
}

/**
 * Renders an HTML warning banner for a PhishingResult.
 * Returns empty string if risk is 'none'.
 *
 * @param result - PhishingResult from checkPhishing()
 * @returns HTML string (empty if no risk)
 */
export function renderPhishingWarning(result: PhishingResult): string {
  if (result.risk === 'none') return '';

  const labels: Record<PhishingRisk, string> = {
    none: '',
    low: 'Low Risk',
    medium: 'Medium Risk — Verify Source',
    high: 'High Risk — Possible Phishing',
  };

  const cls = `dm-phishing-${result.risk}`;
  const label = labels[result.risk];
  const reasonsHtml = result.reasons.length > 0
    ? `<div class="dm-phishing-reasons">${result.reasons.map(r => `<div class="dm-phishing-reason">• ${sanitize(r)}</div>`).join('')}</div>`
    : '';

  return `<div class="dm-phishing-warn ${cls}"><strong>${label}</strong>${reasonsHtml}</div>`;
}
