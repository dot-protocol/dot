/**
 * history.test.ts — DotFS history/chain walk tests.
 *
 * 25+ tests: walk versions, depth limit, 100-version file,
 * branching (overwrite from different identity).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity, hash } from '@dot-protocol/core';
import { DotFS } from '../src/dotfs.js';
import { MemoryFSBackend } from '../src/backends/memory.js';

let backend: MemoryFSBackend;
let dotfs: DotFS;

beforeEach(async () => {
  backend = new MemoryFSBackend();
  const identity = await createIdentity();
  dotfs = new DotFS(backend, identity);
});

// ─── Basic history ─────────────────────────────────────────────────────────────

describe('history — basic', () => {
  it('returns empty array for file with no sidecar', () => {
    backend.writeFile('/raw.txt', new TextEncoder().encode('raw'));
    const h = dotfs.history('/raw.txt');
    expect(h).toHaveLength(0);
  });

  it('returns one DOT after one write', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('v1'));
    const h = dotfs.history('/file.txt');
    expect(h).toHaveLength(1);
  });

  it('returns two DOTs after two writes', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('v1'));
    await dotfs.write('/file.txt', new TextEncoder().encode('v2'));
    const h = dotfs.history('/file.txt');
    expect(h).toHaveLength(2);
  });

  it('history is in reverse chronological order (latest first)', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('v1'));
    await dotfs.write('/file.txt', new TextEncoder().encode('v2'));
    await dotfs.write('/file.txt', new TextEncoder().encode('v3'));
    const h = dotfs.history('/file.txt');
    // Latest first: chain.depth should be 2, 1, 0
    expect(h[0]?.chain?.depth).toBe(2);
    expect(h[1]?.chain?.depth).toBe(1);
    expect(h[2]?.chain?.depth).toBe(0);
  });

  it('first item in history is the most recent write', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('first'));
    await dotfs.write('/file.txt', new TextEncoder().encode('second'));
    const h = dotfs.history('/file.txt');
    expect(h[0]?.chain?.depth).toBe(1);
  });

  it('last item in history is the genesis write', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('first'));
    await dotfs.write('/file.txt', new TextEncoder().encode('second'));
    await dotfs.write('/file.txt', new TextEncoder().encode('third'));
    const h = dotfs.history('/file.txt');
    const last = h[h.length - 1];
    expect(last?.chain?.depth).toBe(0);
  });
});

// ─── Depth limit ──────────────────────────────────────────────────────────────

describe('history — depth limit', () => {
  it('depth=1 returns only the latest DOT', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('v1'));
    await dotfs.write('/file.txt', new TextEncoder().encode('v2'));
    await dotfs.write('/file.txt', new TextEncoder().encode('v3'));
    const h = dotfs.history('/file.txt', 1);
    expect(h).toHaveLength(1);
    expect(h[0]?.chain?.depth).toBe(2);
  });

  it('depth=2 returns latest two DOTs', async () => {
    for (let i = 0; i < 5; i++) {
      await dotfs.write('/file.txt', new TextEncoder().encode(`v${i}`));
    }
    const h = dotfs.history('/file.txt', 2);
    expect(h).toHaveLength(2);
    expect(h[0]?.chain?.depth).toBe(4);
    expect(h[1]?.chain?.depth).toBe(3);
  });

  it('depth=0 returns all DOTs', async () => {
    for (let i = 0; i < 10; i++) {
      await dotfs.write('/file.txt', new TextEncoder().encode(`v${i}`));
    }
    const h = dotfs.history('/file.txt', 0);
    expect(h).toHaveLength(10);
  });

  it('depth larger than chain length returns full chain', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('v1'));
    await dotfs.write('/file.txt', new TextEncoder().encode('v2'));
    const h = dotfs.history('/file.txt', 100);
    expect(h).toHaveLength(2);
  });

  it('undefined depth returns all DOTs', async () => {
    for (let i = 0; i < 7; i++) {
      await dotfs.write('/file.txt', new TextEncoder().encode(`v${i}`));
    }
    const h = dotfs.history('/file.txt');
    expect(h).toHaveLength(7);
  });
});

// ─── Chain integrity ──────────────────────────────────────────────────────────

describe('history — chain integrity', () => {
  it('each DOT in history has a signature', async () => {
    for (let i = 0; i < 5; i++) {
      await dotfs.write('/file.txt', new TextEncoder().encode(`v${i}`));
    }
    const h = dotfs.history('/file.txt');
    for (const dot of h) {
      expect(dot.sign?.signature).toBeDefined();
      expect(dot.sign?.signature?.length).toBe(64);
    }
  });

  it('each DOT in history has a verify.hash', async () => {
    for (let i = 0; i < 5; i++) {
      await dotfs.write('/file.txt', new TextEncoder().encode(`v${i}`));
    }
    const h = dotfs.history('/file.txt');
    for (const dot of h) {
      expect(dot.verify?.hash).toBeDefined();
    }
  });

  it('chain linkage is valid: each DOT.chain.previous = hash(prev DOT)', async () => {
    for (let i = 0; i < 5; i++) {
      await dotfs.write('/file.txt', new TextEncoder().encode(`v${i}`));
    }
    const h = dotfs.history('/file.txt');
    // h is reverse order: h[0] = latest, h[4] = genesis
    // Check in forward direction (reverse h)
    const forward = h.slice().reverse();
    for (let i = 1; i < forward.length; i++) {
      const prev = forward[i - 1]!;
      const curr = forward[i]!;
      const expectedPrev = hash(prev);
      const actualPrev = curr.chain?.previous;
      expect(actualPrev).toBeDefined();
      expect(Array.from(actualPrev!)).toEqual(Array.from(expectedPrev));
    }
  });

  it('genesis DOT has all-zero chain.previous', async () => {
    await dotfs.write('/file.txt', new TextEncoder().encode('first'));
    await dotfs.write('/file.txt', new TextEncoder().encode('second'));
    const h = dotfs.history('/file.txt');
    const genesis = h[h.length - 1]!;
    expect(genesis.chain?.previous?.every(b => b === 0)).toBe(true);
  });
});

// ─── 100-version stress ────────────────────────────────────────────────────────

describe('history — 100-version file', () => {
  it('accumulates 100 writes correctly', async () => {
    for (let i = 0; i < 100; i++) {
      await dotfs.write('/big.txt', new TextEncoder().encode(`version ${i}`));
    }
    const h = dotfs.history('/big.txt');
    expect(h).toHaveLength(100);
  }, 60_000); // 60s timeout for 100 async writes

  it('100th write has chain.depth = 99', async () => {
    for (let i = 0; i < 100; i++) {
      await dotfs.write('/big.txt', new TextEncoder().encode(`version ${i}`));
    }
    const h = dotfs.history('/big.txt');
    expect(h[0]?.chain?.depth).toBe(99);
  }, 60_000);

  it('depth=10 from 100 returns latest 10', async () => {
    for (let i = 0; i < 100; i++) {
      await dotfs.write('/big.txt', new TextEncoder().encode(`v${i}`));
    }
    const h = dotfs.history('/big.txt', 10);
    expect(h).toHaveLength(10);
    expect(h[0]?.chain?.depth).toBe(99);
  }, 60_000);
});

// ─── Branching (different identities) ─────────────────────────────────────────

describe('history — branching from different identity', () => {
  it('second identity can write to same file, extending chain', async () => {
    const identity2 = await createIdentity();
    const dotfs2 = new DotFS(backend, identity2);

    await dotfs.write('/shared.txt', new TextEncoder().encode('from identity 1'));
    await dotfs2.write('/shared.txt', new TextEncoder().encode('from identity 2'));

    const h = dotfs.history('/shared.txt');
    expect(h).toHaveLength(2);
  });

  it('two different observers are tracked in chain', async () => {
    const identity2 = await createIdentity();
    const dotfs2 = new DotFS(backend, identity2);

    const dot1 = await dotfs.write('/shared.txt', new TextEncoder().encode('v1'));
    const dot2 = await dotfs2.write('/shared.txt', new TextEncoder().encode('v2'));

    const key1 = Array.from(dot1.sign?.observer ?? []).join(',');
    const key2 = Array.from(dot2.sign?.observer ?? []).join(',');
    expect(key1).not.toBe(key2);
  });

  it('history shows latest write from second identity first', async () => {
    const identity2 = await createIdentity();
    const dotfs2 = new DotFS(backend, identity2);

    const identity2PK = identity2.publicKey;

    await dotfs.write('/shared.txt', new TextEncoder().encode('v1'));
    await dotfs2.write('/shared.txt', new TextEncoder().encode('v2'));

    const h = dotfs.history('/shared.txt');
    const latestObserver = Array.from(h[0]?.sign?.observer ?? []).join(',');
    const expectedObserver = Array.from(identity2PK).join(',');
    expect(latestObserver).toBe(expectedObserver);
  });
});
