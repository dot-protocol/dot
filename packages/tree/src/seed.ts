/**
 * seed.ts — The seed protocol for @dot-protocol/tree.
 *
 * The Seed is the first Tree DOT — genesis of all knowledge.
 * createSeed() creates the master genesis DOT + 3 branch roots.
 * Returns a Tree with exactly 4 nodes (genesis + 3 roots).
 */

import type { DOT, Identity } from '@dot-protocol/core';
import { createTree } from './tree.js';
import type { Tree } from './types.js';

/**
 * Creates the Seed — the first Tree.
 *
 * Identical to createTree() but semantically named as the root-of-all-roots.
 * Returns a Tree with exactly 4 nodes:
 * - genesis bond DOT
 * - root "observe"
 * - root "flow"
 * - root "connect"
 *
 * @param identity - Optional pre-existing identity.
 * @returns The seeded Tree.
 */
export async function createSeed(identity?: Identity): Promise<Tree> {
  return createTree(identity);
}

/**
 * Returns the master genesis DOT from the tree.
 *
 * The genesis DOT is a bond DOT that references all three root hashes.
 * It is identified by having branch === 'genesis'.
 *
 * @param tree - The tree to inspect.
 * @returns The genesis DOT.
 * @throws If no genesis node is found.
 */
export function getSeedDOT(tree: Tree): DOT {
  for (const node of tree.nodes.values()) {
    if (node.branch === 'genesis') {
      return node.dot;
    }
  }
  throw new Error('No genesis DOT found in tree — was this created with createSeed()?');
}
