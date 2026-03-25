/**
 * single-file-wasm.test.ts — Tests for generateSingleFile({ includeWasm: true }).
 *
 * Validates the WASM-powered distribution:
 * - Real WASM binary embedded as base64
 * - No external resources
 * - Size under 400KB (WASM is ~282KB base64)
 * - All required UI elements present
 * - WASM init code present
 */

import { describe, it, expect } from 'vitest';
import { generateSingleFile } from '../src/single-file.js';
import { getWasmSize } from '../src/wasm-loader.js';
import { writeFileSync } from 'fs';

// ── Helpers ───────────────────────────────────────────────────────────────

function hasExternalURL(html: string): boolean {
  const patterns = [
    /src\s*=\s*["']https?:/i,
    /href\s*=\s*["']https?:/i,
    /src\s*=\s*["']\/\//i,
    /href\s*=\s*["']\/\//i,
    /@import\s+["']https?:/i,
    /url\s*\(\s*["']?https?:/i,
  ];
  return patterns.some((re) => re.test(html));
}

function byteSize(s: string): number {
  return Buffer.byteLength(s, 'utf8');
}

// ── WASM presence tests ───────────────────────────────────────────────────

describe('generateSingleFile({ includeWasm: true }) — WASM binary', () => {
  it('returns a string longer than the non-WASM version', async () => {
    const withWasm = await generateSingleFile({ includeWasm: true });
    const withoutWasm = await generateSingleFile({ includeWasm: false });
    expect(byteSize(withWasm)).toBeGreaterThan(byteSize(withoutWasm));
  });

  it('contains base64-encoded WASM binary', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    // WASM base64 is ~282KB — a long base64 string will be present
    // The magic bytes 0x00asm encode to "AGFzbQ" in base64
    expect(html).toMatch(/AGFzbQ/);
  });

  it('contains WASM_B64 variable', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/WASM_B64/);
  });

  it('contains WebAssembly.instantiate call', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/WebAssembly\.instantiate/);
  });

  it('contains window.DotWasm exposure', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/window\.DotWasm/);
  });

  it('contains generate_keypair in WASM init block', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/generate_keypair/);
  });

  it('contains create_dot in WASM init block', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/create_dot/);
  });

  it('contains verify_dot in WASM init block', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/verify_dot/);
  });

  it('contains hash_hex in WASM init block', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/hash_hex/);
  });

  it('contains ObservationType enum', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/ObservationType/);
  });

  it('contains wasm-ed25519 method marker', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/wasm-ed25519/);
  });

  it('contains dot-identity-v2-wasm localStorage key', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/dot-identity-v2-wasm/);
  });
});

// ── Size tests ────────────────────────────────────────────────────────────

describe('generateSingleFile({ includeWasm: true }) — size', () => {
  it('is under 400KB total', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    const size = byteSize(html);
    expect(size).toBeLessThan(400 * 1024);
  });

  it('is larger than the raw WASM binary size', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    const htmlSize = byteSize(html);
    const wasmRaw = getWasmSize();
    // HTML must contain at least the WASM (base64 is larger than raw)
    expect(htmlSize).toBeGreaterThan(wasmRaw);
  });

  it('is at least 250KB (WASM base64 is ~282KB)', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    const size = byteSize(html);
    expect(size).toBeGreaterThan(250 * 1024);
  });
});

// ── No external resources ─────────────────────────────────────────────────

describe('generateSingleFile({ includeWasm: true }) — no external resources', () => {
  it('contains no external URLs', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(hasExternalURL(html)).toBe(false);
  });

  it('contains no fetch() calls for WASM loading', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    // The glue's default fetch-based init is replaced — fetch should not be
    // called for loading the WASM binary (it may appear in unrelated glue code)
    // Key check: no fetch(new URL('dot_wasm_bg.wasm'...) pattern
    expect(html).not.toMatch(/fetch\(.*dot_wasm_bg\.wasm/);
  });

  it('contains no CDN references', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).not.toMatch(/cdn\./i);
    expect(html).not.toMatch(/unpkg\.com/i);
    expect(html).not.toMatch(/jsdelivr\.net/i);
  });

  it('contains inline <style> block', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/<style>/i);
  });

  it('contains no external stylesheet links', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).not.toMatch(/<link\s[^>]*stylesheet/i);
  });
});

// ── HTML structure ────────────────────────────────────────────────────────

describe('generateSingleFile({ includeWasm: true }) — HTML structure', () => {
  it('starts with DOCTYPE', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i);
  });

  it('has lang="en" attribute', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/lang="en"/i);
  });

  it('has charset UTF-8', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/charset="UTF-8"/i);
  });

  it('has viewport meta', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/name="viewport"/i);
  });

  it('has tree container div', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/id="tree-container"/);
  });

  it('has observe input', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/id="dot-input"/);
  });

  it('has Observe button', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/id="dot-submit"/);
    expect(html).toMatch(/Observe/);
  });

  it('has search input', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/id="vw-search"/);
  });

  it('has export button', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/id="dot-export"/);
  });

  it('has verify button', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/id="dot-verify"/);
  });

  it('has identity display element', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/id="dot-identity"/);
  });

  it('has dark background in CSS', async () => {
    const html = await generateSingleFile({ includeWasm: true });
    expect(html).toMatch(/#0a0a0b|#09090b|background:#/i);
  });
});

// ── Writes the WASM version to Downloads ─────────────────────────────────

describe('R855 deliverable: WASM-powered single HTML file', () => {
  it('generates and writes the-tree.html to Downloads', async () => {
    const html = await generateSingleFile({
      title: 'The Tree — DOT Protocol',
      includeWasm: true,
      includeTree: true,
    });

    const size = byteSize(html);
    const outputPath = '/Users/blaze/Downloads/the-tree.html';
    writeFileSync(outputPath, html, 'utf8');

    console.log('\nWASM deliverable size:', size, 'bytes', '(' + (size / 1024).toFixed(1) + 'KB)');
    console.log('Written to:', outputPath);

    expect(html).toMatch(/<!DOCTYPE html>/i);
    expect(html).toMatch(/AGFzbQ/); // WASM magic bytes in base64
    expect(html).toMatch(/window\.DotWasm/);
    expect(size).toBeLessThan(400 * 1024);
    console.log('WASM assertions passed');
  });
});
