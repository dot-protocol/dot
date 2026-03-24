/**
 * Tests for the TypeScript code generator (codegen/typescript.ts).
 * 40+ tests covering all 7 functions and full programs.
 */

import { describe, it, expect } from 'vitest';
import { generateTypeScript } from '../src/codegen/typescript.js';
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
// Imports
// ---------------------------------------------------------------------------

describe('generateTypeScript — header imports', () => {
  it('generates import from @dot-protocol/core', () => {
    const ts = generateTypeScript(makeProgram([]));
    expect(ts).toContain("import { observe, sign, chain } from '@dot-protocol/core'");
  });
});

// ---------------------------------------------------------------------------
// Observe statement basics
// ---------------------------------------------------------------------------

describe('generateTypeScript — ObserveStatement', () => {
  it('generates a const dot assignment', () => {
    const prog = makeProgram([makeObserve({ observationType: 'temperature' })]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('const dot');
  });

  it('generates await sign(chain(observe(...)', () => {
    const prog = makeProgram([makeObserve({ observationType: 'temperature' })]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('await sign(chain(observe(');
  });

  it('generates observe with value literal', () => {
    const prog = makeProgram([makeObserve({ value: numLit(82.3) })]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('observe(82.3');
  });

  it('generates observe with string value', () => {
    const prog = makeProgram([makeObserve({ value: strLit('hello') })]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('"hello"');
  });

  it('generates observe with type option', () => {
    const prog = makeProgram([makeObserve({ observationType: 'temperature', value: numLit(80) })]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('type: "temperature"');
  });

  it('generates observe with undefined value when no value given', () => {
    const prog = makeProgram([makeObserve({})]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('observe(undefined');
  });

  it('generates unique dot variable names for multiple observations', () => {
    const prog = makeProgram([makeObserve({}), makeObserve({})]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('dot1');
    expect(ts).toContain('dot2');
  });

  it('uses name as dot variable name when provided', () => {
    const prog = makeProgram([makeObserve({ name: 'myDot' })]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('const myDot =');
  });
});

// ---------------------------------------------------------------------------
// gate function
// ---------------------------------------------------------------------------

describe('generateTypeScript — gate', () => {
  it('generates if statement for gate', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeGate(binExpr(ident('temp'), '>', numLit(80)))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('if (temp > 80)');
  });

  it('generates closing brace for gate', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeGate(ident('isReady'))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('}');
  });

  it('generates gate with identifier condition', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeGate(ident('enabled'))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('if (enabled)');
  });

  it('generates gate with compound && condition', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeGate(
        binExpr(binExpr(ident('a'), '>', numLit(0)), '&&', binExpr(ident('b'), '<', numLit(100)))
      )] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('&&');
  });

  it('generates gate with boolean literal condition', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeGate(boolLit(true))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('if (true)');
  });
});

// ---------------------------------------------------------------------------
// pulse function
// ---------------------------------------------------------------------------

describe('generateTypeScript — pulse', () => {
  it('generates emit call for pulse', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makePulse(strLit('overheating'))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('emit(');
  });

  it('includes label in emit call', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makePulse(strLit('alert'))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('"alert"');
  });

  it('includes dot variable in emit call', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makePulse(strLit('event'))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toMatch(/emit\("event", dot\d+\)/);
  });

  it('generates emit with default event for empty pulse', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeFnCall('pulse', [])] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('emit(');
  });
});

// ---------------------------------------------------------------------------
// mesh function
// ---------------------------------------------------------------------------

describe('generateTypeScript — mesh', () => {
  it('generates broadcast call for mesh', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeMesh(arrLit(strLit('a'), strLit('b')))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('broadcast(');
  });

  it('includes targets in broadcast call', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeMesh(arrLit(strLit('maintenance'), strLit('dashboard')))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('"maintenance"');
    expect(ts).toContain('"dashboard"');
  });

  it('broadcasts with identifier target', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeMesh(ident('maintenanceTeam'))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('broadcast(maintenanceTeam');
  });

  it('includes dot variable in broadcast call', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeMesh(ident('team'))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toMatch(/broadcast\(team, dot\d+\)/);
  });
});

// ---------------------------------------------------------------------------
// bloom function
// ---------------------------------------------------------------------------

describe('generateTypeScript — bloom', () => {
  it('generates thresholdCheck for bloom', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeBloom(binExpr(ident('count'), '>', numLit(5)), ident('alert'))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('thresholdCheck(');
  });

  it('generates if block for bloom', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeBloom(ident('cond'), ident('fn'))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('if (thresholdCheck(');
  });

  it('calls then-function in bloom body', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeBloom(ident('ready'), ident('triggerAlert'))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('triggerAlert(');
  });
});

// ---------------------------------------------------------------------------
// fade function
// ---------------------------------------------------------------------------

describe('generateTypeScript — fade', () => {
  it('generates setTimeout for fade', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeFade(numLit(30000))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('setTimeout(');
  });

  it('calls expire in setTimeout callback', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeFade(numLit(5000))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('expire(');
  });

  it('uses the after duration as timeout value', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeFade(numLit(10000))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('10000');
  });
});

// ---------------------------------------------------------------------------
// forge function
// ---------------------------------------------------------------------------

describe('generateTypeScript — forge', () => {
  it('generates side effect call for forge', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeForge(ident('logToDatabase'))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('logToDatabase(');
  });

  it('passes dot variable to forge action', () => {
    const prog = makeProgram([
      makeObserve({ chain: [makeForge(ident('sendNotification'))] }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toMatch(/sendNotification\(dot\d+\)/);
  });
});

// ---------------------------------------------------------------------------
// Agent statement
// ---------------------------------------------------------------------------

describe('generateTypeScript — AgentStatement', () => {
  it('generates setInterval for agent', () => {
    const prog = makeProgram([
      makeAgent({ name: 'scanner', every: { value: 5, unit: 'seconds' } }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('setInterval(');
  });

  it('generates async callback in setInterval', () => {
    const prog = makeProgram([
      makeAgent({ name: 'scanner', every: { value: 5, unit: 'seconds' } }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('async () =>');
  });

  it('converts seconds to milliseconds correctly', () => {
    const prog = makeProgram([
      makeAgent({ name: 'scanner', every: { value: 5, unit: 'seconds' } }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('5000');
  });

  it('converts minutes to milliseconds correctly', () => {
    const prog = makeProgram([
      makeAgent({ name: 'poller', every: { value: 2, unit: 'minutes' } }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('120000');
  });

  it('includes agent body observations inside setInterval', () => {
    const prog = makeProgram([
      makeAgent({
        name: 'monitor',
        every: { value: 10, unit: 'seconds' },
        body: [makeObserve({ observationType: 'temperature', value: numLit(82.3) })],
      }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('observe(82.3');
    expect(ts).toContain('setInterval(');
  });

  it('agent closes setInterval with correct ms', () => {
    const prog = makeProgram([
      makeAgent({ name: 'fast', every: { value: 100, unit: 'ms' } }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('100');
  });
});

// ---------------------------------------------------------------------------
// Full programs
// ---------------------------------------------------------------------------

describe('generateTypeScript — full programs', () => {
  it('generates complete program with all 7 functions', () => {
    const prog = makeProgram([
      makeObserve({
        name: 'tempDot',
        observationType: 'temperature',
        value: numLit(95),
        chain: [
          makeGate(binExpr(ident('temperature'), '>', numLit(80))),
          makePulse(strLit('overheating')),
          makeMesh(arrLit(strLit('maintenance'), strLit('dashboard'))),
          makeBloom(binExpr(ident('count'), '>', numLit(3)), ident('escalate')),
          makeFade(numLit(60000)),
          makeForge(ident('logEvent')),
        ],
      }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('observe(');
    expect(ts).toContain('if (temperature > 80)');
    expect(ts).toContain('emit(');
    expect(ts).toContain('broadcast(');
    expect(ts).toContain('thresholdCheck(');
    expect(ts).toContain('setTimeout(');
    expect(ts).toContain('logEvent(');
  });

  it('generates valid import at the top of output', () => {
    const prog = makeProgram([makeObserve({})]);
    const ts = generateTypeScript(prog);
    expect(ts.startsWith("import {")).toBe(true);
  });

  it('generates agent containing observe with gate', () => {
    const prog = makeProgram([
      makeAgent({
        name: 'gem_scanner',
        every: { value: 5, unit: 'seconds' },
        body: [
          makeObserve({
            value: numLit(1.5),
            chain: [makeGate(binExpr(ident('price'), '>', numLit(1)))],
          }),
        ],
      }),
    ]);
    const ts = generateTypeScript(prog);
    expect(ts).toContain('setInterval(');
    expect(ts).toContain('observe(');
    expect(ts).toContain('if (price > 1)');
  });

  it('produces string output', () => {
    const prog = makeProgram([]);
    expect(typeof generateTypeScript(prog)).toBe('string');
  });

  it('counter resets between calls', () => {
    const prog = makeProgram([makeObserve({})]);
    const ts1 = generateTypeScript(prog);
    const ts2 = generateTypeScript(prog);
    expect(ts1).toContain('dot1');
    expect(ts2).toContain('dot1'); // resets on each call
  });
});
