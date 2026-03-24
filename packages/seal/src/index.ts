/**
 * @dot-protocol/seal — DOT-SEAL: chain-depth trust replaces TLS.
 *
 * DOT-SEAL replaces Certificate Authorities with chain-depth trust.
 * Trust is computed from: how long an identity has been signing DOTs
 * consistently, how many peers have attested to them, and chain depth.
 *
 * R854: X25519 key exchange → session key → SecureChannel (XSalsa20-Poly1305)
 */

// Trust assessment
export { assessTrust, assessTrustQuick } from './trust.js';
export type { TrustScore } from './trust.js';

// X25519 key exchange
export { generateEphemeralKeypair, computeSharedSecret, deriveSessionKey } from './x25519.js';
export type { EphemeralKeypair } from './x25519.js';

// Handshake protocol
export { DOTSealHandshake } from './handshake.js';
export type { HandshakeMessage, HandshakeResult, CompletedHandshake } from './handshake.js';

// Encrypted channel
export { SecureChannel, createSecureChannel } from './channel.js';
export type { EncryptedDOT } from './channel.js';

// Session management
export { createSession } from './session.js';
export type { Session, ActiveSession } from './session.js';
