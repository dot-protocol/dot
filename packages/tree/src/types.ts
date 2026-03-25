/**
 * types.ts — Tree data model for @dot-protocol/tree.
 *
 * The Tree is world knowledge as a living DOT tree.
 * Every node is a signed observation. Parent-child relationships use bond DOTs.
 * Three root branches: observe, flow, connect.
 */

import type { DOT } from '@dot-protocol/core';
import type { Chain } from '@dot-protocol/chain';

/** A single node in the tree — a signed observation with structural metadata. */
export interface TreeNode {
  /** The signed observation DOT at this node. */
  dot: DOT;
  /** Hex hash of the DOT (64 chars, BLAKE3). */
  hash: string;
  /** Hashes of child nodes attached under this node. */
  children: string[];
  /** Hash of the parent node. Undefined for root nodes. */
  parent?: string;
  /** Which root branch this node belongs to. */
  branch: 'observe' | 'flow' | 'connect' | string;
  /** Depth from root (root = 0). */
  depth: number;
  /** Human-readable label extracted from the payload. */
  label?: string;
}

/** The full Tree — roots, all nodes, identity, and chain. */
export interface Tree {
  /** The three root branch nodes, keyed by branch name. */
  roots: Map<string, TreeNode>;
  /** All nodes in the tree, keyed by hash. */
  nodes: Map<string, TreeNode>;
  /** Ed25519 identity used to sign tree DOTs. */
  identity: { publicKey: Uint8Array; secretKey: Uint8Array };
  /** The underlying DOT chain backing this tree. */
  chain: Chain;
}

/** Options for adding a leaf node to the tree. */
export interface AddLeafOptions {
  /** The textual content of the observation. */
  content: string;
  /** Hash of the parent node to attach under. */
  parentHash: string;
  /** Override the branch (inherits from parent by default). */
  branch?: string;
  /** Observation type classification. Defaults to 'claim'. */
  type?: 'measure' | 'state' | 'event' | 'claim' | 'bond';
}
