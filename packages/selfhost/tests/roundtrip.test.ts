/**
 * roundtrip.test.ts — Roundtrip validation tests.
 *
 * 15+ tests verifying the full DOT source → AST → TypeScript → English roundtrip.
 */

import { describe, it, expect } from 'vitest';
import { compileDotFile, validateRoundtrip } from '../src/compiler.js';
import { selfHostingScore } from '../src/validator.js';

// ---------------------------------------------------------------------------
// DOT programs used in roundtrip tests
// ---------------------------------------------------------------------------

const PROGRAMS = {
  hello: `observe event: "hello world"\n`,

  temperature: `observe measure: temperature at sensor_7 = 82.3
  .gate(temperature > 80)
  .pulse(alert: "overheating")
`,

  chainDemo: `observe event: "first observation"
observe event: "second observation"
  .chain(previous: first)
observe event: "third observation"
  .chain(previous: second)
`,

  agentDemo: `agent health_monitor {
  every 5 seconds {
    observe measure: cpu_usage = 45.2
      .gate(cpu_usage > 90)
      .pulse(alert: "high CPU")
  }
}
`,

  typesDemo: `observe measure: temperature = 22.5
observe state: reactor_status = "online"
observe event: "system started"
observe claim: "sensor calibrated"
observe bond: sensor_7
`,

  trustDemo: `observe claim: "data is accurate"
observe claim: "data is accurate"
  .chain(previous: first_claim)
observe claim: "data is accurate"
  .chain(previous: second_claim)
`,

  lexerDot: `agent lexer {
  every 1 seconds {
    observe event: "tokenize" at source_code
      .gate(ready)
      .forge(action: emit_tokens)
  }
}
`,
};

const ALL_PROGRAMS = Object.values(PROGRAMS);

// ---------------------------------------------------------------------------
// compileDotFile roundtrip
// ---------------------------------------------------------------------------

describe('DOT source → TypeScript roundtrip', () => {
  it('hello.dot → TypeScript contains @dot-protocol/core import', () => {
    const ts = compileDotFile(PROGRAMS.hello);
    expect(ts).toContain("import { observe, sign, chain } from '@dot-protocol/core'");
  });

  it('hello.dot → TypeScript contains observe() call', () => {
    const ts = compileDotFile(PROGRAMS.hello);
    expect(ts).toContain('observe(');
  });

  it('hello.dot → TypeScript contains await sign(chain(', () => {
    const ts = compileDotFile(PROGRAMS.hello);
    expect(ts).toContain('await sign(chain(');
  });

  it('temperature.dot → TypeScript contains gate if-block', () => {
    const ts = compileDotFile(PROGRAMS.temperature);
    expect(ts).toContain('if (temperature > 80)');
  });

  it('temperature.dot → TypeScript contains emit() for pulse', () => {
    const ts = compileDotFile(PROGRAMS.temperature);
    expect(ts).toContain('emit(');
  });

  it('agent-demo.dot → TypeScript contains setInterval', () => {
    const ts = compileDotFile(PROGRAMS.agentDemo);
    expect(ts).toContain('setInterval(');
  });

  it('agent-demo.dot → TypeScript uses 5000ms interval', () => {
    const ts = compileDotFile(PROGRAMS.agentDemo);
    expect(ts).toContain('5000');
  });

  it('types-demo.dot → TypeScript contains all 5 type annotations', () => {
    const ts = compileDotFile(PROGRAMS.typesDemo);
    expect(ts).toContain('type: "measure"');
    expect(ts).toContain('type: "state"');
    expect(ts).toContain('type: "event"');
    expect(ts).toContain('type: "claim"');
    expect(ts).toContain('type: "bond"');
  });
});

// ---------------------------------------------------------------------------
// validateRoundtrip
// ---------------------------------------------------------------------------

describe('validateRoundtrip', () => {
  it('hello.dot passes roundtrip validation', () => {
    const result = validateRoundtrip(PROGRAMS.hello);
    expect(result.valid).toBe(true);
    expect(result.parseErrors).toHaveLength(0);
    expect(result.checkErrors).toHaveLength(0);
  });

  it('temperature.dot passes roundtrip validation', () => {
    const result = validateRoundtrip(PROGRAMS.temperature);
    expect(result.valid).toBe(true);
  });

  it('chain-demo.dot passes roundtrip validation', () => {
    const result = validateRoundtrip(PROGRAMS.chainDemo);
    expect(result.valid).toBe(true);
  });

  it('agent-demo.dot passes roundtrip validation', () => {
    const result = validateRoundtrip(PROGRAMS.agentDemo);
    expect(result.valid).toBe(true);
  });

  it('types-demo.dot passes roundtrip validation', () => {
    const result = validateRoundtrip(PROGRAMS.typesDemo);
    expect(result.valid).toBe(true);
  });

  it('trust-demo.dot passes roundtrip validation', () => {
    const result = validateRoundtrip(PROGRAMS.trustDemo);
    expect(result.valid).toBe(true);
  });

  it('lexer.dot passes roundtrip validation', () => {
    const result = validateRoundtrip(PROGRAMS.lexerDot);
    expect(result.valid).toBe(true);
  });

  it('roundtrip result includes TypeScript source', () => {
    const result = validateRoundtrip(PROGRAMS.hello);
    expect(result.typescript).toBeDefined();
    expect(result.typescript).toContain('@dot-protocol/core');
  });

  it('roundtrip result includes English prose', () => {
    const result = validateRoundtrip(PROGRAMS.hello);
    expect(result.english).toBeDefined();
    expect(typeof result.english).toBe('string');
  });

  it('invalid source fails roundtrip validation', () => {
    const result = validateRoundtrip('@invalid !!');
    expect(result.valid).toBe(false);
    expect(result.parseErrors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// selfHostingScore
// ---------------------------------------------------------------------------

describe('selfHostingScore', () => {
  it('all 7 programs score 100% parse rate', () => {
    const score = selfHostingScore(ALL_PROGRAMS);
    expect(score.parsed).toBe(ALL_PROGRAMS.length);
  });

  it('all 7 programs score 100% type-check rate', () => {
    const score = selfHostingScore(ALL_PROGRAMS);
    expect(score.checked).toBe(ALL_PROGRAMS.length);
  });

  it('all 7 programs score 100% compile rate', () => {
    const score = selfHostingScore(ALL_PROGRAMS);
    expect(score.compiled).toBe(ALL_PROGRAMS.length);
  });

  it('total count matches number of programs', () => {
    const score = selfHostingScore(ALL_PROGRAMS);
    expect(score.total).toBe(ALL_PROGRAMS.length);
  });

  it('scorePercent is high (>= 75 without execution)', () => {
    // Without execution count, score = 3/4 stages = 75%
    const score = selfHostingScore(ALL_PROGRAMS, 0);
    expect(score.scorePercent).toBeGreaterThanOrEqual(75);
  });

  it('scorePercent is 100% when all stages pass', () => {
    const n = ALL_PROGRAMS.length;
    const score = selfHostingScore(ALL_PROGRAMS, n);
    expect(score.scorePercent).toBe(100);
  });

  it('empty programs array returns 100% score', () => {
    const score = selfHostingScore([]);
    expect(score.scorePercent).toBe(100);
    expect(score.total).toBe(0);
  });
});
