/**
 * generate-html.test.ts — Generates the single-file HTML deliverable.
 *
 * Run with: npx vitest run packages/browser/tests/generate-html.test.ts
 * Output: /Users/blaze/Downloads/dot-protocol.html
 */

import { describe, it, expect } from 'vitest';
import { generateSingleFile } from '../src/single-file.js';
import { writeFileSync } from 'fs';

describe('R855 deliverable: single HTML file', () => {
  it('generates and writes dot-protocol.html to Downloads', async () => {
    const html = await generateSingleFile({
      title: 'DOT Protocol',
      includeSample: true,
      includeTree: true,
    });

    const size = Buffer.byteLength(html, 'utf8');
    console.log('\nHTML deliverable size:', size, 'bytes', '(' + (size / 1024).toFixed(1) + 'KB)');

    // Write the file
    const outputPath = '/Users/blaze/Downloads/dot-protocol.html';
    writeFileSync(outputPath, html, 'utf8');
    console.log('Written to:', outputPath);

    // Validate
    expect(html).toMatch(/<!DOCTYPE html>/i);
    expect(html).toMatch(/id="dot-input"/);
    expect(html).toMatch(/id="tree-container"/);
    expect(html).toMatch(/DotCrypto/);
    expect(size).toBeLessThan(100 * 1024);
    console.log('All assertions passed');
  });
});
