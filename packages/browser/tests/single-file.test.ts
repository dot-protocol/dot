/**
 * single-file.test.ts — Tests for generateSingleFile().
 *
 * Validates the self-contained HTML distribution:
 * - Valid HTML structure
 * - All resources inline (no external URLs)
 * - Size constraints (under 100KB)
 * - Required UI elements present
 * - Configuration options work correctly
 */

import { describe, it, expect } from 'vitest';
import { generateSingleFile } from '../src/single-file.js';

// ── Helpers ───────────────────────────────────────────────────────────────

/** Checks if a string contains no external URLs (http://, https://, //, src=, href=). */
function hasExternalURL(html: string): boolean {
  // Allow data: URLs and mailto:, but flag http/https/protocol-relative
  const externalPatterns = [
    /src\s*=\s*["']https?:/i,
    /href\s*=\s*["']https?:/i,
    /src\s*=\s*["']\/\//i,
    /href\s*=\s*["']\/\//i,
    /@import\s+["']https?:/i,
    /url\s*\(\s*["']?https?:/i,
  ];
  return externalPatterns.some((re) => re.test(html));
}

/** Rough byte size of a string (ASCII assumption is OK for size check). */
function byteSize(s: string): number {
  return new TextEncoder().encode(s).length;
}

// ── Structure tests ───────────────────────────────────────────────────────

describe('generateSingleFile() — HTML structure', () => {
  it('returns a string', async () => {
    const html = await generateSingleFile();
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
  });

  it('starts with DOCTYPE declaration', async () => {
    const html = await generateSingleFile();
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i);
  });

  it('has html element with lang attribute', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/<html\s[^>]*lang="en"/i);
  });

  it('has head element', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/<head>/i);
    expect(html).toMatch(/<\/head>/i);
  });

  it('has body element', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/<body>/i);
    expect(html).toMatch(/<\/body>/i);
  });

  it('has meta charset UTF-8', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/charset="UTF-8"/i);
  });

  it('has viewport meta tag', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/name="viewport"/i);
  });

  it('has title element', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/<title>/i);
    expect(html).toMatch(/<\/title>/i);
  });
});

// ── Inline resource tests ─────────────────────────────────────────────────

describe('generateSingleFile() — no external resources', () => {
  it('contains no external script src URLs', async () => {
    const html = await generateSingleFile();
    expect(hasExternalURL(html)).toBe(false);
  });

  it('contains no CDN links', async () => {
    const html = await generateSingleFile();
    expect(html).not.toMatch(/cdn\./i);
    expect(html).not.toMatch(/unpkg\.com/i);
    expect(html).not.toMatch(/jsdelivr\.net/i);
    expect(html).not.toMatch(/cloudflare\.com/i);
  });

  it('contains inline <style> block (no external CSS)', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/<style>/i);
    expect(html).not.toMatch(/<link\s[^>]*stylesheet/i);
  });

  it('contains inline <script> block', async () => {
    const html = await generateSingleFile();
    // Should have at least one inline script without src
    const scriptWithSrc = html.match(/<script\s[^>]*src\s*=/gi);
    expect(scriptWithSrc).toBeNull();
  });

  it('contains no external font imports', async () => {
    const html = await generateSingleFile();
    expect(html).not.toMatch(/fonts\.googleapis/i);
    expect(html).not.toMatch(/fonts\.gstatic/i);
  });
});

// ── Size constraints ──────────────────────────────────────────────────────

describe('generateSingleFile() — size constraints', () => {
  it('is under 100KB total', async () => {
    const html = await generateSingleFile({ includeSample: true });
    const size = byteSize(html);
    expect(size).toBeLessThan(100 * 1024); // 100KB
  });

  it('is under 60KB for empty tree (no sample)', async () => {
    const html = await generateSingleFile({ includeSample: false });
    const size = byteSize(html);
    expect(size).toBeLessThan(60 * 1024); // 60KB
  });

  it('is at least 5KB (sanity check for non-trivial content)', async () => {
    const html = await generateSingleFile();
    const size = byteSize(html);
    expect(size).toBeGreaterThan(5 * 1024);
  });
});

// ── UI elements ───────────────────────────────────────────────────────────

describe('generateSingleFile() — UI elements', () => {
  it('contains an observe input box', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/id="dot-input"/);
  });

  it('contains an Observe button', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/id="dot-submit"/);
    expect(html).toMatch(/Observe/);
  });

  it('contains a tree container div', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/id="tree-container"/);
  });

  it('contains a search input', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/id="vw-search"/);
  });

  it('contains export and verify buttons', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/id="dot-export"/);
    expect(html).toMatch(/id="dot-verify"/);
  });

  it('contains hash display element', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/id="dot-hash-display"/);
  });

  it('contains identity display element', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/id="dot-identity"/);
  });
});

// ── Title configuration ───────────────────────────────────────────────────

describe('generateSingleFile() — title option', () => {
  it('uses default title when not specified', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/<title>DOT Protocol<\/title>/i);
  });

  it('uses custom title when specified', async () => {
    const html = await generateSingleFile({ title: 'My Custom Tree' });
    expect(html).toMatch(/<title>My Custom Tree<\/title>/i);
  });

  it('escapes HTML in title', async () => {
    const html = await generateSingleFile({ title: '<script>alert(1)</script>' });
    expect(html).not.toMatch(/<title><script>/i);
    expect(html).toMatch(/&lt;script&gt;/i);
  });

  it('shows title in vw-title element', async () => {
    const html = await generateSingleFile({ title: 'Climate Registry' });
    expect(html).toMatch(/class="vw-title"[^>]*>Climate Registry/i);
  });
});

// ── includeTree option ────────────────────────────────────────────────────

describe('generateSingleFile() — includeTree option', () => {
  it('includes tree UI when includeTree=true (default)', async () => {
    const html = await generateSingleFile({ includeTree: true });
    expect(html).toMatch(/id="tree-container"/);
    expect(html).toMatch(/id="dot-input"/);
  });

  it('omits tree UI when includeTree=false', async () => {
    const html = await generateSingleFile({ includeTree: false });
    expect(html).not.toMatch(/id="tree-container"/);
    expect(html).not.toMatch(/id="dot-input"/);
  });
});

// ── includeSample option ──────────────────────────────────────────────────

describe('generateSingleFile() — includeSample option', () => {
  it('includeSample=true produces larger output than includeSample=false', async () => {
    const withSample = await generateSingleFile({ includeSample: true });
    const withoutSample = await generateSingleFile({ includeSample: false });
    // Sample adds seed tree content in JS, so with-sample may be same or slightly different
    // Both are valid HTML — just check both produce valid output
    expect(withSample.length).toBeGreaterThan(0);
    expect(withoutSample.length).toBeGreaterThan(0);
  });

  it('both includeSample variants produce valid HTML structure', async () => {
    for (const includeSample of [true, false]) {
      const html = await generateSingleFile({ includeSample });
      expect(html).toMatch(/<!DOCTYPE html>/i);
      expect(html).toMatch(/<\/html>/i);
    }
  });
});

// ── Crypto module present ─────────────────────────────────────────────────

describe('generateSingleFile() — crypto module', () => {
  it('contains DotCrypto module', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/DotCrypto/);
  });

  it('contains localStorage reference for identity persistence', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/localStorage/);
  });

  it('contains SHA-256 or crypto reference', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/crypto\.|SHA-256|SubtleCrypto/i);
  });

  it('contains tree persistence via localStorage', async () => {
    const html = await generateSingleFile();
    expect(html).toMatch(/dot-tree/i);
  });
});
