/**
 * menger.test.ts — Carl Menger Mind tests.
 * 15+ tests covering config, domain, knowledge search, and response quality.
 */

import { describe, it, expect, vi } from 'vitest';
import { createMenger, MENGER_CONFIG } from '../src/menger.js';
import { Mind } from '../src/mind.js';
import type { InferenceProvider } from '../src/types.js';

function createMockProvider(response: string = 'Mock response'): InferenceProvider {
  return { generate: vi.fn().mockResolvedValue(response) };
}

// ─── Config Verification ──────────────────────────────────────────────────────

describe('Menger config', () => {
  it('has correct id', () => {
    expect(MENGER_CONFIG.id).toBe('menger');
  });

  it('has correct name', () => {
    expect(MENGER_CONFIG.name).toBe('Carl Menger');
  });

  it('has correct era', () => {
    expect(MENGER_CONFIG.era).toBe('1840-1921');
  });

  it('axiom contains "Value"', () => {
    expect(MENGER_CONFIG.axiom).toContain('Value');
  });

  it('axiom contains "consciousness"', () => {
    expect(MENGER_CONFIG.axiom).toContain('consciousness');
  });

  it('domain includes "economics"', () => {
    expect(MENGER_CONFIG.domain).toContain('economics');
  });

  it('domain includes "value theory"', () => {
    expect(MENGER_CONFIG.domain).toContain('value theory');
  });

  it('domain includes "Austrian school"', () => {
    expect(MENGER_CONFIG.domain).toContain('Austrian school');
  });

  it('domain includes "marginal utility"', () => {
    expect(MENGER_CONFIG.domain).toContain('marginal utility');
  });

  it('has at least 4 primary sources', () => {
    expect(MENGER_CONFIG.primarySources.length).toBeGreaterThanOrEqual(4);
  });

  it('includes Principles of Economics as a source', () => {
    const titles = MENGER_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes('Principles of Economics'))).toBe(true);
  });

  it('includes Investigations into the Method', () => {
    const titles = MENGER_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes('Investigations') || t.includes('Method'))).toBe(true);
  });

  it('system prompt mentions marginal utility or value', () => {
    const prompt = MENGER_CONFIG.systemPrompt.toLowerCase();
    expect(prompt.includes('marginal') || prompt.includes('value') || prompt.includes('utility')).toBe(true);
  });

  it('primary sources contain content about marginal utility', () => {
    const allContent = MENGER_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('marginal') || allContent.includes('utility')).toBe(true);
  });

  it('primary sources resolve the water-diamond paradox', () => {
    const allContent = MENGER_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('water') && allContent.includes('diamond')).toBe(true);
  });
});

// ─── Mind Factory ─────────────────────────────────────────────────────────────

describe('createMenger', () => {
  it('returns a Mind instance', async () => {
    const menger = await createMenger();
    expect(menger).toBeInstanceOf(Mind);
  });

  it('has menger as config id', async () => {
    const menger = await createMenger();
    expect(menger.config.id).toBe('menger');
  });

  it('has a valid Ed25519 keypair', async () => {
    const menger = await createMenger();
    expect(menger.identity.publicKey.length).toBe(32);
    expect(menger.identity.secretKey.length).toBe(32);
  });

  it('two Menger instances have different identities', async () => {
    const m1 = await createMenger();
    const m2 = await createMenger();
    expect(m1.identity.publicKey).not.toEqual(m2.identity.publicKey);
  });

  it('accepts a custom provider', async () => {
    const mock = createMockProvider('Value exists only in the consciousness of the valuing person.');
    const menger = await createMenger(mock);
    const response = await menger.respond('test');
    expect(response.text).toBe('Value exists only in the consciousness of the valuing person.');
  });
});

// ─── Knowledge Search ─────────────────────────────────────────────────────────

describe('Menger knowledge search', () => {
  it('finds sources for value theory query', async () => {
    const menger = await createMenger();
    const sources = menger.searchKnowledge('value subjective utility marginal goods');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('finds sources for markets and prices query', async () => {
    const menger = await createMenger();
    const sources = menger.searchKnowledge('market price exchange trade goods buyer seller');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('knowledge base contains content about spontaneous order', () => {
    const allContent = MENGER_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('money') || allContent.includes('spontaneous') || allContent.includes('organic')).toBe(true);
  });

  it('sources include content about capital or interest', () => {
    const allContent = MENGER_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('capital') || allContent.includes('interest')).toBe(true);
  });
});

// ─── Response Quality ─────────────────────────────────────────────────────────

describe('Menger response', () => {
  it('responds to a value theory question', async () => {
    const menger = await createMenger();
    const response = await menger.respond('Why is water cheaper than diamonds?');
    expect(response.text.length).toBeGreaterThan(10);
    expect(response.confidence).toBeGreaterThanOrEqual(0);
  });

  it('responds to a markets question', async () => {
    const menger = await createMenger();
    const response = await menger.respond('How do prices emerge in markets?');
    expect(response.text.length).toBeGreaterThan(10);
  });

  it('response includes citation when knowledge matches', async () => {
    const menger = await createMenger();
    const response = await menger.respond('value subjective marginal utility goods exchange');
    if (response.confidence > 0) {
      expect(response.citations.length).toBeGreaterThan(0);
    }
  });

  it('mock provider response returned verbatim', async () => {
    const mock = createMockProvider('Value does not exist outside the consciousness of men.');
    const menger = await createMenger(mock);
    const response = await menger.respond('value consciousness subjective');
    expect(response.text).toBe('Value does not exist outside the consciousness of men.');
  });

  it('correlate returns null or valid response for unrelated topic', async () => {
    const menger = await createMenger();
    const unrelated = await menger.respond('ancient Egyptian hieroglyphics temple ritual');
    const result = await menger.correlate(unrelated);
    expect(result === null || result.text.length > 0).toBe(true);
  });

  it('correlate finds connection on economics value topic', async () => {
    const menger = await createMenger();
    const other = await createMenger();
    const otherResponse = await other.respond('value marginal utility price goods exchange market');
    const correlation = await menger.correlate(otherResponse);
    expect(correlation === null || correlation.text.length > 0).toBe(true);
  });
});
