/**
 * types.ts — Kin type definitions.
 *
 * Kin is the human's local AI OS: identity manager, privacy firewall,
 * stop-condition enforcer, and observation layer between the person and the mesh.
 */

/** Configuration for creating a Kin instance. */
export interface KinConfig {
  /** Where Kin stores persistent data. Default: ~/.kin */
  dataDir?: string;
  /** Pre-existing Ed25519 keypair. If omitted, a new keypair is generated. */
  identity?: { publicKey: Uint8Array; secretKey: Uint8Array };
  /** Sovereign stop conditions. Unoverridable by any .room. */
  stopConditions?: StopConditions;
  /** Privacy level controlling how much PII is stripped from observations. */
  privacyLevel?: 'minimal' | 'balanced' | 'maximum';
}

/**
 * Sovereign stop conditions for Kin.
 *
 * These are enforced locally — no remote party can override them.
 * Any condition that is undefined means "no limit".
 */
export interface StopConditions {
  /** Maximum number of DOTs Kin will create per calendar day. Undefined = unlimited. */
  maxDailyDots?: number;
  /** Maximum session length in minutes before Kin stops observing. Undefined = unlimited. */
  maxSessionMinutes?: number;
  /** Content filter level applied to outgoing observations. Default: 'none'. */
  contentFilter?: 'none' | 'pg' | 'strict';
  /** .room names that Kin will never enter or observe into. */
  blockedRooms?: string[];
}

/** A snapshot of Kin's runtime state. */
export interface KinState {
  /** Kin's identity — public key + human-readable shortcode. */
  identity: { publicKey: Uint8Array; shortcode: string };
  /** Total DOTs created this session. */
  dotsCreated: number;
  /** Total DOTs verified this session. */
  dotsVerified: number;
  /** .room names visited this session. */
  roomsVisited: string[];
  /** Unix timestamp (ms) when this session began. */
  sessionStart: number;
  /** Active stop conditions. */
  stopConditions: StopConditions;
  /** Active privacy level. */
  privacyLevel: string;
}
