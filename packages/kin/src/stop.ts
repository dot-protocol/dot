/**
 * stop.ts — Sovereign stop condition enforcement.
 *
 * Stop conditions are checked locally before every observation.
 * No remote party, no .room, and no AI can override them.
 * If a condition triggers, Kin stops observing until the condition clears.
 */

import type { KinState, StopConditions } from './types.js';

/** The decision returned after evaluating stop conditions. */
export interface StopDecision {
  /** True if the observation is permitted. False if any condition triggered. */
  allowed: boolean;
  /** Human-readable reason for the stop. Only set when allowed is false. */
  reason?: string;
}

/**
 * Evaluate all active stop conditions against the current Kin state.
 *
 * Checks are performed in priority order:
 * 1. blockedRooms — room-level block
 * 2. maxDailyDots — per-day observation cap
 * 3. maxSessionMinutes — session length cap
 *
 * @param state - Current Kin runtime state
 * @param conditions - Stop conditions to evaluate
 * @param currentRoom - Current .room name being observed into (optional)
 * @returns StopDecision — allowed or stopped with reason
 */
export function checkStopConditions(
  state: KinState,
  conditions: StopConditions,
  currentRoom?: string
): StopDecision {
  // 1. Blocked rooms
  if (currentRoom !== undefined && conditions.blockedRooms !== undefined) {
    if (isRoomBlocked(currentRoom, conditions.blockedRooms)) {
      return { allowed: false, reason: `room "${currentRoom}" is blocked` };
    }
  }

  // 2. Max daily dots
  if (conditions.maxDailyDots !== undefined) {
    if (state.dotsCreated >= conditions.maxDailyDots) {
      return {
        allowed: false,
        reason: `daily DOT limit reached (${state.dotsCreated}/${conditions.maxDailyDots})`,
      };
    }
  }

  // 3. Max session minutes
  if (conditions.maxSessionMinutes !== undefined) {
    const elapsedMinutes = (Date.now() - state.sessionStart) / 60_000;
    if (elapsedMinutes >= conditions.maxSessionMinutes) {
      return {
        allowed: false,
        reason: `session time limit reached (${elapsedMinutes.toFixed(1)}/${conditions.maxSessionMinutes} min)`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Check whether a specific .room name is in the blocked list.
 *
 * Comparison is exact (case-sensitive) string match.
 *
 * @param roomName - The .room name to check
 * @param blocked - List of blocked .room names
 * @returns True if the room is blocked
 */
export function isRoomBlocked(roomName: string, blocked: string[]): boolean {
  return blocked.includes(roomName);
}
