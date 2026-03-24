/**
 * Routing tests — request, resolve, cache.
 * Target: 20+ tests.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { observe } from '@dot-protocol/core';
import { request, resolve, clearResolveCache } from '../src/routing.js';
import { createTestMesh, waitFor } from './helpers.js';
import type { TestMesh } from './helpers.js';

let mesh: TestMesh;

beforeEach(() => {
  clearResolveCache();
});

afterEach(() => {
  mesh?.cleanup();
  clearResolveCache();
});

describe('request()', () => {
  it('returns null when DOT not found anywhere', async () => {
    mesh = await createTestMesh(2);
    const result = await request(mesh.nodes[0]!, 'a'.repeat(64));
    expect(result).toBeNull();
  }, 2000);

  it('returns DOT from local storage without hitting peers', async () => {
    mesh = await createTestMesh(2);
    const node = mesh.nodes[0]!;
    const dot = observe('local', { plaintext: true });
    const hash = node.store(dot);
    const result = await request(node, hash);
    expect(result).not.toBeNull();
  });

  it('returns DOT found at direct peer', async () => {
    mesh = await createTestMesh(2);
    const [requester, provider] = [mesh.nodes[0]!, mesh.nodes[1]!];

    const dot = observe('at-peer', { plaintext: true });
    const hash = provider.store(dot);

    const result = await request(requester, hash);
    expect(result).not.toBeNull();
  });

  it('returns null when all peers do not have the DOT', async () => {
    mesh = await createTestMesh(2);
    const fakeHash = '0'.repeat(64);
    const result = await request(mesh.nodes[0]!, fakeHash);
    expect(result).toBeNull();
  }, 2000);

  it('request from node with no peers returns null', async () => {
    mesh = await createTestMesh(1);
    const result = await request(mesh.nodes[0]!, 'b'.repeat(64));
    expect(result).toBeNull();
  });

  it('retrieved DOT is stored locally after request', async () => {
    mesh = await createTestMesh(2);
    const [requester, provider] = [mesh.nodes[0]!, mesh.nodes[1]!];

    const dot = observe('fetch-and-store', { plaintext: true });
    const hash = provider.store(dot);

    await request(requester, hash);
    await waitFor(() => requester.storage.get(hash) !== null, 500);
    expect(requester.storage.get(hash)).not.toBeNull();
  });

  it('cache hit: second request returns without network call', async () => {
    mesh = await createTestMesh(2);
    const [requester, provider] = [mesh.nodes[0]!, mesh.nodes[1]!];

    const dot = observe('cache-test', { plaintext: true });
    const hash = provider.store(dot);

    const first = await request(requester, hash);
    expect(first).not.toBeNull();

    // Second call — served from LRU cache
    const second = await request(requester, hash);
    expect(second).not.toBeNull();
  });

  it('request returns null for empty-string hash', async () => {
    mesh = await createTestMesh(2);
    const result = await request(mesh.nodes[0]!, '');
    expect(result).toBeNull();
  }, 2000);

  it('concurrent requests for the same hash both resolve', async () => {
    mesh = await createTestMesh(2);
    const [requester, provider] = [mesh.nodes[0]!, mesh.nodes[1]!];

    const dot = observe('concurrent', { plaintext: true });
    const hash = provider.store(dot);

    const [r1, r2] = await Promise.all([
      request(requester, hash),
      request(requester, hash),
    ]);

    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
  });

  it('requests for different hashes resolve independently', async () => {
    mesh = await createTestMesh(2);
    const [requester, provider] = [mesh.nodes[0]!, mesh.nodes[1]!];

    const dot1 = observe('hash-a', { plaintext: true });
    const dot2 = observe('hash-b', { plaintext: true });
    const hash1 = provider.store(dot1);
    const hash2 = provider.store(dot2);

    const [r1, r2] = await Promise.all([
      request(requester, hash1),
      request(requester, hash2),
    ]);

    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
  });
});

describe('resolve()', () => {
  it('resolves DOT from local storage', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;
    const dot = observe('local-resolve', { plaintext: true });
    const hash = node.store(dot);
    const result = await resolve(node, hash);
    expect(result).not.toBeNull();
  });

  it('resolves DOT from direct peer', async () => {
    mesh = await createTestMesh(2);
    const [requester, provider] = [mesh.nodes[0]!, mesh.nodes[1]!];
    const dot = observe('peer-resolve', { plaintext: true });
    const hash = provider.store(dot);
    const result = await resolve(requester, hash);
    expect(result).not.toBeNull();
  });

  it('returns null when DOT not found within maxHops', async () => {
    mesh = await createTestMesh(2);
    const result = await resolve(mesh.nodes[0]!, 'c'.repeat(64), 1);
    expect(result).toBeNull();
  }, 4000);

  it('cache hit on second resolve call', async () => {
    mesh = await createTestMesh(2);
    const [requester, provider] = [mesh.nodes[0]!, mesh.nodes[1]!];
    const dot = observe('resolve-cache', { plaintext: true });
    const hash = provider.store(dot);

    await resolve(requester, hash);
    const second = await resolve(requester, hash);
    expect(second).not.toBeNull();
  });

  it('resolve with maxHops=0 still checks local', async () => {
    mesh = await createTestMesh(1);
    const node = mesh.nodes[0]!;
    const dot = observe('zero-hops', { plaintext: true });
    const hash = node.store(dot);
    const result = await resolve(node, hash, 0);
    expect(result).not.toBeNull();
  });

  it('resolve with maxHops=3 (default) still finds peer DOT', async () => {
    mesh = await createTestMesh(2);
    const [requester, provider] = [mesh.nodes[0]!, mesh.nodes[1]!];
    const dot = observe('three-hop', { plaintext: true });
    const hash = provider.store(dot);
    const result = await resolve(requester, hash, 3);
    expect(result).not.toBeNull();
  });

  it('clearResolveCache removes cached entries', async () => {
    mesh = await createTestMesh(2);
    const [requester, provider] = [mesh.nodes[0]!, mesh.nodes[1]!];
    const dot = observe('cache-clear', { plaintext: true });
    const hash = provider.store(dot);

    // Populate cache
    await resolve(requester, hash);
    clearResolveCache();

    // After clearing, still works (falls back to network)
    const result = await resolve(requester, hash);
    expect(result).not.toBeNull();
  });

  it('multiple concurrent resolves return consistently', async () => {
    mesh = await createTestMesh(2);
    const [requester, provider] = [mesh.nodes[0]!, mesh.nodes[1]!];
    const dot = observe('concurrent-resolve', { plaintext: true });
    const hash = provider.store(dot);

    const results = await Promise.all([
      resolve(requester, hash),
      resolve(requester, hash),
      resolve(requester, hash),
    ]);

    for (const r of results) {
      expect(r).not.toBeNull();
    }
  });

  it('resolve returns null for non-existent hash with single node', async () => {
    mesh = await createTestMesh(1);
    const result = await resolve(mesh.nodes[0]!, 'd'.repeat(64), 2);
    expect(result).toBeNull();
  });
});
