/**
 * batch.ts — Fault-tolerant bulk conversion of v0.3.0 DOTs to R854.
 *
 * Converts an ordered array of LegacyDOTs, collecting errors per-index rather than
 * throwing on first failure. Always produces a Bridge DOT at the end.
 */

import { createIdentity } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { type LegacyDOT } from './reader.js';
import { convertDOT } from './converter.js';
import { createBridgeDOT } from './bridge-dot.js';

/** Options for batchConvert. */
export interface BatchConvertOptions {
  /**
   * Progress callback. Called after each DOT is processed with percentage (0–100).
   * Percentage is computed as Math.round((i + 1) / total * 100).
   */
  onProgress?: (pct: number) => void;
  /**
   * Secret key for signing the Bridge DOT.
   * If not provided, a fresh ephemeral identity is generated.
   */
  bridgeSigningKey?: Uint8Array;
}

/** Result of a batch conversion. */
export interface BatchConvertResult {
  /** Successfully converted R854 DOTs (in original order, skipping failed indices). */
  converted: DOT[];
  /** Per-index errors for DOTs that failed conversion. */
  errors: Array<{ index: number; error: string }>;
  /**
   * The Bridge DOT attesting to the migration boundary.
   * Always present, even if all conversions failed or input was empty.
   */
  bridgeDot: DOT;
}

/**
 * Converts an ordered array of v0.3.0 LegacyDOTs to R854 DOTs in bulk.
 *
 * Features:
 * - Fault-tolerant: errors are collected per-index, not thrown
 * - Progress callbacks: fires after each DOT with percentage 0–100
 * - Always produces a Bridge DOT linking the two generations
 * - Optionally uses a provided signing key; otherwise generates an ephemeral one
 *
 * @param dots - Ordered array of parsed LegacyDOTs (oldest first)
 * @param opts - Conversion options
 * @returns BatchConvertResult with converted DOTs, errors, and bridge DOT
 */
export async function batchConvert(
  dots: LegacyDOT[],
  opts: BatchConvertOptions = {},
): Promise<BatchConvertResult> {
  const converted: DOT[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  const total = dots.length;

  for (let i = 0; i < total; i++) {
    const dot = dots[i]!;
    try {
      const r854Dot = convertDOT(dot);
      converted.push(r854Dot);
    } catch (err) {
      errors.push({
        index: i,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Fire progress callback
    if (opts.onProgress !== undefined) {
      const pct = total > 0 ? Math.round(((i + 1) / total) * 100) : 100;
      opts.onProgress(pct);
    }
  }

  // Determine signing key for bridge DOT
  let signingKey: Uint8Array;
  if (opts.bridgeSigningKey !== undefined) {
    signingKey = opts.bridgeSigningKey;
  } else {
    const identity = await createIdentity();
    signingKey = identity.secretKey;
  }

  // Compute legacy root: SHA-256 of last DOT's raw bytes
  // For empty input, use 32 zero bytes
  const legacyRoot = new Uint8Array(32);
  if (dots.length > 0) {
    const lastDot = dots[dots.length - 1]!;
    // Import sha256 dynamically to avoid circular deps — use @noble/hashes
    const { sha256 } = await import('@noble/hashes/sha2');
    const hash = sha256(lastDot.raw);
    legacyRoot.set(hash);
  }

  // R854 root: use 32 zero bytes as placeholder (first R854 DOT hash not yet known)
  const r854Root = new Uint8Array(32);

  const bridgeDot = await createBridgeDOT(legacyRoot, dots.length, r854Root, signingKey);

  return { converted, errors, bridgeDot };
}
