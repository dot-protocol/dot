/**
 * health.ts — DotFS directory health statistics.
 *
 * Scans all non-sidecar files in a directory and aggregates:
 *   - total file count
 *   - verified vs failed counts
 *   - verification rate (0.0–1.0)
 *   - deepest chain found
 *   - paths that failed verification
 */

import { observe, type DOT } from '../../core/src/index.js';
import { createHash } from '../../core/src/hash.js';
import type { DotFS } from './dotfs.js';
import { readSidecar, sidecarExists } from './sidecar.js';
import type { FSBackend } from './backends/interface.js';

export interface HealthStats {
  /** Total non-sidecar files scanned. */
  totalFiles: number;
  /** Files whose content hash matched the sidecar DOT. */
  verifiedCount: number;
  /** Files whose content hash did NOT match. */
  failedCount: number;
  /** Fraction of verified files (0.0–1.0). 1.0 for empty dirs. */
  verificationRate: number;
  /** Maximum chain depth across all files in the directory. */
  deepestChain: number;
  /** Paths that failed verification. */
  errorPaths: string[];
  /** Timestamp of this scan (ms since epoch). */
  checkedAt: number;
}

/**
 * Scans a directory and returns health statistics.
 *
 * @param dotfs - The DotFS instance
 * @param dir - Directory path to scan
 * @returns Health statistics for the directory
 */
export async function computeHealth(dotfs: DotFS, dir: string): Promise<HealthStats> {
  const backend = getDotFSBackend(dotfs);
  const checkedAt = Date.now();

  let names: string[] = [];
  try {
    names = backend.list(dir);
  } catch {
    // Empty or missing dir
  }

  // Filter out sidecar files
  const fileNames = names.filter(n => !(n.startsWith('.') && n.endsWith('.dot')));

  let totalFiles = 0;
  let verifiedCount = 0;
  let failedCount = 0;
  let deepestChain = 0;
  const errorPaths: string[] = [];

  for (const name of fileNames) {
    const filePath = joinPath(dir, name);

    // Skip directories
    if (!isFile(backend, filePath)) continue;

    totalFiles++;

    // Read sidecar for chain depth
    const dots = sidecarExists(backend, filePath) ? readSidecarSafe(backend, filePath) : [];
    const chainDepth = dots.length;
    if (chainDepth > deepestChain) deepestChain = chainDepth;

    // Verify content hash
    const latestDot = dots[dots.length - 1];
    if (latestDot?.verify?.hash !== undefined) {
      let content: Uint8Array;
      try {
        content = backend.readFile(filePath);
      } catch {
        failedCount++;
        errorPaths.push(filePath);
        continue;
      }

      const actualHash = await createHash(content);
      if (bytesEqual(actualHash, latestDot.verify.hash)) {
        verifiedCount++;
      } else {
        failedCount++;
        errorPaths.push(filePath);
      }
    } else {
      // No sidecar DOT or no hash — counts as unverified but not failed
      // (file exists but wasn't written through DotFS)
    }
  }

  const verificationRate = totalFiles === 0 ? 1.0 : verifiedCount / totalFiles;

  return {
    totalFiles,
    verifiedCount,
    failedCount,
    verificationRate,
    deepestChain,
    errorPaths,
    checkedAt,
  };
}

/**
 * Creates a DOT summarizing directory health as a 'state' observation.
 *
 * @param dotfs - The DotFS instance
 * @param dir - Directory to scan
 * @returns Unsigned DOT with JSON health payload
 */
export async function health(dotfs: DotFS, dir: string): Promise<DOT> {
  const stats = await computeHealth(dotfs, dir);
  return observe(stats, { type: 'state', plaintext: true }) as DOT;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDotFSBackend(dotfs: DotFS): FSBackend {
  const internal = dotfs as unknown as { backend: FSBackend };
  return internal.backend;
}

function joinPath(dir: string, name: string): string {
  if (dir === '/') return '/' + name;
  return dir.replace(/\/$/, '') + '/' + name;
}

function isFile(backend: FSBackend, filePath: string): boolean {
  try {
    backend.readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

function readSidecarSafe(backend: FSBackend, filePath: string): DOT[] {
  try {
    return readSidecar(backend, filePath);
  } catch {
    return [];
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
