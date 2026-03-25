/**
 * health.test.ts — Tree health tests for @dot-protocol/tree.
 * 5+ tests covering treeHealth().
 */

import { describe, it, expect } from 'vitest';
import { createTree, addLeaf } from '../src/tree.js';
import { treeHealth } from '../src/health.js';

describe('treeHealth', () => {
  it('returns a measure DOT', async () => {
    const tree = await createTree();
    const h = treeHealth(tree);
    expect(h.type).toBe('measure');
  });

  it('health DOT payload is JSON with correct total_nodes for genesis tree', async () => {
    const tree = await createTree();
    const h = treeHealth(tree);
    const payload = JSON.parse(new TextDecoder().decode(h.payload));
    expect(payload.total_nodes).toBe(4);
  });

  it('health DOT shows depth 0 for genesis tree', async () => {
    const tree = await createTree();
    const h = treeHealth(tree);
    const payload = JSON.parse(new TextDecoder().decode(h.payload));
    expect(payload.depth).toBe(0);
  });

  it('health DOT shows correct node count after adding leaves', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    await addLeaf(tree, { content: 'leaf 1', parentHash: root.hash });
    await addLeaf(tree, { content: 'leaf 2', parentHash: root.hash });

    const h = treeHealth(tree);
    const payload = JSON.parse(new TextDecoder().decode(h.payload));
    expect(payload.total_nodes).toBe(6);
  });

  it('health DOT shows correct depth after nesting', async () => {
    const tree = await createTree();
    const root = tree.roots.get('flow')!;
    const l1 = await addLeaf(tree, { content: 'l1', parentHash: root.hash });
    const l2 = await addLeaf(tree, { content: 'l2', parentHash: l1.hash });
    await addLeaf(tree, { content: 'l3', parentHash: l2.hash });

    const h = treeHealth(tree);
    const payload = JSON.parse(new TextDecoder().decode(h.payload));
    expect(payload.depth).toBe(3);
  });

  it('health DOT has branches count >= 4 (genesis + 3 branches)', async () => {
    const tree = await createTree();
    const h = treeHealth(tree);
    const payload = JSON.parse(new TextDecoder().decode(h.payload));
    // genesis + observe + flow + connect = 4 distinct branches
    expect(payload.branches).toBe(4);
  });

  it('orphan_count is 0 for a valid tree', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    await addLeaf(tree, { content: 'normal leaf', parentHash: root.hash });

    const h = treeHealth(tree);
    const payload = JSON.parse(new TextDecoder().decode(h.payload));
    expect(payload.orphan_count).toBe(0);
  });
});
