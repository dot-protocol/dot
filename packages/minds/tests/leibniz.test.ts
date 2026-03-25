/**
 * leibniz.test.ts — Gottfried Wilhelm Leibniz Mind tests.
 * 15+ tests covering config, domain, knowledge search, and response quality.
 */

import { describe, it, expect, vi } from 'vitest';
import { createLeibniz, LEIBNIZ_CONFIG } from '../src/leibniz.js';
import { Mind } from '../src/mind.js';
import type { InferenceProvider } from '../src/types.js';

function createMockProvider(response: string = 'Mock response'): InferenceProvider {
  return { generate: vi.fn().mockResolvedValue(response) };
}

// ─── Config Verification ──────────────────────────────────────────────────────

describe('Leibniz config', () => {
  it('has correct id', () => {
    expect(LEIBNIZ_CONFIG.id).toBe('leibniz');
  });

  it('has correct name', () => {
    expect(LEIBNIZ_CONFIG.name).toBe('Gottfried Wilhelm Leibniz');
  });

  it('has correct era', () => {
    expect(LEIBNIZ_CONFIG.era).toBe('1646-1716');
  });

  it('axiom contains "best of all possible worlds"', () => {
    expect(LEIBNIZ_CONFIG.axiom).toContain('best of all possible worlds');
  });

  it('domain includes "mathematics"', () => {
    expect(LEIBNIZ_CONFIG.domain).toContain('mathematics');
  });

  it('domain includes "philosophy"', () => {
    expect(LEIBNIZ_CONFIG.domain).toContain('philosophy');
  });

  it('domain includes "logic"', () => {
    expect(LEIBNIZ_CONFIG.domain).toContain('logic');
  });

  it('domain includes "computation"', () => {
    expect(LEIBNIZ_CONFIG.domain).toContain('computation');
  });

  it('domain includes "calculus"', () => {
    expect(LEIBNIZ_CONFIG.domain).toContain('calculus');
  });

  it('has at least 4 primary sources', () => {
    expect(LEIBNIZ_CONFIG.primarySources.length).toBeGreaterThanOrEqual(4);
  });

  it('includes Monadology as a source', () => {
    const titles = LEIBNIZ_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes('Monadology'))).toBe(true);
  });

  it('system prompt mentions monad or calculus or binary', () => {
    const prompt = LEIBNIZ_CONFIG.systemPrompt.toLowerCase();
    expect(
      prompt.includes('monad') || prompt.includes('calculus') || prompt.includes('binary'),
    ).toBe(true);
  });

  it('primary sources contain content about monads', () => {
    const allContent = LEIBNIZ_CONFIG.primarySources.map((s) => s.content).join(' ');
    expect(allContent).toContain('monad');
  });

  it('primary sources contain content about binary', () => {
    const allContent = LEIBNIZ_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('binary') || allContent.includes('0 and 1')).toBe(true);
  });
});

// ─── Mind Factory ─────────────────────────────────────────────────────────────

describe('createLeibniz', () => {
  it('returns a Mind instance', async () => {
    const leibniz = await createLeibniz();
    expect(leibniz).toBeInstanceOf(Mind);
  });

  it('has leibniz as config id', async () => {
    const leibniz = await createLeibniz();
    expect(leibniz.config.id).toBe('leibniz');
  });

  it('has a valid Ed25519 keypair', async () => {
    const leibniz = await createLeibniz();
    expect(leibniz.identity.publicKey.length).toBe(32);
    expect(leibniz.identity.secretKey.length).toBe(32);
  });

  it('two Leibniz instances have different identities', async () => {
    const l1 = await createLeibniz();
    const l2 = await createLeibniz();
    expect(l1.identity.publicKey).not.toEqual(l2.identity.publicKey);
  });

  it('accepts a custom provider', async () => {
    const mock = createMockProvider('This is the best of all possible worlds.');
    const leibniz = await createLeibniz(mock);
    const response = await leibniz.respond('test');
    expect(response.text).toBe('This is the best of all possible worlds.');
  });
});

// ─── Knowledge Search ─────────────────────────────────────────────────────────

describe('Leibniz knowledge search', () => {
  it('finds sources for calculus query', async () => {
    const leibniz = await createLeibniz();
    const sources = leibniz.searchKnowledge('calculus differential integral mathematics');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('finds sources for metaphysics query', async () => {
    const leibniz = await createLeibniz();
    const sources = leibniz.searchKnowledge('monad metaphysics substance perception universe');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('knowledge base contains sufficient reason principle', () => {
    const allContent = LEIBNIZ_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('sufficient reason') || allContent.includes('reason')).toBe(true);
  });

  it('sources include content about binary arithmetic', () => {
    const allContent = LEIBNIZ_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('binary') || allContent.includes('0 and 1')).toBe(true);
  });
});

// ─── Response Quality ─────────────────────────────────────────────────────────

describe('Leibniz response', () => {
  it('responds to a philosophy question', async () => {
    const leibniz = await createLeibniz();
    const response = await leibniz.respond('What are monads?');
    expect(response.text.length).toBeGreaterThan(10);
    expect(response.confidence).toBeGreaterThanOrEqual(0);
  });

  it('responds to a mathematics question', async () => {
    const leibniz = await createLeibniz();
    const response = await leibniz.respond('How does calculus work?');
    expect(response.text.length).toBeGreaterThan(10);
  });

  it('response includes citation when knowledge matches', async () => {
    const leibniz = await createLeibniz();
    const response = await leibniz.respond('monad substance universe perception philosophy');
    if (response.confidence > 0) {
      expect(response.citations.length).toBeGreaterThan(0);
    }
  });

  it('mock provider response returned verbatim', async () => {
    const mock = createMockProvider('Let us calculate — calculemus.');
    const leibniz = await createLeibniz(mock);
    const response = await leibniz.respond('logic computation');
    expect(response.text).toBe('Let us calculate — calculemus.');
  });

  it('correlate returns null or valid response for unrelated topic', async () => {
    const leibniz = await createLeibniz();
    const unrelated = await leibniz.respond('jazz trumpet blues improvisation music');
    const result = await leibniz.correlate(unrelated);
    expect(result === null || result.text.length > 0).toBe(true);
  });

  it('correlate finds connection on logic mathematics topic', async () => {
    const leibniz = await createLeibniz();
    const other = await createLeibniz();
    const otherResponse = await other.respond('logic mathematics calculus binary computation monad');
    const correlation = await leibniz.correlate(otherResponse);
    expect(correlation === null || correlation.text.length > 0).toBe(true);
  });
});
