/**
 * Tests for the DOT language type checker (checker.ts).
 * 35+ tests covering valid programs, invalid conditions, missing args, etc.
 */

import { describe, it, expect } from 'vitest';
import { checkProgram } from '../src/checker.js';
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
  boolLit,
  ident,
  binExpr,
  funcCall,
  arrLit,
  namedArg,
  LOC,
} from './helpers.js';

// ---------------------------------------------------------------------------
// Valid programs
// ---------------------------------------------------------------------------

describe('checkProgram — valid programs', () => {
  it('passes an empty program', () => {
    const { errors } = checkProgram(makeProgram([]));
    expect(errors).toHaveLength(0);
  });

  it('passes a bare observe with no chain', () => {
    const { errors } = checkProgram(makeProgram([makeObserve({ observationType: 'temperature' })]));
    expect(errors).toHaveLength(0);
  });

  it('passes observe with valid gate: binary comparison >', () => {
    const prog = makeProgram([
      makeObserve({
        observationType: 'temperature',
        value: numLit(82.3),
        chain: [makeGate(binExpr(ident('temperature'), '>', numLit(80)))],
      }),
    ]);
    const { errors } = checkProgram(prog);
    expect(errors).toHaveLength(0);
  });

  it('passes observe with valid gate: binary comparison <', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeGate(binExpr(ident('x'), '<', numLit(10)))] }),
    ]);
    expect(checkProgram(prog).errors).toHaveLength(0);
  });

  it('passes observe with valid gate: >=', () => {
    expect(checkProgram(makeProgram([
      makeObserve({ chain: [makeGate(binExpr(ident('v'), '>=', numLit(0)))] }),
    ])).errors).toHaveLength(0);
  });

  it('passes observe with valid gate: <=', () => {
    expect(checkProgram(makeProgram([
      makeObserve({ chain: [makeGate(binExpr(ident('v'), '<=', numLit(100)))] }),
    ])).errors).toHaveLength(0);
  });

  it('passes observe with valid gate: ==', () => {
    expect(checkProgram(makeProgram([
      makeObserve({ chain: [makeGate(binExpr(ident('state'), '==', strLit('active')))] }),
    ])).errors).toHaveLength(0);
  });

  it('passes observe with valid gate: !=', () => {
    expect(checkProgram(makeProgram([
      makeObserve({ chain: [makeGate(binExpr(ident('status'), '!=', strLit('error')))] }),
    ])).errors).toHaveLength(0);
  });

  it('passes observe with valid gate: boolean literal', () => {
    expect(checkProgram(makeProgram([
      makeObserve({ chain: [makeGate(boolLit(true))] }),
    ])).errors).toHaveLength(0);
  });

  it('passes observe with valid gate: identifier (assumed boolean)', () => {
    expect(checkProgram(makeProgram([
      makeObserve({ chain: [makeGate(ident('isReady'))] }),
    ])).errors).toHaveLength(0);
  });

  it('passes observe with valid gate: compound && expression', () => {
    expect(checkProgram(makeProgram([
      makeObserve({ chain: [makeGate(
        binExpr(binExpr(ident('a'), '>', numLit(0)), '&&', binExpr(ident('b'), '<', numLit(100)))
      )] }),
    ])).errors).toHaveLength(0);
  });

  it('passes observe with valid gate: compound || expression', () => {
    expect(checkProgram(makeProgram([
      makeObserve({ chain: [makeGate(
        binExpr(binExpr(ident('x'), '>', numLit(0)), '||', binExpr(ident('y'), '>', numLit(0)))
      )] }),
    ])).errors).toHaveLength(0);
  });

  it('passes mesh with array target', () => {
    expect(checkProgram(makeProgram([
      makeObserve({ chain: [makeMesh(arrLit(strLit('team-a'), strLit('team-b')))] }),
    ])).errors).toHaveLength(0);
  });

  it('passes mesh with identifier target', () => {
    expect(checkProgram(makeProgram([
      makeObserve({ chain: [makeMesh(ident('maintenanceTeam'))] }),
    ])).errors).toHaveLength(0);
  });

  it('passes bloom with both when and then args', () => {
    expect(checkProgram(makeProgram([
      makeObserve({ chain: [makeBloom(binExpr(ident('count'), '>', numLit(5)), ident('triggerAlert'))] }),
    ])).errors).toHaveLength(0);
  });

  it('passes fade with after arg', () => {
    expect(checkProgram(makeProgram([
      makeObserve({ chain: [makeFade(numLit(30000))] }),
    ])).errors).toHaveLength(0);
  });

  it('passes forge with action arg', () => {
    expect(checkProgram(makeProgram([
      makeObserve({ chain: [makeForge(ident('logToDatabase'))] }),
    ])).errors).toHaveLength(0);
  });

  it('passes pulse with a label', () => {
    expect(checkProgram(makeProgram([
      makeObserve({ chain: [makePulse(strLit('overheating'))] }),
    ])).errors).toHaveLength(0);
  });

  it('passes agent with every clause', () => {
    expect(checkProgram(makeProgram([
      makeAgent({ name: 'gem_scanner', every: { value: 5, unit: 'seconds' } }),
    ])).errors).toHaveLength(0);
  });

  it('passes agent with every and body observe', () => {
    expect(checkProgram(makeProgram([
      makeAgent({
        name: 'monitor',
        every: { value: 10, unit: 'seconds' },
        body: [makeObserve({ observationType: 'temperature' })],
      }),
    ])).errors).toHaveLength(0);
  });

  it('passes full chain: gate → pulse → mesh', () => {
    const prog = makeProgram([
      makeObserve({
        observationType: 'temperature',
        value: numLit(95),
        chain: [
          makeGate(binExpr(ident('temperature'), '>', numLit(80))),
          makePulse(strLit('overheating')),
          makeMesh(arrLit(strLit('maintenance'), strLit('dashboard'))),
        ],
      }),
    ]);
    expect(checkProgram(prog).errors).toHaveLength(0);
  });

  it('passes gate: function call in condition (assumed boolean)', () => {
    expect(checkProgram(makeProgram([
      makeObserve({ chain: [makeGate(funcCall('isValid', ident('value')))] }),
    ])).errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Invalid programs — gate
// ---------------------------------------------------------------------------

describe('checkProgram — invalid gate conditions', () => {
  it('rejects gate with no arguments', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeFnCall('gate', [])] }),
    ]);
    const { errors } = checkProgram(prog);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('gate()');
  });

  it('rejects gate with arithmetic binary expr (not comparison)', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeGate(binExpr(ident('x'), '+', numLit(1)))] }),
    ]);
    const { errors } = checkProgram(prog);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toMatch(/gate\(\)/);
  });

  it('rejects gate with named argument as condition', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeFnCall('gate', [namedArg('cond', ident('x'))])] }),
    ]);
    const { errors } = checkProgram(prog);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects gate with string literal as condition', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeGate(strLit('invalid'))] }),
    ]);
    const { errors } = checkProgram(prog);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects gate with number literal as condition', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeGate(numLit(42))] }),
    ]);
    const { errors } = checkProgram(prog);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Invalid programs — mesh
// ---------------------------------------------------------------------------

describe('checkProgram — invalid mesh targets', () => {
  it('rejects mesh with no arguments', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeFnCall('mesh', [])] }),
    ]);
    const { errors } = checkProgram(prog);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('mesh()');
  });

  it('rejects mesh with a number literal target', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeFnCall('mesh', [numLit(42)])] }),
    ]);
    const { errors } = checkProgram(prog);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Invalid programs — bloom
// ---------------------------------------------------------------------------

describe('checkProgram — bloom validation', () => {
  it('rejects bloom missing when', () => {
    const prog = makeProgram([
      makeObserve({ chain: [
        makeFnCall('bloom', [namedArg('then', ident('alert'))]),
      ]}),
    ]);
    const { errors } = checkProgram(prog);
    expect(errors.some(e => e.message.includes('when'))).toBe(true);
  });

  it('rejects bloom missing then', () => {
    const prog = makeProgram([
      makeObserve({ chain: [
        makeFnCall('bloom', [namedArg('when', binExpr(ident('x'), '>', numLit(5)))]),
      ]}),
    ]);
    const { errors } = checkProgram(prog);
    expect(errors.some(e => e.message.includes('then'))).toBe(true);
  });

  it('rejects bloom missing both when and then', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeFnCall('bloom', [])] }),
    ]);
    const { errors } = checkProgram(prog);
    expect(errors.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Invalid programs — fade
// ---------------------------------------------------------------------------

describe('checkProgram — fade validation', () => {
  it('rejects fade missing after', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeFnCall('fade', [])] }),
    ]);
    const { errors } = checkProgram(prog);
    expect(errors.some(e => e.message.includes('after'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invalid programs — forge
// ---------------------------------------------------------------------------

describe('checkProgram — forge validation', () => {
  it('rejects forge missing action', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeFnCall('forge', [])] }),
    ]);
    const { errors } = checkProgram(prog);
    expect(errors.some(e => e.message.includes('action'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invalid programs — agent
// ---------------------------------------------------------------------------

describe('checkProgram — agent validation', () => {
  it('rejects agent without every clause', () => {
    const prog = makeProgram([
      makeAgent({ name: 'my_agent' }), // no every
    ]);
    const { errors } = checkProgram(prog);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain('every');
  });

  it('provides agent name in error message', () => {
    const prog = makeProgram([makeAgent({ name: 'bad_agent' })]);
    const { errors } = checkProgram(prog);
    expect(errors[0]!.message).toContain('bad_agent');
  });
});

// ---------------------------------------------------------------------------
// Warnings
// ---------------------------------------------------------------------------

describe('checkProgram — warnings', () => {
  it('produces warning for pulse with no arguments', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeFnCall('pulse', [])] }),
    ]);
    const { warnings } = checkProgram(prog);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('produces warning for unknown function in chain', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeFnCall('unknownFn', [])] }),
    ]);
    const { warnings } = checkProgram(prog);
    expect(warnings.some(w => w.includes('unknownFn'))).toBe(true);
  });
});
