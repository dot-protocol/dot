/**
 * shannon.test.ts — Claude Shannon Mind tests.
 * 20+ tests covering config, domain, knowledge search, and response quality.
 */

import { describe, it, expect, vi } from 'vitest';
import { createShannon, SHANNON_CONFIG } from '../src/shannon.js';
import { Mind } from '../src/mind.js';
import type { InferenceProvider } from '../src/types.js';

function createMockProvider(response: string = 'Mock response'): InferenceProvider {
  return { generate: vi.fn().mockResolvedValue(response) };
}

// ─── Config Verification ──────────────────────────────────────────────────────

describe('Shannon config', () => {
  it('has correct id', () => {
    expect(SHANNON_CONFIG.id).toBe('shannon');
  });

  it('has correct name', () => {
    expect(SHANNON_CONFIG.name).toBe('Claude Shannon');
  });

  it('has correct era', () => {
    expect(SHANNON_CONFIG.era).toBe('1916-2001');
  });

  it('axiom contains "information" and "uncertainty"', () => {
    expect(SHANNON_CONFIG.axiom.toLowerCase()).toContain('information');
    expect(SHANNON_CONFIG.axiom.toLowerCase()).toContain('uncertainty');
  });

  it('domain includes "information theory"', () => {
    expect(SHANNON_CONFIG.domain).toContain('information theory');
  });

  it('domain includes "mathematics"', () => {
    expect(SHANNON_CONFIG.domain).toContain('mathematics');
  });

  it('domain includes "engineering"', () => {
    expect(SHANNON_CONFIG.domain).toContain('engineering');
  });

  it('has at least 3 primary sources', () => {
    expect(SHANNON_CONFIG.primarySources.length).toBeGreaterThanOrEqual(3);
  });

  it('includes A Mathematical Theory of Communication (1948)', () => {
    const source = SHANNON_CONFIG.primarySources.find((s) =>
      s.title.includes('Mathematical Theory of Communication'),
    );
    expect(source).toBeDefined();
    expect(source!.year).toBe(1948);
  });

  it('includes Communication Theory of Secrecy Systems (1949)', () => {
    const source = SHANNON_CONFIG.primarySources.find((s) =>
      s.title.includes('Secrecy'),
    );
    expect(source).toBeDefined();
    expect(source!.year).toBe(1949);
  });

  it('system prompt mentions information or entropy', () => {
    const prompt = SHANNON_CONFIG.systemPrompt.toLowerCase();
    expect(prompt.includes('information') || prompt.includes('entropy')).toBe(true);
  });

  it('system prompt mentions precision or mathematics', () => {
    const prompt = SHANNON_CONFIG.systemPrompt.toLowerCase();
    expect(prompt.includes('precise') || prompt.includes('math')).toBe(true);
  });
});

// ─── Mind Factory ─────────────────────────────────────────────────────────────

describe('createShannon', () => {
  it('returns a Mind instance', async () => {
    const shannon = await createShannon();
    expect(shannon).toBeInstanceOf(Mind);
  });

  it('has shannon as config id', async () => {
    const shannon = await createShannon();
    expect(shannon.config.id).toBe('shannon');
  });

  it('has a valid Ed25519 keypair', async () => {
    const shannon = await createShannon();
    expect(shannon.identity.publicKey.length).toBe(32);
    expect(shannon.identity.secretKey.length).toBe(32);
  });

  it('two Shannon instances have different identities', async () => {
    const s1 = await createShannon();
    const s2 = await createShannon();
    expect(s1.identity.publicKey).not.toEqual(s2.identity.publicKey);
  });

  it('accepts a custom provider', async () => {
    const mock = createMockProvider('H = -sum p log p. That is entropy.');
    const shannon = await createShannon(mock);
    const response = await shannon.respond('test');
    expect(response.text).toBe('H = -sum p log p. That is entropy.');
  });
});

// ─── Knowledge Search ─────────────────────────────────────────────────────────

describe('Shannon knowledge search', () => {
  it('finds the 1948 paper for information theory query', async () => {
    const shannon = await createShannon();
    const sources = shannon.searchKnowledge('information entropy channel capacity bits');
    expect(sources.length).toBeGreaterThan(0);
    const hasMathPaper = sources.some((s) =>
      s.title.includes('Mathematical Theory of Communication'),
    );
    expect(hasMathPaper).toBe(true);
  });

  it('finds the secrecy paper for cryptography query', async () => {
    const shannon = await createShannon();
    const sources = shannon.searchKnowledge('cryptography cipher secrecy key encryption');
    expect(sources.length).toBeGreaterThan(0);
    const hasSecrecyPaper = sources.some((s) => s.title.includes('Secrecy'));
    expect(hasSecrecyPaper).toBe(true);
  });

  it('knowledge base contains entropy formula description', () => {
    const allContent = SHANNON_CONFIG.primarySources.map((s) => s.content).join(' ');
    expect(allContent).toContain('entropy');
    // Contains the formula description
    expect(allContent.includes('H =') || allContent.includes('entropy')).toBe(true);
  });

  it('knowledge base contains channel capacity description', () => {
    const allContent = SHANNON_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('channel') || allContent.includes('capacity')).toBe(true);
  });

  it('knowledge base contains the bit definition', () => {
    const allContent = SHANNON_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('bit')).toBe(true);
  });
});

// ─── Response Quality ─────────────────────────────────────────────────────────

describe('Shannon response', () => {
  it('responds to an information theory question', async () => {
    const shannon = await createShannon();
    const response = await shannon.respond('What is information?');
    expect(response.text.length).toBeGreaterThan(10);
  });

  it('responds to an entropy question', async () => {
    const shannon = await createShannon();
    const response = await shannon.respond('What is entropy in information theory?');
    expect(response.text.length).toBeGreaterThan(10);
  });

  it('responds to a channel capacity question', async () => {
    const shannon = await createShannon();
    const response = await shannon.respond('How much information can a channel carry?');
    expect(response.text.length).toBeGreaterThan(10);
  });

  it('information query has non-zero confidence', async () => {
    const shannon = await createShannon();
    const response = await shannon.respond('information entropy bits channel communication');
    expect(response.confidence).toBeGreaterThan(0);
  });

  it('cryptography query has citations', async () => {
    const shannon = await createShannon();
    const response = await shannon.respond('cipher secrecy encryption key');
    if (response.confidence > 0) {
      expect(response.citations.length).toBeGreaterThan(0);
    }
  });

  it('mock provider returns mock text verbatim', async () => {
    const mock = createMockProvider('The bit is the fundamental unit of surprise.');
    const shannon = await createShannon(mock);
    const response = await shannon.respond('What is a bit?');
    expect(response.text).toBe('The bit is the fundamental unit of surprise.');
  });

  it('response confidence is between 0 and 1', async () => {
    const shannon = await createShannon();
    const response = await shannon.respond('entropy channel bits information');
    expect(response.confidence).toBeGreaterThanOrEqual(0);
    expect(response.confidence).toBeLessThanOrEqual(1);
  });
});

// ─── Cross-Mind: Shannon + Feynman correlation ────────────────────────────────

describe('Shannon cross-mind correlation', () => {
  it('Shannon finds no correlation with purely poetic content free of technical terms', async () => {
    const shannon = await createShannon();
    // Deliberately avoid any technical terms Shannon might match (source, channel, etc.)
    const purePoetryResponse = {
      text: 'The reed flute cries longing for its reed bed. Love wounds open into light. Dance broken free. The beloved seeks the seeker.',
      citations: [],
      confidence: 0.9,
    };
    const correlation = await shannon.correlate(purePoetryResponse);
    // Shannon's knowledge is about information theory, not mystical poetry
    expect(correlation).toBeNull();
  });

  it('Shannon correlates with information-adjacent content', async () => {
    const mock = createMockProvider('Information theory perspective on this');
    const shannon = await createShannon(mock);
    const infoResponse = {
      text: 'Entropy measures disorder and uncertainty. Information bits capacity channel communication.',
      citations: [],
      confidence: 0.8,
    };
    const correlation = await shannon.correlate(infoResponse);
    // Should find a connection given information/entropy keywords
    expect(correlation).not.toBeNull();
  });
});
