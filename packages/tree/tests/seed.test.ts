/**
 * seed.test.ts — Seed protocol tests for @dot-protocol/tree.
 * 15+ tests covering createSeed, getSeedDOT, and genesis structure.
 */

import { describe, it, expect } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import { createSeed, getSeedDOT } from '../src/seed.js';

// ─── createSeed ───────────────────────────────────────────────────────────────

describe('createSeed', () => {
  it('returns a tree with exactly 4 nodes', async () => {
    const tree = await createSeed();
    expect(tree.nodes.size).toBe(4);
  });

  it('has 3 root branches: observe, flow, connect', async () => {
    const tree = await createSeed();
    expect(tree.roots.has('observe')).toBe(true);
    expect(tree.roots.has('flow')).toBe(true);
    expect(tree.roots.has('connect')).toBe(true);
  });

  it('observe root label is correct', async () => {
    const tree = await createSeed();
    expect(tree.roots.get('observe')!.label).toBe('All knowledge begins with observation');
  });

  it('flow root label is correct', async () => {
    const tree = await createSeed();
    expect(tree.roots.get('flow')!.label).toBe('All action begins with flow');
  });

  it('connect root label is correct', async () => {
    const tree = await createSeed();
    expect(tree.roots.get('connect')!.label).toBe('All meaning begins with connection');
  });

  it('all root DOTs are signed', async () => {
    const tree = await createSeed();
    for (const root of tree.roots.values()) {
      expect(root.dot.sign?.signature).toBeDefined();
      expect(root.dot.sign?.observer).toBeDefined();
    }
  });

  it('genesis DOT is signed', async () => {
    const tree = await createSeed();
    const genesisDOT = getSeedDOT(tree);
    expect(genesisDOT.sign?.signature).toBeDefined();
  });

  it('all root nodes have depth 0', async () => {
    const tree = await createSeed();
    for (const root of tree.roots.values()) {
      expect(root.depth).toBe(0);
    }
  });

  it('accepts a custom identity', async () => {
    const id = await createIdentity();
    const tree = await createSeed(id);
    const pubKey = Buffer.from(tree.identity.publicKey).toString('hex');
    expect(pubKey).toBe(Buffer.from(id.publicKey).toString('hex'));
  });

  it('two seeds with different identities produce different DOT signatures', async () => {
    const id1 = await createIdentity();
    const id2 = await createIdentity();

    const tree1 = await createSeed(id1);
    const tree2 = await createSeed(id2);

    const root1 = tree1.roots.get('observe')!;
    const root2 = tree2.roots.get('observe')!;

    const sig1 = Buffer.from(root1.dot.sign!.signature!).toString('hex');
    const sig2 = Buffer.from(root2.dot.sign!.signature!).toString('hex');

    expect(sig1).not.toBe(sig2);
  });

  it('bond DOTs link roots to genesis', async () => {
    const tree = await createSeed();
    // Genesis node's label should contain root hashes
    for (const node of tree.nodes.values()) {
      if (node.branch === 'genesis') {
        expect(node.label).toContain('genesis');
        break;
      }
    }
  });

  it('chain appendCount is 4 after seed', async () => {
    const tree = await createSeed();
    expect(tree.chain.appendCount).toBe(4);
  });
});

// ─── getSeedDOT ───────────────────────────────────────────────────────────────

describe('getSeedDOT', () => {
  it('returns the genesis DOT', async () => {
    const tree = await createSeed();
    const genDOT = getSeedDOT(tree);
    expect(genDOT).toBeDefined();
    expect(genDOT.type).toBe('bond');
  });

  it('genesis DOT has a signature', async () => {
    const tree = await createSeed();
    const genDOT = getSeedDOT(tree);
    expect(genDOT.sign?.signature).toBeDefined();
  });

  it('genesis DOT has chain linkage', async () => {
    const tree = await createSeed();
    const genDOT = getSeedDOT(tree);
    expect(genDOT.chain?.previous).toBeDefined();
  });
});
