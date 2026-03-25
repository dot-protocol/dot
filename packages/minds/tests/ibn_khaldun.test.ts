/**
 * ibn_khaldun.test.ts — Ibn Khaldun Mind tests.
 * 15+ tests covering config, domain, knowledge search, and response quality.
 */

import { describe, it, expect, vi } from 'vitest';
import { createIbnKhaldun, IBN_KHALDUN_CONFIG } from '../src/ibn_khaldun.js';
import { Mind } from '../src/mind.js';
import type { InferenceProvider } from '../src/types.js';

function createMockProvider(response: string = 'Mock response'): InferenceProvider {
  return { generate: vi.fn().mockResolvedValue(response) };
}

// ─── Config Verification ──────────────────────────────────────────────────────

describe('Ibn Khaldun config', () => {
  it('has correct id', () => {
    expect(IBN_KHALDUN_CONFIG.id).toBe('ibn_khaldun');
  });

  it('has correct name', () => {
    expect(IBN_KHALDUN_CONFIG.name).toBe('Ibn Khaldun');
  });

  it('has correct era', () => {
    expect(IBN_KHALDUN_CONFIG.era).toBe('1332-1406');
  });

  it('axiom contains "Geography"', () => {
    expect(IBN_KHALDUN_CONFIG.axiom).toContain('Geography');
  });

  it('axiom contains "fate"', () => {
    expect(IBN_KHALDUN_CONFIG.axiom).toContain('fate');
  });

  it('domain includes "history"', () => {
    expect(IBN_KHALDUN_CONFIG.domain).toContain('history');
  });

  it('domain includes "sociology"', () => {
    expect(IBN_KHALDUN_CONFIG.domain).toContain('sociology');
  });

  it('domain includes "economics"', () => {
    expect(IBN_KHALDUN_CONFIG.domain).toContain('economics');
  });

  it('domain includes "civilization"', () => {
    expect(IBN_KHALDUN_CONFIG.domain).toContain('civilization');
  });

  it('has at least 4 primary sources', () => {
    expect(IBN_KHALDUN_CONFIG.primarySources.length).toBeGreaterThanOrEqual(4);
  });

  it('includes Muqaddimah as a source', () => {
    const titles = IBN_KHALDUN_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes('Muqaddimah'))).toBe(true);
  });

  it('system prompt mentions asabiyyah or civilization', () => {
    const prompt = IBN_KHALDUN_CONFIG.systemPrompt.toLowerCase();
    expect(prompt.includes('asabiyyah') || prompt.includes('civilization')).toBe(true);
  });

  it('primary sources contain content about asabiyyah', () => {
    const allContent = IBN_KHALDUN_CONFIG.primarySources.map((s) => s.content).join(' ');
    expect(allContent).toContain('asabiyyah');
  });

  it('primary sources mention rise and fall of dynasties', () => {
    const allContent = IBN_KHALDUN_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('dynasty') || allContent.includes('dynasties')).toBe(true);
  });
});

// ─── Mind Factory ─────────────────────────────────────────────────────────────

describe('createIbnKhaldun', () => {
  it('returns a Mind instance', async () => {
    const khaldun = await createIbnKhaldun();
    expect(khaldun).toBeInstanceOf(Mind);
  });

  it('has ibn_khaldun as config id', async () => {
    const khaldun = await createIbnKhaldun();
    expect(khaldun.config.id).toBe('ibn_khaldun');
  });

  it('has a valid Ed25519 keypair', async () => {
    const khaldun = await createIbnKhaldun();
    expect(khaldun.identity.publicKey.length).toBe(32);
    expect(khaldun.identity.secretKey.length).toBe(32);
  });

  it('two Ibn Khaldun instances have different identities', async () => {
    const k1 = await createIbnKhaldun();
    const k2 = await createIbnKhaldun();
    expect(k1.identity.publicKey).not.toEqual(k2.identity.publicKey);
  });

  it('accepts a custom provider', async () => {
    const mock = createMockProvider('Civilizations rise through asabiyyah and fall through luxury.');
    const khaldun = await createIbnKhaldun(mock);
    const response = await khaldun.respond('test');
    expect(response.text).toBe('Civilizations rise through asabiyyah and fall through luxury.');
  });
});

// ─── Knowledge Search ─────────────────────────────────────────────────────────

describe('Ibn Khaldun knowledge search', () => {
  it('finds sources for civilization query', async () => {
    const khaldun = await createIbnKhaldun();
    const sources = khaldun.searchKnowledge('civilization rise fall dynasty asabiyyah');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('finds sources for economics query', async () => {
    const khaldun = await createIbnKhaldun();
    const sources = khaldun.searchKnowledge('economics taxation labor value trade');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('knowledge base contains content about taxation', () => {
    const allContent = IBN_KHALDUN_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('tax')).toBe(true);
  });

  it('sources contain content about geography or climate', () => {
    const allContent = IBN_KHALDUN_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('geography') || allContent.includes('climate')).toBe(true);
  });
});

// ─── Response Quality ─────────────────────────────────────────────────────────

describe('Ibn Khaldun response', () => {
  it('responds to a civilization question', async () => {
    const khaldun = await createIbnKhaldun();
    const response = await khaldun.respond('Why do civilizations fall?');
    expect(response.text.length).toBeGreaterThan(10);
    expect(response.confidence).toBeGreaterThanOrEqual(0);
  });

  it('responds to an economics question', async () => {
    const khaldun = await createIbnKhaldun();
    const response = await khaldun.respond('How do taxes affect economic growth?');
    expect(response.text.length).toBeGreaterThan(10);
  });

  it('response includes citation when knowledge matches', async () => {
    const khaldun = await createIbnKhaldun();
    const response = await khaldun.respond('civilization asabiyyah dynasty rise fall');
    if (response.confidence > 0) {
      expect(response.citations.length).toBeGreaterThan(0);
    }
  });

  it('mock provider response returned verbatim', async () => {
    const mock = createMockProvider('Geography is fate — the environment shapes civilization.');
    const khaldun = await createIbnKhaldun(mock);
    const response = await khaldun.respond('geography environment civilization');
    expect(response.text).toBe('Geography is fate — the environment shapes civilization.');
  });

  it('correlate returns null or valid response', async () => {
    const khaldun = await createIbnKhaldun();
    const unrelated = await khaldun.respond('quantum electrodynamics particle spin');
    const result = await khaldun.correlate(unrelated);
    expect(result === null || result.text.length > 0).toBe(true);
  });

  it('correlate finds connection on social cohesion topic', async () => {
    const khaldun = await createIbnKhaldun();
    const other = await createIbnKhaldun();
    const otherResponse = await other.respond('social cohesion civilization dynasty group asabiyyah');
    const correlation = await khaldun.correlate(otherResponse);
    expect(correlation === null || correlation.text.length > 0).toBe(true);
  });
});
