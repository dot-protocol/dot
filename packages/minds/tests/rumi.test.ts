/**
 * rumi.test.ts — Rumi Mind tests.
 * 20+ tests covering config, domain, knowledge search, and response quality.
 */

import { describe, it, expect, vi } from 'vitest';
import { createRumi, RUMI_CONFIG } from '../src/rumi.js';
import { Mind } from '../src/mind.js';
import type { InferenceProvider } from '../src/types.js';

function createMockProvider(response: string = 'Mock response'): InferenceProvider {
  return { generate: vi.fn().mockResolvedValue(response) };
}

// ─── Config Verification ──────────────────────────────────────────────────────

describe('Rumi config', () => {
  it('has correct id', () => {
    expect(RUMI_CONFIG.id).toBe('rumi');
  });

  it('has correct name', () => {
    expect(RUMI_CONFIG.name).toBe('Rumi');
  });

  it('has correct era', () => {
    expect(RUMI_CONFIG.era).toBe('1207-1273');
  });

  it('axiom contains "wound" and "Light"', () => {
    expect(RUMI_CONFIG.axiom).toContain('wound');
    expect(RUMI_CONFIG.axiom).toContain('Light');
  });

  it('domain includes "poetry"', () => {
    expect(RUMI_CONFIG.domain).toContain('poetry');
  });

  it('domain includes "spirituality"', () => {
    expect(RUMI_CONFIG.domain).toContain('spirituality');
  });

  it('domain includes "love"', () => {
    expect(RUMI_CONFIG.domain).toContain('love');
  });

  it('has at least 3 primary sources', () => {
    expect(RUMI_CONFIG.primarySources.length).toBeGreaterThanOrEqual(3);
  });

  it('includes Masnavi as a primary source', () => {
    const titles = RUMI_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes('Masnavi'))).toBe(true);
  });

  it('includes Divan-e Shams as a primary source', () => {
    const titles = RUMI_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes('Divan') || t.includes('Shams'))).toBe(true);
  });

  it('includes Fihi Ma Fihi as a primary source', () => {
    const titles = RUMI_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes('Fihi'))).toBe(true);
  });

  it('system prompt mentions love or seeking', () => {
    const prompt = RUMI_CONFIG.systemPrompt.toLowerCase();
    expect(prompt.includes('love') || prompt.includes('seek')).toBe(true);
  });

  it('system prompt mentions poetry or metaphor', () => {
    const prompt = RUMI_CONFIG.systemPrompt.toLowerCase();
    expect(prompt.includes('poet') || prompt.includes('metaphor')).toBe(true);
  });
});

// ─── Mind Factory ─────────────────────────────────────────────────────────────

describe('createRumi', () => {
  it('returns a Mind instance', async () => {
    const rumi = await createRumi();
    expect(rumi).toBeInstanceOf(Mind);
  });

  it('has rumi as config id', async () => {
    const rumi = await createRumi();
    expect(rumi.config.id).toBe('rumi');
  });

  it('has a valid Ed25519 keypair', async () => {
    const rumi = await createRumi();
    expect(rumi.identity.publicKey.length).toBe(32);
    expect(rumi.identity.secretKey.length).toBe(32);
  });

  it('two Rumi instances have different identities', async () => {
    const r1 = await createRumi();
    const r2 = await createRumi();
    expect(r1.identity.publicKey).not.toEqual(r2.identity.publicKey);
  });

  it('accepts a custom provider', async () => {
    const mock = createMockProvider('Come, come, whoever you are.');
    const rumi = await createRumi(mock);
    const response = await rumi.respond('test');
    expect(response.text).toBe('Come, come, whoever you are.');
  });
});

// ─── Knowledge Search ─────────────────────────────────────────────────────────

describe('Rumi knowledge search', () => {
  it('finds Masnavi for love/reed query', async () => {
    const rumi = await createRumi();
    const sources = rumi.searchKnowledge('love reed separation longing');
    expect(sources.length).toBeGreaterThan(0);
    // Masnavi starts with the reed flute passage
    const hasMasnavi = sources.some((s) => s.title.includes('Masnavi'));
    expect(hasMasnavi).toBe(true);
  });

  it('finds sources for spirituality query', async () => {
    const rumi = await createRumi();
    const sources = rumi.searchKnowledge('soul ocean silence divine wisdom');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('knowledge base contains the wound quote', () => {
    const allContent = RUMI_CONFIG.primarySources.map((s) => s.content).join(' ');
    expect(allContent).toContain('wound');
  });

  it('knowledge base contains the reed flute passage', () => {
    const allContent = RUMI_CONFIG.primarySources.map((s) => s.content).join(' ');
    expect(allContent).toContain('reed');
  });

  it('knowledge base contains actual Rumi poetry', () => {
    const allContent = RUMI_CONFIG.primarySources.map((s) => s.content).join(' ');
    // Check for well-known lines
    expect(allContent.includes('Out beyond') || allContent.includes('wound')).toBe(true);
  });
});

// ─── Response Quality ─────────────────────────────────────────────────────────

describe('Rumi response', () => {
  it('responds to a love question', async () => {
    const rumi = await createRumi();
    const response = await rumi.respond('What is the nature of love?');
    expect(response.text.length).toBeGreaterThan(10);
  });

  it('responds to a spirituality question', async () => {
    const rumi = await createRumi();
    const response = await rumi.respond('How does the soul find peace?');
    expect(response.text.length).toBeGreaterThan(10);
  });

  it('responds to a grief/wound question', async () => {
    const rumi = await createRumi();
    const response = await rumi.respond('How should we approach grief and pain?');
    expect(response.text.length).toBeGreaterThan(10);
  });

  it('Masnavi-related response has citation', async () => {
    const rumi = await createRumi();
    const response = await rumi.respond('reed separation longing love seeking');
    if (response.confidence > 0) {
      expect(response.citations.length).toBeGreaterThan(0);
    }
  });

  it('mock provider returns mock text', async () => {
    const mock = createMockProvider('Sell your cleverness and buy bewilderment.');
    const rumi = await createRumi(mock);
    const response = await rumi.respond('What should I do with my cleverness?');
    expect(response.text).toBe('Sell your cleverness and buy bewilderment.');
  });

  it('response confidence is between 0 and 1', async () => {
    const rumi = await createRumi();
    const response = await rumi.respond('love soul seeking');
    expect(response.confidence).toBeGreaterThanOrEqual(0);
    expect(response.confidence).toBeLessThanOrEqual(1);
  });
});
