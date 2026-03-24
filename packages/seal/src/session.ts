/**
 * session.ts — DOT-SEAL session as a DOT chain.
 *
 * Every DOT-SEAL session is itself a causal chain. Each sent/received
 * message produces a DOT that extends the session chain, creating a
 * tamper-evident audit log of the session.
 *
 * Session lifecycle DOTs:
 *   - Start DOT: 'event' type, records session creation
 *   - Message DOTs: 'measure' type, records message count and direction
 *   - Health DOT: 'measure' type, snapshots current session state
 *   - Close DOT: 'event' type, records session termination
 */

import { observe, chain as coreChain } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import type { SecureChannel } from './channel.js';

/** A live DOT-SEAL session. */
export interface Session {
  /** Unique session identifier. */
  readonly id: string;
  /** The start DOT (genesis of the session chain). */
  readonly startDOT: DOT;
  /** Current message count (sent + received). */
  readonly messageCount: number;
  /** Unix timestamp when the session started. */
  readonly startedAt: number;
  /** Unix timestamp of the last activity. */
  readonly lastActivity: number;
  /** Number of key rotations performed. */
  readonly keyRotations: number;
  /** Whether the session is still active. */
  readonly active: boolean;
}

/** Internal mutable session state. */
class SessionImpl implements Session {
  readonly id: string;
  readonly startDOT: DOT;
  private _messageCount: number;
  readonly startedAt: number;
  private _lastActivity: number;
  private _active: boolean;
  private _lastDOT: DOT;
  private _channel: SecureChannel;
  private _identity: Uint8Array;

  constructor(
    id: string,
    startDOT: DOT,
    channel: SecureChannel,
    identity: Uint8Array,
  ) {
    this.id = id;
    this.startDOT = startDOT;
    this._messageCount = 0;
    this.startedAt = Date.now();
    this._lastActivity = this.startedAt;
    this._active = true;
    this._lastDOT = startDOT;
    this._channel = channel;
    this._identity = identity;
  }

  get messageCount(): number {
    return this._messageCount;
  }

  get lastActivity(): number {
    return this._lastActivity;
  }

  get keyRotations(): number {
    return this._channel.keyRotations;
  }

  get active(): boolean {
    return this._active;
  }

  /** Record a message event on the session chain. */
  recordMessage(direction: 'sent' | 'received'): DOT {
    this._messageCount++;
    this._lastActivity = Date.now();

    const msgDot = observe(
      { type: 'session-message', direction, seq: this._messageCount },
      { type: 'measure', plaintext: true },
    );

    const withTime: DOT = {
      ...msgDot,
      time: { utc: this._lastActivity },
      sign: { observer: this._identity, level: 'ephemeral' },
    };

    const chained = coreChain(withTime, this._lastDOT);
    this._lastDOT = chained;
    return chained;
  }

  /** Return a health snapshot DOT. */
  sessionHealth(): DOT {
    const now = Date.now();
    const durationMs = now - this.startedAt;

    const healthDot = observe(
      {
        type: 'session-health',
        messageCount: this._messageCount,
        durationMs,
        keyRotations: this.keyRotations,
        active: this._active,
      },
      { type: 'measure', plaintext: true },
    );

    return {
      ...healthDot,
      time: { utc: now },
      sign: { observer: this._identity, level: 'ephemeral' },
    };
  }

  /** Close the session and produce a close DOT. */
  close(): DOT {
    this._active = false;
    this._lastActivity = Date.now();
    const durationMs = this._lastActivity - this.startedAt;

    const closeDot = observe(
      {
        type: 'session-close',
        messageCount: this._messageCount,
        durationMs,
        keyRotations: this.keyRotations,
      },
      { type: 'event', plaintext: true },
    );

    const withTime: DOT = {
      ...closeDot,
      time: { utc: this._lastActivity },
      sign: { observer: this._identity, level: 'ephemeral' },
    };

    const chained = coreChain(withTime, this._lastDOT);
    this._lastDOT = chained;
    return chained;
  }
}

/**
 * Create a new DOT-SEAL session backed by a secure channel.
 *
 * Produces a start DOT (genesis of the session chain) that records
 * the session ID and creation timestamp.
 *
 * @param channel    - SecureChannel from a completed handshake
 * @param myIdentity - 32-byte Ed25519 public key of the local identity
 * @returns Session with a start DOT in the chain
 */
export function createSession(
  channel: SecureChannel,
  myIdentity: Uint8Array,
): SessionImpl {
  const id = generateSessionId();
  const now = Date.now();

  // Genesis DOT for this session
  const startObserved = observe(
    { type: 'session-start', sessionId: id, startedAt: now },
    { type: 'event', plaintext: true },
  );

  const startDOT: DOT = {
    ...startObserved,
    time: { utc: now },
    sign: { observer: myIdentity, level: 'ephemeral' },
    chain: { previous: new Uint8Array(32), depth: 0 }, // genesis
  };

  return new SessionImpl(id, startDOT, channel, myIdentity);
}

/** Generate a random session ID. */
function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Buffer.from(bytes).toString('hex');
}

// Re-export SessionImpl as Session type for external use
export type { SessionImpl as ActiveSession };
