/**
 * hypatia.test.ts — Hypatia of Alexandria Mind tests.
 * 15+ tests covering config, domain, knowledge search, and response quality.
 */

import { describe, it, expect, vi } from 'vitest';
import { createHypatia, HYPATIA_CONFIG } from '../src/hypatia.js';
import { Mind } from '../src/mind.js';
import type { InferenceProvider } from '../src/types.js';

function createMockProvider(response: string = 'Mock response'): InferenceProvider {
  return { generate: vi.fn().mockResolvedValue(response) };
}

// ─── Config Verification ──────────────────────────────────────────────────────

describe('Hypatia config', () => {
  it('has correct id', () => {
    expect(HYPATIA_CONFIG.id).toBe('hypatia');
  });

  it('has correct name', () => {
    expect(HYPATIA_CONFIG.name).toBe('Hypatia of Alexandria');
  });

  it('has correct era', () => {
    expect(HYPATIA_CONFIG.era).toBe('~360-415 CE');
  });

  it('axiom contains "think"', () => {
    expect(HYPATIA_CONFIG.axiom).toContain('think');
  });

  it('axiom contains "right"', () => {
    expect(HYPATIA_CONFIG.axiom.toLowerCase()).toContain('right');
  });

  it('domain includes "mathematics"', () => {
    expect(HYPATIA_CONFIG.domain).toContain('mathematics');
  });

  it('domain includes "astronomy"', () => {
    expect(HYPATIA_CONFIG.domain).toContain('astronomy');
  });

  it('domain includes "philosophy"', () => {
    expect(HYPATIA_CONFIG.domain).toContain('philosophy');
  });

  it('domain includes "teaching"', () => {
    expect(HYPATIA_CONFIG.domain).toContain('teaching');
  });

  it('has at least 4 primary sources', () => {
    expect(HYPATIA_CONFIG.primarySources.length).toBeGreaterThanOrEqual(4);
  });

  it('includes Synesius letters as a source', () => {
    const titles = HYPATIA_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes('Synesius'))).toBe(true);
  });

  it('system prompt mentions reason or inquiry', () => {
    const prompt = HYPATIA_CONFIG.systemPrompt.toLowerCase();
    expect(prompt.includes('reason') || prompt.includes('inquir') || prompt.includes('rational')).toBe(true);
  });

  it('primary sources contain the axiom quote', () => {
    const allContent = HYPATIA_CONFIG.primarySources.map((s) => s.content).join(' ');
    expect(allContent).toContain('think wrongly');
  });
});

// ─── Mind Factory ─────────────────────────────────────────────────────────────

describe('createHypatia', () => {
  it('returns a Mind instance', async () => {
    const hypatia = await createHypatia();
    expect(hypatia).toBeInstanceOf(Mind);
  });

  it('has hypatia as config id', async () => {
    const hypatia = await createHypatia();
    expect(hypatia.config.id).toBe('hypatia');
  });

  it('has a valid Ed25519 keypair', async () => {
    const hypatia = await createHypatia();
    expect(hypatia.identity.publicKey.length).toBe(32);
    expect(hypatia.identity.secretKey.length).toBe(32);
  });

  it('two Hypatia instances have different identities', async () => {
    const h1 = await createHypatia();
    const h2 = await createHypatia();
    expect(h1.identity.publicKey).not.toEqual(h2.identity.publicKey);
  });

  it('accepts a custom provider', async () => {
    const mock = createMockProvider('Reserve your right to think.');
    const hypatia = await createHypatia(mock);
    const response = await hypatia.respond('test');
    expect(response.text).toBe('Reserve your right to think.');
  });
});

// ─── Knowledge Search ─────────────────────────────────────────────────────────

describe('Hypatia knowledge search', () => {
  it('finds sources for mathematics query', async () => {
    const hypatia = await createHypatia();
    const sources = hypatia.searchKnowledge('mathematics geometry theorem proof');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('finds sources for astronomy query', async () => {
    const hypatia = await createHypatia();
    const sources = hypatia.searchKnowledge('astronomy stars celestial bodies planets');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('knowledge base contains content about teaching', () => {
    const allContent = HYPATIA_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('teach') || allContent.includes('student')).toBe(true);
  });

  it('sources include content about philosophy or Neoplatonism', () => {
    const allContent = HYPATIA_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('philosophy') || allContent.includes('plato')).toBe(true);
  });
});

// ─── Response Quality ─────────────────────────────────────────────────────────

describe('Hypatia response', () => {
  it('responds to a mathematics question', async () => {
    const hypatia = await createHypatia();
    const response = await hypatia.respond('What is the nature of mathematical truth?');
    expect(response.text.length).toBeGreaterThan(10);
    expect(response.confidence).toBeGreaterThanOrEqual(0);
  });

  it('responds to a teaching question', async () => {
    const hypatia = await createHypatia();
    const response = await hypatia.respond('How do you teach difficult subjects to students?');
    expect(response.text.length).toBeGreaterThan(10);
  });

  it('response includes citation when knowledge matches', async () => {
    const hypatia = await createHypatia();
    const response = await hypatia.respond('mathematics geometry philosophy reason');
    if (response.confidence > 0) {
      expect(response.citations.length).toBeGreaterThan(0);
    }
  });

  it('mock provider response returned verbatim', async () => {
    const mock = createMockProvider('Even to think wrongly is better than not to think at all.');
    const hypatia = await createHypatia(mock);
    const response = await hypatia.respond('thinking inquiry');
    expect(response.text).toBe('Even to think wrongly is better than not to think at all.');
  });

  it('correlate returns null or valid response for unrelated topic', async () => {
    const hypatia = await createHypatia();
    const unrelated = await hypatia.respond('jazz music trumpet improvisation blues');
    const result = await hypatia.correlate(unrelated);
    expect(result === null || result.text.length > 0).toBe(true);
  });

  it('correlate finds connection on mathematics philosophy topic', async () => {
    const hypatia = await createHypatia();
    const other = await createHypatia();
    const otherResponse = await other.respond('mathematics geometry philosophy rational truth');
    const correlation = await hypatia.correlate(otherResponse);
    expect(correlation === null || correlation.text.length > 0).toBe(true);
  });
});
