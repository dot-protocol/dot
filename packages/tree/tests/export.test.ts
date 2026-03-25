/**
 * export.test.ts — Serialization and rendering tests for @dot-protocol/tree.
 * 15+ tests covering toJSON, fromJSON, toMarkdown, toDotMark.
 */

import { describe, it, expect } from 'vitest';
import { createTree, addLeaf, verifyTree } from '../src/tree.js';
import { toJSON, fromJSON, toMarkdown, toDotMark } from '../src/export.js';

// ─── toJSON / fromJSON ────────────────────────────────────────────────────────

describe('toJSON', () => {
  it('produces a valid JSON string', async () => {
    const tree = await createTree();
    const json = toJSON(tree);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('contains version 1.0', async () => {
    const tree = await createTree();
    const parsed = JSON.parse(toJSON(tree));
    expect(parsed.version).toBe('1.0');
  });

  it('includes rootHashes array with 3 entries', async () => {
    const tree = await createTree();
    const parsed = JSON.parse(toJSON(tree));
    expect(parsed.rootHashes).toHaveLength(3);
  });

  it('includes all 4 nodes for genesis tree', async () => {
    const tree = await createTree();
    const parsed = JSON.parse(toJSON(tree));
    expect(Object.keys(parsed.nodes)).toHaveLength(4);
  });

  it('includes all nodes for 10-leaf tree', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    for (let i = 0; i < 10; i++) {
      await addLeaf(tree, { content: `leaf ${i}`, parentHash: root.hash });
    }
    const parsed = JSON.parse(toJSON(tree));
    expect(Object.keys(parsed.nodes)).toHaveLength(14);
  });
});

describe('fromJSON', () => {
  it('roundtrip: fromJSON(toJSON(tree)) has same node count', async () => {
    const tree = await createTree();
    const json = toJSON(tree);
    const restored = await fromJSON(json);
    expect(restored.nodes.size).toBe(tree.nodes.size);
  });

  it('roundtrip preserves root count', async () => {
    const tree = await createTree();
    const restored = await fromJSON(toJSON(tree));
    expect(restored.roots.size).toBe(tree.roots.size);
  });

  it('roundtrip preserves branch names', async () => {
    const tree = await createTree();
    const restored = await fromJSON(toJSON(tree));
    expect(restored.roots.has('observe')).toBe(true);
    expect(restored.roots.has('flow')).toBe(true);
    expect(restored.roots.has('connect')).toBe(true);
  });

  it('roundtrip preserves node labels', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    const restored = await fromJSON(toJSON(tree));
    const restoredRoot = restored.roots.get('observe')!;
    expect(restoredRoot.label).toBe(root.label);
  });

  it('roundtrip preserves child relationships', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    const leaf = await addLeaf(tree, { content: 'preserved child', parentHash: root.hash });

    const restored = await fromJSON(toJSON(tree));
    const restoredRoot = restored.roots.get('observe')!;
    expect(restoredRoot.children).toContain(leaf.hash);
  });

  it('roundtrip: verify() passes on restored 10-node tree', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    for (let i = 0; i < 6; i++) {
      await addLeaf(tree, { content: `node ${i}`, parentHash: root.hash });
    }
    const restored = await fromJSON(toJSON(tree));
    // Signatures should still verify (public keys + sigs preserved)
    const result = await verifyTree(restored);
    expect(result.valid).toBe(true);
  });

  it('throws on unsupported version', async () => {
    const fakeJson = JSON.stringify({ version: '2.0', rootHashes: [], nodes: {} });
    await expect(fromJSON(fakeJson)).rejects.toThrow('Unsupported tree version');
  });
});

// ─── toMarkdown ───────────────────────────────────────────────────────────────

describe('toMarkdown', () => {
  it('produces a non-empty string', async () => {
    const tree = await createTree();
    const md = toMarkdown(tree);
    expect(md.length).toBeGreaterThan(0);
  });

  it('contains Observe section header', async () => {
    const tree = await createTree();
    const md = toMarkdown(tree);
    expect(md).toContain('- Observe');
  });

  it('contains Flow section header', async () => {
    const tree = await createTree();
    const md = toMarkdown(tree);
    expect(md).toContain('- Flow');
  });

  it('contains Connect section header', async () => {
    const tree = await createTree();
    const md = toMarkdown(tree);
    expect(md).toContain('- Connect');
  });

  it('contains root labels as quoted lines', async () => {
    const tree = await createTree();
    const md = toMarkdown(tree);
    expect(md).toContain('"All knowledge begins with observation"');
    expect(md).toContain('"All action begins with flow"');
    expect(md).toContain('"All meaning begins with connection"');
  });

  it('includes leaf labels when leaves are added', async () => {
    const tree = await createTree();
    const root = tree.roots.get('observe')!;
    await addLeaf(tree, { content: 'unique leaf content xyz', parentHash: root.hash });

    const md = toMarkdown(tree);
    expect(md).toContain('unique leaf content xyz');
  });

  it('indents children deeper than parents', async () => {
    const tree = await createTree();
    const root = tree.roots.get('flow')!;
    await addLeaf(tree, { content: 'indented child', parentHash: root.hash });

    const md = toMarkdown(tree);
    const lines = md.split('\n');
    const rootLine = lines.find((l) => l.includes('All action begins with flow'))!;
    const childLine = lines.find((l) => l.includes('indented child'))!;

    // Child line should have more leading spaces
    const rootIndent = rootLine.match(/^(\s*)/)?.[1]?.length ?? 0;
    const childIndent = childLine.match(/^(\s*)/)?.[1]?.length ?? 0;
    expect(childIndent).toBeGreaterThan(rootIndent);
  });
});

// ─── toDotMark ────────────────────────────────────────────────────────────────

describe('toDotMark', () => {
  it('produces a non-empty string', async () => {
    const tree = await createTree();
    const dm = toDotMark(tree);
    expect(dm.length).toBeGreaterThan(0);
  });

  it('contains @page declaration', async () => {
    const tree = await createTree();
    const dm = toDotMark(tree);
    expect(dm).toContain('@page tree');
  });

  it('contains @section observe', async () => {
    const tree = await createTree();
    const dm = toDotMark(tree);
    expect(dm).toContain('@section observe');
  });

  it('contains @section flow', async () => {
    const tree = await createTree();
    const dm = toDotMark(tree);
    expect(dm).toContain('@section flow');
  });

  it('contains @section connect', async () => {
    const tree = await createTree();
    const dm = toDotMark(tree);
    expect(dm).toContain('@section connect');
  });

  it('contains @observe blocks', async () => {
    const tree = await createTree();
    const dm = toDotMark(tree);
    expect(dm).toContain('@observe');
  });

  it('contains hash fields', async () => {
    const tree = await createTree();
    const dm = toDotMark(tree);
    expect(dm).toContain('hash:');
  });

  it('contains branch fields', async () => {
    const tree = await createTree();
    const dm = toDotMark(tree);
    expect(dm).toContain('branch:');
  });

  it('contains depth fields', async () => {
    const tree = await createTree();
    const dm = toDotMark(tree);
    expect(dm).toContain('depth:');
  });
});
