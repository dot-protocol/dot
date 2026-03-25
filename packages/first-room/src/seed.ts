/**
 * seed.ts — Create and export the seeded .the.first.room.
 *
 * The seed room contains:
 * - Genesis DOT: "The first room. Where observation begins."
 * - 3 seed observations (Observe / Flow / Connect branches):
 *   1. "All knowledge begins with observation." — Observe branch
 *   2. "The wound is the place where the light enters you." — Rumi (Connect branch)
 *   3. "The first principle is that you must not fool yourself." — Feynman (Flow branch)
 *
 * generateSeedHTML() writes to /Users/blaze/Downloads/the-first-room.html
 */

import { createIdentity } from '@dot-protocol/core';
import { writeFileSync } from 'node:fs';
import type { FirstRoom } from './room-chain.js';
import { createFirstRoom, addObservation, addMember } from './room-chain.js';
import { generateRoomHTML } from './html-room.js';

/** Seed observations with their branch context. */
const SEED_OBSERVATIONS = [
  {
    content: 'All knowledge begins with observation.',
    branch: 'Observe',
  },
  {
    content: 'The wound is the place where the light enters you. — Rumi',
    branch: 'Connect',
  },
  {
    content: 'The first principle is that you must not fool yourself. — Feynman',
    branch: 'Flow',
  },
] as const;

/**
 * Creates .the.first.room with 4 DOTs:
 * - genesis DOT (from createFirstRoom)
 * - 3 seed observations
 *
 * Returns the seeded room.
 */
export async function seedFirstRoom(): Promise<FirstRoom> {
  const room = await createFirstRoom();

  // Use the room's own identity as the initial observer for seed content
  for (const seed of SEED_OBSERVATIONS) {
    await addObservation(room, seed.content, room.identity);
  }

  return room;
}

/**
 * Generates the HTML for the seeded first room and writes it to
 * /Users/blaze/Downloads/the-first-room.html.
 *
 * Returns the HTML string.
 */
export async function generateSeedHTML(): Promise<string> {
  const room = await seedFirstRoom();
  const html = await generateRoomHTML(room);

  const outPath = '/Users/blaze/Downloads/the-first-room.html';
  writeFileSync(outPath, html, 'utf8');

  return html;
}
