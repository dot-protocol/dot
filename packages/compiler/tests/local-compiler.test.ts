/**
 * Tests for local-compiler.ts — deterministic, no LLM required.
 *
 * Covers:
 *   - detectLanguage: 8+ languages via Unicode ranges
 *   - extractClaims: sentence splitting and type classification
 *   - extractEntities: proper nouns, quoted strings, numeric quantities
 *   - LocalCompiler: end-to-end compile/decompile/verify via generate()
 */

import { describe, it, expect } from 'vitest';
import { detectLanguage, extractClaims, extractEntities, LocalCompiler } from '../src/local-compiler.js';

// ---------------------------------------------------------------------------
// detectLanguage
// ---------------------------------------------------------------------------

describe('detectLanguage', () => {
  it('detects English as default for Latin-script text', () => {
    expect(detectLanguage('The weather is sunny today.')).toBe('en');
  });

  it('detects Hindi from Devanagari characters', () => {
    // "नमस्ते दुनिया" = "Hello world" in Hindi
    expect(detectLanguage('नमस्ते दुनिया, आज मौसम अच्छा है।')).toBe('hi');
  });

  it('detects Arabic from Arabic script', () => {
    // "مرحبا بالعالم" = "Hello world" in Arabic
    expect(detectLanguage('مرحبا بالعالم، الطقس جميل اليوم')).toBe('ar');
  });

  it('detects Chinese from CJK ideographs', () => {
    // "今天天气很好" = "The weather is very good today" in Chinese
    expect(detectLanguage('今天天气很好，我很开心')).toBe('zh');
  });

  it('detects Korean from Hangul syllables', () => {
    // "안녕하세요" = "Hello" in Korean
    expect(detectLanguage('안녕하세요 오늘 날씨가 좋네요')).toBe('ko');
  });

  it('detects Russian from Cyrillic characters', () => {
    // "Привет мир" = "Hello world" in Russian
    expect(detectLanguage('Привет мир, сегодня хорошая погода')).toBe('ru');
  });

  it('detects Japanese from Hiragana', () => {
    // "こんにちは" = "Hello" in Japanese
    expect(detectLanguage('こんにちは、今日はいい天気ですね')).toBe('ja');
  });

  it('detects Greek from Greek script', () => {
    // "Γεια σου κόσμε" = "Hello world" in Greek
    expect(detectLanguage('Γεια σου κόσμε, ο καιρός είναι ωραίος σήμερα')).toBe('el');
  });

  it('returns "en" for empty string', () => {
    expect(detectLanguage('')).toBe('en');
  });

  it('returns "en" for pure punctuation/numbers', () => {
    expect(detectLanguage('123 456 !@#$%')).toBe('en');
  });

  it('returns the dominant language for mixed-script text', () => {
    // Mostly Arabic with a few Latin chars
    const result = detectLanguage('مرحبا hello مرحبا مرحبا مرحبا');
    expect(result).toBe('ar');
  });
});

// ---------------------------------------------------------------------------
// extractClaims
// ---------------------------------------------------------------------------

describe('extractClaims', () => {
  it('splits text into individual sentence claims', () => {
    const claims = extractClaims('The sky is blue. Water is wet. Fire is hot.');
    expect(claims.length).toBe(3);
  });

  it('classifies declarative sentences as facts', () => {
    const claims = extractClaims('The temperature is 25 degrees Celsius.');
    expect(claims[0]?.type).toBe('fact');
  });

  it('classifies questions correctly', () => {
    const claims = extractClaims('Is the temperature above 30 degrees?');
    expect(claims[0]?.type).toBe('question');
  });

  it('classifies opinion-marker sentences as opinions', () => {
    const claims = extractClaims('I think the policy is ineffective.');
    expect(claims[0]?.type).toBe('opinion');
  });

  it('classifies "I believe" sentences as opinions', () => {
    const claims = extractClaims('I believe this approach is incorrect.');
    expect(claims[0]?.type).toBe('opinion');
  });

  it('classifies prediction-marker sentences as predictions', () => {
    const claims = extractClaims('The market will recover next year.');
    expect(claims[0]?.type).toBe('prediction');
  });

  it('assigns high certainty to facts', () => {
    const claims = extractClaims('Water boils at 100 degrees Celsius.');
    expect(claims[0]?.certainty).toBeGreaterThan(0.7);
  });

  it('assigns lower certainty to opinions than facts', () => {
    const factClaims = extractClaims('The Earth orbits the Sun.');
    const opinionClaims = extractClaims('I think this plan might work.');
    expect(factClaims[0]!.certainty).toBeGreaterThan(opinionClaims[0]!.certainty);
  });

  it('assigns lower certainty when hedge words are present', () => {
    const certain = extractClaims('The sky is blue.');
    const hedged = extractClaims('The sky is possibly blue.');
    expect(certain[0]!.certainty).toBeGreaterThan(hedged[0]!.certainty);
  });

  it('handles single-sentence input', () => {
    const claims = extractClaims('Hello world.');
    expect(claims.length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty string', () => {
    const claims = extractClaims('');
    expect(claims).toEqual([]);
  });

  it('handles exclamation marks as sentence terminators', () => {
    const claims = extractClaims('This is amazing! It really works! I love it!');
    expect(claims.length).toBe(3);
  });

  it('includes the full statement text in each claim', () => {
    const claims = extractClaims('The temperature sensor reads 82.3 degrees.');
    expect(claims[0]?.statement).toContain('82.3');
  });

  it('certainty is always in 0-1 range', () => {
    const claims = extractClaims('Perhaps maybe possibly this could be true.');
    for (const c of claims) {
      expect(c.certainty).toBeGreaterThanOrEqual(0);
      expect(c.certainty).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// extractEntities
// ---------------------------------------------------------------------------

describe('extractEntities', () => {
  it('extracts capitalized proper nouns from mid-sentence position', () => {
    const entities = extractEntities('We visited London and Paris last summer.');
    const names = entities.map(e => e.name);
    expect(names).toContain('London');
    expect(names).toContain('Paris');
  });

  it('extracts quoted strings as entities', () => {
    const entities = extractEntities('The policy is called "Project Sunrise".');
    const names = entities.map(e => e.name);
    expect(names.some(n => n.includes('Project Sunrise'))).toBe(true);
  });

  it('extracts numeric quantities with units', () => {
    const entities = extractEntities('The temperature is 82°F and humidity is 65%.');
    const names = entities.map(e => e.name);
    // Should find at least one quantity
    expect(names.some(n => n.includes('%') || n.includes('°'))).toBe(true);
  });

  it('deduplicates entities that appear multiple times', () => {
    const entities = extractEntities('Alice met Bob. Alice and Bob went to the store. Alice is happy.');
    const aliceEntries = entities.filter(e => e.name === 'Alice');
    expect(aliceEntries.length).toBe(1);
  });

  it('returns an empty array for text with no entities', () => {
    const entities = extractEntities('the quick brown fox jumps over the lazy dog');
    // All lowercase — no proper nouns, no quoted strings, no quantities
    expect(entities.length).toBe(0);
  });

  it('assigns a category to each entity', () => {
    const entities = extractEntities('We visited London last year.');
    for (const e of entities) {
      expect(typeof e.category).toBe('string');
      expect(e.category.length).toBeGreaterThan(0);
    }
  });

  it('does not extract first-word of sentence as entity when it is a common word', () => {
    const entities = extractEntities('The report was issued. This is important. A new policy was set.');
    const names = entities.map(e => e.name);
    // "The", "This", "A" should not be entities
    expect(names).not.toContain('The');
    expect(names).not.toContain('This');
    expect(names).not.toContain('A');
  });

  it('categorises quoted strings as "concept"', () => {
    const entities = extractEntities('They launched "Operation Moonshot" yesterday.');
    const quoted = entities.find(e => e.name.includes('Operation Moonshot'));
    expect(quoted?.category).toBe('concept');
  });
});

// ---------------------------------------------------------------------------
// LocalCompiler.generate()
// ---------------------------------------------------------------------------

describe('LocalCompiler', () => {
  const compiler = new LocalCompiler();

  it('implements CompilerProvider interface', () => {
    expect(typeof compiler.generate).toBe('function');
  });

  it('handles a compile JSON prompt and returns valid JSON', async () => {
    const prompt = JSON.stringify({ task: 'compile', text: 'The sky is blue.' });
    const result = await compiler.generate(prompt, '');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('returns sourceLanguage in compile response', async () => {
    const prompt = JSON.stringify({ task: 'compile', text: 'Hello world.' });
    const raw = await compiler.generate(prompt, '');
    const parsed = JSON.parse(raw);
    expect(typeof parsed.sourceLanguage).toBe('string');
  });

  it('returns claims array in compile response', async () => {
    const prompt = JSON.stringify({ task: 'compile', text: 'The temperature is 82 degrees. It is very hot.' });
    const raw = await compiler.generate(prompt, '');
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed.dot.claims)).toBe(true);
    expect(parsed.dot.claims.length).toBeGreaterThan(0);
  });

  it('handles decompile JSON prompt', async () => {
    const content = {
      claims: [{ statement: 'The sky is blue.', type: 'fact', certainty: 0.9 }],
      entities: [],
      relationships: [],
      scope: { domain: 'general', certainty: 0.9, timeframe: 'current' },
    };
    const prompt = JSON.stringify({ task: 'decompile', content, targetLanguage: 'en', audienceLevel: 'general' });
    const raw = await compiler.generate(prompt, '');
    const parsed = JSON.parse(raw);
    expect(typeof parsed.text).toBe('string');
    expect(parsed.text.length).toBeGreaterThan(0);
  });

  it('handles verify JSON prompt', async () => {
    const content = {
      claims: [{ statement: 'The sky is blue.', type: 'fact', certainty: 0.9 }],
      entities: [],
      relationships: [],
      scope: { domain: 'general', certainty: 0.9, timeframe: 'current' },
    };
    const prompt = JSON.stringify({ task: 'verify', content, rendering: 'The sky is blue.' });
    const raw = await compiler.generate(prompt, '');
    const parsed = JSON.parse(raw);
    expect(typeof parsed.fidelity).toBe('number');
    expect(typeof parsed.faithful).toBe('boolean');
  });

  it('falls back to compile mode for plain-text prompts', async () => {
    const raw = await compiler.generate('Paris is the capital of France.', '');
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
