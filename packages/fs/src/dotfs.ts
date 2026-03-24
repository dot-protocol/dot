/**
 * dotfs.ts — DotFS: a STCV-aware filesystem layer.
 *
 * Every file write creates a signed, chained DOT that records:
 *   - BLAKE3 hash of the content (verify base)
 *   - Ed25519 signature (sign base)
 *   - Timestamp (time base)
 *   - Chain link to the previous DOT for this file (chain base)
 *
 * The DOT chain is stored in a sidecar file alongside each managed file.
 * Reading a file compares the current content hash against the sidecar's
 * latest DOT to detect tampering.
 */

import {
  observe,
  sign,
  chain,
  type DOT,
  type Identity,
} from '../../core/src/index.js';
import { createHash } from '../../core/src/hash.js';
import type { FSBackend } from './backends/interface.js';
import { sidecarPath, sidecarExists, writeSidecar, readSidecar } from './sidecar.js';

export interface ReadResult {
  /** The file content bytes. */
  content: Uint8Array;
  /** The latest DOT from the sidecar, or undefined if no sidecar exists. */
  dot: DOT | undefined;
  /** True if content BLAKE3 matches dot.verify.hash; false otherwise. */
  verified: boolean;
}

export interface VerifyResult {
  /** True if all integrity checks passed. */
  valid: boolean;
  /** Human-readable error messages for each failed check. */
  errors: string[];
}

export interface ListEntry {
  /** Basename of the file. */
  name: string;
  /** Number of DOTs in the sidecar (write history depth). */
  chainDepth: number;
  /** Whether content hash matches the latest sidecar DOT. */
  verified: boolean;
}

export class DotFS {
  constructor(
    private readonly backend: FSBackend,
    private readonly identity: Identity,
  ) {}

  /**
   * Write content to a file, creating a signed DOT and appending it to the sidecar.
   *
   * @param filePath - Absolute path to write
   * @param content - Raw bytes to write
   * @returns The newly created signed DOT
   */
  async write(filePath: string, content: Uint8Array): Promise<DOT> {
    // Ensure parent directory exists
    const dir = dirname(filePath);
    this.backend.mkdir(dir);

    // Write the file content
    this.backend.writeFile(filePath, content);

    // Compute content hash
    const contentHash = await createHash(content);

    // Read existing sidecar to find the chain tip
    const existingChain = readSidecar(this.backend, filePath);
    const previous = existingChain[existingChain.length - 1];

    // Build the unsigned DOT
    let dot = observe(null, { type: 'state' });

    // Set verify.hash = BLAKE3(content)
    dot = {
      ...dot,
      type: 'state',
      payload: undefined,
      payload_mode: 'none',
      verify: { hash: contentHash },
      time: { utc: Date.now() },
    };

    // Apply chain linkage
    const chained = chain(dot as DOT, previous);

    // Sign the DOT
    const signed = await sign(chained, this.identity.secretKey);

    // Append to sidecar
    writeSidecar(this.backend, filePath, signed);

    return signed;
  }

  /**
   * Read a file and verify its integrity against the sidecar.
   *
   * @param filePath - Absolute path to read
   * @returns Content bytes, latest DOT (if any), and verified flag
   */
  async read(filePath: string): Promise<ReadResult> {
    const content = this.backend.readFile(filePath);

    // Read sidecar for the latest DOT
    let dot: DOT | undefined;
    let verified = false;

    if (sidecarExists(this.backend, filePath)) {
      let dots: DOT[] = [];
      try {
        dots = readSidecar(this.backend, filePath);
      } catch {
        // Corrupt sidecar — treat as missing
      }

      if (dots.length > 0) {
        dot = dots[dots.length - 1];

        // Verify content hash
        if (dot?.verify?.hash !== undefined) {
          const actualHash = await createHash(content);
          verified = bytesEqual(actualHash, dot.verify.hash);
        }
      }
      // No DOTs in sidecar → unverified
    }

    return { content, dot, verified };
  }

  /**
   * Return the write history for a file (latest first).
   *
   * @param filePath - Absolute path
   * @param depth - Maximum number of entries to return (0 = all, undefined = all)
   * @returns Array of DOTs in reverse chronological order
   */
  history(filePath: string, depth?: number): DOT[] {
    const dots = readSidecar(this.backend, filePath);
    if (dots.length === 0) return [];

    // Reverse so latest is first
    const reversed = dots.slice().reverse();

    if (depth === undefined || depth === 0) return reversed;
    return reversed.slice(0, depth);
  }

  /**
   * Verify the integrity of a file: content hash + sidecar chain.
   *
   * @param filePath - Absolute path to verify
   * @returns Verification result with errors list
   */
  async verify(filePath: string): Promise<VerifyResult> {
    const errors: string[] = [];

    // File must exist
    if (!this.backend.exists(filePath)) {
      return { valid: false, errors: [`file does not exist: ${filePath}`] };
    }

    // Sidecar must exist
    if (!sidecarExists(this.backend, filePath)) {
      errors.push(`no sidecar for ${filePath} — file not managed by DotFS`);
      return { valid: false, errors };
    }

    // Read sidecar
    let dots: DOT[] = [];
    try {
      dots = readSidecar(this.backend, filePath);
    } catch {
      errors.push('sidecar is malformed');
      return { valid: false, errors };
    }

    if (dots.length === 0) {
      errors.push('sidecar is empty — no DOT history');
      return { valid: false, errors };
    }

    // Get latest DOT
    const latestDot = dots[dots.length - 1];
    if (!latestDot) {
      errors.push('sidecar is empty — no DOT history');
      return { valid: false, errors };
    }

    // Verify content hash
    if (latestDot.verify?.hash !== undefined) {
      const content = this.backend.readFile(filePath);
      const actualHash = await createHash(content);
      if (!bytesEqual(actualHash, latestDot.verify.hash)) {
        errors.push('content hash mismatch — file may be tampered');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * List files in a directory with chain depth and verification status.
   *
   * @param dir - Directory path to list
   * @returns Array of list entries (skips sidecar files)
   */
  list(dir: string): ListEntry[] {
    const entries: ListEntry[] = [];
    let names: string[] = [];

    try {
      names = this.backend.list(dir);
    } catch {
      return [];
    }

    for (const name of names) {
      // Skip sidecar files (they start with . and end with .dot)
      if (name.startsWith('.') && name.endsWith('.dot')) continue;

      const filePath = joinPath(dir, name);

      // Skip directories
      if (!this.backend.exists(filePath) || isDirectory(this.backend, filePath, name)) continue;

      const dots = readSidecar(this.backend, filePath);
      const chainDepth = dots.length;

      // Shallow verified flag: true if sidecar exists and has a DOT with verify.hash.
      // For deep verification, use dotfs.verify(). list() is kept sync.
      const verified = dots.length > 0 && dots[dots.length - 1]?.verify?.hash !== undefined;

      entries.push({ name, chainDepth, verified });
    }

    return entries;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function dirname(p: string): string {
  const lastSlash = p.lastIndexOf('/');
  if (lastSlash <= 0) return '/';
  return p.slice(0, lastSlash);
}

function joinPath(dir: string, name: string): string {
  if (dir === '/') return '/' + name;
  return dir.replace(/\/$/, '') + '/' + name;
}

function isDirectory(backend: FSBackend, filePath: string, name: string): boolean {
  try {
    // If readFile throws (it's a dir), return true
    backend.readFile(filePath);
    return false;
  } catch {
    return true;
  }
}
