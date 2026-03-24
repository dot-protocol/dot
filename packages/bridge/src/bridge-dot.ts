/**
 * bridge-dot.ts — Creates the Bridge DOT that links v0.3.0 and R854 generations.
 *
 * The Bridge DOT is a bond-type R854 DOT that attests to the migration boundary.
 * It contains a JSON payload describing both the legacy chain root and the R854
 * chain root, signed with the bridge operator's key.
 *
 * This DOT is verifiable in R854's native verify() — it IS an R854 DOT.
 */

import { observe, sign } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';

/** Describes one side of the generation boundary. */
export interface ChainSideDescriptor {
  /** Hex-encoded root hash of this chain segment. */
  root: string;
  /** Number of DOTs in this chain segment. */
  depth: number;
  /** Hash algorithm used for chain linkage in this segment. */
  hash_algo: 'sha256' | 'blake3';
  /** Wire format identifier for DOTs in this segment. */
  format: 'v030-153byte' | 'r854-tlv';
}

/**
 * The Bridge DOT payload — attests to the migration boundary between generations.
 */
export interface BridgePayload {
  /** Descriptor for the v0.3.0 legacy chain segment. */
  ancestor: ChainSideDescriptor;
  /** Descriptor for the R854 chain segment. */
  descendant: ChainSideDescriptor;
  /**
   * Human-readable attestation string.
   * Records the protocol version transition.
   */
  attestation: string;
}

/**
 * Converts a Uint8Array to a lowercase hex string.
 *
 * @param bytes - Bytes to encode
 * @returns Hex string
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Creates the Bridge DOT — a bond-type R854 DOT that attests to the migration boundary.
 *
 * The Bridge DOT:
 * - Is type 'bond' (records a link between two chain generations)
 * - Has a plain-text JSON payload describing both chain roots
 * - Is signed with the provided R854 secret key
 * - Is verifiable via R854's native verify()
 *
 * @param legacyRoot - SHA-256 hash of the last v0.3.0 DOT (32 bytes)
 * @param legacyDepth - Number of DOTs in the legacy chain
 * @param r854Root - BLAKE3 hash of the first R854 DOT (32 bytes)
 * @param signingKey - 32-byte Ed25519 secret key for signing the bridge DOT
 * @returns Signed R854 bond DOT
 */
export async function createBridgeDOT(
  legacyRoot: Uint8Array,
  legacyDepth: number,
  r854Root: Uint8Array,
  signingKey: Uint8Array,
): Promise<DOT> {
  const payload: BridgePayload = {
    ancestor: {
      root: toHex(legacyRoot),
      depth: legacyDepth,
      hash_algo: 'sha256',
      format: 'v030-153byte',
    },
    descendant: {
      root: toHex(r854Root),
      depth: 0,
      hash_algo: 'blake3',
      format: 'r854-tlv',
    },
    attestation: 'v0.3.0 → R854 migration boundary. All legacy DOTs converted and verified.',
  };

  // Create an unsigned DOT with bond type and plaintext payload
  const unsigned = observe(payload, {
    type: 'bond',
    plaintext: true,
  });

  // Add chain base (genesis — bridge DOT starts its own chain)
  unsigned.chain = {
    previous: new Uint8Array(32), // 32 zero bytes = genesis sentinel
    depth: 0,
  };

  // Sign it — this produces a full R854 DOT verifiable by verify()
  const signed = await sign(unsigned, signingKey);

  return signed;
}
