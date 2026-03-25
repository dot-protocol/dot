/**
 * room.ts — Core room operations.
 *
 * A .room is a DOT chain. The chain IS the room.
 * Wherever the chain is replicated, the room exists. No server owns it.
 */

import { observe, sign, createIdentity, hash } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { createChain, append, walk, dotHashToHex, bufToHex } from '@dot-protocol/chain';
import type { Chain } from '@dot-protocol/chain';
import type { Room, RoomMember, RoomConfig, RoomState, RoomIdentity } from './types.js';
import { normalizeRoomName } from './namespace.js';

/** Default room config */
const DEFAULT_CONFIG: RoomConfig = {
  visibility: 'public',
};

/**
 * Compute a simple state hash from room contents.
 * Uses a deterministic encoding of member count, dot count, last activity.
 */
function computeStateHash(memberCount: number, dotCount: number, lastActivity: number): Uint8Array {
  const enc = new TextEncoder();
  const str = `${memberCount}:${dotCount}:${lastActivity}`;
  const raw = enc.encode(str);
  // Use core hash (BLAKE3) via a synthetic DOT
  const dot: DOT = { payload: raw, payload_mode: 'plain' };
  return hash(dot);
}

/**
 * Build RoomState from the current room chain and members.
 */
async function buildState(
  chain: Chain,
  members: Map<string, RoomMember>,
  minds: Map<string, unknown>,
  lastActivity: number,
): Promise<RoomState> {
  const dotCount = chain.appendCount;
  const memberCount = members.size;
  const mindCount = minds.size;
  const stateHash = computeStateHash(memberCount, dotCount, lastActivity);
  return { dotCount, memberCount, mindCount, lastActivity, stateHash };
}

/**
 * Create a new room.
 *
 * @param name - Room name (must start with ".")
 * @param creatorIdentity - Optional creator keypair; if provided, a join DOT is added
 * @param config - Optional room configuration
 */
export async function createRoom(
  name: string,
  creatorIdentity?: { publicKey: Uint8Array; secretKey: Uint8Array },
  config?: Partial<RoomConfig>,
): Promise<Room> {
  const normalizedName = normalizeRoomName(name);

  // Generate room identity (keypair)
  const roomIdentityBase = await createIdentity();
  const identity: RoomIdentity = {
    publicKey: roomIdentityBase.publicKey,
    secretKey: roomIdentityBase.secretKey,
    name: normalizedName,
  };

  // Create chain with MemoryStorage
  let chain = createChain();

  // Create genesis DOT — room's own key signs it
  const genesisDot = observe(
    { event: `Room ${normalizedName} created` },
    { type: 'claim', plaintext: true },
  );
  const signedGenesis = await sign(genesisDot, identity.secretKey);
  chain = append(chain, signedGenesis);

  const members = new Map<string, RoomMember>();
  const minds = new Map<string, import('./types.js').Mind>();
  const now = Date.now();

  // If creator provided, add join DOT
  if (creatorIdentity !== undefined) {
    const pubHex = bufToHex(creatorIdentity.publicKey);
    const joinDot = observe(
      { event: `${pubHex.slice(0, 8)} joined`, room: normalizedName },
      { type: 'event', plaintext: true },
    );
    const signedJoin = await sign(joinDot, creatorIdentity.secretKey);
    chain = append(chain, signedJoin);

    const member: RoomMember = {
      publicKey: creatorIdentity.publicKey,
      joinedAt: now,
      role: 'contributor',
    };
    members.set(pubHex, member);
  }

  const roomConfig: RoomConfig = { ...DEFAULT_CONFIG, ...config };
  const state = await buildState(chain, members, minds, now);

  return {
    name: normalizedName,
    chain,
    identity,
    members,
    minds,
    state,
    config: roomConfig,
  };
}

/**
 * Join a room.
 *
 * @param room - The room to join
 * @param identity - Member's keypair
 * @param name - Optional display name
 */
export async function joinRoom(
  room: Room,
  identity: { publicKey: Uint8Array; secretKey: Uint8Array },
  name?: string,
): Promise<RoomMember> {
  const pubHex = bufToHex(identity.publicKey);
  const displayName = name ?? pubHex.slice(0, 8);

  const joinDot = observe(
    { event: `${displayName} joined`, room: room.name },
    { type: 'event', plaintext: true },
  );
  const signed = await sign(joinDot, identity.secretKey);
  room.chain = append(room.chain, signed);

  const now = Date.now();
  const member: RoomMember = {
    publicKey: identity.publicKey,
    name,
    joinedAt: now,
    role: 'contributor',
    lastSeen: now,
  };
  room.members.set(pubHex, member);
  room.state = await buildState(room.chain, room.members, room.minds, now);

  return member;
}

/**
 * Leave a room.
 *
 * @param room - The room to leave
 * @param publicKey - Member's public key
 */
export async function leaveRoom(
  room: Room,
  publicKey: Uint8Array,
  secretKey: Uint8Array,
): Promise<void> {
  const pubHex = bufToHex(publicKey);
  const member = room.members.get(pubHex);
  const displayName = member?.name ?? pubHex.slice(0, 8);

  const leaveDot = observe(
    { event: `${displayName} left`, room: room.name },
    { type: 'event', plaintext: true },
  );
  const signed = await sign(leaveDot, secretKey);
  room.chain = append(room.chain, signed);

  room.members.delete(pubHex);
  room.state = await buildState(room.chain, room.members, room.minds, Date.now());
}

/**
 * Post an observation to a room.
 *
 * @param room - The target room
 * @param content - Observation content
 * @param identity - Signer's keypair
 * @param options - Optional metadata
 */
export async function observe_in_room(
  room: Room,
  content: string,
  identity: { publicKey: Uint8Array; secretKey: Uint8Array },
  options?: {
    type?: string;
    citations?: string[];
    parentHash?: string;
  },
): Promise<DOT> {
  const payload: Record<string, unknown> = { content };

  if (options?.citations !== undefined && options.citations.length > 0) {
    payload['citations'] = options.citations;
  }
  if (options?.parentHash !== undefined) {
    payload['parentHash'] = options.parentHash;
  }
  if (options?.type !== undefined) {
    payload['observationType'] = options.type;
  }

  const dot = observe(payload, { type: 'claim', plaintext: true });
  const signed = await sign(dot, identity.secretKey);
  room.chain = append(room.chain, signed);

  // Update lastSeen for member
  const pubHex = bufToHex(identity.publicKey);
  const member = room.members.get(pubHex);
  if (member !== undefined) {
    member.lastSeen = Date.now();
  }

  room.state = await buildState(room.chain, room.members, room.minds, Date.now());
  return signed;
}

/**
 * Post a correction to a previous observation.
 *
 * @param room - The room
 * @param originalHash - Hash (hex) of the DOT being corrected
 * @param correction - The correction content
 * @param identity - Signer's keypair
 */
export async function correct(
  room: Room,
  originalHash: string,
  correction: string,
  identity: { publicKey: Uint8Array; secretKey: Uint8Array },
): Promise<DOT> {
  return observe_in_room(room, correction, identity, {
    parentHash: originalHash,
    type: 'correction',
  });
}

/**
 * Get the current computed state of a room.
 */
export async function getState(room: Room): Promise<RoomState> {
  room.state = await buildState(room.chain, room.members, room.minds, room.state.lastActivity);
  return room.state;
}

/**
 * Reconstruct a Room from just its chain.
 *
 * The chain IS the room. This function replays all DOTs to rebuild state.
 * Supports: genesis, join, leave events.
 *
 * @param chain - The chain to replay
 * @param roomName - Optional room name override (read from genesis if not provided)
 */
export async function replayRoom(chain: Chain, roomName?: string): Promise<Room> {
  const dots = walk(chain);

  // Generate a fresh room identity (can't recover original keypair from chain)
  const roomIdentityBase = await createIdentity();

  let name = roomName ?? '.unknown';
  const members = new Map<string, RoomMember>();
  const minds = new Map<string, import('./types.js').Mind>();
  let lastActivity = Date.now();

  for (const dot of dots) {
    if (dot.payload === undefined) continue;

    let payloadObj: Record<string, unknown> | null = null;
    try {
      const text = new TextDecoder().decode(dot.payload);
      payloadObj = JSON.parse(text) as Record<string, unknown>;
    } catch {
      continue;
    }

    const observer = dot.sign?.observer;
    const pubHex = observer !== undefined ? bufToHex(observer) : null;

    // Detect room name from genesis
    if (typeof payloadObj['event'] === 'string') {
      const event = payloadObj['event'] as string;

      if (event.includes('created') && typeof payloadObj['event'] === 'string') {
        const match = /Room (.+) created/.exec(event);
        if (match !== null && match[1] !== undefined) {
          name = match[1];
        }
      } else if (event.includes('joined') && pubHex !== null) {
        if (!members.has(pubHex)) {
          members.set(pubHex, {
            publicKey: observer!,
            joinedAt: dot.time?.utc ?? Date.now(),
            role: 'contributor',
          });
        }
      } else if (event.includes('left') && pubHex !== null) {
        members.delete(pubHex);
      }
    }

    lastActivity = dot.time?.utc ?? lastActivity;
  }

  const identity: RoomIdentity = {
    publicKey: roomIdentityBase.publicKey,
    secretKey: roomIdentityBase.secretKey,
    name,
  };

  const state = await buildState(chain, members, minds, lastActivity);

  return {
    name,
    chain,
    identity,
    members,
    minds,
    state,
    config: { ...DEFAULT_CONFIG },
  };
}

/**
 * Get all DOTs in the room chain, oldest first.
 */
export function getRoomDots(room: Room): DOT[] {
  return walk(room.chain);
}

/**
 * Get hash of the latest DOT in the room.
 */
export function getRoomTipHash(room: Room): string | null {
  return room.chain.tipHash;
}
