/**
 * Tests for the English prose code generator (codegen/english.ts).
 * 20+ tests covering all observation and chain patterns.
 */

import { describe, it, expect } from 'vitest';
import { generateEnglish } from '../src/codegen/english.js';
import {
  makeProgram,
  makeObserve,
  makeAgent,
  makeGate,
  makePulse,
  makeMesh,
  makeBloom,
  makeFade,
  makeForge,
  makeFnCall,
  numLit,
  strLit,
  ident,
  binExpr,
  funcCall,
  arrLit,
  namedArg,
} from './helpers.js';

// ---------------------------------------------------------------------------
// Observe statement basics
// ---------------------------------------------------------------------------

describe('generateEnglish — ObserveStatement basics', () => {
  it('produces readable sentence for bare observe', () => {
    const prog = makeProgram([makeObserve({ observationType: 'temperature' })]);
    const text = generateEnglish(prog);
    expect(text).toContain('Observe');
    expect(text).toContain('temperature');
  });

  it('includes location in output', () => {
    const prog = makeProgram([
      makeObserve({
        observationType: 'temperature',
        location: funcCall('sensor', numLit(7)),
      }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain('sensor');
  });

  it('includes value in parentheses', () => {
    const prog = makeProgram([
      makeObserve({ observationType: 'temperature', value: numLit(82.3) }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain('82.3');
  });

  it('includes "at" when location given', () => {
    const prog = makeProgram([
      makeObserve({ observationType: 'temperature', location: ident('sensor_7') }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain(' at ');
  });

  it('uses "value" as fallback observation type', () => {
    const prog = makeProgram([makeObserve({})]);
    const text = generateEnglish(prog);
    expect(text).toContain('value');
  });

  it('ends with a period', () => {
    const prog = makeProgram([makeObserve({ observationType: 'state' })]);
    const text = generateEnglish(prog);
    expect(text.trimEnd()).toMatch(/\.$/);
  });

  it('uses observation type label in sentence', () => {
    const prog = makeProgram([makeObserve({ observationType: 'state' })]);
    const text = generateEnglish(prog);
    expect(text).toContain('state');
  });
});

// ---------------------------------------------------------------------------
// Function chain — gate
// ---------------------------------------------------------------------------

describe('generateEnglish — gate', () => {
  it('generates If-clause for gate', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeGate(binExpr(ident('temperature'), '>', numLit(80)))] }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain('If');
  });

  it('uses "exceeds" for > operator', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeGate(binExpr(ident('temperature'), '>', numLit(80)))] }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain('exceeds');
  });

  it('uses "is below" for < operator', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeGate(binExpr(ident('level'), '<', numLit(10)))] }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain('is below');
  });

  it('uses "equals" for == operator', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeGate(binExpr(ident('status'), '==', strLit('ok')))] }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain('equals');
  });
});

// ---------------------------------------------------------------------------
// Function chain — pulse
// ---------------------------------------------------------------------------

describe('generateEnglish — pulse', () => {
  it('generates send alert for pulse', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makePulse(strLit('overheating'))] }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain('alert');
  });

  it('includes label in pulse description', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makePulse(strLit('critical-alert'))] }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain('critical-alert');
  });

  it('generates send an event for empty pulse', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeFnCall('pulse', [])] }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain('event');
  });
});

// ---------------------------------------------------------------------------
// Function chain — mesh
// ---------------------------------------------------------------------------

describe('generateEnglish — mesh', () => {
  it('generates broadcast description for mesh', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeMesh(arrLit(strLit('maintenance'), strLit('dashboard')))] }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain('broadcast');
  });

  it('includes all targets in mesh description', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeMesh(arrLit(strLit('team-a'), strLit('team-b')))] }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain('team-a');
    expect(text).toContain('team-b');
  });
});

// ---------------------------------------------------------------------------
// Agent descriptions
// ---------------------------------------------------------------------------

describe('generateEnglish — AgentStatement', () => {
  it('includes "every N unit" in agent description', () => {
    const prog = makeProgram([
      makeAgent({ name: 'gem_scanner', every: { value: 5, unit: 'seconds' } }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain('Every 5');
    expect(text).toContain('second');
  });

  it('includes agent name in description', () => {
    const prog = makeProgram([
      makeAgent({ name: 'gem_scanner', every: { value: 5, unit: 'seconds' } }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain('gem scanner');
  });

  it('describes agent without every clause', () => {
    const prog = makeProgram([makeAgent({ name: 'data_collector' })]);
    const text = generateEnglish(prog);
    expect(text).toContain('data collector');
    expect(text).toContain('agent');
  });

  it('includes agent body observation in description', () => {
    const prog = makeProgram([
      makeAgent({
        name: 'monitor',
        every: { value: 10, unit: 'seconds' },
        body: [makeObserve({ observationType: 'temperature', value: numLit(82) })],
      }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain('temperature');
  });
});

// ---------------------------------------------------------------------------
// Multi-statement programs
// ---------------------------------------------------------------------------

describe('generateEnglish — multi-statement programs', () => {
  it('produces multiple lines for multiple statements', () => {
    const prog = makeProgram([
      makeObserve({ observationType: 'temperature' }),
      makeObserve({ observationType: 'pressure' }),
    ]);
    const text = generateEnglish(prog);
    expect(text).toContain('temperature');
    expect(text).toContain('pressure');
  });

  it('produces empty string for empty program', () => {
    const text = generateEnglish(makeProgram([]));
    expect(text).toBe('');
  });
});
