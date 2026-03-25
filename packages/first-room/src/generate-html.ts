/**
 * generate-html.ts — Script to generate the seed HTML and write to Downloads.
 * Run via vitest to get workspace resolution.
 */
import { generateSeedHTML } from './seed.js';

const html = await generateSeedHTML();
const bytes = new TextEncoder().encode(html).length;
console.log(`Written: /Users/blaze/Downloads/the-first-room.html`);
console.log(`Size: ${bytes} bytes (${(bytes / 1024).toFixed(1)} KB)`);
