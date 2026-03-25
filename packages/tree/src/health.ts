/**
 * health.ts — Tree health observation for @dot-protocol/tree.
 *
 * Produces a measure DOT summarising the current tree state:
 * total nodes, depth, branch counts, verified %, orphan count.
 */

import { observe } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import type { Tree } from './types.js';
import { depth as treeDepth, size as treeSize, verifyTree } from './tree.js';

/**
 * Returns a measure DOT summarising the health of the tree.
 *
 * Payload (plaintext JSON) contains:
 * - total_nodes: number
 * - depth: number (deepest node)
 * - branches: number (distinct branch names)
 * - orphan_count: number (nodes whose parent is not in the tree)
 *
 * Note: verified_pct is omitted from the sync version to avoid async.
 * Use verifyTree() directly for full signature verification.
 *
 * @param tree - The tree to inspect.
 * @returns A measure DOT (unsigned, plaintext).
 */
export function treeHealth(tree: Tree): DOT {
  const totalNodes = treeSize(tree);
  const maxDepth = treeDepth(tree);

  // Count distinct branches
  const branches = new Set<string>();
  for (const node of tree.nodes.values()) {
    branches.add(node.branch);
  }

  // Count orphans: nodes whose parent hash is not in nodes map
  let orphanCount = 0;
  for (const node of tree.nodes.values()) {
    if (node.parent !== undefined && !tree.nodes.has(node.parent)) {
      orphanCount++;
    }
  }

  return observe(
    {
      total_nodes: totalNodes,
      depth: maxDepth,
      branches: branches.size,
      orphan_count: orphanCount,
    },
    { type: 'measure', plaintext: true },
  ) as DOT;
}
