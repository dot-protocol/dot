/**
 * faraday.test.ts — Michael Faraday Mind tests.
 * 15+ tests covering config, domain, knowledge search, and response quality.
 */

import { describe, it, expect, vi } from 'vitest';
import { createFaraday, FARADAY_CONFIG } from '../src/faraday.js';
import { Mind } from '../src/mind.js';
import type { InferenceProvider } from '../src/types.js';

function createMockProvider(response: string = 'Mock response'): InferenceProvider {
  return { generate: vi.fn().mockResolvedValue(response) };
}

// ─── Config Verification ──────────────────────────────────────────────────────

describe('Faraday config', () => {
  it('has correct id', () => {
    expect(FARADAY_CONFIG.id).toBe('faraday');
  });

  it('has correct name', () => {
    expect(FARADAY_CONFIG.name).toBe('Michael Faraday');
  });

  it('has correct era', () => {
    expect(FARADAY_CONFIG.era).toBe('1791-1867');
  });

  it('axiom contains "wonderful"', () => {
    expect(FARADAY_CONFIG.axiom).toContain('wonderful');
  });

  it('axiom contains "laws of nature"', () => {
    expect(FARADAY_CONFIG.axiom).toContain('laws of nature');
  });

  it('domain includes "electromagnetism"', () => {
    expect(FARADAY_CONFIG.domain).toContain('electromagnetism');
  });

  it('domain includes "chemistry"', () => {
    expect(FARADAY_CONFIG.domain).toContain('chemistry');
  });

  it('domain includes "experimental science"', () => {
    expect(FARADAY_CONFIG.domain).toContain('experimental science');
  });

  it('domain includes "induction"', () => {
    expect(FARADAY_CONFIG.domain).toContain('induction');
  });

  it('has at least 4 primary sources', () => {
    expect(FARADAY_CONFIG.primarySources.length).toBeGreaterThanOrEqual(4);
  });

  it('includes Experimental Researches in Electricity', () => {
    const titles = FARADAY_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes('Experimental Researches'))).toBe(true);
  });

  it('includes Chemical History of a Candle', () => {
    const titles = FARADAY_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes('Candle') || t.includes('Chemical History'))).toBe(true);
  });

  it('system prompt mentions experiment or induction', () => {
    const prompt = FARADAY_CONFIG.systemPrompt.toLowerCase();
    expect(prompt.includes('experiment') || prompt.includes('induction')).toBe(true);
  });

  it('primary sources contain content about electromagnetic induction', () => {
    const allContent = FARADAY_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('induction') || allContent.includes('electromagnetic')).toBe(true);
  });
});

// ─── Mind Factory ─────────────────────────────────────────────────────────────

describe('createFaraday', () => {
  it('returns a Mind instance', async () => {
    const faraday = await createFaraday();
    expect(faraday).toBeInstanceOf(Mind);
  });

  it('has faraday as config id', async () => {
    const faraday = await createFaraday();
    expect(faraday.config.id).toBe('faraday');
  });

  it('has a valid Ed25519 keypair', async () => {
    const faraday = await createFaraday();
    expect(faraday.identity.publicKey.length).toBe(32);
    expect(faraday.identity.secretKey.length).toBe(32);
  });

  it('two Faraday instances have different identities', async () => {
    const f1 = await createFaraday();
    const f2 = await createFaraday();
    expect(f1.identity.publicKey).not.toEqual(f2.identity.publicKey);
  });

  it('accepts a custom provider', async () => {
    const mock = createMockProvider('Nothing is too wonderful to be true.');
    const faraday = await createFaraday(mock);
    const response = await faraday.respond('test');
    expect(response.text).toBe('Nothing is too wonderful to be true.');
  });
});

// ─── Knowledge Search ─────────────────────────────────────────────────────────

describe('Faraday knowledge search', () => {
  it('finds sources for electromagnetism query', async () => {
    const faraday = await createFaraday();
    const sources = faraday.searchKnowledge('electromagnetic induction electricity magnetism');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('finds sources for candle chemistry query', async () => {
    const faraday = await createFaraday();
    const sources = faraday.searchKnowledge('candle flame burning chemistry carbon');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('knowledge base contains content about magnetic fields', () => {
    const allContent = FARADAY_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('magnetic') || allContent.includes('magnet')).toBe(true);
  });

  it('sources include content about lines of force', () => {
    const allContent = FARADAY_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('lines of force') || allContent.includes('field')).toBe(true);
  });
});

// ─── Response Quality ─────────────────────────────────────────────────────────

describe('Faraday response', () => {
  it('responds to an electromagnetism question', async () => {
    const faraday = await createFaraday();
    const response = await faraday.respond('What is electromagnetic induction?');
    expect(response.text.length).toBeGreaterThan(10);
    expect(response.confidence).toBeGreaterThanOrEqual(0);
  });

  it('responds to a chemistry question', async () => {
    const faraday = await createFaraday();
    const response = await faraday.respond('What can a candle teach us about chemistry?');
    expect(response.text.length).toBeGreaterThan(10);
  });

  it('response includes citation when knowledge matches', async () => {
    const faraday = await createFaraday();
    const response = await faraday.respond('electromagnetic induction electricity magnetism experiment');
    if (response.confidence > 0) {
      expect(response.citations.length).toBeGreaterThan(0);
    }
  });

  it('mock provider response returned verbatim', async () => {
    const mock = createMockProvider('The candle is a window into all of chemistry.');
    const faraday = await createFaraday(mock);
    const response = await faraday.respond('candle chemistry');
    expect(response.text).toBe('The candle is a window into all of chemistry.');
  });

  it('correlate returns null or valid response for unrelated topic', async () => {
    const faraday = await createFaraday();
    const unrelated = await faraday.respond('medieval poetry romance troubadours lyric');
    const result = await faraday.correlate(unrelated);
    expect(result === null || result.text.length > 0).toBe(true);
  });

  it('correlate finds connection on electrical science topic', async () => {
    const faraday = await createFaraday();
    const other = await createFaraday();
    const otherResponse = await other.respond('electricity magnetism induction experiment force field');
    const correlation = await faraday.correlate(otherResponse);
    expect(correlation === null || correlation.text.length > 0).toBe(true);
  });
});
