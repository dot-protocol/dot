/**
 * observe() — create a new unsigned DOT from any payload.
 *
 * R854.1: Payload is FHE-encrypted by DEFAULT. Plaintext is explicit opt-in.
 * R854.1: {} is a valid DOT — no payload is perfectly fine.
 */

import { type DOT, type UnsignedDOT, type ObservationType, computeLevel } from './types.js';

/** Options for creating a DOT observation. */
export interface ObserveOptions {
  /** Classification of this observation. */
  type?: ObservationType;
  /**
   * If true, store payload as plaintext.
   * Default: false — payload is marked as FHE-encrypted.
   * NOTE: Actual FHE encryption wiring is pending Agent 1's crypto implementation.
   *       For now, the mode is recorded and bytes are stored as-is.
   */
  plaintext?: boolean;
  /**
   * Public keys of recipients authorized to decrypt the FHE payload.
   * Populated into fhe.decryptable_by metadata.
   */
  share_with?: Uint8Array[];
}

/**
 * Creates a new unsigned DOT observation.
 *
 * @param payload - The value to observe. May be:
 *   - undefined/null → empty DOT (payload_mode = 'none')
 *   - string → encoded as UTF-8 bytes
 *   - Uint8Array → used directly
 *   - object → JSON-serialized then encoded as UTF-8 bytes
 * @param options - Observation options (type, encryption mode, recipients)
 * @returns An UnsignedDOT ready for signing or immediate use
 *
 * @example
 * // Empty DOT — valid per Correction #47
 * const empty = observe();
 *
 * @example
 * // FHE-encrypted string observation (default)
 * const dot = observe('temperature: 98.6', { type: 'measure' });
 *
 * @example
 * // Explicit plaintext
 * const plain = observe({ key: 'value' }, { plaintext: true });
 */
export function observe(payload?: unknown, options?: ObserveOptions): UnsignedDOT {
  const start = performance.now();

  const dot: UnsignedDOT = {};

  // Encode payload
  if (payload === undefined || payload === null) {
    // Empty DOT — valid per R854.1 Correction #47
    dot.payload_mode = 'none';
  } else {
    const encoded = encodePayload(payload);
    dot.payload = encoded;

    if (options?.plaintext === true) {
      dot.payload_mode = 'plain';
    } else {
      // FHE is the default — actual encryption wired in by crypto Agent
      // For now: mark mode and store encoded bytes unencrypted
      dot.payload_mode = 'fhe';

      // Record FHE metadata if recipients specified
      if (options?.share_with !== undefined && options.share_with.length > 0) {
        dot.fhe = {
          scheme: 'tfhe',
          decryptable_by: options.share_with,
        };
      }
    }
  }

  // Set observation type if provided
  if (options?.type !== undefined) {
    dot.type = options.type;
  }

  // Meta-observation: record creation timestamp
  const created_at = start;
  dot._meta = {
    created_at,
    level: computeLevel(dot),
  };

  return dot;
}

/**
 * Encodes an arbitrary payload value to Uint8Array.
 *
 * @param payload - Value to encode
 * @returns Encoded bytes
 */
function encodePayload(payload: unknown): Uint8Array {
  if (payload instanceof Uint8Array) {
    return payload;
  }
  if (typeof payload === 'string') {
    return new TextEncoder().encode(payload);
  }
  // Object, number, boolean, etc. → JSON
  return new TextEncoder().encode(JSON.stringify(payload));
}
