/**
 * handshake.ts — DOT-SEAL mutual authentication protocol.
 *
 * DOT-SEAL handshake protocol:
 *   1. Initiator sends: identity DOT + chain depth + trust proof + ephemeral pubkey
 *   2. Responder verifies, sends back own identity DOT + ephemeral pubkey
 *   3. Both compute X25519 shared secret → derive session key → SecureChannel
 *
 * Trust proof: the identity's chain depth, signed with their Ed25519 key.
 * Replay protection: timestamp in HandshakeMessage (reject if stale > 30s).
 */

import { getSodium } from '../../core/src/crypto/sodium-init.js';
import { observe, sign, verify, toBytes, chain as coreChain } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import type { Chain } from '@dot-protocol/chain';
import { depth as chainDepthFn } from '@dot-protocol/chain';
import { assessTrust, assessTrustQuick } from './trust.js';
import type { TrustScore } from './trust.js';
import { generateEphemeralKeypair, computeSharedSecret, deriveSessionKey } from './x25519.js';
import type { EphemeralKeypair } from './x25519.js';
import { SecureChannel } from './channel.js';

/** Maximum age of a HandshakeMessage before it is rejected as stale (30 seconds). */
const HANDSHAKE_TIMEOUT_MS = 30_000;

/** Message sent by the initiator to start a DOT-SEAL handshake. */
export interface HandshakeMessage {
  /** A DOT signed by the initiator establishing identity. */
  identityDOT: DOT;
  /** Depth of the initiator's chain (claimed — verified by responder). */
  chainDepth: number;
  /**
   * Trust proof: Ed25519 signature over (chainDepth as 4-byte BE || timestamp as 8-byte BE).
   * Signed with the same key as identityDOT.sign.observer.
   */
  trustProof: Uint8Array;
  /** 32-byte ephemeral X25519 public key for this handshake. */
  ephemeralPubKey: Uint8Array;
  /** Unix timestamp (ms) when this message was created. Used for replay detection. */
  timestamp: number;
}

/** Result of a successful respond() call. */
export interface HandshakeResult {
  /** The encrypted channel ready for use. */
  channel: SecureChannel;
  /** Trust score computed for the remote peer. */
  peerTrust: TrustScore;
  /** Our own trust score as computed from our chain. */
  myTrust: TrustScore;
  /** The responder's reply message (to be sent to the initiator). */
  replyMessage: HandshakeMessage;
}

/** Result of a successful complete() call (initiator side). */
export interface CompletedHandshake {
  /** The encrypted channel ready for use. */
  channel: SecureChannel;
  /** Trust score computed for the remote peer. */
  peerTrust: TrustScore;
  /** Our own trust score. */
  myTrust: TrustScore;
}

/**
 * DOTSealHandshake — implements the DOT-SEAL mutual authentication protocol.
 *
 * Usage:
 *   Initiator:
 *     const hs = new DOTSealHandshake();
 *     const msg = await hs.initiate(myIdentity, myChain, peerPubKey);
 *     // send msg to peer ...
 *     const result = await hs.complete(peerReply);
 *
 *   Responder:
 *     const hs = new DOTSealHandshake();
 *     const result = await hs.respond(initiatorMsg, myIdentity, myChain);
 *     // send result.replyMessage to initiator ...
 *     // use result.channel
 */
export class DOTSealHandshake {
  private ephemeralKeypair: EphemeralKeypair | null = null;
  private mySecretKey: Uint8Array | null = null;
  private myPublicKey: Uint8Array | null = null;
  private myChain: Chain | null = null;
  private _used = false;

  /**
   * Create the initiator's HandshakeMessage.
   *
   * Generates an ephemeral X25519 keypair for this handshake, builds an
   * identity DOT signed with mySecretKey, and signs a trust proof.
   *
   * @param mySecretKey  - 32-byte Ed25519 secret key (from createIdentity())
   * @param myChain      - The caller's DOT chain (for trust computation)
   * @param peerPublicKey - Peer's long-term Ed25519 public key (for future use)
   * @returns HandshakeMessage to send to the responder
   */
  async initiate(
    mySecretKey: Uint8Array,
    myChain: Chain,
    peerPublicKey: Uint8Array,
  ): Promise<HandshakeMessage> {
    if (this._used) {
      throw new Error('DOTSealHandshake: already used — create a new instance per handshake');
    }
    // Suppress unused variable warning
    void peerPublicKey;

    this.mySecretKey = mySecretKey;
    this.myChain = myChain;

    // Derive public key from secret key
    const sodium = await getSodium();
    this.myPublicKey = sodium.crypto_sign_ed25519_sk_to_pk(
      expandSecretKey(mySecretKey, sodium),
    );

    // Generate ephemeral X25519 keypair
    this.ephemeralKeypair = await generateEphemeralKeypair();

    // Build identity DOT
    const depth = chainDepthFn(myChain);
    const timestamp = Date.now();
    const identityDOT = await buildIdentityDOT(mySecretKey, this.myPublicKey, depth, timestamp, sodium);

    // Build trust proof: sign(chainDepth BE-4 || timestamp BE-8)
    const trustProof = await buildTrustProof(mySecretKey, depth, timestamp, sodium);

    return {
      identityDOT,
      chainDepth: depth,
      trustProof,
      ephemeralPubKey: this.ephemeralKeypair.publicKey,
      timestamp,
    };
  }

  /**
   * Respond to an initiator's HandshakeMessage.
   *
   * Verifies the initiator's identity DOT and trust proof, builds our own
   * identity message, computes the shared secret, and returns a ready channel.
   *
   * @param peerMessage  - HandshakeMessage from the initiator
   * @param mySecretKey  - Our 32-byte Ed25519 secret key
   * @param myChain      - Our DOT chain
   * @returns HandshakeResult with channel, trust scores, and our replyMessage
   */
  async respond(
    peerMessage: HandshakeMessage,
    mySecretKey: Uint8Array,
    myChain: Chain,
  ): Promise<HandshakeResult> {
    // Verify timestamp freshness (replay protection)
    const age = Date.now() - peerMessage.timestamp;
    if (age > HANDSHAKE_TIMEOUT_MS || age < -HANDSHAKE_TIMEOUT_MS) {
      throw new Error(
        `DOTSealHandshake.respond: message is stale (age ${age}ms > ${HANDSHAKE_TIMEOUT_MS}ms)`,
      );
    }

    const sodium = await getSodium();
    const myPublicKey = sodium.crypto_sign_ed25519_sk_to_pk(
      expandSecretKey(mySecretKey, sodium),
    );

    // Extract peer's Ed25519 public key from their identity DOT
    const peerEdPubKey = peerMessage.identityDOT.sign?.observer;
    if (peerEdPubKey === undefined) {
      throw new Error('DOTSealHandshake.respond: peerMessage has no identity public key');
    }

    // Verify peer's trust proof
    const proofValid = await verifyTrustProof(
      peerEdPubKey,
      peerMessage.chainDepth,
      peerMessage.timestamp,
      peerMessage.trustProof,
      sodium,
    );
    if (!proofValid) {
      throw new Error('DOTSealHandshake.respond: trust proof verification failed');
    }

    // Compute peer trust (quick mode — we don't have their chain, only claimed depth)
    const peerTrust = assessTrustQuick(peerEdPubKey, peerMessage.chainDepth, 0);

    // Compute our trust
    const myTrust = await assessTrust(myPublicKey, myChain);

    // Generate our ephemeral keypair
    const myEphemeral = await generateEphemeralKeypair();

    // X25519 shared secret
    const sharedSecret = await computeSharedSecret(
      myEphemeral.secretKey,
      peerMessage.ephemeralPubKey,
    );

    // Derive session key
    const sessionKey = await deriveSessionKey(sharedSecret, 'dot-seal');

    // Build our reply
    const myDepth = chainDepthFn(myChain);
    const timestamp = Date.now();
    const myIdentityDOT = await buildIdentityDOT(mySecretKey, myPublicKey, myDepth, timestamp, sodium);
    const myTrustProof = await buildTrustProof(mySecretKey, myDepth, timestamp, sodium);

    const replyMessage: HandshakeMessage = {
      identityDOT: myIdentityDOT,
      chainDepth: myDepth,
      trustProof: myTrustProof,
      ephemeralPubKey: myEphemeral.publicKey,
      timestamp,
    };

    const channel = new SecureChannel(sessionKey);

    return { channel, peerTrust, myTrust, replyMessage };
  }

  /**
   * Complete the handshake on the initiator's side after receiving the responder's reply.
   *
   * @param peerResponse - HandshakeMessage from the responder
   * @returns CompletedHandshake with channel and trust scores
   */
  async complete(peerResponse: HandshakeMessage): Promise<CompletedHandshake> {
    if (this.ephemeralKeypair === null || this.mySecretKey === null || this.myChain === null) {
      throw new Error(
        'DOTSealHandshake.complete: must call initiate() first',
      );
    }

    // Verify timestamp freshness
    const age = Date.now() - peerResponse.timestamp;
    if (age > HANDSHAKE_TIMEOUT_MS || age < -HANDSHAKE_TIMEOUT_MS) {
      throw new Error(
        `DOTSealHandshake.complete: response is stale (age ${age}ms > ${HANDSHAKE_TIMEOUT_MS}ms)`,
      );
    }

    const sodium = await getSodium();

    // Extract peer's Ed25519 public key
    const peerEdPubKey = peerResponse.identityDOT.sign?.observer;
    if (peerEdPubKey === undefined) {
      throw new Error('DOTSealHandshake.complete: peer response has no identity public key');
    }

    // Verify peer's trust proof
    const proofValid = await verifyTrustProof(
      peerEdPubKey,
      peerResponse.chainDepth,
      peerResponse.timestamp,
      peerResponse.trustProof,
      sodium,
    );
    if (!proofValid) {
      throw new Error('DOTSealHandshake.complete: peer trust proof verification failed');
    }

    // X25519 shared secret (we're the initiator, so we use our ephemeral secret)
    const sharedSecret = await computeSharedSecret(
      this.ephemeralKeypair.secretKey,
      peerResponse.ephemeralPubKey,
    );

    // Derive session key — same derivation as responder
    const sessionKey = await deriveSessionKey(sharedSecret, 'dot-seal');

    // Compute trust scores
    const myPublicKey = sodium.crypto_sign_ed25519_sk_to_pk(
      expandSecretKey(this.mySecretKey, sodium),
    );
    const peerTrust = assessTrustQuick(peerEdPubKey, peerResponse.chainDepth, 0);
    const myTrust = await assessTrust(myPublicKey, this.myChain);

    this._used = true;

    const channel = new SecureChannel(sessionKey);
    return { channel, peerTrust, myTrust };
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Build an identity DOT signed with the given key. */
async function buildIdentityDOT(
  secretKey: Uint8Array,
  publicKey: Uint8Array,
  depth: number,
  timestamp: number,
  sodium: Awaited<ReturnType<typeof getSodium>>,
): Promise<DOT> {
  const payload = new TextEncoder().encode(
    JSON.stringify({ type: 'seal-identity', depth, timestamp }),
  );
  const dot = observe(payload, { type: 'claim', plaintext: true });
  const withTime: DOT = {
    ...dot,
    time: { utc: timestamp },
    sign: { observer: publicKey, level: 'pseudonymous' },
  };

  // Sign the DOT bytes
  const dotBytes = toBytes(withTime);
  const expandedKey = expandSecretKey(secretKey, sodium);
  const signature = sodium.crypto_sign_detached(dotBytes, expandedKey);

  return {
    ...withTime,
    sign: {
      observer: publicKey,
      signature,
      level: 'pseudonymous',
    },
  };
}

/** Build trust proof bytes: sign(depth BE-4 || timestamp BE-8). */
async function buildTrustProof(
  secretKey: Uint8Array,
  depth: number,
  timestamp: number,
  sodium: Awaited<ReturnType<typeof getSodium>>,
): Promise<Uint8Array> {
  const msg = new Uint8Array(12);
  const view = new DataView(msg.buffer);
  view.setUint32(0, depth, false);
  view.setBigUint64(4, BigInt(timestamp), false);
  const expandedKey = expandSecretKey(secretKey, sodium);
  return sodium.crypto_sign_detached(msg, expandedKey);
}

/** Verify a trust proof. */
async function verifyTrustProof(
  publicKey: Uint8Array,
  depth: number,
  timestamp: number,
  proof: Uint8Array,
  sodium: Awaited<ReturnType<typeof getSodium>>,
): Promise<boolean> {
  const msg = new Uint8Array(12);
  const view = new DataView(msg.buffer);
  view.setUint32(0, depth, false);
  view.setBigUint64(4, BigInt(timestamp), false);
  try {
    return sodium.crypto_sign_verify_detached(proof, msg, publicKey);
  } catch {
    return false;
  }
}

/**
 * Expand a 32-byte @noble/ed25519 secret key to 64-byte libsodium format.
 *
 * @noble/ed25519 uses 32-byte private keys (seed only).
 * libsodium uses 64-byte keys (seed || public key).
 * We derive the 64-byte form by using crypto_sign_seed_keypair.
 */
type SodiumLike = {
  crypto_sign_seed_keypair(seed: Uint8Array): { publicKey: Uint8Array; privateKey: Uint8Array };
  crypto_sign_ed25519_sk_to_pk(sk: Uint8Array): Uint8Array;
  crypto_sign_detached(msg: Uint8Array | string, sk: Uint8Array): Uint8Array;
  crypto_sign_verify_detached(sig: Uint8Array, msg: Uint8Array | string, pk: Uint8Array): boolean;
};

function expandSecretKey(secretKey: Uint8Array, sodium: SodiumLike): Uint8Array {
  if (secretKey.length === 64) return secretKey;
  // 32-byte seed → derive 64-byte sodium key
  const kp = sodium.crypto_sign_seed_keypair(secretKey);
  return kp.privateKey;
}
