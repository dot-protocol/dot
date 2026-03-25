/**
 * Tests for verifyFidelity() — score rendering fidelity.
 *
 * All tests use LocalCompiler (no LLM). Tests verify:
 *   - Faithful rendering → high fidelity score
 *   - Dropped claim → issue flagged
 *   - Added content → issue flagged
 *   - Softened language → issue flagged
 *   - Missing citation → issue flagged
 *   - Issue structure is correct
 *   - Edge cases (empty content, provider failures)
 */

import { describe, it, expect } from 'vitest';
import { verifyFidelity } from '../src/verify.js';
import { LocalCompiler } from '../src/local-compiler.js';
import type { StructuredContent, FidelityIssue } from '../src/types.js';

const provider = new LocalCompiler();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContent(claims: Array<{
  statement: string;
  type?: 'fact' | 'opinion' | 'prediction' | 'question';
  certainty?: number;
  source?: string;
}>): StructuredContent {
  return {
    claims: claims.map(c => ({
      statement: c.statement,
      type: c.type ?? 'fact',
      certainty: c.certainty ?? 0.9,
      source: c.source,
    })),
    entities: [],
    relationships: [],
    scope: { domain: 'general', certainty: 0.9, timeframe: 'current' },
  };
}

// ---------------------------------------------------------------------------
// Basic structure
// ---------------------------------------------------------------------------

describe('verifyFidelity — return structure', () => {
  it('returns a VerifyResult with fidelity, issues, and faithful', async () => {
    const content = makeContent([{ statement: 'The sky is blue.' }]);
    const result = await verifyFidelity(content, 'The sky is blue.', provider);
    expect(result).toHaveProperty('fidelity');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('faithful');
  });

  it('fidelity is a number between 0 and 1', async () => {
    const content = makeContent([{ statement: 'Water is wet.' }]);
    const result = await verifyFidelity(content, 'Water is wet.', provider);
    expect(typeof result.fidelity).toBe('number');
    expect(result.fidelity).toBeGreaterThanOrEqual(0);
    expect(result.fidelity).toBeLessThanOrEqual(1);
  });

  it('issues is an array', async () => {
    const content = makeContent([{ statement: 'The temperature is 82 degrees.' }]);
    const result = await verifyFidelity(content, 'The temperature is 82 degrees.', provider);
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it('faithful is a boolean', async () => {
    const content = makeContent([{ statement: 'The sky is blue.' }]);
    const result = await verifyFidelity(content, 'The sky is blue.', provider);
    expect(typeof result.faithful).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// Faithful rendering
// ---------------------------------------------------------------------------

describe('verifyFidelity — faithful rendering', () => {
  it('exact rendering of a claim produces high fidelity', async () => {
    const content = makeContent([
      { statement: 'The temperature is eighty two degrees Fahrenheit at sensor seven.' },
    ]);
    const result = await verifyFidelity(
      content,
      'The temperature is eighty two degrees Fahrenheit at sensor seven.',
      provider,
    );
    expect(result.fidelity).toBeGreaterThan(0.7);
  });

  it('faithful is true when fidelity is above 0.8', async () => {
    const content = makeContent([{ statement: 'Water boils at one hundred degrees Celsius.' }]);
    const result = await verifyFidelity(
      content,
      'Water boils at one hundred degrees Celsius.',
      provider,
    );
    expect(result.faithful).toBe(result.fidelity > 0.8);
  });

  it('empty issues list for nearly perfect rendering', async () => {
    const claim = 'The temperature sensor recorded a reading of eighty two degrees.';
    const content = makeContent([{ statement: claim }]);
    const result = await verifyFidelity(content, claim, provider);
    // High fidelity match should have no or very few issues
    const highIssues = result.issues.filter(i => i.severity === 'high');
    expect(highIssues.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Dropped claim detection
// ---------------------------------------------------------------------------

describe('verifyFidelity — dropped claim detection', () => {
  it('detects a completely dropped claim', async () => {
    const content = makeContent([
      { statement: 'The temperature is critically elevated and requires immediate attention.' },
      { statement: 'The backup cooling system has failed completely.' },
    ]);
    // Rendering only includes the first claim
    const result = await verifyFidelity(
      content,
      'The temperature is critically elevated and requires immediate attention.',
      provider,
    );
    const droppedIssues = result.issues.filter(i => i.type === 'dropped_claim');
    expect(droppedIssues.length).toBeGreaterThan(0);
  });

  it('dropped claim issue has a description', async () => {
    const content = makeContent([
      { statement: 'The primary reactor temperature exceeded threshold.' },
      { statement: 'Emergency protocols were not followed correctly.' },
    ]);
    const result = await verifyFidelity(
      content,
      'The primary reactor temperature exceeded threshold.',
      provider,
    );
    const dropped = result.issues.filter(i => i.type === 'dropped_claim');
    if (dropped.length > 0) {
      expect(typeof dropped[0]!.description).toBe('string');
      expect(dropped[0]!.description.length).toBeGreaterThan(0);
    }
  });

  it('dropped claim reduces fidelity score', async () => {
    const content = makeContent([
      { statement: 'The temperature sensor recorded a critical reading.' },
      { statement: 'The secondary sensor also failed completely and unexpectedly.' },
    ]);
    const fullResult = await verifyFidelity(
      content,
      'The temperature sensor recorded a critical reading. The secondary sensor also failed completely and unexpectedly.',
      provider,
    );
    const partialResult = await verifyFidelity(
      content,
      'The temperature sensor recorded a critical reading.',
      provider,
    );
    expect(partialResult.fidelity).toBeLessThanOrEqual(fullResult.fidelity);
  });
});

// ---------------------------------------------------------------------------
// Added content detection
// ---------------------------------------------------------------------------

describe('verifyFidelity — added content detection', () => {
  it('flags rendering with substantial added content', async () => {
    const content = makeContent([
      { statement: 'The door is open.' },
    ]);
    // Rendering adds a lot of content not in the spec
    const rendering = 'The door is open. Furthermore, the windows were also opened by the maintenance crew, who arrived at 9am and completed a full inspection of all ventilation systems including the HVAC unit and associated ductwork which had previously been reported as malfunctioning according to the building management system logs.';
    const result = await verifyFidelity(content, rendering, provider);
    const addedIssues = result.issues.filter(i => i.type === 'added_content');
    expect(addedIssues.length).toBeGreaterThan(0);
  });

  it('added content issue has a severity', async () => {
    const content = makeContent([{ statement: 'The value is ten.' }]);
    const rendering = 'The value is ten. Additionally, experts from multiple institutions have confirmed that this represents a significant departure from baseline measurements established over the past several decades of continuous monitoring.';
    const result = await verifyFidelity(content, rendering, provider);
    for (const issue of result.issues) {
      expect(['low', 'medium', 'high']).toContain(issue.severity);
    }
  });
});

// ---------------------------------------------------------------------------
// Softened language detection
// ---------------------------------------------------------------------------

describe('verifyFidelity — softened language detection', () => {
  it('flags softening hedges when original claim is high-certainty', async () => {
    const content = makeContent([
      { statement: 'The system has definitively failed.', certainty: 0.95 },
    ]);
    // Rendering uses hedging language
    const result = await verifyFidelity(
      content,
      'The system has perhaps possibly failed, though we cannot be certain.',
      provider,
    );
    const softened = result.issues.filter(i => i.type === 'softened_language');
    expect(softened.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Missing citation detection
// ---------------------------------------------------------------------------

describe('verifyFidelity — missing citation detection', () => {
  it('flags missing citation when source is in content but absent from rendering', async () => {
    const content = makeContent([
      { statement: 'Global temperatures are rising.', source: 'IPCC 2024' },
    ]);
    const result = await verifyFidelity(
      content,
      'Global temperatures are rising.',
      provider,
    );
    const citationIssues = result.issues.filter(i => i.type === 'missing_citation');
    expect(citationIssues.length).toBeGreaterThan(0);
  });

  it('no citation issue when rendering includes the source', async () => {
    const content = makeContent([
      { statement: 'Global temperatures are rising.', source: 'IPCC 2024' },
    ]);
    const result = await verifyFidelity(
      content,
      'Global temperatures are rising. (Source: IPCC 2024)',
      provider,
    );
    const citationIssues = result.issues.filter(i => i.type === 'missing_citation');
    expect(citationIssues.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Issue structure
// ---------------------------------------------------------------------------

describe('verifyFidelity — issue structure', () => {
  it('all issues have valid type values', async () => {
    const validTypes = new Set([
      'dropped_claim', 'added_content', 'softened_language',
      'missing_citation', 'changed_certainty',
    ]);
    const content = makeContent([{ statement: 'Something significant occurred.' }]);
    const result = await verifyFidelity(content, 'Something different happened entirely.', provider);
    for (const issue of result.issues) {
      expect(validTypes.has(issue.type)).toBe(true);
    }
  });

  it('all issues have valid severity values', async () => {
    const validSeverities = new Set(['low', 'medium', 'high']);
    const content = makeContent([
      { statement: 'The critical system has completely failed.' },
    ]);
    const result = await verifyFidelity(content, 'Everything is fine.', provider);
    for (const issue of result.issues) {
      expect(validSeverities.has(issue.severity)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('verifyFidelity — edge cases', () => {
  it('handles empty claims array gracefully', async () => {
    const content: StructuredContent = {
      claims: [],
      entities: [],
      relationships: [],
      scope: { domain: 'general', certainty: 0.7, timeframe: 'current' },
    };
    const result = await verifyFidelity(content, 'Some rendering.', provider);
    expect(result).toHaveProperty('fidelity');
    expect(result.fidelity).toBeGreaterThanOrEqual(0);
  });

  it('handles empty rendering string', async () => {
    const content = makeContent([{ statement: 'There is a problem.' }]);
    const result = await verifyFidelity(content, '', provider);
    expect(result.fidelity).toBeLessThan(1);
  });

  it('falls back gracefully when provider throws', async () => {
    const brokenProvider = { generate: async () => { throw new Error('Offline'); } };
    const content = makeContent([{ statement: 'The sky is blue.' }]);
    const result = await verifyFidelity(content, 'The sky is blue.', brokenProvider);
    expect(result).toHaveProperty('fidelity');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('faithful');
  });

  it('falls back gracefully when provider returns invalid JSON', async () => {
    const badProvider = { generate: async () => 'I cannot evaluate this.' };
    const content = makeContent([{ statement: 'The temperature is normal.' }]);
    const result = await verifyFidelity(content, 'The temperature is normal.', badProvider);
    expect(result).toHaveProperty('fidelity');
    expect(typeof result.faithful).toBe('boolean');
  });
});
