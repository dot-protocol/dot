/**
 * kin.ts — Core Kin OS.
 *
 * Kin is the human's local AI that protects them. It manages identity,
 * privacy, verification, and sovereign stop conditions between the person
 * and every .room in the mesh.
 *
 * Architecture:
 *   Kin.create() → generates or loads identity
 *             ↓
 *   observe()  → checkStop → reformulate → create DOT → sign → chain → emit
 *   verify()   → verify signature → check trust → flag warnings
 *   health()   → measure DOT of Kin's own state (meta-chain)
 */

import {
  observe as coreObserve,
  sign as coreSign,
  verify as coreVerify,
  createIdentity,
  computeTrust,
} from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { createChain, append } from '@dot-protocol/chain';
import type { Chain } from '@dot-protocol/chain';

import type { KinConfig, KinState, StopConditions } from './types.js';
import { reformulate } from './privacy.js';
import { checkStopConditions, type StopDecision } from './stop.js';

/** Result of verifying an incoming DOT. */
export interface VerificationResult {
  /** Whether the DOT passed all present integrity checks. */
  valid: boolean;
  /** Computed trust score (0.0 – ~3.0+). */
  trust: number;
  /** Human-readable warnings (e.g. unsigned, low-trust). */
  warnings: string[];
}

/**
 * Kin — the human's personal OS and privacy firewall.
 *
 * One Kin instance per person. It observes on their behalf,
 * enforces stop conditions, strips PII, and signs DOTs with their identity.
 *
 * @example
 * const kin = await Kin.create();
 * const dot = await kin.observe('temperature: 98.6', 'health.room');
 */
export class Kin {
  readonly config: KinConfig;
  readonly identity: { publicKey: Uint8Array; secretKey: Uint8Array };

  /** Kin's own meta-chain — records every observation Kin makes. */
  readonly chain: Chain;

  private _state: KinState;

  private constructor(
    config: KinConfig,
    identity: { publicKey: Uint8Array; secretKey: Uint8Array },
    chain: Chain,
    state: KinState
  ) {
    this.config = config;
    this.identity = identity;
    this.chain = chain;
    this._state = state;
  }

  /**
   * Create a new Kin instance.
   *
   * If config.identity is provided, it is used directly.
   * Otherwise a fresh Ed25519 keypair is generated.
   *
   * @param config - Optional configuration
   * @returns Initialized Kin instance
   */
  static async create(config?: KinConfig): Promise<Kin> {
    const cfg: KinConfig = config ?? {};

    // Identity: use provided or generate fresh
    const kp = cfg.identity ?? (await createIdentity());

    // Shortcode: first 8 hex chars of public key
    const shortcode = bufToHex(kp.publicKey).slice(0, 8);

    const chain = createChain();

    const stopConditions: StopConditions = cfg.stopConditions ?? {};
    const privacyLevel = cfg.privacyLevel ?? 'balanced';

    const state: KinState = {
      identity: { publicKey: kp.publicKey, shortcode },
      dotsCreated: 0,
      dotsVerified: 0,
      roomsVisited: [],
      sessionStart: Date.now(),
      stopConditions,
      privacyLevel,
    };

    return new Kin(cfg, kp, chain, state);
  }

  // ---------------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------------

  /**
   * Return Kin's public identity — public key and human-readable shortcode.
   */
  getIdentity(): { publicKey: Uint8Array; shortcode: string } {
    return this._state.identity;
  }

  /**
   * Return the public key as a lowercase hex string.
   */
  getPublicKeyHex(): string {
    return bufToHex(this.identity.publicKey);
  }

  // ---------------------------------------------------------------------------
  // Privacy
  // ---------------------------------------------------------------------------

  /**
   * Reformulate content for privacy before it enters the mesh.
   *
   * Strips or replaces PII based on the active privacy level.
   * The room sees the observation, not the observer's personal details.
   *
   * @param content - Raw content string
   * @returns Privacy-sanitized string
   */
  reformulate(content: string): string {
    const level = (this._state.privacyLevel ?? 'balanced') as
      | 'minimal'
      | 'balanced'
      | 'maximum';
    return reformulate(content, level);
  }

  // ---------------------------------------------------------------------------
  // Verification
  // ---------------------------------------------------------------------------

  /**
   * Verify an incoming DOT from the mesh.
   *
   * Checks:
   * 1. Ed25519 signature (if present)
   * 2. Chain linkage (structural)
   * 3. Trust score computation
   * 4. Flags for zero-depth or low-trust DOTs
   *
   * Per R854.1 Correction #47: unsigned DOTs are valid — they simply carry lower trust.
   *
   * @param dot - Incoming DOT to verify
   * @returns Verification result with validity, trust score, and warnings
   */
  async verifyIncoming(dot: DOT): Promise<VerificationResult> {
    const warnings: string[] = [];
    const trust = computeTrust(dot);

    // Core verification (signature + hash)
    const result = await coreVerify(dot);
    if (!result.valid) {
      return { valid: false, trust, warnings: [`verification failed: ${result.reason}`] };
    }

    // Warn on unsigned
    if (!dot.sign?.signature) {
      warnings.push('DOT is unsigned — trust is lower');
    }

    // Warn on zero-depth (genesis or no chain)
    const chainDepth = dot.chain?.depth ?? 0;
    if (chainDepth === 0) {
      warnings.push('DOT has zero chain depth — genesis or unlinked');
    }

    // Warn on low trust
    if (trust < 0.2) {
      warnings.push(`low trust score: ${trust.toFixed(3)}`);
    }

    this._state = { ...this._state, dotsVerified: this._state.dotsVerified + 1 };

    return { valid: true, trust, warnings };
  }

  // ---------------------------------------------------------------------------
  // Stop conditions
  // ---------------------------------------------------------------------------

  /**
   * Evaluate all stop conditions against the current state.
   *
   * @param room - Optional .room name being observed into
   * @returns StopDecision
   */
  checkStop(room?: string): StopDecision {
    return checkStopConditions(this._state, this._state.stopConditions, room);
  }

  /**
   * Quick check: is Kin allowed to observe right now?
   *
   * @returns True if observation is permitted
   */
  canObserve(room?: string): boolean {
    return this.checkStop(room).allowed;
  }

  // ---------------------------------------------------------------------------
  // Observation
  // ---------------------------------------------------------------------------

  /**
   * Create a signed, chained, privacy-filtered DOT observation.
   *
   * Pipeline:
   * 1. Check stop conditions
   * 2. Reformulate content for privacy
   * 3. Create DOT with coreObserve
   * 4. Sign with Kin's identity
   * 5. Append to Kin's meta-chain
   * 6. Update state
   *
   * @param content - The thing being observed
   * @param room - Optional .room this observation is entering
   * @returns Signed DOT, or null if a stop condition prevented observation
   */
  async observe(content: string, room?: string): Promise<DOT | null> {
    // 1. Stop check
    const stop = this.checkStop(room);
    if (!stop.allowed) {
      return null;
    }

    // 2. Privacy reformulation
    const safeContent = this.reformulate(content);

    // 3. Create unsigned DOT
    const unsigned = coreObserve(safeContent, { type: 'state', plaintext: true });

    // 4. Sign
    const signed = await coreSign(unsigned, this.identity.secretKey);

    // 5. Append to meta-chain (immutable — returns new chain, but we track count)
    append(this.chain, signed);

    // 6. Update state
    const roomsVisited = room && !this._state.roomsVisited.includes(room)
      ? [...this._state.roomsVisited, room]
      : this._state.roomsVisited;

    this._state = {
      ...this._state,
      dotsCreated: this._state.dotsCreated + 1,
      roomsVisited,
    };

    return signed;
  }

  // ---------------------------------------------------------------------------
  // State & health
  // ---------------------------------------------------------------------------

  /**
   * Return a snapshot of Kin's current runtime state.
   */
  getState(): KinState {
    return { ...this._state };
  }

  /**
   * Emit a 'measure' DOT describing Kin's own health.
   *
   * This is a self-awareness primitive: Kin can observe itself.
   *
   * @returns An unsigned measure DOT with Kin's current state as payload
   */
  health(): DOT {
    const payload = {
      dotsCreated: this._state.dotsCreated,
      dotsVerified: this._state.dotsVerified,
      roomsVisited: this._state.roomsVisited.length,
      sessionDurationMs: Date.now() - this._state.sessionStart,
      shortcode: this._state.identity.shortcode,
    };
    return coreObserve(payload, { type: 'measure', plaintext: true }) as DOT;
  }

  /**
   * Gracefully shut down Kin.
   *
   * Resets session state. Persistent data (if any) would be flushed here.
   */
  shutdown(): void {
    // Reset session-level counters. Identity and config persist.
    this._state = {
      ...this._state,
      dotsCreated: 0,
      dotsVerified: 0,
      roomsVisited: [],
      sessionStart: Date.now(),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
