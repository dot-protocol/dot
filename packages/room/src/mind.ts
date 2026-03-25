/**
 * mind.ts — Mind management for rooms.
 *
 * Minds are AI agents that can be activated in a room and respond to queries.
 * Each mind has a domain and signing identity, and signs its responses.
 */

import { observe, sign, createIdentity } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { append, bufToHex, dotHashToHex } from '@dot-protocol/chain';
import type { Room, Mind } from './types.js';

/**
 * Create a new Mind with a fresh keypair.
 *
 * @param id - Unique identifier for this mind
 * @param name - Display name (e.g. "Feynman")
 * @param domain - Knowledge domain (e.g. "physics")
 */
export async function createMind(id: string, name: string, domain: string): Promise<Mind> {
  const identity = await createIdentity();
  return {
    id,
    name,
    publicKey: identity.publicKey,
    domain,
    active: false,
    // Store secretKey separately — Mind type only has publicKey publicly
    _secretKey: identity.secretKey,
  } as Mind & { _secretKey: Uint8Array };
}

/**
 * Activate a mind in a room.
 * Creates a mind_activate DOT signed by the room identity.
 *
 * @param room - The room to add the mind to
 * @param mind - The mind to activate
 */
export async function activateMind(room: Room, mind: Mind): Promise<DOT> {
  const dot = observe(
    {
      event: `mind_activate`,
      mindId: mind.id,
      mindName: mind.name,
      domain: mind.domain,
      publicKey: bufToHex(mind.publicKey),
    },
    { type: 'event', plaintext: true },
  );
  const signed = await sign(dot, room.identity.secretKey);
  room.chain = append(room.chain, signed);

  // Add to minds map
  room.minds.set(mind.id, { ...mind, active: true });

  return signed;
}

/**
 * Deactivate a mind in a room.
 *
 * @param room - The room
 * @param mindId - The ID of the mind to deactivate
 */
export async function deactivateMind(room: Room, mindId: string): Promise<void> {
  const mind = room.minds.get(mindId);
  if (mind === undefined) return;

  const dot = observe(
    {
      event: `mind_deactivate`,
      mindId,
    },
    { type: 'event', plaintext: true },
  );
  const signed = await sign(dot, room.identity.secretKey);
  room.chain = append(room.chain, signed);

  room.minds.set(mindId, { ...mind, active: false });
}

/**
 * A mind responds to a query DOT.
 * The response is chained and signed with the mind's key.
 *
 * @param room - The room context
 * @param mind - The responding mind (must have _secretKey attached)
 * @param query - The query DOT being responded to
 * @param response - The response content
 * @param citations - Optional list of citation strings
 */
export async function mindRespond(
  room: Room,
  mind: Mind & { _secretKey: Uint8Array },
  query: DOT,
  response: string,
  citations?: string[],
): Promise<DOT> {
  const queryHash = dotHashToHex(query);

  const payload: Record<string, unknown> = {
    event: 'mind_response',
    mindId: mind.id,
    mindName: mind.name,
    queryHash,
    response,
  };

  if (citations !== undefined && citations.length > 0) {
    payload['citations'] = citations;
  }

  const dot = observe(payload, { type: 'claim', plaintext: true });
  const signed = await sign(dot, mind._secretKey);
  room.chain = append(room.chain, signed);

  return signed;
}
