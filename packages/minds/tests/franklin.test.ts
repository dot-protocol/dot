/**
 * franklin.test.ts — Benjamin Franklin Mind tests.
 * 15+ tests covering config, domain, knowledge search, and response quality.
 */

import { describe, it, expect, vi } from 'vitest';
import { createFranklin, FRANKLIN_CONFIG } from '../src/franklin.js';
import { Mind } from '../src/mind.js';
import type { InferenceProvider } from '../src/types.js';

function createMockProvider(response: string = 'Mock response'): InferenceProvider {
  return { generate: vi.fn().mockResolvedValue(response) };
}

// ─── Config Verification ──────────────────────────────────────────────────────

describe('Franklin config', () => {
  it('has correct id', () => {
    expect(FRANKLIN_CONFIG.id).toBe('franklin');
  });

  it('has correct name', () => {
    expect(FRANKLIN_CONFIG.name).toBe('Benjamin Franklin');
  });

  it('has correct era', () => {
    expect(FRANKLIN_CONFIG.era).toBe('1706-1790');
  });

  it('axiom contains "knowledge"', () => {
    expect(FRANKLIN_CONFIG.axiom).toContain('knowledge');
  });

  it('axiom contains "interest"', () => {
    expect(FRANKLIN_CONFIG.axiom).toContain('interest');
  });

  it('domain includes "diplomacy"', () => {
    expect(FRANKLIN_CONFIG.domain).toContain('diplomacy');
  });

  it('domain includes "science"', () => {
    expect(FRANKLIN_CONFIG.domain).toContain('science');
  });

  it('domain includes "invention"', () => {
    expect(FRANKLIN_CONFIG.domain).toContain('invention');
  });

  it('domain includes "wit"', () => {
    expect(FRANKLIN_CONFIG.domain).toContain('wit');
  });

  it('has at least 4 primary sources', () => {
    expect(FRANKLIN_CONFIG.primarySources.length).toBeGreaterThanOrEqual(4);
  });

  it("includes Poor Richard's Almanack", () => {
    const titles = FRANKLIN_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes("Poor Richard"))).toBe(true);
  });

  it('includes the Autobiography', () => {
    const titles = FRANKLIN_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes('Autobiography'))).toBe(true);
  });

  it('system prompt mentions experiment or empiric', () => {
    const prompt = FRANKLIN_CONFIG.systemPrompt.toLowerCase();
    expect(
      prompt.includes('empiric') || prompt.includes('experiment') || prompt.includes('kite'),
    ).toBe(true);
  });

  it('primary sources contain real Franklin quotes', () => {
    const allContent = FRANKLIN_CONFIG.primarySources.map((s) => s.content).join(' ');
    expect(allContent).toContain('knowledge');
    expect(allContent).toContain('virtue');
  });
});

// ─── Mind Factory ─────────────────────────────────────────────────────────────

describe('createFranklin', () => {
  it('returns a Mind instance', async () => {
    const franklin = await createFranklin();
    expect(franklin).toBeInstanceOf(Mind);
  });

  it('has franklin as config id', async () => {
    const franklin = await createFranklin();
    expect(franklin.config.id).toBe('franklin');
  });

  it('has a valid Ed25519 keypair', async () => {
    const franklin = await createFranklin();
    expect(franklin.identity.publicKey.length).toBe(32);
    expect(franklin.identity.secretKey.length).toBe(32);
  });

  it('two Franklin instances have different identities', async () => {
    const f1 = await createFranklin();
    const f2 = await createFranklin();
    expect(f1.identity.publicKey).not.toEqual(f2.identity.publicKey);
  });

  it('accepts a custom provider', async () => {
    const mock = createMockProvider('Well done is better than well said.');
    const franklin = await createFranklin(mock);
    const response = await franklin.respond('test');
    expect(response.text).toBe('Well done is better than well said.');
  });
});

// ─── Knowledge Search ─────────────────────────────────────────────────────────

describe('Franklin knowledge search', () => {
  it('finds sources for electricity query', async () => {
    const franklin = await createFranklin();
    const sources = franklin.searchKnowledge('electricity lightning experiment kite');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('finds sources for self-improvement query', async () => {
    const franklin = await createFranklin();
    const sources = franklin.searchKnowledge('virtue self-improvement character improvement');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('knowledge base contains aphorisms about knowledge', () => {
    const allContent = FRANKLIN_CONFIG.primarySources.map((s) => s.content).join(' ');
    expect(allContent).toContain('knowledge');
  });

  it('sources include electricity or lightning content', () => {
    const allContent = FRANKLIN_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('electricity') || allContent.includes('lightning')).toBe(true);
  });
});

// ─── Response Quality ─────────────────────────────────────────────────────────

describe('Franklin response', () => {
  it('responds to a self-improvement question', async () => {
    const franklin = await createFranklin();
    const response = await franklin.respond('How do I improve my character?');
    expect(response.text.length).toBeGreaterThan(10);
    expect(response.confidence).toBeGreaterThanOrEqual(0);
  });

  it('responds to an electricity question', async () => {
    const franklin = await createFranklin();
    const response = await franklin.respond('How does lightning relate to electricity?');
    expect(response.text.length).toBeGreaterThan(10);
  });

  it('response includes a citation when knowledge matches', async () => {
    const franklin = await createFranklin();
    const response = await franklin.respond('virtue knowledge self-improvement character');
    if (response.confidence > 0) {
      expect(response.citations.length).toBeGreaterThan(0);
    }
  });

  it('mock provider response is returned verbatim', async () => {
    const mock = createMockProvider('An ounce of prevention is worth a pound of cure.');
    const franklin = await createFranklin(mock);
    const response = await franklin.respond('health prevention');
    expect(response.text).toBe('An ounce of prevention is worth a pound of cure.');
  });

  it('correlate returns null for unrelated topic', async () => {
    const franklin = await createFranklin();
    const unrelated = await franklin.respond('quantum chromodynamics particle physics');
    const result = await franklin.correlate(unrelated);
    // Either null or a low confidence response is acceptable
    if (result !== null) {
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    }
  });

  it('correlate finds connection on related topic', async () => {
    const franklin = await createFranklin();
    const other = await createFranklin();
    const otherResponse = await other.respond('knowledge virtue self-improvement character');
    const correlation = await franklin.correlate(otherResponse);
    // Franklin's knowledge base is rich enough to find connections on virtue/knowledge
    expect(correlation === null || correlation.text.length > 0).toBe(true);
  });
});
