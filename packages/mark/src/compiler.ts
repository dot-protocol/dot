/**
 * compiler.ts — DotMarkAST → HTML+CSS string.
 *
 * Output is self-contained: inline CSS, no external dependencies, no CDN.
 * Dark theme by default.
 * Each element wrapped in .dot-element with data-trust and data-depth attributes.
 * All output sanitized before return.
 */

import type { DotMarkAST, PageNode, ElementNode } from './parser.js';
import { renderGauge, renderBadge, renderNumber, renderText, renderList, renderChart } from './components.js';
import { renderTrustBadge, renderTrustBar } from './trust-ui.js';
import { baseStyles } from './styles.js';
import { sanitize, sanitizeAttribute, escapeText } from './sanitizer.js';

/**
 * Compile a DotMarkAST into a self-contained HTML string.
 *
 * @param ast - Parsed DotMarkAST from parseDotMark()
 * @returns Full HTML document string
 */
export function compileDotMark(ast: DotMarkAST): string {
  const css = baseStyles();
  const bodyContent = ast.pages.map(compilePage).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DOT-MARK</title>
<style>
${css}
</style>
</head>
<body>
${bodyContent}
</body>
</html>`;

  return sanitize(html);
}

// ---------------------------------------------------------------------------
// Page compiler
// ---------------------------------------------------------------------------

function compilePage(page: PageNode): string {
  const titleHtml = page.title
    ? `<h1 class="dm-page-title">${escapeText(page.title)}</h1>`
    : '';
  const elementsHtml = page.elements.map(compileElement).join('\n');
  return `<div class="dm-page">\n${titleHtml}\n<div class="dm-elements">\n${elementsHtml}\n</div>\n</div>`;
}

// ---------------------------------------------------------------------------
// Element compiler
// ---------------------------------------------------------------------------

function compileElement(elem: ElementNode): string {
  const { observe, render } = elem;

  // Determine display type and props
  const display = render?.display ?? inferDefaultDisplay(observe.observationType);
  const props = render?.props ?? {};

  // Trust and depth — for now we derive dummy defaults from what we know
  // In a real runtime, a DOT would be passed; here we use metadata from props
  const trust = typeof props['trust'] === 'number'
    ? props['trust']
    : (props['trust'] === 'show' ? 0.0 : 0.0);
  const depth = typeof props['depth'] === 'number' ? props['depth'] : 0;

  // Label: observation name or type
  const label = observe.name ?? observe.observationType ?? observe.location ?? 'observation';

  // Render the content
  const contentHtml = renderDisplayContent(display, observe, props);

  // Trust bar + badge
  const trustBar = renderTrustBar(trust);
  const trustBadge = renderTrustBadge(trust, depth);

  const safeLabel = sanitizeAttribute(label);
  const safeTrust = trust.toFixed(4);
  const safeDepth = depth.toString();

  return `<div class="dot-element dm-element" data-label="${safeLabel}" data-trust="${safeTrust}" data-depth="${safeDepth}" data-display="${sanitizeAttribute(display)}">
  ${trustBar}
  <div class="dm-element-label">${escapeText(label)}</div>
  <div class="dm-element-content">
    ${contentHtml}
  </div>
  <div class="dm-trust-row">
    ${trustBadge}
  </div>
</div>`;
}

// ---------------------------------------------------------------------------
// Display type dispatch
// ---------------------------------------------------------------------------

function renderDisplayContent(
  display: string,
  observe: ElementNode['observe'],
  props: Record<string, unknown>,
): string {
  switch (display) {
    case 'gauge': {
      const range = props['range'];
      const min = Array.isArray(range) ? (range[0] as number ?? 0) : (typeof props['min'] === 'number' ? props['min'] : 0);
      const max = Array.isArray(range) ? (range[1] as number ?? 100) : (typeof props['max'] === 'number' ? props['max'] : 100);
      const unit = typeof props['unit'] === 'string' ? props['unit'] : '';
      const value = observe.value !== undefined ? parseFloat(observe.value) : 50;
      return renderGauge(isNaN(value) ? 50 : value, min, max, unit);
    }
    case 'badge': {
      const colors = props['colors'] as Record<string, string> | undefined;
      const stateValue = observe.value ?? observe.name ?? 'unknown';
      const color = colors?.[stateValue] ?? defaultBadgeColor(observe.observationType);
      return renderBadge(stateValue, color);
    }
    case 'number': {
      const val = observe.value !== undefined ? parseFloat(observe.value) : 0;
      const lbl = typeof props['label'] === 'string' ? props['label'] : observe.name;
      return renderNumber(isNaN(val) ? 0 : val, lbl);
    }
    case 'list': {
      const val = observe.value ?? '';
      const items = val ? val.split(',').map((s: string) => s.trim()) : [];
      return renderList(items);
    }
    case 'chart': {
      const lbl = typeof props['label'] === 'string' ? props['label'] : observe.name;
      return renderChart(lbl);
    }
    case 'text':
    default: {
      const content = observe.value ?? observe.name ?? `[${observe.observationType ?? 'observation'}]`;
      return renderText(content);
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferDefaultDisplay(observationType: string | undefined): string {
  switch (observationType) {
    case 'measure': return 'gauge';
    case 'state':   return 'badge';
    case 'event':   return 'badge';
    case 'claim':   return 'text';
    case 'bond':    return 'text';
    default:        return 'text';
  }
}

function defaultBadgeColor(observationType: string | undefined): string {
  switch (observationType) {
    case 'state':   return 'green';
    case 'event':   return 'orange';
    case 'measure': return 'blue';
    default:        return 'gray';
  }
}
