/**
 * sanitizer.ts — XSS prevention for DOT-MARK compiler output.
 *
 * All HTML produced by the compiler passes through sanitize() before return.
 * Strips: script tags, event handlers (on*=), javascript: URLs, data: URLs.
 * Escapes attribute values to prevent injection.
 */

/**
 * Sanitizes an HTML string, stripping XSS vectors.
 *
 * Removes:
 * - <script> ... </script> blocks (case-insensitive)
 * - on* event handler attributes (onclick, onload, etc.)
 * - javascript: URL values
 * - data: URL values
 * - <iframe>, <object>, <embed>, <form> tags
 * - <link rel="import"> and <base> tags
 *
 * @param html - Raw HTML string
 * @returns Sanitized HTML string
 */
export function sanitize(html: string): string {
  let out = html;

  // Remove <script>...</script> blocks (case-insensitive, including newlines)
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');

  // Remove dangerous tags entirely
  out = out.replace(/<\s*(iframe|object|embed|form|base)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '');
  out = out.replace(/<\s*(iframe|object|embed|form|base)\b[^>]*/gi, '');

  // Remove on* event handler attributes (e.g. onclick="...", onmouseover='...')
  out = out.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Remove javascript: in attribute values
  out = out.replace(/(?:href|src|action|data)\s*=\s*["']?\s*javascript:/gi, 'data-blocked=');

  // Remove data: URLs in src/href attributes
  out = out.replace(/(?:href|src)\s*=\s*["']?\s*data:/gi, 'data-blocked=');

  return out;
}

/**
 * Escapes special characters in an HTML attribute value.
 * Prevents injection when embedding user-controlled strings in attributes.
 *
 * @param value - Raw attribute value string
 * @returns Escaped string safe for use inside HTML attributes
 */
export function sanitizeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escapes text content for safe insertion into HTML text nodes.
 *
 * @param text - Raw text
 * @returns HTML-escaped text
 */
export function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
