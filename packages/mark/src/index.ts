/**
 * @dot-protocol/mark — DOT-MARK rendering language.
 *
 * Compiles DOT-MARK source to self-contained HTML+CSS.
 * Every element is a signed DOT observation. Trust is visible.
 *
 * Usage:
 *   import { parseDotMark, compileDotMark } from '@dot-protocol/mark';
 *   const ast = parseDotMark(source);
 *   const html = compileDotMark(ast);
 */

// Parser
export { parseDotMark } from './parser.js';
export type { DotMarkAST, PageNode, ElementNode, ObserveNode, RenderDirective } from './parser.js';

// Compiler
export { compileDotMark } from './compiler.js';

// Trust UI
export { renderTrustBadge, renderTrustBar, trustColor, trustClass, chainDepthLabel } from './trust-ui.js';

// Phishing detection
export { checkPhishing, renderPhishingWarning } from './phishing.js';
export type { PhishingResult, PhishingRisk } from './phishing.js';

// Sanitizer
export { sanitize, sanitizeAttribute, escapeText } from './sanitizer.js';

// Components
export { renderGauge, renderBadge, renderNumber, renderText, renderList, renderChart, renderObservation } from './components.js';

// Styles
export { baseStyles, COLORS } from './styles.js';
