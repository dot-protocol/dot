/**
 * export.ts — Tree serialization and rendering for @dot-protocol/tree.
 *
 * toJSON/fromJSON: round-trip serialization for sharing and storage.
 * toMarkdown: indented markdown representation of the tree.
 * toDotMark: DOT-MARK source renderable as HTML.
 */

import { createIdentity } from '@dot-protocol/core';
import type { Tree, TreeNode } from './types.js';

/** Serialized representation of a single TreeNode (JSON-safe). */
interface SerializedNode {
  hash: string;
  children: string[];
  parent?: string;
  branch: string;
  depth: number;
  label?: string;
  dot: {
    payload?: number[];
    payload_mode?: string;
    type?: string;
    sign?: {
      observer?: number[];
      signature?: number[];
      level?: string;
    };
    time?: { utc?: number; monotonic?: number };
    chain?: { previous?: number[]; depth?: number };
    verify?: { hash?: number[] };
  };
}

/** Full serialized tree. */
interface SerializedTree {
  version: '1.0';
  rootHashes: string[];
  nodes: Record<string, SerializedNode>;
}

/**
 * Serialize a Tree to a JSON string.
 *
 * All Uint8Arrays are converted to plain number arrays for JSON safety.
 * The result can be passed back to fromJSON() to recover the tree structure.
 */
export function toJSON(tree: Tree): string {
  const nodes: Record<string, SerializedNode> = {};

  for (const [hash, node] of tree.nodes.entries()) {
    const dot = node.dot;
    const serializedDot: SerializedNode['dot'] = {};

    if (dot.payload) serializedDot.payload = Array.from(dot.payload);
    if (dot.payload_mode) serializedDot.payload_mode = dot.payload_mode;
    if (dot.type) serializedDot.type = dot.type;

    if (dot.sign) {
      serializedDot.sign = {};
      if (dot.sign.observer) serializedDot.sign.observer = Array.from(dot.sign.observer);
      if (dot.sign.signature) serializedDot.sign.signature = Array.from(dot.sign.signature);
      if (dot.sign.level) serializedDot.sign.level = dot.sign.level;
    }

    if (dot.time) {
      serializedDot.time = {};
      if (dot.time.utc !== undefined) serializedDot.time.utc = dot.time.utc;
      if (dot.time.monotonic !== undefined) serializedDot.time.monotonic = dot.time.monotonic;
    }

    if (dot.chain) {
      serializedDot.chain = {};
      if (dot.chain.previous) serializedDot.chain.previous = Array.from(dot.chain.previous);
      if (dot.chain.depth !== undefined) serializedDot.chain.depth = dot.chain.depth;
    }

    if (dot.verify?.hash) {
      serializedDot.verify = { hash: Array.from(dot.verify.hash) };
    }

    nodes[hash] = {
      hash,
      children: [...node.children],
      parent: node.parent,
      branch: node.branch,
      depth: node.depth,
      label: node.label,
      dot: serializedDot,
    };
  }

  const rootHashes = Array.from(tree.roots.values()).map((n) => n.hash);

  const serialized: SerializedTree = {
    version: '1.0',
    rootHashes,
    nodes,
  };

  return JSON.stringify(serialized, null, 2);
}

/**
 * Deserialize a Tree from a JSON string produced by toJSON().
 *
 * Reconstructs the nodes map and roots map from the serialized data.
 * The identity is re-generated (since secret keys are never serialized).
 * The chain is reconstructed as a stub (appendCount reflects node count).
 *
 * Note: The deserialized tree is read-only — its identity cannot sign new DOTs
 * without providing a known identity. Use addLeaf() with a fresh tree to extend it.
 */
export async function fromJSON(json: string): Promise<Tree> {
  const serialized = JSON.parse(json) as SerializedTree;

  if (serialized.version !== '1.0') {
    throw new Error(`Unsupported tree version: ${serialized.version}`);
  }

  const { createChain } = await import('@dot-protocol/chain');

  // Reconstruct identity (public key only — secret key is lost)
  const identity = await createIdentity();

  const nodes = new Map<string, import('./types.js').TreeNode>();
  const roots = new Map<string, import('./types.js').TreeNode>();

  // First pass: reconstruct all nodes
  for (const [hash, sn] of Object.entries(serialized.nodes)) {
    const dot: import('@dot-protocol/core').DOT = {};

    if (sn.dot.payload) dot.payload = new Uint8Array(sn.dot.payload);
    if (sn.dot.payload_mode) dot.payload_mode = sn.dot.payload_mode as import('@dot-protocol/core').PayloadMode;
    if (sn.dot.type) dot.type = sn.dot.type as import('@dot-protocol/core').ObservationType;

    if (sn.dot.sign) {
      dot.sign = {};
      if (sn.dot.sign.observer) dot.sign.observer = new Uint8Array(sn.dot.sign.observer);
      if (sn.dot.sign.signature) dot.sign.signature = new Uint8Array(sn.dot.sign.signature);
      if (sn.dot.sign.level) dot.sign.level = sn.dot.sign.level as import('@dot-protocol/core').IdentityLevel;
    }

    if (sn.dot.time) {
      dot.time = {};
      if (sn.dot.time.utc !== undefined) dot.time.utc = sn.dot.time.utc;
      if (sn.dot.time.monotonic !== undefined) dot.time.monotonic = sn.dot.time.monotonic;
    }

    if (sn.dot.chain) {
      dot.chain = {};
      if (sn.dot.chain.previous) dot.chain.previous = new Uint8Array(sn.dot.chain.previous);
      if (sn.dot.chain.depth !== undefined) dot.chain.depth = sn.dot.chain.depth;
    }

    if (sn.dot.verify?.hash) {
      dot.verify = { hash: new Uint8Array(sn.dot.verify.hash) };
    }

    const node: import('./types.js').TreeNode = {
      dot,
      hash,
      children: [...sn.children],
      parent: sn.parent,
      branch: sn.branch,
      depth: sn.depth,
      label: sn.label,
    };

    nodes.set(hash, node);
  }

  // Second pass: populate roots
  for (const hash of serialized.rootHashes) {
    const node = nodes.get(hash);
    if (node && node.branch !== 'genesis') {
      roots.set(node.branch, node);
    }
  }

  const chain = createChain();

  return {
    roots,
    nodes,
    identity,
    chain,
  };
}

/**
 * Render a tree as indented markdown.
 *
 * Format:
 * - observe
 *   - "All knowledge begins with observation"
 *   - (children...)
 * - flow
 *   - ...
 * - connect
 *   - ...
 */
export function toMarkdown(tree: Tree): string {
  const lines: string[] = [];
  const BRANCH_ORDER: Array<'observe' | 'flow' | 'connect'> = ['observe', 'flow', 'connect'];

  for (const branchName of BRANCH_ORDER) {
    const root = tree.roots.get(branchName);
    if (!root) continue;

    lines.push(`- ${capitalise(branchName)}`);
    renderNodeMarkdown(tree, root, lines, 1);
  }

  return lines.join('\n');
}

/** Recursively render a node and its children as indented markdown. */
function renderNodeMarkdown(tree: Tree, node: TreeNode, lines: string[], indent: number): void {
  const prefix = '  '.repeat(indent);
  const label = node.label ?? node.hash.slice(0, 8) + '...';
  lines.push(`${prefix}- "${label}"`);

  for (const childHash of node.children) {
    const child = tree.nodes.get(childHash);
    if (child) {
      renderNodeMarkdown(tree, child, lines, indent + 1);
    }
  }
}

/**
 * Render a tree as DOT-MARK source.
 *
 * Produces a DOT-MARK document with one @observe block per node,
 * with parent-child relationships encoded as trust attributes.
 */
export function toDotMark(tree: Tree): string {
  const lines: string[] = [
    '@page tree {',
    '  title: "The Tree — World Knowledge";',
    '  theme: dark;',
    '',
  ];

  const BRANCH_ORDER: Array<'observe' | 'flow' | 'connect'> = ['observe', 'flow', 'connect'];

  for (const branchName of BRANCH_ORDER) {
    const root = tree.roots.get(branchName);
    if (!root) continue;

    lines.push(`  @section ${branchName} {`);
    renderNodeDotMark(tree, root, lines, 2);
    lines.push('  }');
    lines.push('');
  }

  lines.push('}');
  return lines.join('\n');
}

/** Recursively render a node and children as DOT-MARK @observe blocks. */
function renderNodeDotMark(tree: Tree, node: TreeNode, lines: string[], indent: number): void {
  const prefix = '  '.repeat(indent);
  const label = node.label ?? 'unlabeled';
  const escaped = label.replace(/"/g, '\\"');
  const sigShort = node.dot.sign?.signature
    ? Buffer.from(node.dot.sign.signature).toString('hex').slice(0, 16) + '...'
    : 'unsigned';

  lines.push(`${prefix}@observe {`);
  lines.push(`${prefix}  content: "${escaped}";`);
  lines.push(`${prefix}  hash: "${node.hash.slice(0, 16)}...";`);
  lines.push(`${prefix}  branch: "${node.branch}";`);
  lines.push(`${prefix}  depth: ${node.depth};`);
  lines.push(`${prefix}  sig: "${sigShort}";`);
  lines.push(`${prefix}}`);

  for (const childHash of node.children) {
    const child = tree.nodes.get(childHash);
    if (child) {
      renderNodeDotMark(tree, child, lines, indent);
    }
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
