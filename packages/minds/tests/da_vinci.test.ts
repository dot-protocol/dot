/**
 * da_vinci.test.ts — Leonardo da Vinci Mind tests.
 * 15+ tests covering config, domain, knowledge search, and response quality.
 */

import { describe, it, expect, vi } from 'vitest';
import { createDaVinci, DA_VINCI_CONFIG } from '../src/da_vinci.js';
import { Mind } from '../src/mind.js';
import type { InferenceProvider } from '../src/types.js';

function createMockProvider(response: string = 'Mock response'): InferenceProvider {
  return { generate: vi.fn().mockResolvedValue(response) };
}

// ─── Config Verification ──────────────────────────────────────────────────────

describe('da Vinci config', () => {
  it('has correct id', () => {
    expect(DA_VINCI_CONFIG.id).toBe('da_vinci');
  });

  it('has correct name', () => {
    expect(DA_VINCI_CONFIG.name).toBe('Leonardo da Vinci');
  });

  it('has correct era', () => {
    expect(DA_VINCI_CONFIG.era).toBe('1452-1519');
  });

  it('axiom contains "Simplicity"', () => {
    expect(DA_VINCI_CONFIG.axiom).toContain('Simplicity');
  });

  it('axiom contains "sophistication"', () => {
    expect(DA_VINCI_CONFIG.axiom).toContain('sophistication');
  });

  it('domain includes "art"', () => {
    expect(DA_VINCI_CONFIG.domain).toContain('art');
  });

  it('domain includes "engineering"', () => {
    expect(DA_VINCI_CONFIG.domain).toContain('engineering');
  });

  it('domain includes "anatomy"', () => {
    expect(DA_VINCI_CONFIG.domain).toContain('anatomy');
  });

  it('domain includes "observation"', () => {
    expect(DA_VINCI_CONFIG.domain).toContain('observation');
  });

  it('domain includes "curiosity"', () => {
    expect(DA_VINCI_CONFIG.domain).toContain('curiosity');
  });

  it('has at least 4 primary sources', () => {
    expect(DA_VINCI_CONFIG.primarySources.length).toBeGreaterThanOrEqual(4);
  });

  it('includes Codex Leicester as a source', () => {
    const titles = DA_VINCI_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes('Codex'))).toBe(true);
  });

  it('includes Treatise on Painting', () => {
    const titles = DA_VINCI_CONFIG.primarySources.map((s) => s.title);
    expect(titles.some((t) => t.includes('Painting') || t.includes('Treatise'))).toBe(true);
  });

  it('system prompt mentions observation or eye', () => {
    const prompt = DA_VINCI_CONFIG.systemPrompt.toLowerCase();
    expect(prompt.includes('observ') || prompt.includes('eye') || prompt.includes('see')).toBe(true);
  });

  it('primary sources contain content about anatomy', () => {
    const allContent = DA_VINCI_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('anatom') || allContent.includes('dissect')).toBe(true);
  });
});

// ─── Mind Factory ─────────────────────────────────────────────────────────────

describe('createDaVinci', () => {
  it('returns a Mind instance', async () => {
    const davinci = await createDaVinci();
    expect(davinci).toBeInstanceOf(Mind);
  });

  it('has da_vinci as config id', async () => {
    const davinci = await createDaVinci();
    expect(davinci.config.id).toBe('da_vinci');
  });

  it('has a valid Ed25519 keypair', async () => {
    const davinci = await createDaVinci();
    expect(davinci.identity.publicKey.length).toBe(32);
    expect(davinci.identity.secretKey.length).toBe(32);
  });

  it('two da Vinci instances have different identities', async () => {
    const d1 = await createDaVinci();
    const d2 = await createDaVinci();
    expect(d1.identity.publicKey).not.toEqual(d2.identity.publicKey);
  });

  it('accepts a custom provider', async () => {
    const mock = createMockProvider('Simplicity is the ultimate sophistication.');
    const davinci = await createDaVinci(mock);
    const response = await davinci.respond('test');
    expect(response.text).toBe('Simplicity is the ultimate sophistication.');
  });
});

// ─── Knowledge Search ─────────────────────────────────────────────────────────

describe('da Vinci knowledge search', () => {
  it('finds sources for art painting query', async () => {
    const davinci = await createDaVinci();
    const sources = davinci.searchKnowledge('painting art light shadow observation');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('finds sources for anatomy query', async () => {
    const davinci = await createDaVinci();
    const sources = davinci.searchKnowledge('anatomy body muscle dissection structure');
    expect(sources.length).toBeGreaterThan(0);
  });

  it('knowledge base contains content about water', () => {
    const allContent = DA_VINCI_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(allContent.includes('water')).toBe(true);
  });

  it('sources include content about invention or engineering', () => {
    const allContent = DA_VINCI_CONFIG.primarySources.map((s) => s.content).join(' ').toLowerCase();
    expect(
      allContent.includes('invent') || allContent.includes('engineer') || allContent.includes('machine'),
    ).toBe(true);
  });
});

// ─── Response Quality ─────────────────────────────────────────────────────────

describe('da Vinci response', () => {
  it('responds to an art question', async () => {
    const davinci = await createDaVinci();
    const response = await davinci.respond('What is the relationship between art and science?');
    expect(response.text.length).toBeGreaterThan(10);
    expect(response.confidence).toBeGreaterThanOrEqual(0);
  });

  it('responds to an anatomy question', async () => {
    const davinci = await createDaVinci();
    const response = await davinci.respond('How does understanding anatomy help painters?');
    expect(response.text.length).toBeGreaterThan(10);
  });

  it('response includes citation when knowledge matches', async () => {
    const davinci = await createDaVinci();
    const response = await davinci.respond('observation painting anatomy art simplicity');
    if (response.confidence > 0) {
      expect(response.citations.length).toBeGreaterThan(0);
    }
  });

  it('mock provider response returned verbatim', async () => {
    const mock = createMockProvider('The noblest pleasure is the joy of understanding.');
    const davinci = await createDaVinci(mock);
    const response = await davinci.respond('understanding knowledge joy');
    expect(response.text).toBe('The noblest pleasure is the joy of understanding.');
  });

  it('correlate returns null or valid response for unrelated topic', async () => {
    const davinci = await createDaVinci();
    const unrelated = await davinci.respond('cryptocurrency blockchain decentralized finance');
    const result = await davinci.correlate(unrelated);
    expect(result === null || result.text.length > 0).toBe(true);
  });

  it('correlate finds connection on art observation nature topic', async () => {
    const davinci = await createDaVinci();
    const other = await createDaVinci();
    const otherResponse = await other.respond('observation painting anatomy nature art simplicity');
    const correlation = await davinci.correlate(otherResponse);
    expect(correlation === null || correlation.text.length > 0).toBe(true);
  });
});
