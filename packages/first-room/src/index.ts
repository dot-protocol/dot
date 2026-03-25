/**
 * @dot-protocol/first-room — .the.first.room
 *
 * The seed room. A DOT chain that IS the room.
 * Every observation, join, and seed is a DOT appended to a single causal chain.
 *
 * @example
 * import { createFirstRoom, addObservation, generateRoomHTML } from '@dot-protocol/first-room';
 * import { createIdentity } from '@dot-protocol/core';
 *
 * const room = await createFirstRoom();
 * const identity = await createIdentity();
 * await addObservation(room, 'Hello, world.', identity);
 * const html = await generateRoomHTML(room);
 */

// Room chain — core data model
export {
  createFirstRoom,
  addObservation,
  addMember,
  getChainView,
  decodePayload,
  bufToHex,
} from './room-chain.js';

export type { FirstRoom, RoomMember, ChainEntry } from './room-chain.js';

// Terminal renderer
export { renderTerminal, renderChainHex } from './terminal.js';

// HTML renderer
export { generateRoomHTML } from './html-room.js';

// Seed
export { seedFirstRoom, generateSeedHTML } from './seed.js';
