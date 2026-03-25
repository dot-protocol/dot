/**
 * Tests for compile() — natural language → StructuredContent.
 *
 * All tests use LocalCompiler so they run deterministically without an LLM.
 */

import { describe, it, expect } from 'vitest';
import { compile } from '../src/compile.js';
import { LocalCompiler } from '../src/local-compiler.js';
import type { CompileResult } from '../src/types.js';

const provider = new LocalCompiler();

// ---------------------------------------------------------------------------
// Basic structure
// ---------------------------------------------------------------------------

describe('compile — return structure', () => {
  it('returns a CompileResult with all required fields', async () => {
    const result: CompileResult = await compile('Hello world.', provider);
    expect(result).toHaveProperty('dot');
    expect(result).toHaveProperty('sourceLanguage');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('citations');
  });

  it('dot contains claims, entities, relationships, scope', async () => {
    const result = await compile('The temperature is high.', provider);
    expect(result.dot).toHaveProperty('claims');
    expect(result.dot).toHaveProperty('entities');
    expect(result.dot).toHaveProperty('relationships');
    expect(result.dot).toHaveProperty('scope');
  });

  it('claims is an array', async () => {
    const result = await compile('The sky is blue.', provider);
    expect(Array.isArray(result.dot.claims)).toBe(true);
  });

  it('entities is an array', async () => {
    const result = await compile('Alice works at Acme Corp.', provider);
    expect(Array.isArray(result.dot.entities)).toBe(true);
  });

  it('citations is an array', async () => {
    const result = await compile('Water is H2O.', provider);
    expect(Array.isArray(result.citations)).toBe(true);
  });

  it('confidence is between 0 and 1', async () => {
    const result = await compile('The Earth orbits the Sun.', provider);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

describe('compile — language detection', () => {
  it('detects English for Latin-script text', async () => {
    const result = await compile('The weather is sunny today.', provider);
    expect(result.sourceLanguage).toBe('en');
  });

  it('detects Hindi for Devanagari text', async () => {
    const result = await compile('नमस्ते दुनिया, आज मौसम बहुत अच्छा है।', provider);
    expect(result.sourceLanguage).toBe('hi');
  });

  it('detects Arabic for Arabic-script text', async () => {
    const result = await compile('مرحبا بالعالم، الطقس جميل اليوم.', provider);
    expect(result.sourceLanguage).toBe('ar');
  });

  it('detects Chinese for CJK ideographs', async () => {
    const result = await compile('今天天气很好，温度是25摄氏度。', provider);
    expect(result.sourceLanguage).toBe('zh');
  });
});

// ---------------------------------------------------------------------------
// Claims extraction
// ---------------------------------------------------------------------------

describe('compile — claims extraction', () => {
  it('extracts at least one claim from a non-empty sentence', async () => {
    const result = await compile('The temperature is 82 degrees Fahrenheit.', provider);
    expect(result.dot.claims.length).toBeGreaterThan(0);
  });

  it('extracts multiple claims from multi-sentence text', async () => {
    const result = await compile('The sky is blue. Water is wet. Fire is hot.', provider);
    expect(result.dot.claims.length).toBeGreaterThanOrEqual(2);
  });

  it('each claim has a statement field', async () => {
    const result = await compile('The sensor reads 82 degrees.', provider);
    for (const claim of result.dot.claims) {
      expect(typeof claim.statement).toBe('string');
      expect(claim.statement.length).toBeGreaterThan(0);
    }
  });

  it('each claim has a type field', async () => {
    const result = await compile('The sensor reads 82 degrees.', provider);
    const validTypes = ['fact', 'opinion', 'prediction', 'question'];
    for (const claim of result.dot.claims) {
      expect(validTypes).toContain(claim.type);
    }
  });

  it('each claim has a certainty between 0 and 1', async () => {
    const result = await compile('The sensor reads 82 degrees. Maybe the calibration is off?', provider);
    for (const claim of result.dot.claims) {
      expect(claim.certainty).toBeGreaterThanOrEqual(0);
      expect(claim.certainty).toBeLessThanOrEqual(1);
    }
  });

  it('classifies factual sentences as facts', async () => {
    const result = await compile('Water boils at 100 degrees Celsius.', provider);
    const facts = result.dot.claims.filter(c => c.type === 'fact');
    expect(facts.length).toBeGreaterThan(0);
  });

  it('classifies questions correctly', async () => {
    const result = await compile('Is the temperature above normal?', provider);
    const questions = result.dot.claims.filter(c => c.type === 'question');
    expect(questions.length).toBeGreaterThan(0);
  });

  it('classifies opinion sentences as opinions', async () => {
    const result = await compile('I think the reading is too high.', provider);
    const opinions = result.dot.claims.filter(c => c.type === 'opinion');
    expect(opinions.length).toBeGreaterThan(0);
  });

  it('classifies prediction sentences as predictions', async () => {
    const result = await compile('The temperature will rise next week.', provider);
    const predictions = result.dot.claims.filter(c => c.type === 'prediction');
    expect(predictions.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Entity extraction
// ---------------------------------------------------------------------------

describe('compile — entity extraction', () => {
  it('extracts entities from text with proper nouns', async () => {
    const result = await compile('Alice and Bob visited London together.', provider);
    const names = result.dot.entities.map(e => e.name);
    expect(names.some(n => n === 'London' || n === 'Alice' || n === 'Bob')).toBe(true);
  });

  it('each entity has a name and category', async () => {
    const result = await compile('Apple released a new iPhone in San Francisco.', provider);
    for (const entity of result.dot.entities) {
      expect(typeof entity.name).toBe('string');
      expect(typeof entity.category).toBe('string');
    }
  });

  it('extracts numeric quantities as entities', async () => {
    const result = await compile('The package weighs 5 kg and costs 30 USD.', provider);
    const names = result.dot.entities.map(e => e.name);
    expect(names.some(n => n.includes('kg') || n.includes('USD'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

describe('compile — scope', () => {
  it('scope has domain, certainty, timeframe', async () => {
    const result = await compile('The temperature is 82 degrees.', provider);
    expect(typeof result.dot.scope.domain).toBe('string');
    expect(typeof result.dot.scope.certainty).toBe('number');
    expect(typeof result.dot.scope.timeframe).toBe('string');
  });

  it('scope certainty is between 0 and 1', async () => {
    const result = await compile('Something might happen.', provider);
    expect(result.dot.scope.certainty).toBeGreaterThanOrEqual(0);
    expect(result.dot.scope.certainty).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Provider error handling
// ---------------------------------------------------------------------------

describe('compile — provider error handling', () => {
  it('falls back gracefully when provider throws', async () => {
    const brokenProvider = {
      generate: async () => { throw new Error('Provider unavailable'); },
    };
    const result = await compile('The sky is blue.', brokenProvider);
    // Should still return a valid CompileResult
    expect(result).toHaveProperty('dot');
    expect(result).toHaveProperty('sourceLanguage');
    expect(Array.isArray(result.dot.claims)).toBe(true);
  });

  it('falls back gracefully when provider returns garbage', async () => {
    const badProvider = { generate: async () => 'not valid json at all' };
    const result = await compile('Test text.', badProvider);
    expect(result).toHaveProperty('dot');
  });
});
