/**
 * trust-ui.ts — Trust visualization for DOT-MARK.
 *
 * Trust ranges (R854 trust formula output):
 *   < 0.3  → red (phishing risk)
 *   0.3–0.7 → yellow (low trust)
 *   0.7–1.5 → green (trusted)
 *   > 1.5  → gold (highly trusted)
 *
 * Chain depth labels follow the ancient-internet naming convention.
 */

/**
 * Returns the CSS color string for a given trust score.
 *
 * @param trust - Computed trust score (0.0 to ~3.0+)
 */
export function trustColor(trust: number): string {
  if (trust < 0.3) return '#ef4444';   // red
  if (trust < 0.7) return '#eab308';   // yellow
  if (trust < 1.5) return '#22c55e';   // green
  return '#f59e0b';                     // gold
}

/**
 * Returns a CSS class suffix for trust coloring: red/yellow/green/gold.
 */
export function trustClass(trust: number): string {
  if (trust < 0.3) return 'red';
  if (trust < 0.7) return 'yellow';
  if (trust < 1.5) return 'green';
  return 'gold';
}

/**
 * Returns a human-readable label for chain depth.
 *
 * @param depth - Chain depth (0 = genesis)
 */
export function chainDepthLabel(depth: number): string {
  if (depth === 0) return 'Genesis';
  if (depth <= 10) return `Shallow (${depth})`;
  if (depth <= 100) return `Established (${depth})`;
  if (depth <= 999) return `Deep (${depth})`;
  return `Ancient (${depth})`;
}

/**
 * Renders an HTML trust badge pill showing trust score and label.
 *
 * @param trust - Trust score
 * @param depth - Chain depth
 * @returns HTML string
 */
export function renderTrustBadge(trust: number, depth: number): string {
  const cls = trustClass(trust);
  const label = chainDepthLabel(depth);
  const score = trust.toFixed(2);
  return `<span class="dm-trust-badge dm-trust-${cls}" title="Trust: ${score} | Depth: ${depth}">${score} · ${label}</span>`;
}

/**
 * Renders a horizontal trust bar as an SVG/HTML element.
 * Width is proportional to trust (capped at 100% for trust >= 2.0).
 *
 * @param trust - Trust score
 * @returns HTML string containing the trust bar
 */
export function renderTrustBar(trust: number): string {
  const pct = Math.min(100, Math.round((trust / 2.0) * 100));
  const color = trustColor(trust);
  return `<div class="dm-trust-bar-wrap"><div class="dm-trust-bar-fill" style="width:${pct}%;background:${color};"></div></div>`;
}
