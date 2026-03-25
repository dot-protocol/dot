/**
 * tree.test.ts — Core tree operation tests for @dot-protocol/tree.
 * 40+ tests covering createTree, addLeaf, getNode, getChildren,
 * getAncestors, getBranch, search, depth, size, verifyTree.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import {
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
} from '../src/tree.js';
import type { Tree } from '../src/types.js';

// ─── createTree ───────────────────────────────────────────────────────────────

describe('createTree', () => {
  it('produces exactly 4 nodes (genesis + 3 roots)', async () => {
    const tree = await createTree();
    expect(tree.nodes.size).toBe(4);
  });

  it('has 3 root branch entries', async () => {
    const tree = await createTree();
    expect(tree.roots.size).toBe(3);
  });

  it('roots are named observe, flow, connect', async () => {
    const tree = await createTree();
    expect(tree.roots.has('observe')).toBe(true);
    expect(tree.roots.has('flow')).toBe(true);
    expect(tree.roots.has('connect')).toBe(true);
  });

  it('observe root has correct label', async () => {
    const tree = await createTree();
    const obs = tree.roots.get('observe')!;
    expect(obs.label).toBe('All knowledge begins with observation');
  });

  it('flow root has correct label', async () => {
    const tree = await createTree();
    const flow = tree.roots.get('flow')!;
    expect(flow.label).toBe('All action begins with flow');
  });

  it('connect root has correct label', async () => {
    const tree = await createTree();
    const conn = tree.roots.get('connect')!;
    expect(conn.label).toBe('All meaning begins with connection');
  });

  it('all root nodes have depth 0', async () => {
    const tree = await createTree();
    for (const root of tree.roots.values()) {
      expect(root.depth).toBe(0);
    }
  });

  it('all root nodes have no parent', async () => {
    const tree = await createTree();
    for (const root of tree.roots.values()) {
      expect(root.parent).toBeUndefined();
    }
  });

  it('root DOTs are signed', async () => {
    const tree = await createTree();
    for (const root of tree.roots.values()) {
      expect(root.dot.sign?.signature).toBeDefined();
      expect(root.dot.sign?.observer).toBeDefined();
    }
  });

  it('genesis node exists with branch genesis', async () => {
    const tree = await createTree();
    let genesisNode = null;
    for (const node of tree.nodes.values()) {
      if (node.branch === 'genesis') genesisNode = node;
    }
    expect(genesisNode).not.toBeNull();
  });

  it('genesis DOT is a bond type', async () => {
    const tree = await createTree();
    for (const node of tree.nodes.values()) {
      if (node.branch === 'genesis') {
        expect(node.dot.type).toBe('bond');
      }
    }
  });

  it('accepts a pre-existing identity', async () => {
    const id = await createIdentity();
    const tree = await createTree(id);
    expect(Buffer.from(tree.identity.publicKey).toString('hex')).toBe(
      Buffer.from(id.publicKey).toString('hex'),
    );
  });

  it('chain appendCount equals 4 after genesis', async () => {
    const tree = await createTree();
    expect(tree.chain.appendCount).toBe(4);
  });

  it('all 4 node hashes are unique', async () => {
    const tree = await createTree();
    const hashes = new Set(tree.nodes.keys());
    expect(hashes.size).toBe(4);
  });
});

// ─── addLeaf ──────────────────────────────────────────────────────────────────

describe('addLeaf', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = await createTree();
  });

  it('adds a node to tree.nodes', async () => {
    const root = tree.roots.get('observe')!;
    const leaf = await addLeaf(tree, { content: 'first leaf', parentHash: root.hash });
    expect(tree.nodes.has(leaf.hash)).toBe(true);
  });

  it('new node has correct parent hash', async () => {
    const root = tree.roots.get('observe')!;
    const leaf = await addLeaf(tree, { content: 'child node', parentHash: root.hash });
    expect(leaf.parent).toBe(root.hash);
  });

  it('new node depth is parent depth + 1', async () => {
    const root = tree.roots.get('observe')!;
    const leaf = await addLeaf(tree, { content: 'depth test', parentHash: root.hash });
    expect(leaf.depth).toBe(1);
  });

  it('parent node children array is updated', async () => {
    const root = tree.roots.get('observe')!;
    const leaf = await addLeaf(tree, { content: 'child', parentHash: root.hash });
    expect(root.children).toContain(leaf.hash);
  });

  it('leaf DOT is signed', async () => {
    const root = tree.roots.get('flow')!;
    const leaf = await addLeaf(tree, { content: 'signed leaf', parentHash: root.hash });
    expect(leaf.dot.sign?.signature).toBeDefined();
  });

  it('leaf inherits branch from parent', async () => {
    const root = tree.roots.get('connect')!;
    const leaf = await addLeaf(tree, { content: 'inherited branch', parentHash: root.hash });
    expect(leaf.branch).toBe('connect');
  });

  it('leaf branch can be overridden', async () => {
    const root = tree.roots.get('observe')!;
    const leaf = await addLeaf(tree, {
      content: 'custom branch',
      parentHash: root.hash,
      branch: 'custom',
    });
    expect(leaf.branch).toBe('custom');
  });

  it('leaf label matches content', async () => {
    const root = tree.roots.get('observe')!;
    const leaf = await addLeaf(tree, { content: 'hello world', parentHash: root.hash });
    expect(leaf.label).toBe('hello world');
  });

  it('addLeaf creates both observation and bond DOTs in chain', async () => {
    const root = tree.roots.get('observe')!;
    const prevCount = tree.chain.appendCount;
    await addLeaf(tree, { content: 'two dots', parentHash: root.hash });
    // Each addLeaf appends 2 DOTs (observation + bond)
    expect(tree.chain.appendCount).toBe(prevCount + 2);
  });

  it('throws if parentHash not found', async () => {
    await expect(
      addLeaf(tree, { content: 'orphan', parentHash: 'deadbeef'.repeat(8) }),
    ).rejects.toThrow();
  });

  it('leaf can be added to another leaf (nested depth)', async () => {
    const root = tree.roots.get('observe')!;
    const child = await addLeaf(tree, { content: 'level 1', parentHash: root.hash });
    const grandchild = await addLeaf(tree, { content: 'level 2', parentHash: child.hash });
    expect(grandchild.depth).toBe(2);
    expect(grandchild.parent).toBe(child.hash);
  });

  it('10 leaves → tree has 14 nodes (4 initial + 10)', async () => {
    const root = tree.roots.get('observe')!;
    for (let i = 0; i < 10; i++) {
      await addLeaf(tree, { content: `leaf ${i}`, parentHash: root.hash });
    }
    expect(tree.nodes.size).toBe(14);
  });

  it('multiple observers can add leaves', async () => {
    const id2 = await createIdentity();
    const tree2 = await createTree(id2);

    const root = tree.roots.get('observe')!;
    const root2 = tree2.roots.get('observe')!;

    const leaf1 = await addLeaf(tree, { content: 'from id1', parentHash: root.hash });
    const leaf2 = await addLeaf(tree2, { content: 'from id2', parentHash: root2.hash });

    // Different trees, both have signed leaves
    expect(leaf1.dot.sign?.observer).toBeDefined();
    expect(leaf2.dot.sign?.observer).toBeDefined();

    // Signers are different
    const obs1 = Buffer.from(leaf1.dot.sign!.observer!).toString('hex');
    const obs2 = Buffer.from(leaf2.dot.sign!.observer!).toString('hex');
    expect(obs1).not.toBe(obs2);
  });

  it('leaf content is stored in payload', async () => {
    const root = tree.roots.get('connect')!;
    const leaf = await addLeaf(tree, { content: 'payload check', parentHash: root.hash });
    const decoded = new TextDecoder().decode(leaf.dot.payload);
    expect(decoded).toBe('payload check');
  });
});

// ─── getNode ──────────────────────────────────────────────────────────────────

describe('getNode', () => {
  it('returns correct node by hash', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    const node = getNode(tree, root.hash);
    expect(node).not.toBeNull();
    expect(node!.hash).toBe(root.hash);
  });

  it('returns null for unknown hash', async () => {
    const tree = await createTree();
    const node = getNode(tree, 'unknown-hash');
    expect(node).toBeNull();
  });
});

// ─── getChildren ──────────────────────────────────────────────────────────────

describe('getChildren', () => {
  it('returns empty array for leaf with no children', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    const leaf = await addLeaf(tree, { content: 'childless', parentHash: root.hash });
    expect(getChildren(tree, leaf.hash)).toHaveLength(0);
  });

  it('returns direct children only', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    const c1 = await addLeaf(tree, { content: 'child 1', parentHash: root.hash });
    const c2 = await addLeaf(tree, { content: 'child 2', parentHash: root.hash });
    // Add grandchild — should not appear in root's children
    await addLeaf(tree, { content: 'grandchild', parentHash: c1.hash });

    const children = getChildren(tree, root.hash);
    const childHashes = children.map((c) => c.hash);
    expect(childHashes).toContain(c1.hash);
    expect(childHashes).toContain(c2.hash);
    expect(children).toHaveLength(2);
  });

  it('returns empty array for unknown hash', async () => {
    const tree = await createTree();
    expect(getChildren(tree, 'nonexistent')).toHaveLength(0);
  });
});

// ─── getAncestors ─────────────────────────────────────────────────────────────

describe('getAncestors', () => {
  it('returns empty for root node', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    expect(getAncestors(tree, root.hash)).toHaveLength(0);
  });

  it('returns [root] for depth-1 node', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    const leaf = await addLeaf(tree, { content: 'level 1', parentHash: root.hash });
    const ancestors = getAncestors(tree, leaf.hash);
    expect(ancestors).toHaveLength(1);
    expect(ancestors[0]!.hash).toBe(root.hash);
  });

  it('walks to root for deeply nested nodes', async () => {
    const tree = await createTree();
    const root = tree.roots.get('flow')!;
    const l1 = await addLeaf(tree, { content: 'l1', parentHash: root.hash });
    const l2 = await addLeaf(tree, { content: 'l2', parentHash: l1.hash });
    const l3 = await addLeaf(tree, { content: 'l3', parentHash: l2.hash });

    const ancestors = getAncestors(tree, l3.hash);
    expect(ancestors).toHaveLength(3);
    expect(ancestors[0]!.hash).toBe(root.hash); // root-first
    expect(ancestors[1]!.hash).toBe(l1.hash);
    expect(ancestors[2]!.hash).toBe(l2.hash);
  });
});

// ─── getBranch ────────────────────────────────────────────────────────────────

describe('getBranch', () => {
  it('returns all nodes in a branch', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    await addLeaf(tree, { content: 'obs leaf 1', parentHash: root.hash });
    await addLeaf(tree, { content: 'obs leaf 2', parentHash: root.hash });

    const branch = getBranch(tree, 'observe');
    expect(branch.length).toBeGreaterThanOrEqual(3); // root + 2 leaves
    for (const node of branch) {
      expect(node.branch).toBe('observe');
    }
  });

  it('returns empty for unknown branch', async () => {
    const tree = await createTree();
    expect(getBranch(tree, 'nonexistent')).toHaveLength(0);
  });
});

// ─── search ───────────────────────────────────────────────────────────────────

describe('search', () => {
  it('finds nodes matching content', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    await addLeaf(tree, { content: 'the universe expands', parentHash: root.hash });
    await addLeaf(tree, { content: 'stars are born', parentHash: root.hash });

    const results = search(tree, 'universe');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]!.label).toContain('universe');
  });

  it('is case-insensitive', async () => {
    const tree = await createTree();
    const root = tree.roots.get('connect')!;
    await addLeaf(tree, { content: 'UPPER CASE CONTENT', parentHash: root.hash });

    const results = search(tree, 'upper case');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for no match', async () => {
    const tree = await createTree();
    const results = search(tree, 'xyznotfound123');
    expect(results).toHaveLength(0);
  });

  it('finds root nodes by content', async () => {
    const tree = await createTree();
    const results = search(tree, 'knowledge begins');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── depth ────────────────────────────────────────────────────────────────────

describe('depth', () => {
  it('returns 0 for tree with only roots', async () => {
    const tree = await createTree();
    expect(depth(tree)).toBe(0);
  });

  it('returns 1 after adding one leaf', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    await addLeaf(tree, { content: 'depth 1', parentHash: root.hash });
    expect(depth(tree)).toBe(1);
  });

  it('returns deepest node depth', async () => {
    const tree = await createTree();
    const root = tree.roots.get('flow')!;
    const l1 = await addLeaf(tree, { content: 'l1', parentHash: root.hash });
    const l2 = await addLeaf(tree, { content: 'l2', parentHash: l1.hash });
    await addLeaf(tree, { content: 'l3', parentHash: l2.hash });
    expect(depth(tree)).toBe(3);
  });
});

// ─── size ─────────────────────────────────────────────────────────────────────

describe('size', () => {
  it('returns 4 for genesis tree', async () => {
    const tree = await createTree();
    expect(size(tree)).toBe(4);
  });

  it('increments by 1 for each leaf added', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    await addLeaf(tree, { content: 'a', parentHash: root.hash });
    expect(size(tree)).toBe(5);
    await addLeaf(tree, { content: 'b', parentHash: root.hash });
    expect(size(tree)).toBe(6);
  });
});

// ─── verifyTree ───────────────────────────────────────────────────────────────

describe('verifyTree', () => {
  it('passes for a fresh genesis tree', async () => {
    const tree = await createTree();
    const result = await verifyTree(tree);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('passes after adding leaves', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    await addLeaf(tree, { content: 'verified leaf', parentHash: root.hash });
    const result = await verifyTree(tree);
    expect(result.valid).toBe(true);
  });

  it('fails if a DOT signature is tampered', async () => {
    const tree = await createTree();
    // Tamper a root DOT signature
    const root = tree.roots.get('observe')!;
    if (root.dot.sign?.signature) {
      root.dot.sign.signature[0] ^= 0xff; // flip first byte
    }
    const result = await verifyTree(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
