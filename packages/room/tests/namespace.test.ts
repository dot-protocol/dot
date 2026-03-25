/**
 * namespace.test.ts — Room naming tests.
 * Target: 15+ tests.
 */

import { describe, it, expect } from 'vitest';
import { isValidRoomName, normalizeRoomName, parseRoomName } from '../src/namespace.js';

// --- isValidRoomName ---

describe('isValidRoomName', () => {
  it('accepts ".physics"', () => {
    expect(isValidRoomName('.physics')).toBe(true);
  });

  it('accepts ".the.first.room"', () => {
    expect(isValidRoomName('.the.first.room')).toBe(true);
  });

  it('accepts ".my-bakery"', () => {
    expect(isValidRoomName('.my-bakery')).toBe(true);
  });

  it('accepts ".a" (single char segment)', () => {
    expect(isValidRoomName('.a')).toBe(true);
  });

  it('accepts ".alpha1.beta2"', () => {
    expect(isValidRoomName('.alpha1.beta2')).toBe(true);
  });

  it('accepts ".UPPERCASE"', () => {
    expect(isValidRoomName('.UPPERCASE')).toBe(true);
  });

  it('rejects "physics" (no leading dot)', () => {
    expect(isValidRoomName('physics')).toBe(false);
  });

  it('rejects "" (empty string)', () => {
    expect(isValidRoomName('')).toBe(false);
  });

  it('rejects "." (dot only, no body)', () => {
    expect(isValidRoomName('.')).toBe(false);
  });

  it('rejects ".phy sics" (space)', () => {
    expect(isValidRoomName('.phy sics')).toBe(false);
  });

  it('rejects ".hello!" (special char)', () => {
    expect(isValidRoomName('.hello!')).toBe(false);
  });

  it('rejects ".hello world" (space)', () => {
    expect(isValidRoomName('.hello world')).toBe(false);
  });

  it('rejects "..double.dot" (consecutive dots)', () => {
    expect(isValidRoomName('..double.dot')).toBe(false);
  });

  it('rejects ".trailing." (trailing dot)', () => {
    expect(isValidRoomName('.trailing.')).toBe(false);
  });

  it('rejects a name over 255 chars', () => {
    const long = '.' + 'a'.repeat(255);
    expect(isValidRoomName(long)).toBe(false);
  });

  it('accepts name exactly at 255 chars', () => {
    const at255 = '.' + 'a'.repeat(254);
    expect(isValidRoomName(at255)).toBe(true);
  });
});

// --- normalizeRoomName ---

describe('normalizeRoomName', () => {
  it('lowercases the name', () => {
    expect(normalizeRoomName('.PHYSICS')).toBe('.physics');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeRoomName('  .physics  ')).toBe('.physics');
  });

  it('returns the same valid lowercase name', () => {
    expect(normalizeRoomName('.the.first.room')).toBe('.the.first.room');
  });

  it('throws for invalid name after normalization', () => {
    expect(() => normalizeRoomName('noDot')).toThrow();
  });

  it('throws for empty string', () => {
    expect(() => normalizeRoomName('')).toThrow();
  });

  it('preserves hyphens', () => {
    expect(normalizeRoomName('.my-bakery')).toBe('.my-bakery');
  });
});

// --- parseRoomName ---

describe('parseRoomName', () => {
  it('parses ".physics" into ["physics"], depth 1', () => {
    const result = parseRoomName('.physics');
    expect(result.parts).toEqual(['physics']);
    expect(result.depth).toBe(1);
  });

  it('parses ".the.first.room" into 3 parts', () => {
    const result = parseRoomName('.the.first.room');
    expect(result.parts).toEqual(['the', 'first', 'room']);
    expect(result.depth).toBe(3);
  });

  it('parses ".physics.quantum.entanglement" into 3 parts', () => {
    const result = parseRoomName('.physics.quantum.entanglement');
    expect(result.parts).toEqual(['physics', 'quantum', 'entanglement']);
    expect(result.depth).toBe(3);
  });

  it('parses ".a" into depth 1', () => {
    const result = parseRoomName('.a');
    expect(result.depth).toBe(1);
    expect(result.parts).toEqual(['a']);
  });

  it('handles name without leading dot (graceful)', () => {
    const result = parseRoomName('physics.quantum');
    expect(result.parts).toEqual(['physics', 'quantum']);
    expect(result.depth).toBe(2);
  });
});
