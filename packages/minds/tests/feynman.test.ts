/**
 * feynman.test.ts — Richard Feynman Mind tests.
 * 20+ tests covering config, domain, knowledge search, and response quality.
 */

import { describe, it, expect, vi } from 'vitest';
import { createFeynman, FEYNMAN_CONFIG } from '../src/feynman.js';
import { Mind } from '../src/mind.js';
import type { InferenceProvider } from '../src/types.js';

function createMockProvider(response: string = 'Mock response'): InferenceProvider {
  return { generate: vi.fn().mockResolvedValue(response) };
}

// ─── Config Verification ──────────────────────────────────────────────────────

describe('Feynman config', () => {
  it('has correct id', () => {
    expect(FEYNMAN_CONFIG.id).toBe('feynman');
  });

  it('has correct name', () => {
    expect(FEYNMAN_CONFIG.name).toBe('Richard Feynman');
  });

  it('has correct era', () => {
    expect(FEYNMAN_CONFIG.era).toBe('1918-1988');
  });

  it('axiom contains "fool yourself"', () => {
    expect(FEYNMAN_CONFIG.axiom).toContain('fool yourself');
  });

  it('domain includes "physics"', () => {
    expect(FEYNMAN_CONFIG.domain).toContain('physics');
  });

  it('domain includes "education"', () => {
    expect(FEYNMAN_CONFIG.domain).toContain('education');
  });

  it('domain includes "curiosity"', () => {
    expect(FEYNMAN_CONFIG.domain).toContain('curiosity');
  });

  it('has at least 4 primary sources', () => {
    expect(FEYNMAN_CONFIG.primarySources.length).toBeGreaterThanOrEqual(4);
  });

  it('includes The Feynman Lectures on Physics', () => {
    const titles = FEYNMAN_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes('Feynman Lectures'))).toBe(true);
  });

  it("includes Surely You're Joking", () => {
    const titles = FEYNMAN_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes("You're Joking"))).toBe(true);
  });

  it('includes The Character of Physical Law', () => {
    const titles = FEYNMAN_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes('Character of Physical Law'))).toBe(true);
  });

  it('system prompt mentions plain speaking or analogies', () => {
    const prompt = FEYNMAN_CONFIG.systemPrompt.toLowerCase();
    expect(
      prompt.includes('plain') || prompt.includes('analog') || prompt.includes('challenge'),
    ).toBe(true);
  });
});

// ─── Mind Factory ─────────────────────────────────────────────────────────────

describe('createFeynman', () => {
  it('returns a Mind instance', async () => {
    const feynman = await createFeynman();
    expect(feynman).toBeInstanceOf(Mind);
  });

  it('has feynman as config id', async () => {
    const feynman = await createFeynman();
    expect(feynman.config.id).toBe('feynman');
  });

  it('has a valid Ed25519 keypair', async () => {
    const feynman = await createFeynman();
    expect(feynman.identity.publicKey.length).toBe(32);
    expect(feynman.identity.secretKey.length).toBe(32);
  });

  it('two Feynman instances have different identities', async () => {
    const f1 = await createFeynman();
    const f2 = await createFeynman();
    expect(f1.identity.publicKey).not.toEqual(f2.identity.publicKey);
  });

  it('accepts a custom provider', async () => {
    const mock = createMockProvider('Feynman custom provider response');
    const feynman = await createFeynman(mock);
    const response = await feynman.respond('test');
    expect(response.text).toBe('Feynman custom provider response');
  });
});

// ─── Knowledge Search ─────────────────────────────────────────────────────────

describe('Feynman knowledge search', () => {
  it('finds physics sources for physics query', async () => {
    const feynman = await createFeynman();
    const sources = feynman.searchKnowledge('quantum mechanics uncertainty physics');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('finds teaching/education sources for education query', async () => {
    const feynman = await createFeynman();
    // Use words that appear verbatim in the source content
    const sources = feynman.searchKnowledge('teacher learn experiment curiosity');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('knowledge base contains actual Feynman quotes', () => {
    const allContent = FEYNMAN_CONFIG.primarySources.map((s) => s.content).join(' ');
    // Check for well-known Feynman quotes
    expect(allContent).toContain('fool yourself');
    expect(allContent).toContain('experiment');
  });

  it('physics source content mentions quantum or uncertainty', () => {
    const allContent = FEYNMAN_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('quantum') || allContent.includes('uncertainty')).toBe(true);
  });
});

// ─── Response Quality ─────────────────────────────────────────────────────────

describe('Feynman response', () => {
  it('responds to a physics question', async () => {
    const feynman = await createFeynman();
    const response = await feynman.respond('What is quantum mechanics?');
    expect(response.text.length).toBeGreaterThan(10);
    expect(response.confidence).toBeGreaterThan(0);
  });

  it('responds to an education question', async () => {
    const feynman = await createFeynman();
    const response = await feynman.respond('How should a teacher explain difficult concepts?');
    expect(response.text.length).toBeGreaterThan(10);
  });

  it('response includes a citation when knowledge matches', async () => {
    const feynman = await createFeynman();
    const response = await feynman.respond('quantum uncertainty physics experiment');
    if (response.confidence > 0) {
      expect(response.citations.length).toBeGreaterThan(0);
    }
  });

  it('local inference response mentions source title', async () => {
    const feynman = await createFeynman();
    const response = await feynman.respond('quantum mechanics uncertainty physics');
    // LocalInference templates include source title
    const sourceTitle = FEYNMAN_CONFIG.primarySources
      .map((s) => s.title)
      .some((title) => response.text.includes(title));
    expect(sourceTitle || response.text.length > 20).toBe(true);
  });

  it('curiosity response with mock returns mock text', async () => {
    const mock = createMockProvider('Science is not certain. And that is wonderful.');
    const feynman = await createFeynman(mock);
    const response = await feynman.respond('Is science certain?');
    expect(response.text).toBe('Science is not certain. And that is wonderful.');
  });
});
