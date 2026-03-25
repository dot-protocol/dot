/**
 * tree.ts — Core tree operations for @dot-protocol/tree.
 *
 * The Tree is world knowledge as a living DOT tree.
 * Every node is a signed observation. Parent-child relationships use bond DOTs.
 * addLeaf always produces two DOTs: an observation DOT + a bond DOT.
 */

import {
  observe,
  sign,
  chain as coreChain,
  hash as coreHash,
  createIdentity,
  verify,
} from '@dot-protocol/core';
import type { DOT, Identity } from '@dot-protocol/core';
import { createChain, append, dotHashToHex } from '@dot-protocol/chain';
import type { Tree, TreeNode, AddLeafOptions } from './types.js';

/** Extract a human-readable label from a DOT's payload. */
function extractLabel(dot: DOT): string | undefined {
  if (!dot.payload || dot.payload.length === 0) return undefined;
  try {
    const text = new TextDecoder().decode(dot.payload);
    // Trim to 120 chars for display
    return text.length > 120 ? text.slice(0, 117) + '...' : text;
  } catch {
    return undefined;
  }
}

/**
 * Creates a genesis tree with 3 root DOTs plus a master genesis DOT.
 *
 * Genesis structure (4 DOTs total):
 * - genesis: master genesis bond DOT linking all three roots
 * - observe: "All knowledge begins with observation"
 * - flow: "All action begins with flow"
 * - connect: "All meaning begins with connection"
 *
 * @param identity - Optional pre-existing identity. Auto-generated if omitted.
 * @returns A fresh Tree with 4 nodes.
 */
export async function createTree(identity?: Identity): Promise<Tree> {
  const id = identity ?? (await createIdentity());
  let chain = createChain();

  const tree: Tree = {
    roots: new Map(),
    nodes: new Map(),
    identity: id,
    chain,
  };

  // Create the three root observation DOTs
  const rootDefs: Array<{ branch: 'observe' | 'flow' | 'connect'; content: string }> = [
    { branch: 'observe', content: 'All knowledge begins with observation' },
    { branch: 'flow', content: 'All action begins with flow' },
    { branch: 'connect', content: 'All meaning begins with connection' },
  ];

  const rootHashes: string[] = [];

  for (const def of rootDefs) {
    // Observe → chain → sign
    const unsigned = observe(def.content, { type: 'claim', plaintext: true });
    const chained = coreChain(unsigned as DOT, chain.appendCount > 0 ? getTipDot(chain) ?? undefined : undefined);
    const signed = await sign(chained, id.secretKey);
    chain = append(chain, signed);

    const h = dotHashToHex(signed);
    rootHashes.push(h);

    const node: TreeNode = {
      dot: signed,
      hash: h,
      children: [],
      parent: undefined,
      branch: def.branch,
      depth: 0,
      label: def.content,
    };

    tree.roots.set(def.branch, node);
    tree.nodes.set(h, node);
  }

  // Create master genesis bond DOT referencing all three root hashes
  const genesisBondContent = `genesis: roots=[${rootHashes.join(',')}]`;
  const genesisUnsigned = observe(genesisBondContent, { type: 'bond', plaintext: true });
  const genesisChained = coreChain(genesisUnsigned as DOT, getTipDot(chain) ?? undefined);
  const genesisSigned = await sign(genesisChained, id.secretKey);
  chain = append(chain, genesisSigned);

  const genesisHash = dotHashToHex(genesisSigned);
  const genesisNode: TreeNode = {
    dot: genesisSigned,
    hash: genesisHash,
    children: rootHashes,
    parent: undefined,
    branch: 'genesis',
    depth: 0,
    label: 'genesis',
  };
  tree.nodes.set(genesisHash, genesisNode);

  tree.chain = chain;
  return tree;
}

/**
 * Adds a leaf node to the tree under a given parent.
 *
 * Creates two DOTs:
 * 1. An observation DOT for the content
 * 2. A bond DOT: "leaf is_child_of parent"
 *
 * Both are signed and chained. The new node is registered in tree.nodes
 * and the parent's children array is updated.
 *
 * @param tree - The tree to mutate (in place — nodes/roots/chain updated)
 * @param options - Leaf content, parent hash, optional branch and type
 * @returns The new TreeNode
 */
export async function addLeaf(tree: Tree, options: AddLeafOptions): Promise<TreeNode> {
  const { content, parentHash, type = 'claim' } = options;

  // Resolve parent
  const parent = tree.nodes.get(parentHash);
  if (!parent) {
    throw new Error(`Parent node not found: ${parentHash}`);
  }

  // Inherit branch from parent (or use override)
  const branch = options.branch ?? parent.branch;
  const leafDepth = parent.depth + 1;

  // 1. Create observation DOT
  const unsigned = observe(content, { type, plaintext: true });
  const chained = coreChain(unsigned as DOT, getTipDot(tree.chain) ?? undefined);
  const signed = await sign(chained, tree.identity.secretKey);
  tree.chain = append(tree.chain, signed);

  const leafHash = dotHashToHex(signed);

  // 2. Create bond DOT: "leafHash is_child_of parentHash"
  const bondContent = `bond: ${leafHash} is_child_of ${parentHash}`;
  const bondUnsigned = observe(bondContent, { type: 'bond', plaintext: true });
  const bondChained = coreChain(bondUnsigned as DOT, getTipDot(tree.chain) ?? undefined);
  const bondSigned = await sign(bondChained, tree.identity.secretKey);
  tree.chain = append(tree.chain, bondSigned);

  // Register the leaf node
  const node: TreeNode = {
    dot: signed,
    hash: leafHash,
    children: [],
    parent: parentHash,
    branch,
    depth: leafDepth,
    label: extractLabel(signed),
  };

  tree.nodes.set(leafHash, node);

  // Update parent's children
  parent.children.push(leafHash);

  return node;
}

/**
 * Returns a node by its hash, or null if not found.
 */
export function getNode(tree: Tree, hash: string): TreeNode | null {
  return tree.nodes.get(hash) ?? null;
}

/**
 * Returns the direct children of a node.
 */
export function getChildren(tree: Tree, hash: string): TreeNode[] {
  const node = tree.nodes.get(hash);
  if (!node) return [];
  return node.children
    .map((h) => tree.nodes.get(h))
    .filter((n): n is TreeNode => n !== undefined);
}

/**
 * Returns all ancestors of a node, walking up to the root.
 * The returned array is root-first (oldest ancestor first).
 */
export function getAncestors(tree: Tree, hash: string): TreeNode[] {
  const ancestors: TreeNode[] = [];
  let current = tree.nodes.get(hash);
  // Walk up via parent pointers
  while (current?.parent !== undefined) {
    const parent = tree.nodes.get(current.parent);
    if (!parent) break;
    ancestors.unshift(parent);
    current = parent;
  }
  return ancestors;
}

/**
 * Returns all nodes in a given branch (by branch name).
 */
export function getBranch(tree: Tree, branch: string): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of tree.nodes.values()) {
    if (node.branch === branch) {
      result.push(node);
    }
  }
  return result;
}

/**
 * Search nodes by matching label or payload content (case-insensitive).
 */
export function search(tree: Tree, query: string): TreeNode[] {
  const q = query.toLowerCase();
  const results: TreeNode[] = [];
  for (const node of tree.nodes.values()) {
    const label = (node.label ?? '').toLowerCase();
    if (label.includes(q)) {
      results.push(node);
    }
  }
  return results;
}

/**
 * Returns the maximum depth of any node in the tree.
 */
export function depth(tree: Tree): number {
  let max = 0;
  for (const node of tree.nodes.values()) {
    if (node.depth > max) max = node.depth;
  }
  return max;
}

/**
 * Returns the total number of nodes in the tree.
 */
export function size(tree: Tree): number {
  return tree.nodes.size;
}

/**
 * Verifies the integrity of all DOTs in the tree.
 *
 * Checks each node's DOT signature and confirms the bond DOTs
 * are present in the chain for leaf nodes.
 *
 * @returns An object with valid flag and a list of error strings.
 */
export async function verifyTree(tree: Tree): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const [hash, node] of tree.nodes.entries()) {
    const result = await verify(node.dot);
    if (!result.valid) {
      errors.push(`Node ${hash.slice(0, 8)}...: ${result.reason ?? 'verification failed'}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Retrieve the current tip DOT from the tree's chain storage. */
function getTipDot(chain: import('@dot-protocol/chain').Chain): DOT | null {
  if (chain.tipHash === null) return null;
  return chain.storage.get(chain.tipHash);
}
