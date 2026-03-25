/**
 * types.ts — Room data model for @dot-protocol/room.
 *
 * A .room is a DOT chain. The chain IS the room.
 * Wherever the chain is replicated, the room exists.
 * No server owns it.
 */

import type { Chain } from '@dot-protocol/chain';

export interface Room {
  /** Room name, e.g. ".the.first.room", ".physics", ".mybakery" */
  name: string;
  /** From @dot-protocol/chain — the room IS its chain */
  chain: Chain;
  /** Room's own keypair (for Room AI signing) */
  identity: RoomIdentity;
  /** pubkey hex → member info */
  members: Map<string, RoomMember>;
  /** mind ID → mind info */
  minds: Map<string, Mind>;
  /** Current computed state */
  state: RoomState;
  config: RoomConfig;
}

export interface RoomMember {
  publicKey: Uint8Array;
  name?: string;
  /** Timestamp of join DOT */
  joinedAt: number;
  role: 'observer' | 'contributor' | 'mind' | 'governor';
  lastSeen?: number;
}

export interface Mind {
  id: string;
  name: string;
  /** Mind's signing key */
  publicKey: Uint8Array;
  /** e.g. "physics", "poetry" */
  domain: string;
  active: boolean;
}

export interface RoomState {
  dotCount: number;
  memberCount: number;
  mindCount: number;
  lastActivity: number;
  /** BLAKE3 hash of current state */
  stateHash: Uint8Array;
}

export interface RoomConfig {
  maxMembers?: number;
  maxMinds?: number;
  visibility: 'public' | 'private' | 'invite';
  computeBudget?: number;
}

/** DOT types specific to rooms */
export type RoomDOTType =
  | 'genesis'
  | 'observation'
  | 'correction'
  | 'state'
  | 'contact'
  | 'join'
  | 'leave'
  | 'mind_activate'
  | 'mind_response';

export interface RoomIdentity {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
  name: string;
}
