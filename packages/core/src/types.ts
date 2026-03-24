/**
 * Core type definitions for DOT Protocol R854.
 *
 * DOT is 0 bytes conceptually — the contact itself. When encoded, overhead is <256 bytes.
 * ALL STCV bases are OPTIONAL per Correction #47 (graceful degradation).
 * Every DOT is valid at every level of completeness: {} is a valid DOT.
 */

/** The five fundamental observation types a DOT can carry. */
export type ObservationType = 'measure' | 'state' | 'event' | 'claim' | 'bond';

/** How the payload is encoded/encrypted. FHE is the default when payload is present. */
export type PayloadMode = 'fhe' | 'plain' | 'none';

/**
 * Identity disclosure level of the observer.
 * Controls how much identity information is revealed in the sign base.
 */
export type IdentityLevel = 'absent' | 'ephemeral' | 'anonymous' | 'pseudonymous' | 'real';

/**
 * The DOT — a single unit of observation.
 *
 * All fields are optional per R854 Correction #47 (graceful degradation).
 * An empty object `{}` is a valid, minimal DOT at level 0.
 */
export interface DOT {
  /** Payload bytes — FHE-encrypted by default when present. */
  payload?: Uint8Array;
  /**
   * Payload encoding mode.
   * Defaults to 'fhe' when payload is present, 'none' when absent.
   */
  payload_mode?: PayloadMode;
  /** Observation type classification. */
  type?: ObservationType;

  // --- STCV bases (Sign, Time, Chain, Verify) — ALL OPTIONAL ---

  /**
   * S: Sign base — observer identity and signature.
   * Omitting this produces an unsigned DOT, which is still valid.
   */
  sign?: {
    /** Ed25519 public key of the observer (32 bytes). */
    observer?: Uint8Array;
    /** Ed25519 signature over the canonical signed bytes (64 bytes). */
    signature?: Uint8Array;
    /** Identity disclosure level. */
    level?: IdentityLevel;
  };

  /**
   * T: Time base — temporal anchoring.
   * Both fields are optional; partial time is valid.
   */
  time?: {
    /** Unix timestamp in milliseconds (UTC). */
    utc?: number;
    /** Per-observer monotonic counter for ordering within a session. */
    monotonic?: number;
  };

  /**
   * C: Chain base — causal linkage to a previous DOT.
   * Omitting this produces a genesis DOT.
   */
  chain?: {
    /** BLAKE3 hash of the previous DOT (32 bytes). Genesis: 32 zero bytes. */
    previous?: Uint8Array;
    /** Depth in the causal chain (0 = genesis). */
    depth?: number;
  };

  /**
   * V: Verify base — content integrity hash.
   * Enables independent payload verification without decryption.
   */
  verify?: {
    /** BLAKE3 hash of the payload bytes (32 bytes). */
    hash?: Uint8Array;
  };

  /** FHE metadata for selective decryption by authorized recipients. */
  fhe?: {
    /** FHE scheme identifier. Currently only 'tfhe' is supported. */
    scheme?: 'tfhe';
    /** Hash of the evaluation key used for this encryption (32 bytes). */
    eval_key_hash?: Uint8Array;
    /** Public keys of entities authorized to decrypt this payload. */
    decryptable_by?: Uint8Array[];
  };

  /**
   * Meta-observation: self-awareness fields.
   * A DOT describing its own creation context.
   */
  _meta?: {
    /** Monotonic timestamp (performance.now() ms) when this DOT was created. */
    created_at?: number;
    /** Time taken to produce this DOT, in microseconds. */
    duration_us?: number;
    /** Completeness level 0–6 computed from which STCV bases are present. */
    level?: DOTLevel;
  };
}

/**
 * An unsigned DOT — before the sign base is populated.
 * The sign field may carry identity info (observer, level) but has no signature yet.
 */
export interface UnsignedDOT extends Omit<DOT, 'sign'> {
  sign?: {
    /** Ed25519 public key — may be present before signing for identity declaration. */
    observer?: Uint8Array;
    /** Identity disclosure level. */
    level?: IdentityLevel;
    // No signature field — this is the distinguishing constraint of UnsignedDOT
  };
}

/**
 * DOT completeness levels 0–6.
 * Higher levels indicate more STCV bases present and higher inherent trust.
 */
export enum DOTLevel {
  /** Level 0: No bases present. Valid empty observation. */
  Empty = 0,
  /** Level 1: Payload present (with or without encryption mode). */
  Payload = 1,
  /** Level 2: Time base present. */
  Timed = 2,
  /** Level 3: Verify base present. */
  Verified = 3,
  /** Level 4: Sign base with signature present. */
  Signed = 4,
  /** Level 5: Chain base present. */
  Chained = 5,
  /** Level 6: All STCV bases present. */
  Full = 6,
}

/**
 * Computes the completeness level of a DOT based on which STCV bases are present.
 *
 * @param dot - The DOT to evaluate
 * @returns A DOTLevel value 0–6
 */
export function computeLevel(dot: DOT | UnsignedDOT): DOTLevel {
  let score = 0;

  // Payload presence
  if (dot.payload !== undefined && dot.payload.length > 0) score++;

  // Time base
  if (dot.time !== undefined && (dot.time.utc !== undefined || dot.time.monotonic !== undefined)) {
    score++;
  }

  // Verify base
  if (dot.verify?.hash !== undefined) score++;

  // Sign base with actual signature
  if ((dot as DOT).sign?.signature !== undefined) score++;

  // Chain base
  if (dot.chain?.previous !== undefined) score++;

  // All STCV bases present — full DOT
  const d = dot as DOT;
  if (
    d.sign?.signature !== undefined &&
    d.time !== undefined &&
    d.chain !== undefined &&
    d.verify !== undefined &&
    d.payload !== undefined
  ) {
    return DOTLevel.Full;
  }

  return Math.min(score, DOTLevel.Full) as DOTLevel;
}
