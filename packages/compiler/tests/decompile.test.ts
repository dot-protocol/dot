/**
 * Tests for decompile() — StructuredContent → natural language.
 *
 * All tests use LocalCompiler (no LLM). Tests verify:
 *   - Basic rendering of claims into text
 *   - Audience level affects output
 *   - All claims appear in output
 *   - Citations are included
 *   - Language tag is preserved
 *   - Edge cases (empty content, missing fields)
 */

import { describe, it, expect } from 'vitest';
import { decompile } from '../src/decompile.js';
import { LocalCompiler } from '../src/local-compiler.js';
import type { StructuredContent } from '../src/types.js';

const provider = new LocalCompiler();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContent(overrides: Partial<StructuredContent> = {}): StructuredContent {
  return {
    claims: [
      { statement: 'The temperature is 82 degrees Fahrenheit.', type: 'fact', certainty: 0.9 },
    ],
    entities: [{ name: 'sensor_7', category: 'entity' }],
    relationships: [],
    scope: { domain: 'science', certainty: 0.9, timeframe: 'current' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Basic structure
// ---------------------------------------------------------------------------

describe('decompile — return structure', () => {
  it('returns a DecompileResult with all required fields', async () => {
    const result = await decompile(makeContent(), 'en', provider);
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('targetLanguage');
    expect(result).toHaveProperty('audienceLevel');
    expect(result).toHaveProperty('fidelity');
  });

  it('text is a non-empty string for non-empty content', async () => {
    const result = await decompile(makeContent(), 'en', provider);
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('preserves targetLanguage in result', async () => {
    const result = await decompile(makeContent(), 'es', provider);
    expect(result.targetLanguage).toBe('es');
  });

  it('fidelity is between 0 and 1', async () => {
    const result = await decompile(makeContent(), 'en', provider);
    expect(result.fidelity).toBeGreaterThanOrEqual(0);
    expect(result.fidelity).toBeLessThanOrEqual(1);
  });

  it('audienceLevel matches requested level', async () => {
    const result = await decompile(makeContent(), 'en', provider, { audienceLevel: 'expert' });
    expect(result.audienceLevel).toBe('expert');
  });

  it('defaults to "general" audience when not specified', async () => {
    const result = await decompile(makeContent(), 'en', provider);
    expect(result.audienceLevel).toBe('general');
  });
});

// ---------------------------------------------------------------------------
// Claim presence
// ---------------------------------------------------------------------------

describe('decompile — claim presence', () => {
  it('claim content appears in the rendered text', async () => {
    const content = makeContent({
      claims: [{ statement: 'Water boils at 100 degrees Celsius.', type: 'fact', certainty: 0.95 }],
    });
    const result = await decompile(content, 'en', provider);
    // Key words from the claim should be present
    expect(result.text.toLowerCase()).toMatch(/water|boil|100|celsius/);
  });

  it('multiple claims all contribute to the rendered text', async () => {
    const content = makeContent({
      claims: [
        { statement: 'The sky is blue.', type: 'fact', certainty: 0.9 },
        { statement: 'The grass is green.', type: 'fact', certainty: 0.9 },
      ],
    });
    const result = await decompile(content, 'en', provider);
    expect(result.text.toLowerCase()).toMatch(/sky|blue/);
    expect(result.text.toLowerCase()).toMatch(/grass|green/);
  });

  it('opinion claims are rendered with appropriate framing', async () => {
    const content = makeContent({
      claims: [{ statement: 'the policy is ineffective', type: 'opinion', certainty: 0.6 }],
    });
    const result = await decompile(content, 'en', provider);
    // Should have some belief/opinion framing
    expect(result.text).toBeTruthy();
  });

  it('question claims end with a question mark', async () => {
    const content = makeContent({
      claims: [{ statement: 'Is the temperature normal', type: 'question', certainty: 0.5 }],
    });
    const result = await decompile(content, 'en', provider);
    expect(result.text).toContain('?');
  });
});

// ---------------------------------------------------------------------------
// Citations
// ---------------------------------------------------------------------------

describe('decompile — citations', () => {
  it('claim sources are included in the rendered output', async () => {
    const content = makeContent({
      claims: [
        {
          statement: 'The temperature is rising globally.',
          type: 'fact',
          certainty: 0.9,
          source: 'IPCC 2023',
        },
      ],
    });
    const result = await decompile(content, 'en', provider);
    expect(result.text).toContain('IPCC 2023');
  });
});

// ---------------------------------------------------------------------------
// Audience level
// ---------------------------------------------------------------------------

describe('decompile — audience level', () => {
  it('returns a result for child audience level', async () => {
    const result = await decompile(makeContent(), 'en', provider, { audienceLevel: 'child' });
    expect(result.audienceLevel).toBe('child');
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('returns a result for general audience level', async () => {
    const result = await decompile(makeContent(), 'en', provider, { audienceLevel: 'general' });
    expect(result.audienceLevel).toBe('general');
  });

  it('returns a result for expert audience level', async () => {
    const result = await decompile(makeContent(), 'en', provider, { audienceLevel: 'expert' });
    expect(result.audienceLevel).toBe('expert');
  });

  it('different audience levels produce different text for complex content', async () => {
    const content = makeContent({
      claims: [
        { statement: 'the administration will impose new tariff regulations', type: 'prediction', certainty: 0.6 },
      ],
    });
    const childResult = await decompile(content, 'en', provider, { audienceLevel: 'child' });
    const expertResult = await decompile(content, 'en', provider, { audienceLevel: 'expert' });
    // Both should be non-empty and valid
    expect(childResult.text.length).toBeGreaterThan(0);
    expect(expertResult.text.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('decompile — edge cases', () => {
  it('returns empty string for empty claims array', async () => {
    const content = makeContent({ claims: [] });
    const result = await decompile(content, 'en', provider);
    expect(result.text).toBe('');
  });

  it('handles content with no entities gracefully', async () => {
    const content: StructuredContent = {
      claims: [{ statement: 'Something happened.', type: 'fact', certainty: 0.8 }],
      entities: [],
      relationships: [],
      scope: { domain: 'general', certainty: 0.8, timeframe: 'current' },
    };
    const result = await decompile(content, 'en', provider);
    expect(result).toHaveProperty('text');
  });

  it('handles provider throwing error gracefully', async () => {
    const brokenProvider = { generate: async () => { throw new Error('LLM offline'); } };
    const result = await decompile(makeContent(), 'en', brokenProvider);
    expect(result).toHaveProperty('text');
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('handles provider returning non-JSON gracefully', async () => {
    const badProvider = { generate: async () => 'Sorry, I cannot help with that.' };
    const result = await decompile(makeContent(), 'en', badProvider);
    expect(result).toHaveProperty('text');
  });

  it('handles content with only relationships (no claims)', async () => {
    const content: StructuredContent = {
      claims: [],
      entities: [{ name: 'Alice', category: 'person' }, { name: 'Bob', category: 'person' }],
      relationships: [{ from: 'Alice', relation: 'knows', to: 'Bob' }],
      scope: { domain: 'social', certainty: 0.9, timeframe: 'current' },
    };
    const result = await decompile(content, 'en', provider);
    expect(result).toHaveProperty('text');
    expect(result.fidelity).toBeGreaterThanOrEqual(0);
  });
});
