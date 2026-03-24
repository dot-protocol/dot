/**
 * styles.ts — CSS-in-JS for DOT-MARK.
 *
 * Dark theme by default.
 * Trust colors: red/yellow/green/gold by threshold.
 * All classes prefixed with `dm-` to avoid collisions.
 */

/** Color palette constants. */
export const COLORS = {
  bg: '#0a0a0b',
  surface: '#18181b',
  border: '#27272a',
  text: '#e4e4e7',
  textMuted: '#71717a',
  accent: '#818cf8',
  trustRed: '#ef4444',
  trustYellow: '#eab308',
  trustGreen: '#22c55e',
  trustGold: '#f59e0b',
} as const;

/**
 * Returns the full CSS string for all DOT-MARK elements.
 * Self-contained — no external dependencies.
 */
export function baseStyles(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: ${COLORS.bg};
      color: ${COLORS.text};
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      padding: 24px;
    }
    .dm-page {
      max-width: 900px;
      margin: 0 auto;
    }
    .dm-page-title {
      font-size: 22px;
      font-weight: 600;
      color: ${COLORS.text};
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid ${COLORS.border};
    }
    .dm-elements {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .dm-element {
      background: ${COLORS.surface};
      border: 1px solid ${COLORS.border};
      border-radius: 8px;
      padding: 16px;
      position: relative;
      overflow: hidden;
    }
    .dm-element-label {
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${COLORS.textMuted};
      margin-bottom: 8px;
    }
    /* Trust bar at top of element */
    .dm-trust-bar-wrap {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: ${COLORS.border};
    }
    .dm-trust-bar-fill {
      height: 100%;
      border-radius: 0 2px 2px 0;
    }
    /* Trust badge */
    .dm-trust-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 500;
      padding: 2px 7px;
      border-radius: 999px;
      border: 1px solid currentColor;
      opacity: 0.85;
    }
    .dm-trust-red    { color: ${COLORS.trustRed}; }
    .dm-trust-yellow { color: ${COLORS.trustYellow}; }
    .dm-trust-green  { color: ${COLORS.trustGreen}; }
    .dm-trust-gold   { color: ${COLORS.trustGold}; }
    /* Gauge */
    .dm-gauge-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .dm-gauge-value { font-size: 24px; font-weight: 700; color: ${COLORS.text}; }
    .dm-gauge-unit { font-size: 12px; color: ${COLORS.textMuted}; }
    /* Badge */
    .dm-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    /* Number */
    .dm-number-wrap { display: flex; flex-direction: column; gap: 2px; }
    .dm-number-value { font-size: 32px; font-weight: 700; color: ${COLORS.text}; line-height: 1; }
    .dm-number-label { font-size: 12px; color: ${COLORS.textMuted}; }
    /* Text */
    .dm-text { color: ${COLORS.text}; font-size: 14px; line-height: 1.6; }
    /* List */
    .dm-list { list-style: none; display: flex; flex-direction: column; gap: 4px; }
    .dm-list-item {
      padding: 6px 10px;
      background: ${COLORS.bg};
      border-radius: 4px;
      font-size: 13px;
      color: ${COLORS.text};
      border-left: 2px solid ${COLORS.accent};
    }
    /* Chart placeholder */
    .dm-chart-placeholder {
      width: 100%; height: 80px;
      background: ${COLORS.bg};
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${COLORS.textMuted};
      font-size: 12px;
      border: 1px dashed ${COLORS.border};
    }
    /* Phishing warning */
    .dm-phishing-warn {
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      border-left: 4px solid;
      margin-bottom: 16px;
    }
    .dm-phishing-high   { background: #1a0a0a; color: #fca5a5; border-color: ${COLORS.trustRed}; }
    .dm-phishing-medium { background: #1a150a; color: #fde68a; border-color: ${COLORS.trustYellow}; }
    .dm-phishing-low    { background: #0f1a12; color: #86efac; border-color: ${COLORS.trustGreen}; }
    .dm-phishing-reasons { margin-top: 6px; font-size: 12px; opacity: 0.8; }
    .dm-phishing-reason { margin-top: 2px; }
    /* Trust row at bottom of element */
    .dm-trust-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid ${COLORS.border};
    }
    .dm-depth-label { font-size: 11px; color: ${COLORS.textMuted}; }
  `.replace(/^\s+/gm, '    ').trim();
}
