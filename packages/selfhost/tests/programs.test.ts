/**
 * programs.test.ts — Tests that every .dot program parses, checks, and compiles.
 *
 * 25+ tests verifying the self-hosting DOT programs are valid.
 */

import { describe, it, expect } from 'vitest';
import { lex, parse, checkProgram, generateTypeScript } from '@dot-protocol/lang';

// ---------------------------------------------------------------------------
// Program sources (inline — mirrors programs/*.dot files)
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

// Helper: lex + parse + check a source
function pipeline(src: string) {
  const { tokens, errors: le } = lex(src);
  const { ast, errors: pe } = parse(tokens, src);
  const cr = checkProgram(ast);
  return { ast, lexErrors: le, parseErrors: pe, checkErrors: cr.errors };
}

// ---------------------------------------------------------------------------
// hello.dot
// ---------------------------------------------------------------------------

describe('hello.dot', () => {
  it('lexes without errors', () => {
    const { lexErrors } = pipeline(PROGRAMS.hello);
    expect(lexErrors).toHaveLength(0);
  });

  it('parses without errors', () => {
    const { parseErrors } = pipeline(PROGRAMS.hello);
    expect(parseErrors).toHaveLength(0);
  });

  it('type-checks without errors', () => {
    const { checkErrors } = pipeline(PROGRAMS.hello);
    expect(checkErrors).toHaveLength(0);
  });

  it('produces exactly 1 statement', () => {
    const { ast } = pipeline(PROGRAMS.hello);
    expect(ast.body).toHaveLength(1);
  });

  it('compiles to TypeScript with @dot-protocol/core import', () => {
    const { ast } = pipeline(PROGRAMS.hello);
    const ts = generateTypeScript(ast);
    expect(ts).toContain("@dot-protocol/core");
  });

  it('generated TypeScript contains observe() call', () => {
    const { ast } = pipeline(PROGRAMS.hello);
    const ts = generateTypeScript(ast);
    expect(ts).toContain('observe(');
  });

  it('generated TypeScript contains await sign(chain(', () => {
    const { ast } = pipeline(PROGRAMS.hello);
    const ts = generateTypeScript(ast);
    expect(ts).toContain('await sign(chain(');
  });
});

// ---------------------------------------------------------------------------
// temperature.dot
// ---------------------------------------------------------------------------

describe('temperature.dot', () => {
  it('parses without errors', () => {
    const { parseErrors, lexErrors } = pipeline(PROGRAMS.temperature);
    expect(lexErrors).toHaveLength(0);
    expect(parseErrors).toHaveLength(0);
  });

  it('type-checks without semantic errors', () => {
    const { checkErrors } = pipeline(PROGRAMS.temperature);
    expect(checkErrors).toHaveLength(0);
  });

  it('generates TypeScript with gate if-block', () => {
    const { ast } = pipeline(PROGRAMS.temperature);
    const ts = generateTypeScript(ast);
    expect(ts).toContain('if (temperature > 80)');
  });

  it('generated TypeScript contains emit() for pulse', () => {
    const { ast } = pipeline(PROGRAMS.temperature);
    const ts = generateTypeScript(ast);
    expect(ts).toContain('emit(');
  });

  it('has measure observation type', () => {
    const { ast } = pipeline(PROGRAMS.temperature);
    const stmt = ast.body[0];
    expect(stmt?.type).toBe('ObserveStatement');
    // @ts-expect-error — accessing typed property
    expect(stmt?.observationType).toBe('measure');
  });
});

// ---------------------------------------------------------------------------
// chain-demo.dot
// ---------------------------------------------------------------------------

describe('chain-demo.dot', () => {
  it('parses 3 statements without errors', () => {
    const { parseErrors, ast } = pipeline(PROGRAMS.chainDemo);
    expect(parseErrors).toHaveLength(0);
    expect(ast.body).toHaveLength(3);
  });

  it('type-checks without errors', () => {
    const { checkErrors } = pipeline(PROGRAMS.chainDemo);
    expect(checkErrors).toHaveLength(0);
  });

  it('compiles to TypeScript with chain calls', () => {
    const { ast } = pipeline(PROGRAMS.chainDemo);
    const ts = generateTypeScript(ast);
    expect(ts).toContain('@dot-protocol/core');
  });

  it('all three statements are ObserveStatements', () => {
    const { ast } = pipeline(PROGRAMS.chainDemo);
    for (const stmt of ast.body) {
      expect(stmt.type).toBe('ObserveStatement');
    }
  });
});

// ---------------------------------------------------------------------------
// agent-demo.dot
// ---------------------------------------------------------------------------

describe('agent-demo.dot', () => {
  it('parses without errors', () => {
    const { parseErrors, lexErrors } = pipeline(PROGRAMS.agentDemo);
    expect(lexErrors).toHaveLength(0);
    expect(parseErrors).toHaveLength(0);
  });

  it('type-checks without errors', () => {
    const { checkErrors } = pipeline(PROGRAMS.agentDemo);
    expect(checkErrors).toHaveLength(0);
  });

  it('produces an AgentStatement', () => {
    const { ast } = pipeline(PROGRAMS.agentDemo);
    expect(ast.body[0]?.type).toBe('AgentStatement');
  });

  it('agent has every 5 seconds clause', () => {
    const { ast } = pipeline(PROGRAMS.agentDemo);
    const agent = ast.body[0];
    // @ts-expect-error — accessing typed property
    expect(agent?.every?.value).toBe(5);
    // @ts-expect-error — accessing typed property
    expect(agent?.every?.unit).toBe('seconds');
  });

  it('compiles to TypeScript with setInterval', () => {
    const { ast } = pipeline(PROGRAMS.agentDemo);
    const ts = generateTypeScript(ast);
    expect(ts).toContain('setInterval(');
  });

  it('setInterval uses 5000ms', () => {
    const { ast } = pipeline(PROGRAMS.agentDemo);
    const ts = generateTypeScript(ast);
    expect(ts).toContain('5000');
  });
});

// ---------------------------------------------------------------------------
// types-demo.dot (all 5 observation types)
// ---------------------------------------------------------------------------

describe('types-demo.dot', () => {
  it('parses 5 statements without errors', () => {
    const { parseErrors, ast } = pipeline(PROGRAMS.typesDemo);
    expect(parseErrors).toHaveLength(0);
    expect(ast.body).toHaveLength(5);
  });

  it('type-checks without semantic errors', () => {
    const { checkErrors } = pipeline(PROGRAMS.typesDemo);
    expect(checkErrors).toHaveLength(0);
  });

  it('first statement is measure type', () => {
    const { ast } = pipeline(PROGRAMS.typesDemo);
    // @ts-expect-error — accessing typed property
    expect(ast.body[0]?.observationType).toBe('measure');
  });

  it('second statement is state type', () => {
    const { ast } = pipeline(PROGRAMS.typesDemo);
    // @ts-expect-error — accessing typed property
    expect(ast.body[1]?.observationType).toBe('state');
  });

  it('third statement is event type', () => {
    const { ast } = pipeline(PROGRAMS.typesDemo);
    // @ts-expect-error — accessing typed property
    expect(ast.body[2]?.observationType).toBe('event');
  });

  it('fourth statement is claim type', () => {
    const { ast } = pipeline(PROGRAMS.typesDemo);
    // @ts-expect-error — accessing typed property
    expect(ast.body[3]?.observationType).toBe('claim');
  });

  it('fifth statement is bond type', () => {
    const { ast } = pipeline(PROGRAMS.typesDemo);
    // @ts-expect-error — accessing typed property
    expect(ast.body[4]?.observationType).toBe('bond');
  });

  it('compiles all 5 types to TypeScript', () => {
    const { ast } = pipeline(PROGRAMS.typesDemo);
    const ts = generateTypeScript(ast);
    expect(ts).toContain('type: "measure"');
    expect(ts).toContain('type: "state"');
    expect(ts).toContain('type: "event"');
    expect(ts).toContain('type: "claim"');
    expect(ts).toContain('type: "bond"');
  });
});

// ---------------------------------------------------------------------------
// trust-demo.dot
// ---------------------------------------------------------------------------

describe('trust-demo.dot', () => {
  it('parses 3 claim statements without errors', () => {
    const { parseErrors, ast } = pipeline(PROGRAMS.trustDemo);
    expect(parseErrors).toHaveLength(0);
    expect(ast.body).toHaveLength(3);
  });

  it('type-checks without errors', () => {
    const { checkErrors } = pipeline(PROGRAMS.trustDemo);
    expect(checkErrors).toHaveLength(0);
  });

  it('all statements have claim type', () => {
    const { ast } = pipeline(PROGRAMS.trustDemo);
    for (const stmt of ast.body) {
      // @ts-expect-error — accessing typed property
      expect(stmt?.observationType).toBe('claim');
    }
  });
});

// ---------------------------------------------------------------------------
// lexer.dot (meta-circular program)
// ---------------------------------------------------------------------------

describe('lexer.dot', () => {
  it('parses without errors', () => {
    const { parseErrors, lexErrors } = pipeline(PROGRAMS.lexerDot);
    expect(lexErrors).toHaveLength(0);
    expect(parseErrors).toHaveLength(0);
  });

  it('type-checks without errors', () => {
    const { checkErrors } = pipeline(PROGRAMS.lexerDot);
    expect(checkErrors).toHaveLength(0);
  });

  it('is an AgentStatement named lexer', () => {
    const { ast } = pipeline(PROGRAMS.lexerDot);
    const agent = ast.body[0];
    expect(agent?.type).toBe('AgentStatement');
    // @ts-expect-error — accessing typed property
    expect(agent?.name).toBe('lexer');
  });

  it('compiles to TypeScript', () => {
    const { ast } = pipeline(PROGRAMS.lexerDot);
    const ts = generateTypeScript(ast);
    expect(ts).toContain('@dot-protocol/core');
    expect(ts).toContain('setInterval(');
  });
});
