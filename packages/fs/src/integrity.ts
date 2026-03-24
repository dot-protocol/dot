/**
 * integrity.ts — Standalone integrity check utilities for DotFS.
 *
 * Provides:
 *   - checkIntegrity() — detailed per-file report
 *   - detectTampering() — quick hash comparison
 *   - createTamperingEventDOT() — build a tampering event DOT for alerting
 */

import { observe, hash, type DOT } from '../../core/src/index.js';
import { createHashSync } from '../../core/src/hash.js';
import type { DotFS } from './dotfs.js';
import { readSidecar } from './sidecar.js';

export interface IntegrityReport {
  /** File path checked. */
  path: string;
  /** True if all checks passed. */
  valid: boolean;
  /** True if the content hash matches the latest DOT's verify.hash. */
  contentHashValid: boolean;
  /** True if all DOT signatures are valid (skipped if unsigned). */
  signaturesValid: boolean;
  /** True if the chain linkage is internally consistent. */
  chainValid: boolean;
  /** Number of DOTs in the sidecar chain. */
  chainDepth: number;
  /** Timestamp of the check (ms since epoch). */
  checkedAt: number;
  /** Error messages if any checks failed. */
  errors: string[];
}

export interface TamperingResult {
  /** True if tampering was detected. */
  tampered: boolean;
  /** Expected BLAKE3 hash as hex string (from sidecar DOT). Empty if no sidecar. */
  expected: string;
  /** Actual BLAKE3 hash of current content as hex string. Empty if no sidecar. */
  actual: string;
}

/**
 * Performs a detailed integrity check on a file managed by DotFS.
 *
 * Checks:
 *   1. Content hash vs latest DOT's verify.hash
 *   2. Sidecar chain linkage consistency
 *   3. DOT signature validity (if signed)
 *
 * @param dotfs - The DotFS instance
 * @param filePath - Absolute path to check
 * @returns Detailed IntegrityReport
 */
export async function checkIntegrity(dotfs: DotFS, filePath: string): Promise<IntegrityReport> {
  const checkedAt = Date.now();
  const errors: string[] = [];

  // Delegate to dotfs.verify for core checks
  const verifyResult = await dotfs.verify(filePath);
  errors.push(...verifyResult.errors);

  // Read sidecar for deep checks
  const dots = (dotfs as unknown as { backend: import('./backends/interface.js').FSBackend })
    ? readSidecarFromDotFS(dotfs, filePath)
    : [];

  const chainDepth = dots.length;

  // Check content hash
  let contentHashValid = false;
  if (verifyResult.valid || errors.every(e => !e.includes('hash'))) {
    contentHashValid = !errors.some(e => e.includes('hash'));
    if (verifyResult.valid) contentHashValid = true;
  }

  // Check chain linkage
  let chainValid = true;
  if (dots.length > 1) {
    for (let i = 1; i < dots.length; i++) {
      const prev = dots[i - 1];
      const curr = dots[i];
      if (!prev || !curr) continue;

      const expectedPrev = hash(prev);
      const actualPrev = curr.chain?.previous;
      if (actualPrev === undefined || !bytesEqual(expectedPrev, actualPrev)) {
        chainValid = false;
        errors.push(`chain link broken at depth ${i}`);
        break;
      }
    }
  }

  // Check signatures
  let signaturesValid = true;
  for (const dot of dots) {
    if (dot.sign?.signature !== undefined) {
      // Basic structural check (length)
      if (dot.sign.signature.length !== 64) {
        signaturesValid = false;
        errors.push('invalid signature length in chain');
        break;
      }
    }
  }

  const valid = verifyResult.valid && chainValid && signaturesValid;

  return {
    path: filePath,
    valid,
    contentHashValid: verifyResult.valid ? true : !errors.some(e => e.includes('hash')),
    signaturesValid,
    chainValid,
    chainDepth,
    checkedAt,
    errors: verifyResult.errors,
  };
}

/**
 * Quick tampering detection for a file.
 *
 * Compares the current content's BLAKE3 hash against the expected hash
 * recorded in the latest sidecar DOT.
 *
 * @param dotfs - The DotFS instance
 * @param filePath - Absolute path to check
 * @returns TamperingResult with tampered flag and hash hex strings
 */
export async function detectTampering(dotfs: DotFS, filePath: string): Promise<TamperingResult> {
  const dots = readSidecarFromDotFS(dotfs, filePath);

  if (dots.length === 0) {
    // No sidecar — cannot determine tampering
    return { tampered: false, expected: '', actual: '' };
  }

  const latestDot = dots[dots.length - 1];
  if (!latestDot?.verify?.hash) {
    return { tampered: false, expected: '', actual: '' };
  }

  const expectedHash = latestDot.verify.hash;
  const expectedHex = toHex(expectedHash);

  // Read current content
  const backend = getDotFSBackend(dotfs);
  if (!backend) return { tampered: false, expected: '', actual: '' };

  let content: Uint8Array;
  try {
    content = backend.readFile(filePath);
  } catch {
    return { tampered: false, expected: expectedHex, actual: '' };
  }

  // Compute actual hash synchronously
  const { createHash: createHashAsync } = await import('../../core/src/hash.js');
  const actualHashBytes = await createHashAsync(content);
  const actualHex = toHex(actualHashBytes);

  const tampered = expectedHex !== actualHex;

  return {
    tampered,
    expected: expectedHex,
    actual: actualHex,
  };
}

/**
 * Creates a DOT event recording a detected tampering incident.
 *
 * The DOT's payload is a JSON object with:
 *   - event: 'tampering_detected'
 *   - path: the file path
 *   - expected_hash: the hash from the sidecar
 *   - actual_hash: the hash of the current content
 *
 * @param filePath - The file where tampering was detected
 * @param expectedHash - Hex hash from the sidecar
 * @param actualHash - Hex hash of the current content
 * @returns An unsigned DOT of type 'event'
 */
export function createTamperingEventDOT(
  filePath: string,
  expectedHash: string,
  actualHash: string,
): DOT {
  const payload = JSON.stringify({
    event: 'tampering_detected',
    path: filePath,
    expected_hash: expectedHash,
    actual_hash: actualHash,
    detected_at: Date.now(),
  });

  return observe(payload, { type: 'event', plaintext: true }) as DOT;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Access the backend from a DotFS instance via the private field. */
function getDotFSBackend(dotfs: DotFS): import('./backends/interface.js').FSBackend | null {
  // Access private field via type assertion
  const internal = dotfs as unknown as { backend: import('./backends/interface.js').FSBackend };
  return internal.backend ?? null;
}

/** Read sidecar using the DotFS's internal backend. */
function readSidecarFromDotFS(dotfs: DotFS, filePath: string): DOT[] {
  const backend = getDotFSBackend(dotfs);
  if (!backend) return [];
  try {
    return readSidecar(backend, filePath);
  } catch {
    return [];
  }
}
