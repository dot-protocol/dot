/**
 * mind.test.ts — Core Mind class and LocalInference tests.
 * 30+ tests covering construction, respond, searchKnowledge, correlate, LocalInference.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import { Mind, createMind } from '../src/mind.js';
import { LocalInference, extractKeywords } from '../src/local-inference.js';
import type { MindConfig, InferenceProvider, MindResponse } from '../src/types.js';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_CONFIG: MindConfig = {
  id: 'test-mind',
  name: 'Test Mind',
  era: '2000-2024',
  domain: ['testing', 'verification', 'computation'],
  axiom: 'Tests are the cheapest insurance you have.',
  systemPrompt: 'You are a test mind. Be precise.',
  primarySources: [
    {
      title: 'Testing in Practice',
      author: 'Test Author',
      year: 2020,
      type: 'paper',
      content:
        'Unit tests verify that individual components work correctly in isolation. Integration tests verify that components work together. The goal of testing is not to find bugs but to build confidence that the system does what it should do. Test coverage measures which code paths are exercised by your tests.',
    },
    {
      title: 'Computation Fundamentals',
      author: 'Another Author',
      year: 2015,
      type: 'book',
      content:
        'Computation is the process of following a precise set of rules to transform input into output. Algorithms are the recipes. Data structures are the containers. Together they define what is computable and how efficiently it can be computed.',
    },
    {
      title: 'Verification Methods',
      author: 'Third Author',
      year: 2018,
      type: 'lecture',
      content:
        'Formal verification uses mathematical proof to establish that a system satisfies its specification. Unlike testing, which checks specific inputs, formal verification covers all possible inputs. The tradeoff is that formal verification requires specifying exactly what the system should do.',
    },
  ],
};

// Mock provider for controlled test output
function createMockProvider(response: string = 'Mock response'): InferenceProvider {
  return {
    generate: vi.fn().mockResolvedValue(response),
  };
}

// ─── Mind Construction ────────────────────────────────────────────────────────

describe('Mind construction', () => {
  it('creates a Mind with config', async () => {
    const identity = await createIdentity();
    const mind = new Mind(TEST_CONFIG, identity);
    expect(mind.config).toBe(TEST_CONFIG);
    expect(mind.config.id).toBe('test-mind');
  });

  it('generates a unique Ed25519 identity', async () => {
    const identity = await createIdentity();
    const mind = new Mind(TEST_CONFIG, identity);
    expect(mind.identity.publicKey).toBeInstanceOf(Uint8Array);
    expect(mind.identity.secretKey).toBeInstanceOf(Uint8Array);
    expect(mind.identity.publicKey.length).toBe(32);
    expect(mind.identity.secretKey.length).toBe(32);
  });

  it('two minds have different keypairs', async () => {
    const id1 = await createIdentity();
    const id2 = await createIdentity();
    const m1 = new Mind(TEST_CONFIG, id1);
    const m2 = new Mind(TEST_CONFIG, id2);
    // Public keys should differ (vanishingly small chance of collision)
    expect(m1.identity.publicKey).not.toEqual(m2.identity.publicKey);
  });

  it('defaults to LocalInference when no provider given', async () => {
    const identity = await createIdentity();
    const mind = new Mind(TEST_CONFIG, identity);
    expect(mind.provider).toBeInstanceOf(LocalInference);
  });

  it('uses provided inference provider', async () => {
    const identity = await createIdentity();
    const mock = createMockProvider();
    const mind = new Mind(TEST_CONFIG, identity, mock);
    expect(mind.provider).toBe(mock);
  });

  it('initializes state with zeroed counters', async () => {
    const identity = await createIdentity();
    const mind = new Mind(TEST_CONFIG, identity);
    expect(mind.state.responsesGiven).toBe(0);
    expect(mind.state.correlationsMade).toBe(0);
    expect(mind.state.lastActive).toBe(0);
  });

  it('createMind factory returns a Mind', async () => {
    const mind = await createMind(TEST_CONFIG);
    expect(mind).toBeInstanceOf(Mind);
    expect(mind.config.id).toBe('test-mind');
  });
});

// ─── Mind.respond ─────────────────────────────────────────────────────────────

describe('Mind.respond', () => {
  it('returns a MindResponse with text', async () => {
    const identity = await createIdentity();
    const mock = createMockProvider('Test response text');
    const mind = new Mind(TEST_CONFIG, identity, mock);
    const response = await mind.respond('What is testing?');
    expect(response.text).toBe('Test response text');
  });

  it('returns citations array', async () => {
    const identity = await createIdentity();
    const mock = createMockProvider();
    const mind = new Mind(TEST_CONFIG, identity, mock);
    const response = await mind.respond('unit tests verification');
    expect(Array.isArray(response.citations)).toBe(true);
  });

  it('citations reference source titles from knowledge base', async () => {
    const identity = await createIdentity();
    const mock = createMockProvider();
    const mind = new Mind(TEST_CONFIG, identity, mock);
    const response = await mind.respond('unit tests verification');
    const sourceTitles = TEST_CONFIG.primarySources.map((s) => s.title);
    for (const citation of response.citations) {
      expect(sourceTitles).toContain(citation.source);
    }
  });

  it('returns a confidence value between 0 and 1', async () => {
    const identity = await createIdentity();
    const mock = createMockProvider();
    const mind = new Mind(TEST_CONFIG, identity, mock);
    const response = await mind.respond('What is testing?');
    expect(response.confidence).toBeGreaterThanOrEqual(0);
    expect(response.confidence).toBeLessThanOrEqual(1);
  });

  it('increments responsesGiven counter', async () => {
    const identity = await createIdentity();
    const mock = createMockProvider();
    const mind = new Mind(TEST_CONFIG, identity, mock);
    expect(mind.state.responsesGiven).toBe(0);
    await mind.respond('test query');
    expect(mind.state.responsesGiven).toBe(1);
    await mind.respond('test query 2');
    expect(mind.state.responsesGiven).toBe(2);
  });

  it('updates lastActive timestamp after respond', async () => {
    const identity = await createIdentity();
    const mock = createMockProvider();
    const mind = new Mind(TEST_CONFIG, identity, mock);
    const before = Date.now();
    await mind.respond('test query');
    const after = Date.now();
    expect(mind.state.lastActive).toBeGreaterThanOrEqual(before);
    expect(mind.state.lastActive).toBeLessThanOrEqual(after);
  });

  it('high confidence on topic well-covered by knowledge base', async () => {
    const identity = await createIdentity();
    const mock = createMockProvider();
    const mind = new Mind(TEST_CONFIG, identity, mock);
    const response = await mind.respond('unit tests coverage verification components');
    expect(response.confidence).toBeGreaterThan(0.3);
  });
});

// ─── Mind.searchKnowledge ─────────────────────────────────────────────────────

describe('Mind.searchKnowledge', () => {
  let mind: Mind;

  beforeEach(async () => {
    const identity = await createIdentity();
    mind = new Mind(TEST_CONFIG, identity);
  });

  it('returns relevant sources for a matching query', () => {
    const sources = mind.searchKnowledge('unit tests coverage');
    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0]!.title).toBe('Testing in Practice');
  });

  it('returns up to 3 sources maximum', () => {
    const sources = mind.searchKnowledge('tests computation verification');
    expect(sources.length).toBeLessThanOrEqual(3);
  });

  it('returns empty array for unrelated query', () => {
    const sources = mind.searchKnowledge('poetry love ocean wind reed');
    expect(sources.length).toBe(0);
  });

  it('ranks sources by relevance — most relevant first', () => {
    const sources = mind.searchKnowledge('tests coverage paths');
    // "Testing in Practice" should rank higher than others for this query
    expect(sources[0]!.title).toBe('Testing in Practice');
  });

  it('returns source for empty/trivial query (graceful degradation)', () => {
    const sources = mind.searchKnowledge('the');
    // Should return something (first source fallback or empty)
    expect(Array.isArray(sources)).toBe(true);
  });
});

// ─── Mind.correlate ───────────────────────────────────────────────────────────

describe('Mind.correlate', () => {
  it('returns null for completely unrelated response', async () => {
    const identity = await createIdentity();
    const mock = createMockProvider();
    const mind = new Mind(TEST_CONFIG, identity, mock);

    const unrelatedResponse: MindResponse = {
      text: 'The reed flute cries for its home in the reed bed. Love is the ocean and we are waves.',
      citations: [],
      confidence: 0.9,
    };

    const result = await mind.correlate(unrelatedResponse);
    expect(result).toBeNull();
  });

  it('returns a MindResponse for related content', async () => {
    const identity = await createIdentity();
    const mock = createMockProvider('Connected thought about testing');
    const mind = new Mind(TEST_CONFIG, identity, mock);

    const relatedResponse: MindResponse = {
      text: 'Testing and verification methods ensure software components work correctly with full coverage.',
      citations: [],
      confidence: 0.8,
    };

    const result = await mind.correlate(relatedResponse);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('Connected thought about testing');
  });

  it('increments correlationsMade when correlation found', async () => {
    const identity = await createIdentity();
    const mock = createMockProvider('Correlated response');
    const mind = new Mind(TEST_CONFIG, identity, mock);

    const relatedResponse: MindResponse = {
      text: 'Testing verification unit tests coverage algorithms computation',
      citations: [],
      confidence: 0.8,
    };

    expect(mind.state.correlationsMade).toBe(0);
    await mind.correlate(relatedResponse);
    expect(mind.state.correlationsMade).toBe(1);
  });

  it('does not increment correlationsMade when correlation is null', async () => {
    const identity = await createIdentity();
    const mock = createMockProvider();
    const mind = new Mind(TEST_CONFIG, identity, mock);

    const unrelatedResponse: MindResponse = {
      text: 'Sufi poetry love mysticism wound light',
      citations: [],
      confidence: 0.9,
    };

    await mind.correlate(unrelatedResponse);
    expect(mind.state.correlationsMade).toBe(0);
  });
});

// ─── LocalInference ───────────────────────────────────────────────────────────

describe('LocalInference', () => {
  it('generate returns a non-empty string', async () => {
    const inference = new LocalInference('Test Mind', TEST_CONFIG.primarySources);
    const result = await inference.generate('What is testing?', 'system prompt');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('response includes source title when match found', async () => {
    const inference = new LocalInference('Test Mind', TEST_CONFIG.primarySources);
    const result = await inference.generate('unit tests coverage verification', 'system');
    expect(result).toContain('Testing in Practice');
  });

  it('response mentions the mind name', async () => {
    const inference = new LocalInference('Socrates', TEST_CONFIG.primarySources);
    const result = await inference.generate('What is testing?', 'system');
    expect(result).toContain('Socrates');
  });

  it('handles query with no matching sources gracefully', async () => {
    const inference = new LocalInference('Test Mind', TEST_CONFIG.primarySources);
    const result = await inference.generate(
      'ancient Mesopotamian cuneiform pottery glazing techniques',
      'system',
    );
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('findMatchingSources returns matching sources', () => {
    const inference = new LocalInference('Test Mind', TEST_CONFIG.primarySources);
    const matches = inference.findMatchingSources(['tests', 'coverage']);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]!.title).toBe('Testing in Practice');
  });

  it('findMatchingSources returns empty for no-match keywords', () => {
    const inference = new LocalInference('Test Mind', TEST_CONFIG.primarySources);
    const matches = inference.findMatchingSources(['xyzabc123nonexistent']);
    expect(matches.length).toBe(0);
  });
});

// ─── extractKeywords ──────────────────────────────────────────────────────────

describe('extractKeywords', () => {
  it('returns meaningful keywords from a sentence', () => {
    const kw = extractKeywords('What is quantum mechanics?');
    expect(kw).toContain('quantum');
    expect(kw).toContain('mechanics');
  });

  it('filters out common stop words', () => {
    const kw = extractKeywords('What is the meaning of life?');
    expect(kw).not.toContain('what');
    expect(kw).not.toContain('the');
    expect(kw).not.toContain('is');
    expect(kw).not.toContain('of');
  });

  it('returns empty array for all-stopword input', () => {
    const kw = extractKeywords('the a an');
    expect(kw.length).toBe(0);
  });

  it('lowercases all keywords', () => {
    const kw = extractKeywords('Quantum Physics ENTROPY');
    expect(kw).toContain('quantum');
    expect(kw).toContain('physics');
    expect(kw).toContain('entropy');
  });

  it('filters out very short words', () => {
    const kw = extractKeywords('is it ok to be');
    // All these are either stop words or <=2 chars
    expect(kw.length).toBe(0);
  });
});

// ─── Provider-agnostic: same Mind works with both LocalInference and mock ─────

describe('Provider-agnostic interface', () => {
  it('same Mind config works with LocalInference', async () => {
    const identity = await createIdentity();
    const mind = new Mind(TEST_CONFIG, identity); // LocalInference by default
    const response = await mind.respond('unit tests');
    expect(response.text.length).toBeGreaterThan(0);
  });

  it('same Mind config works with mock provider', async () => {
    const identity = await createIdentity();
    const mock = createMockProvider('Precisely what was asked');
    const mind = new Mind(TEST_CONFIG, identity, mock);
    const response = await mind.respond('unit tests');
    expect(response.text).toBe('Precisely what was asked');
  });

  it('switching providers does not change the config', async () => {
    const identity = await createIdentity();
    const mock = createMockProvider();
    const mindA = new Mind(TEST_CONFIG, identity);
    const mindB = new Mind(TEST_CONFIG, identity, mock);
    expect(mindA.config).toEqual(mindB.config);
  });
});
