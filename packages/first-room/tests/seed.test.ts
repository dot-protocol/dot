/**
 * seed.test.ts — Tests for the seed room and HTML generation.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verify_chain } from '@dot-protocol/chain';
import { seedFirstRoom, generateSeedHTML } from '../src/seed.js';
import { getChainView } from '../src/room-chain.js';

describe('seedFirstRoom', () => {
  it('returns a room with at least 4 DOTs (genesis + 3 seeds)', async () => {
    const room = await seedFirstRoom();
    expect(room.dotCount).toBeGreaterThanOrEqual(4);
  });

  it('chain is verifiable after seeding', async () => {
    const room = await seedFirstRoom();
    const result = verify_chain(room.chain);
    expect(result.valid).toBe(true);
  });

  it('contains the Rumi quote', async () => {
    const room = await seedFirstRoom();
    const entries = getChainView(room);
    const hasRumi = entries.some((e) => e.content.includes('Rumi'));
    expect(hasRumi).toBe(true);
  });

  it('contains the Feynman quote', async () => {
    const room = await seedFirstRoom();
    const entries = getChainView(room);
    const hasFeynman = entries.some((e) => e.content.includes('Feynman'));
    expect(hasFeynman).toBe(true);
  });

  it('contains the observation seed', async () => {
    const room = await seedFirstRoom();
    const entries = getChainView(room);
    const hasObs = entries.some((e) => e.content.includes('All knowledge begins with observation'));
    expect(hasObs).toBe(true);
  });

  it('genesis DOT is first entry', async () => {
    const room = await seedFirstRoom();
    const entries = getChainView(room);
    expect(entries[0]!.content).toBe('The first room. Where observation begins.');
  });

  it('all seed DOTs are signed', async () => {
    const room = await seedFirstRoom();
    const entries = getChainView(room);
    // All entries with depth > 0 should have an observer shortcode
    const signed = entries.every((e) => e.observer.length >= 8);
    expect(signed).toBe(true);
  });

  it('all seed DOTs have correct depths in sequence', async () => {
    const room = await seedFirstRoom();
    const entries = getChainView(room);
    for (let i = 0; i < entries.length; i++) {
      expect(entries[i]!.depth).toBe(i);
    }
  });

  it('room name is still ".the.first.room"', async () => {
    const room = await seedFirstRoom();
    expect(room.name).toBe('.the.first.room');
  });

  it('seed calls are idempotent (each call produces fresh room)', async () => {
    const room1 = await seedFirstRoom();
    const room2 = await seedFirstRoom();
    // Different rooms — different identities
    const pk1 = Buffer.from(room1.identity.publicKey).toString('hex');
    const pk2 = Buffer.from(room2.identity.publicKey).toString('hex');
    expect(pk1).not.toBe(pk2);
  });
});

describe('generateSeedHTML', () => {
  async function withTempOutput<T>(callback: (outPath: string) => Promise<T>): Promise<T> {
    const dir = await mkdtemp(join(tmpdir(), 'first-room-'));
    try {
      return await callback(join(dir, 'the-first-room.html'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  async function generateTestHTML(): Promise<string> {
    return withTempOutput((outPath) => generateSeedHTML(outPath));
  }

  it('returns valid HTML string', async () => {
    const html = await generateTestHTML();
    expect(html).toBeTruthy();
    expect(html.trim()).toMatch(/^<!DOCTYPE html>/i);
  });

  it('HTML contains .the.first.room', async () => {
    const html = await generateTestHTML();
    expect(html).toContain('.the.first.room');
  });

  it('HTML contains Rumi quote', async () => {
    const html = await generateTestHTML();
    expect(html).toContain('Rumi');
  });

  it('HTML contains Feynman quote', async () => {
    const html = await generateTestHTML();
    expect(html).toContain('Feynman');
  });

  it('HTML contains observe input', async () => {
    const html = await generateTestHTML();
    expect(html).toContain('observe-input');
  });

  it('HTML is under 50KB', async () => {
    const html = await generateTestHTML();
    const bytes = new TextEncoder().encode(html).length;
    expect(bytes).toBeLessThan(50 * 1024);
  });

  it('HTML contains chain verified indicator', async () => {
    const html = await generateTestHTML();
    expect(html).toContain('verified');
  });

  it('HTML has at least 4 DOT cards', async () => {
    const html = await generateTestHTML();
    // Count dot-card occurrences
    const matches = html.match(/class="dot-card/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(4);
  });

  it('HTML has no external script src', async () => {
    const html = await generateTestHTML();
    expect(html).not.toMatch(/<script[^>]+src="https?:\/\//);
  });

  it('file is written to the requested output path', async () => {
    await withTempOutput(async (outPath) => {
      await generateSeedHTML(outPath);
      expect(existsSync(outPath)).toBe(true);
    });
  });
});
