/**
 * components.ts — Built-in display renderers for DOT-MARK.
 *
 * Each renderer produces a self-contained HTML fragment (no external deps).
 * renderObservation() is the smart dispatch — auto-picks display from DOT type.
 */

import type { DOT } from '@dot-protocol/core';
import { escapeText, sanitizeAttribute } from './sanitizer.js';

/**
 * Renders a gauge (SVG arc) for a numeric value within a range.
 *
 * @param value - Current value
 * @param min   - Minimum of range
 * @param max   - Maximum of range
 * @param unit  - Unit label (e.g. "C", "%", "rpm")
 * @returns HTML string containing an SVG arc gauge
 */
export function renderGauge(value: number, min: number, max: number, unit: string): string {
  const safeUnit = sanitizeAttribute(unit);
  const clampedValue = Math.min(max, Math.max(min, value));
  const range = max - min;
  const pct = range === 0 ? 0 : (clampedValue - min) / range;

  // SVG arc: 180-degree half-circle gauge
  const cx = 60, cy = 60, r = 46;
  // Arc from 180° to 360° (half circle, bottom)
  const startAngle = Math.PI;       // left
  const endAngle = 0;               // right (clockwise, but we draw counter...)
  // We draw the arc from left to right proportionally
  const sweepAngle = Math.PI * pct; // portion of the 180° arc
  const x1 = cx + r * Math.cos(Math.PI);
  const y1 = cy + r * Math.sin(Math.PI);
  const x2 = cx + r * Math.cos(Math.PI - sweepAngle);
  const y2 = cy + r * Math.sin(Math.PI - sweepAngle);
  const largeArc = sweepAngle > Math.PI / 2 ? 1 : 0;

  const bgPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const fgPath = pct > 0
    ? `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
    : '';

  const color = pct < 0.3 ? '#22c55e' : pct < 0.7 ? '#eab308' : '#ef4444';
  const displayValue = Number.isInteger(value) ? value.toString() : value.toFixed(1);

  return `<div class="dm-gauge-wrap">
  <svg width="120" height="70" viewBox="0 0 120 70">
    <path d="${bgPath}" fill="none" stroke="#27272a" stroke-width="8" stroke-linecap="round"/>
    ${fgPath ? `<path d="${fgPath}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>` : ''}
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#e4e4e7" font-size="18" font-weight="700" font-family="system-ui">${escapeText(displayValue)}</text>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="#71717a" font-size="11" font-family="system-ui">${escapeText(safeUnit)}</text>
  </svg>
  <div class="dm-gauge-unit">${min} – ${max} ${escapeText(safeUnit)}</div>
</div>`;
}

/**
 * Renders a colored badge pill.
 *
 * @param label - Badge text
 * @param color - CSS color string (e.g. "green", "#22c55e")
 * @returns HTML string
 */
export function renderBadge(label: string, color: string): string {
  const safeLabel = escapeText(label);
  const safeColor = sanitizeAttribute(color);
  // Convert known color names to hex for text contrast
  const bgMap: Record<string, string> = {
    green: '#166534', red: '#7f1d1d', blue: '#1e3a5f',
    yellow: '#713f12', orange: '#7c2d12', purple: '#4c1d95',
    gray: '#27272a', grey: '#27272a',
  };
  const bg = bgMap[safeColor.toLowerCase()] ?? safeColor;
  return `<span class="dm-badge" style="background:${bg};color:${safeColor}">${safeLabel}</span>`;
}

/**
 * Renders a large formatted number with an optional label.
 *
 * @param value - Numeric value
 * @param label - Optional label below the number
 * @returns HTML string
 */
export function renderNumber(value: number, label?: string): string {
  const formatted = formatNumber(value);
  const labelHtml = label
    ? `<div class="dm-number-label">${escapeText(label)}</div>`
    : '';
  return `<div class="dm-number-wrap"><div class="dm-number-value">${escapeText(formatted)}</div>${labelHtml}</div>`;
}

/**
 * Renders a paragraph of text.
 *
 * @param text - Text content
 * @returns HTML string
 */
export function renderText(text: string): string {
  return `<p class="dm-text">${escapeText(text)}</p>`;
}

/**
 * Renders a bullet list.
 *
 * @param items - Array of string items
 * @returns HTML string
 */
export function renderList(items: string[]): string {
  const itemsHtml = items.map(i => `<li class="dm-list-item">${escapeText(i)}</li>`).join('\n  ');
  return `<ul class="dm-list">\n  ${itemsHtml}\n</ul>`;
}

/**
 * Renders a chart placeholder div.
 * Real chart rendering requires a JS charting library — this is the static fallback.
 *
 * @param label - Optional label for the chart placeholder
 * @returns HTML string
 */
export function renderChart(label?: string): string {
  const txt = label ? escapeText(label) : 'Chart';
  return `<div class="dm-chart-placeholder">${txt}</div>`;
}

/**
 * Auto-picks a renderer based on DOT type and renders the observation.
 *
 * Mapping:
 * - measure → gauge (if numeric payload) or number
 * - state   → badge
 * - event   → badge (with event styling)
 * - claim   → text
 * - bond    → text
 * - default → text
 *
 * @param dot     - The DOT to render
 * @param display - Override display type (optional)
 * @returns HTML string
 */
export function renderObservation(dot: DOT, display?: string): string {
  const effectiveDisplay = display ?? inferDisplay(dot);

  // Decode payload if present (plain mode)
  const payloadText = decodePayload(dot);

  switch (effectiveDisplay) {
    case 'gauge': {
      const val = payloadText !== undefined ? parseFloat(payloadText) : 0;
      return renderGauge(isNaN(val) ? 0 : val, 0, 100, '');
    }
    case 'badge': {
      const label = payloadText ?? dot.type ?? 'observation';
      return renderBadge(label, typeColor(dot.type));
    }
    case 'number': {
      const val = payloadText !== undefined ? parseFloat(payloadText) : 0;
      return renderNumber(isNaN(val) ? 0 : val, dot.type);
    }
    case 'list': {
      const items = payloadText ? payloadText.split(',').map(s => s.trim()) : [];
      return renderList(items);
    }
    case 'chart':
      return renderChart(payloadText ?? dot.type);
    case 'text':
    default:
      return renderText(payloadText ?? `[${dot.type ?? 'observation'}]`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Infer display type from DOT observation type. */
function inferDisplay(dot: DOT): string {
  switch (dot.type) {
    case 'measure': return 'gauge';
    case 'state':   return 'badge';
    case 'event':   return 'badge';
    case 'claim':   return 'text';
    case 'bond':    return 'text';
    default:        return 'text';
  }
}

/** Color for observation type badges. */
function typeColor(type: string | undefined): string {
  const map: Record<string, string> = {
    measure: 'blue', state: 'green', event: 'orange',
    claim: 'purple', bond: 'gray',
  };
  return map[type ?? ''] ?? 'gray';
}

/** Decode plain-mode payload to string. FHE payloads are not decoded. */
function decodePayload(dot: DOT): string | undefined {
  if (!dot.payload || dot.payload.length === 0) return undefined;
  if (dot.payload_mode === 'plain') {
    try {
      return new TextDecoder().decode(dot.payload);
    } catch {
      return undefined;
    }
  }
  return undefined; // FHE or none — no decode
}

/** Format a number with thousands separators. */
function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return value.toLocaleString('en-US');
  }
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
