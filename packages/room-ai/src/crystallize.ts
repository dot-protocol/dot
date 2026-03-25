/**
 * crystallize.ts — Create a state checkpoint DOT for a room.
 *
 * A "crystallize" DOT is a state snapshot that captures the room's current
 * condition: members, minds, dot count, recent topics, compute used.
 *
 * The room can be understood from its crystallize DOTs alone — they are
 * the room's autobiography, not just its diary entries.
 *
 * Signed by the room's own identity (the Room AI is the room's voice).
 */

import { observe, sign } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { append } from '@dot-protocol/chain';
import type { Room } from '@dot-protocol/room';
import type { RoomAI } from './room-ai.js';

/** Payload stored in a crystallize DOT. */
export interface CrystallizePayload {
  event: 'crystallize';
  members: number;
  minds: number;
  dotCount: number;
  topTopics: string[];
  computeUsed: number;
  timestamp: number;
}

/**
 * Create a crystallize DOT — a state checkpoint for the room.
 *
 * The DOT captures:
 * - Member count
 * - Mind count
 * - DOT count (chain length)
 * - Top topics (mind domains active in the room)
 * - Compute tokens used
 * - Timestamp
 *
 * Signed by the provided identity (typically the room's own keypair).
 * Appended to the room's chain.
 *
 * @param room - The room to snapshot
 * @param ai - The Room AI (provides compute usage and mind info)
 * @param identity - Signing identity (publicKey + secretKey)
 * @returns The signed crystallize DOT
 */
export async function crystallize(
  room: Room,
  ai: RoomAI,
  identity: { publicKey: Uint8Array; secretKey: Uint8Array },
): Promise<DOT> {
  const usage = ai.getComputeUsage();

  // Extract top topics from active minds
  const topTopics = Array.from(room.minds.values())
    .filter((m) => m.active)
    .map((m) => m.domain)
    .slice(0, 5);

  const payload: CrystallizePayload = {
    event: 'crystallize',
    members: room.members.size,
    minds: room.minds.size,
    dotCount: room.chain.appendCount,
    topTopics,
    computeUsed: usage.tokensUsed,
    timestamp: Date.now(),
  };

  const dot = observe(payload, { type: 'state', plaintext: true });
  const signed = await sign(dot, identity.secretKey);

  // Append to the room's chain
  room.chain = append(room.chain, signed);

  return signed;
}
