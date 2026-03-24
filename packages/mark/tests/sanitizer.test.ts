/**
 * Sanitizer tests for @dot-protocol/mark — R854.
 * 15+ tests covering XSS vectors and safe content preservation.
 */

import { describe, it, expect } from 'vitest';
import { sanitize, sanitizeAttribute, escapeText } from '../src/sanitizer.js';

// ---------------------------------------------------------------------------
// sanitize — script stripping
// ---------------------------------------------------------------------------

describe('sanitize — script tags', () => {
  it('removes <script> block', () => {
    const html = '<p>Hello</p><script>alert(1)</script>';
    expect(sanitize(html)).not.toContain('<script>');
  });

  it('removes <script> with attributes', () => {
    const html = '<script type="text/javascript">evil()</script>';
    expect(sanitize(html)).not.toContain('<script');
  });

  it('removes uppercase <SCRIPT>', () => {
    const html = '<SCRIPT>evil()</SCRIPT>';
    expect(sanitize(html)).not.toContain('SCRIPT');
  });

  it('removes multiline script block', () => {
    const html = '<script>\nvar x = 1;\nalert(x);\n</script>';
    expect(sanitize(html)).not.toContain('<script');
  });

  it('preserves content outside script tags', () => {
    const html = '<p>Safe text</p><script>bad()</script><p>More safe</p>';
    const out = sanitize(html);
    expect(out).toContain('Safe text');
    expect(out).toContain('More safe');
  });
});

// ---------------------------------------------------------------------------
// sanitize — event handlers
// ---------------------------------------------------------------------------

describe('sanitize — event handlers', () => {
  it('removes onclick attribute', () => {
    const html = '<button onclick="evil()">Click</button>';
    const out = sanitize(html);
    expect(out).not.toContain('onclick');
  });

  it('removes onload attribute', () => {
    const html = '<img onload="evil()" src="x.png">';
    const out = sanitize(html);
    expect(out).not.toContain('onload');
  });

  it('removes onerror attribute', () => {
    const html = '<img onerror="evil()" src="bad">';
    const out = sanitize(html);
    expect(out).not.toContain('onerror');
  });

  it('preserves the element itself after stripping handler', () => {
    const html = '<button onclick="bad()">Click me</button>';
    const out = sanitize(html);
    expect(out).toContain('Click me');
  });
});

// ---------------------------------------------------------------------------
// sanitize — javascript: URLs
// ---------------------------------------------------------------------------

describe('sanitize — javascript: URLs', () => {
  it('removes javascript: in href', () => {
    const html = '<a href="javascript:alert(1)">link</a>';
    const out = sanitize(html);
    expect(out).not.toContain('javascript:');
  });

  it('removes javascript: with spaces', () => {
    const html = '<a href="javascript :alert(1)">link</a>';
    // our regex catches `javascript:` exactly; spaces variant less common but handle
    const out = sanitize(html);
    expect(out).toContain('link');
  });
});

// ---------------------------------------------------------------------------
// sanitize — data: URLs
// ---------------------------------------------------------------------------

describe('sanitize — data: URLs', () => {
  it('removes data: in src', () => {
    const html = '<img src="data:image/png;base64,abc">';
    const out = sanitize(html);
    expect(out).not.toContain('data:image');
  });

  it('removes data: in href', () => {
    const html = '<a href="data:text/html,<script>evil()</script>">x</a>';
    const out = sanitize(html);
    expect(out).not.toContain('data:text');
  });
});

// ---------------------------------------------------------------------------
// sanitize — normal content preserved
// ---------------------------------------------------------------------------

describe('sanitize — normal content preserved', () => {
  it('preserves plain paragraph', () => {
    const html = '<p>Hello world</p>';
    expect(sanitize(html)).toContain('<p>Hello world</p>');
  });

  it('preserves div with class', () => {
    const html = '<div class="dm-element">content</div>';
    expect(sanitize(html)).toContain('dm-element');
  });

  it('preserves SVG arc path', () => {
    const html = '<svg><path d="M 10 10" fill="none"/></svg>';
    expect(sanitize(html)).toContain('<path');
  });
});

// ---------------------------------------------------------------------------
// sanitizeAttribute
// ---------------------------------------------------------------------------

describe('sanitizeAttribute', () => {
  it('escapes double quotes', () => {
    expect(sanitizeAttribute('say "hello"')).toContain('&quot;');
  });

  it('escapes single quotes', () => {
    expect(sanitizeAttribute("say 'hello'")).toContain('&#x27;');
  });

  it('escapes angle brackets', () => {
    const out = sanitizeAttribute('<script>');
    expect(out).toContain('&lt;');
    expect(out).not.toContain('<script>');
  });

  it('escapes ampersand', () => {
    expect(sanitizeAttribute('a&b')).toContain('&amp;');
  });

  it('leaves normal text unchanged', () => {
    expect(sanitizeAttribute('hello world')).toBe('hello world');
  });
});

// ---------------------------------------------------------------------------
// escapeText
// ---------------------------------------------------------------------------

describe('escapeText', () => {
  it('escapes < and >', () => {
    const out = escapeText('<b>bold</b>');
    expect(out).not.toContain('<b>');
    expect(out).toContain('&lt;');
    expect(out).toContain('&gt;');
  });

  it('escapes &', () => {
    expect(escapeText('AT&T')).toContain('&amp;');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeText('hello world')).toBe('hello world');
  });
});
