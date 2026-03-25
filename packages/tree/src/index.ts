/**
 * @dot-protocol/tree — World knowledge as a living DOT tree.
 *
 * Every node is a signed observation.
 * Parent-child relationships use bond DOTs.
 * Three root branches: observe, flow, connect.
 *
 * Primary entry points:
 *   createTree()  — creates genesis tree with 3 branch roots
 *   createSeed()  — alias for createTree(), semantically the "first tree"
 *   addLeaf()     — adds a signed leaf node under a parent
 *
 * @example
 * import { createTree, addLeaf, toMarkdown } from '@dot-protocol/tree';
 *
 * const tree = await createTree();
 * const root = tree.roots.get('observe')!;
 * const leaf = await addLeaf(tree, { content: 'The sky is blue', parentHash: root.hash });
 * console.log(toMarkdown(tree));
 */

// Core types
export type { TreeNode, Tree, AddLeafOptions } from './types.js';

// Tree operations
export {
  createTree,
  addLeaf,
  getNode,
  getChildren,
  getAncestors,
  getBranch,
  search,
  depth,
  size,
  verifyTree,
} from './tree.js';

// Seed protocol
export { createSeed, getSeedDOT } from './seed.js';

// Export / serialization
export { toJSON, fromJSON, toMarkdown, toDotMark } from './export.js';

// Health
export { treeHealth } from './health.js';
