/**
 * generate-html.ts — Script to generate the seed HTML and write to Downloads.
 * Run via vitest to get workspace resolution.
 */
import { generateSeedHTML, getDefaultSeedHTMLPath } from './seed.js';

const outPath = getDefaultSeedHTMLPath();
const html = await generateSeedHTML(outPath);
const bytes = new TextEncoder().encode(html).length;
console.log(`Written: ${outPath}`);
console.log(`Size: ${bytes} bytes (${(bytes / 1024).toFixed(1)} KB)`);
