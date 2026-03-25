/**
 * room-chain.ts — .the.first.room as a DOT chain.
 *
 * The room IS the chain. Every observation, join event, and seed
 * is a DOT appended to a single causal chain. The room has its own
 * Ed25519 identity used to co-sign genesis and join events.
 */

import {
  observe,
  sign,
  computeTrust,
  createIdentity,
  hash,
  bufToHex as coreBufToHex,
} from '@dot-protocol/core';
import type { DOT, Identity } from '@dot-protocol/core';
import {
  createChain,
  append,
  walk,
  verify_chain,
  dotHashToHex,
  bufToHex,
  MemoryStorage,
} from '@dot-protocol/chain';
import type { Chain } from '@dot-protocol/chain';

export { bufToHex };

/** A member of .the.first.room. */
export interface RoomMember {
  name: string;
  publicKey: Uint8Array;
  joinedAt: number;
}

/** The first room — a DOT chain with identity and members. */
export interface FirstRoom {
  /** Always ".the.first.room" */
  name: string;
  /** The causal chain backing the room. */
  chain: Chain;
  /** Room's own Ed25519 identity (signs genesis and join events). */
  identity: Identity;
  /** Members who have joined, keyed by their public key hex. */
  members: Map<string, RoomMember>;
  /** Total DOT count (same as chain.appendCount). */
  dotCount: number;
  /** Unix ms when the room was created. */
  createdAt: number;
}

/** A single entry in the visible chain view. */
export interface ChainEntry {
  /** Hex-encoded BLAKE3 hash (64 chars). */
  hash: string;
  /** Decoded text content of the DOT. */
  content: string;
  /** First 8 chars of the observer's public key hex. */
  observer: string;
  /** Unix ms timestamp of the DOT. */
  timestamp: number;
  /** Depth in the causal chain. */
  depth: number;
  /** DOT type (event, claim, bond, state, measure). */
  type: string;
  /** Whether this DOT's chain linkage is cryptographically verified. */
  verified: boolean;
  /** Computed trust score 0.0–3.0+. */
  trust: number;
}

/**
 * Creates .the.first.room with a genesis DOT.
 *
 * Steps:
 * 1. Generate Ed25519 identity for the room
 * 2. Create a MemoryStorage-backed chain
 * 3. Append the genesis DOT: "The first room. Where observation begins."
 */
export async function createFirstRoom(): Promise<FirstRoom> {
  const identity = await createIdentity();
  const storage = new MemoryStorage();
  let chain = createChain(storage, 'first-room');
  const createdAt = Date.now();

  // Genesis DOT — unsigned observe + sign with room identity
  const genesis = observe('The first room. Where observation begins.', {
    plaintext: true,
    type: 'event',
  });
  const genesisSigned = await sign(genesis, identity.secretKey);

  // Add timestamp
  const genesisWithTime: DOT = {
    ...genesisSigned,
    time: { utc: createdAt, monotonic: 0 },
    type: 'event',
  };

  chain = append(chain, genesisWithTime);

  const room: FirstRoom = {
    name: '.the.first.room',
    chain,
    identity,
    members: new Map(),
    dotCount: chain.appendCount,
    createdAt,
  };

  return room;
}

/**
 * Add an observation DOT to the room chain.
 *
 * The observer signs the DOT with their own identity.
 */
export async function addObservation(
  room: FirstRoom,
  content: string,
  observer: Identity,
): Promise<DOT> {
  const unsigned = observe(content, { plaintext: true, type: 'claim' });
  const signed = await sign(unsigned, observer.secretKey);

  const withTime: DOT = {
    ...signed,
    time: { utc: Date.now(), monotonic: room.chain.appendCount },
    type: 'claim',
  };

  room.chain = append(room.chain, withTime);
  room.dotCount = room.chain.appendCount;

  // Return the last appended DOT (from chain tip)
  return withTime;
}

/**
 * Add a member join DOT to the room chain.
 *
 * Creates a signed event DOT using the member's identity, registers them
 * in the room's member map.
 */
export async function addMember(
  room: FirstRoom,
  name: string,
  identity: Identity,
): Promise<DOT> {
  const joinedAt = Date.now();

  const unsigned = observe(`${name} joined`, { plaintext: true, type: 'event' });
  const signed = await sign(unsigned, identity.secretKey);

  const withTime: DOT = {
    ...signed,
    time: { utc: joinedAt, monotonic: room.chain.appendCount },
    type: 'event',
  };

  room.chain = append(room.chain, withTime);
  room.dotCount = room.chain.appendCount;

  const pkHex = bufToHex(identity.publicKey);
  room.members.set(pkHex, { name, publicKey: identity.publicKey, joinedAt });

  return withTime;
}

/**
 * Returns all DOTs in the chain as ChainEntry objects, oldest-first.
 */
export function getChainView(room: FirstRoom): ChainEntry[] {
  const dots = walk(room.chain);
  const verifyResult = verify_chain(room.chain);
  const verified = verifyResult.valid;

  return dots.map((dot) => {
    const h = dotHashToHex(dot);
    const content = decodePayload(dot);
    const observerHex = dot.sign?.observer ? bufToHex(dot.sign.observer) : '00000000';
    const observer = observerHex.slice(0, 8);
    const timestamp = dot.time?.utc ?? 0;
    const depth = dot.chain?.depth ?? 0;
    const type = dot.type ?? 'claim';
    const trust = computeTrust(dot);

    return {
      hash: h,
      content,
      observer,
      timestamp,
      depth,
      type,
      verified,
      trust,
    };
  });
}

/** Decode a DOT's payload to a human-readable string. */
export function decodePayload(dot: DOT): string {
  if (!dot.payload || dot.payload.length === 0) return '(empty)';
  try {
    return new TextDecoder().decode(dot.payload);
  } catch {
    return `(binary: ${dot.payload.length} bytes)`;
  }
}
