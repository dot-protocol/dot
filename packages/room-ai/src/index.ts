/**
 * @dot-protocol/room-ai — Room AI governance engine.
 *
 * Every .room has a Room AI that governs it:
 * - Routes queries to relevant minds
 * - Activates up to N minds per query (configurable)
 * - Manages compute budgets
 * - Detects cross-room correlations
 * - Enforces start/stop (Kin enforces; Room AI defers)
 * - Creates state DOTs as checkpoints
 *
 * @example
 * import { RoomAI } from '@dot-protocol/room-ai';
 * import { createRoom } from '@dot-protocol/room';
 * import { createFeynman, createRumi } from '@dot-protocol/minds';
 *
 * const room = await createRoom('.physics');
 * const feynman = await createFeynman();
 * const rumi = await createRumi();
 *
 * const ai = new RoomAI(room, [feynman, rumi], { maxMindsPerQuery: 2 });
 *
 * const result = await ai.handleQuery('What is the nature of light?', userKey);
 * console.log(result.mindResponses);
 * console.log(result.crossRoomLinks);
 */

// Core engine
export { RoomAI } from './room-ai.js';

// Correlation engine
export { CorrelationEngine } from './correlation.js';
export type { KnownRoom } from './correlation.js';

// State crystallization
export { crystallize } from './crystallize.js';
export type { CrystallizePayload } from './crystallize.js';

// Types
export type {
  RoomAIConfig,
  QueryResult,
  MindQueryResponse,
  CrossRoomLink,
  ComputeUsage,
  InteractionLimit,
} from './types.js';
