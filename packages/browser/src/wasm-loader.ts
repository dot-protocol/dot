/**
 * wasm-loader.ts — WASM binary reader for single-file distribution.
 *
 * Reads the compiled DOT WASM module and its JS glue from packages/wasm/pkg/
 * and returns them as strings/base64 for inlining into single-file HTML.
 *
 * IMPORTANT: This module uses Node.js `fs` — it is a BUILD-TIME helper only.
 * It is NOT bundled into or executed in the browser.
 *
 * Exports:
 * - getWasmBase64(): WASM binary as base64 string
 * - getWasmGlue(): JS glue code as string (the dot_wasm.js contents)
 * - getWasmSize(): byte size of the raw WASM binary
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Path resolution ───────────────────────────────────────────────────────

function getWasmDir(): string {
  // Works from: packages/browser/src/wasm-loader.ts
  // WASM is at:  packages/wasm/pkg/
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    return resolve(__dirname, '../../wasm/pkg');
  } catch {
    // Fallback for non-ESM contexts (unlikely but defensive)
    return resolve(process.cwd(), 'packages/wasm/pkg');
  }
}

// ── Exports ───────────────────────────────────────────────────────────────

/**
 * Returns the DOT WASM binary encoded as base64.
 * This string is embedded in the single-file HTML and decoded at runtime.
 *
 * @throws If packages/wasm/pkg/dot_wasm_bg.wasm does not exist
 */
export function getWasmBase64(): string {
  const wasmPath = resolve(getWasmDir(), 'dot_wasm_bg.wasm');
  const bytes = readFileSync(wasmPath);
  return bytes.toString('base64');
}

/**
 * Returns the DOT WASM JS glue code as a string.
 * The glue code is MODIFIED before embedding:
 * - The default export (which calls fetch()) is removed
 * - The initSync function is exposed for use with inline bytes
 *
 * @throws If packages/wasm/pkg/dot_wasm.js does not exist
 */
export function getWasmGlue(): string {
  const gluePath = resolve(getWasmDir(), 'dot_wasm.js');
  return readFileSync(gluePath, 'utf-8');
}

/**
 * Returns the byte length of the raw WASM binary (before base64 encoding).
 * Useful for size assertions in tests.
 */
export function getWasmSize(): number {
  const wasmPath = resolve(getWasmDir(), 'dot_wasm_bg.wasm');
  const bytes = readFileSync(wasmPath);
  return bytes.length;
}

/**
 * Returns the base64-encoded size (after encoding).
 * Approximately 4/3 of raw size.
 */
export function getWasmBase64Size(): number {
  return getWasmBase64().length;
}
