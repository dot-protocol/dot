/**
 * @dot-protocol/room — A .room is a DOT chain.
 *
 * The chain IS the room. Wherever the chain is replicated, the room exists.
 * No server owns it.
 *
 * R856: Session 1 — Room package implementation.
 */

// Types
export type {
  Room,
  RoomMember,
  Mind,
  RoomState,
  RoomConfig,
  RoomDOTType,
  RoomIdentity,
} from './types.js';

// Room operations
export {
  createRoom,
  joinRoom,
  leaveRoom,
  observe_in_room,
  correct,
  getState,
  replayRoom,
  getRoomDots,
  getRoomTipHash,
} from './room.js';

// Mind management
export { createMind, activateMind, deactivateMind, mindRespond } from './mind.js';

// Governance
export { shouldActivateMind, routeQuery, createStateDOT } from './governance.js';
export type { GovernanceConfig } from './governance.js';

// Namespace
export { isValidRoomName, normalizeRoomName, parseRoomName } from './namespace.js';
export type { ParsedRoomName } from './namespace.js';
