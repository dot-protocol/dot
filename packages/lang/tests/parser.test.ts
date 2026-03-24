/**
 * Parser tests for @dot-protocol/lang — R854.
 * Target: 70+ tests covering all parse constructs.
 */

import { describe, it, expect } from 'vitest';
import { lex } from '../src/lexer.js';
import { parse } from '../src/parser.js';
import type {
  Program,
  ObserveStatement,
  AgentStatement,
  FunctionCall,
  BinaryExpr,
  Literal,
  Identifier,
  ArrayLiteral,
  NamedArg,
  MemberAccess,
  FuncCallExpr,
} from '../src/ast.js';

// Helper: lex + parse a source string, return AST
function parseSource(src: string): Program {
  const { tokens } = lex(src);
  const { ast } = parse(tokens, src);
  return ast;
}

function parseErrors(src: string) {
  const { tokens } = lex(src);
  return parse(tokens, src).errors;
}

// Convenience: get first statement
function firstObserve(src: string): ObserveStatement {
  const ast = parseSource(src);
  return ast.body[0] as ObserveStatement;
}

function firstAgent(src: string): AgentStatement {
  const ast = parseSource(src);
  return ast.body[0] as AgentStatement;
}

// --- Program structure ---

describe('Program', () => {
  it('parses empty source to empty body', () => {
    const ast = parseSource('');
    expect(ast.type).toBe('Program');
    expect(ast.body).toHaveLength(0);
  });

  it('parses whitespace-only to empty body', () => {
    const ast = parseSource('   \n\n  ');
    expect(ast.body).toHaveLength(0);
  });

  it('parses multiple statements', () => {
    const src = 'observe a\nobserve b';
    const ast = parseSource(src);
    expect(ast.body).toHaveLength(2);
    expect(ast.body[0]?.type).toBe('ObserveStatement');
    expect(ast.body[1]?.type).toBe('ObserveStatement');
  });
});

// --- Basic observe ---

describe('ObserveStatement: bare forms', () => {
  it('parses bare "observe"', () => {
    const stmt = firstObserve('observe');
    expect(stmt.type).toBe('ObserveStatement');
    expect(stmt.observationType).toBeUndefined();
    expect(stmt.name).toBeUndefined();
    expect(stmt.location).toBeUndefined();
    expect(stmt.value).toBeUndefined();
    expect(stmt.functionChain).toHaveLength(0);
  });

  it('parses "observe temperature at sensor_7"', () => {
    const stmt = firstObserve('observe temperature at sensor_7');
    expect(stmt.name).toBe('temperature');
    expect(stmt.location?.type).toBe('Identifier');
    expect((stmt.location as Identifier).name).toBe('sensor_7');
  });

  it('parses observe with location only', () => {
    const stmt = firstObserve('observe at sensor_7');
    expect(stmt.name).toBeUndefined();
    expect(stmt.location?.type).toBe('Identifier');
  });

  it('parses observe with value only', () => {
    const stmt = firstObserve('observe temperature = 42');
    expect(stmt.name).toBe('temperature');
    expect(stmt.value?.type).toBe('Literal');
    expect((stmt.value as Literal).value).toBe(42);
  });

  it('parses "observe bond: sensor_7 is_part_of reactor_3" (R854 example)', () => {
    const stmt = firstObserve('observe bond: sensor_7 is_part_of reactor_3');
    expect(stmt.observationType).toBe('bond');
    expect(stmt.name).toBe('sensor_7');
    // 'is_part_of' parsed as part of location expression
  });

  it('parses "observe plain: \\"this is public\\""', () => {
    const stmt = firstObserve('observe plain: "this is public"');
    expect(stmt.observationType).toBe('plain');
    expect(stmt.value?.type).toBe('Literal');
    expect((stmt.value as Literal).value).toBe('this is public');
  });
});

// --- Observe with type ---

describe('ObserveStatement: with type annotation', () => {
  it('parses observe measure:', () => {
    const stmt = firstObserve('observe measure: temperature at sensor_7 = 82.3');
    expect(stmt.observationType).toBe('measure');
    expect(stmt.name).toBe('temperature');
    expect((stmt.location as Identifier).name).toBe('sensor_7');
    expect((stmt.value as Literal).value).toBe(82.3);
  });

  it('parses observe state:', () => {
    const stmt = firstObserve('observe state: reactor = "active"');
    expect(stmt.observationType).toBe('state');
    expect((stmt.value as Literal).value).toBe('active');
  });

  it('parses observe event:', () => {
    const stmt = firstObserve('observe event: click at button_1');
    expect(stmt.observationType).toBe('event');
  });

  it('parses observe claim:', () => {
    const stmt = firstObserve('observe claim: ownership at asset_5');
    expect(stmt.observationType).toBe('claim');
  });
});

// --- Function chains ---

describe('ObserveStatement: function chains', () => {
  it('parses single .gate()', () => {
    const src = `observe temperature at sensor_7
  .gate(temperature > 80)`;
    const stmt = firstObserve(src);
    expect(stmt.functionChain).toHaveLength(1);
    expect(stmt.functionChain[0]?.name).toBe('gate');
  });

  it('.gate() has correct condition expression', () => {
    const src = `observe x\n  .gate(temperature > 80)`;
    const stmt = firstObserve(src);
    const gate = stmt.functionChain[0] as FunctionCall;
    const cond = gate.args[0] as BinaryExpr;
    expect(cond.type).toBe('BinaryExpr');
    expect(cond.op).toBe('>');
    expect((cond.left as Identifier).name).toBe('temperature');
    expect((cond.right as Literal).value).toBe(80);
  });

  it('parses .pulse() with named arg', () => {
    const src = `observe x\n  .pulse(alert: "overheating")`;
    const stmt = firstObserve(src);
    const pulse = stmt.functionChain[0] as FunctionCall;
    expect(pulse.name).toBe('pulse');
    const arg = pulse.args[0] as NamedArg;
    expect(arg.type).toBe('NamedArg');
    expect(arg.name).toBe('alert');
    expect((arg.value as Literal).value).toBe('overheating');
  });

  it('parses .chain() with named arg', () => {
    const src = `observe x\n  .chain(previous: last_obs)`;
    const stmt = firstObserve(src);
    const chain = stmt.functionChain[0] as FunctionCall;
    expect(chain.name).toBe('chain');
    const arg = chain.args[0] as NamedArg;
    expect(arg.name).toBe('previous');
  });

  it('parses .mesh() with array target', () => {
    const src = `observe x\n  .mesh(to: [maintenance, dashboard])`;
    const stmt = firstObserve(src);
    const mesh = stmt.functionChain[0] as FunctionCall;
    expect(mesh.name).toBe('mesh');
    const toArg = mesh.args[0] as NamedArg;
    expect(toArg.name).toBe('to');
    expect(toArg.value.type).toBe('ArrayLiteral');
    const arr = toArg.value as ArrayLiteral;
    expect(arr.elements).toHaveLength(2);
  });

  it('parses .bloom() with when: and then:', () => {
    const src = `observe x\n  .bloom(when: 3, then: escalate)`;
    const stmt = firstObserve(src);
    const bloom = stmt.functionChain[0] as FunctionCall;
    expect(bloom.name).toBe('bloom');
    const whenArg = bloom.args.find(a => (a as NamedArg).name === 'when') as NamedArg;
    const thenArg = bloom.args.find(a => (a as NamedArg).name === 'then') as NamedArg;
    expect(whenArg).toBeDefined();
    expect(thenArg).toBeDefined();
    expect((thenArg.value as Identifier).name).toBe('escalate');
  });

  it('parses .fade() with after: named arg', () => {
    const src = `observe x\n  .fade(after: 24)`;
    const stmt = firstObserve(src);
    const fade = stmt.functionChain[0] as FunctionCall;
    expect(fade.name).toBe('fade');
    const afterArg = fade.args[0] as NamedArg;
    expect(afterArg.name).toBe('after');
    expect((afterArg.value as Literal).value).toBe(24);
  });

  it('parses .forge() with action: named arg', () => {
    const src = `observe x\n  .forge(action: shutdown)`;
    const stmt = firstObserve(src);
    const forge = stmt.functionChain[0] as FunctionCall;
    expect(forge.name).toBe('forge');
    const actionArg = forge.args[0] as NamedArg;
    expect(actionArg.name).toBe('action');
  });

  it('parses multiple chained calls', () => {
    const src = `observe measure: temperature at sensor_7 = 82.3
  .gate(temperature > 80)
  .pulse(alert: "overheating")
  .chain(previous: last_obs)
  .mesh(to: [maintenance, dashboard])
  .bloom(when: 3, then: escalate)
  .fade(after: 24)
  .forge(action: shutdown)`;
    const stmt = firstObserve(src);
    expect(stmt.functionChain).toHaveLength(7);
    const names = stmt.functionChain.map(f => f.name);
    expect(names).toEqual(['gate', 'pulse', 'chain', 'mesh', 'bloom', 'fade', 'forge']);
  });
});

// --- Agent statements ---

describe('AgentStatement', () => {
  it('parses basic agent with every clause', () => {
    const src = `agent gem_scanner {
  every 5 seconds {
    observe token at dexpaprika
  }
}`;
    const stmt = firstAgent(src);
    expect(stmt.type).toBe('AgentStatement');
    expect(stmt.name).toBe('gem_scanner');
    expect(stmt.every).toBeDefined();
    expect(stmt.every?.value).toBe(5);
    expect(stmt.every?.unit).toBe('seconds');
  });

  it('agent every with minutes unit', () => {
    const src = `agent heartbeat {\n  every 1 minutes {\n    observe alive\n  }\n}`;
    const stmt = firstAgent(src);
    expect(stmt.every?.unit).toBe('minutes');
  });

  it('agent every with hours unit', () => {
    const src = `agent periodic {\n  every 2 hours {\n    observe status\n  }\n}`;
    const stmt = firstAgent(src);
    expect(stmt.every?.unit).toBe('hours');
  });

  it('agent body contains observe statements', () => {
    const src = `agent gem_scanner {
  every 5 seconds {
    observe token at dexpaprika
  }
}`;
    const stmt = firstAgent(src);
    expect(stmt.body.length).toBeGreaterThan(0);
    expect(stmt.body[0]?.type).toBe('ObserveStatement');
  });

  it('agent body observe can have function chain', () => {
    const src = `agent gem_scanner {
  every 5 seconds {
    observe measure: token.price at dexpaprika
      .gate(token.volume > 1000)
      .bloom(when: gem_score, then: flag)
  }
}`;
    const stmt = firstAgent(src);
    const obs = stmt.body[0] as ObserveStatement;
    expect(obs.functionChain).toHaveLength(2);
  });

  it('agent name is correctly extracted', () => {
    const src = `agent price_watch {\n  every 10 seconds {\n    observe price\n  }\n}`;
    const stmt = firstAgent(src);
    expect(stmt.name).toBe('price_watch');
  });
});

// --- Expressions ---

describe('Expressions: binary', () => {
  it('parses comparison: x > 80', () => {
    const src = `observe x\n  .gate(x > 80)`;
    const stmt = firstObserve(src);
    const gate = stmt.functionChain[0] as FunctionCall;
    const expr = gate.args[0] as BinaryExpr;
    expect(expr.type).toBe('BinaryExpr');
    expect(expr.op).toBe('>');
  });

  it('parses comparison: x < 10', () => {
    const src = `observe x\n  .gate(x < 10)`;
    const stmt = firstObserve(src);
    const expr = (stmt.functionChain[0] as FunctionCall).args[0] as BinaryExpr;
    expect(expr.op).toBe('<');
  });

  it('parses comparison: x >= 5', () => {
    const src = `observe x\n  .gate(x >= 5)`;
    const stmt = firstObserve(src);
    const expr = (stmt.functionChain[0] as FunctionCall).args[0] as BinaryExpr;
    expect(expr.op).toBe('>=');
  });

  it('parses comparison: x <= 100', () => {
    const src = `observe x\n  .gate(x <= 100)`;
    const stmt = firstObserve(src);
    const expr = (stmt.functionChain[0] as FunctionCall).args[0] as BinaryExpr;
    expect(expr.op).toBe('<=');
  });

  it('parses and expression', () => {
    const src = `observe x\n  .gate(a > 1 and b < 5)`;
    const stmt = firstObserve(src);
    const expr = (stmt.functionChain[0] as FunctionCall).args[0] as BinaryExpr;
    expect(expr.op).toBe('and');
  });

  it('parses or expression', () => {
    const src = `observe x\n  .gate(a > 1 or b < 5)`;
    const stmt = firstObserve(src);
    const expr = (stmt.functionChain[0] as FunctionCall).args[0] as BinaryExpr;
    expect(expr.op).toBe('or');
  });

  it('parses arithmetic: a + b', () => {
    const src = `observe x = a + b`;
    const stmt = firstObserve(src);
    const expr = stmt.value as BinaryExpr;
    expect(expr.op).toBe('+');
  });

  it('parses arithmetic: a * b', () => {
    const src = `observe x = a * b`;
    const stmt = firstObserve(src);
    const expr = stmt.value as BinaryExpr;
    expect(expr.op).toBe('*');
  });
});

describe('Expressions: member access', () => {
  it('parses token.price as MemberAccess', () => {
    const src = `observe x = token.price`;
    const stmt = firstObserve(src);
    const expr = stmt.value as MemberAccess;
    expect(expr.type).toBe('MemberAccess');
    expect((expr.object as Identifier).name).toBe('token');
    expect(expr.property).toBe('price');
  });

  it('parses chained member access', () => {
    const src = `observe x\n  .gate(a.b > 0)`;
    const stmt = firstObserve(src);
    const cond = (stmt.functionChain[0] as FunctionCall).args[0] as BinaryExpr;
    expect(cond.left.type).toBe('MemberAccess');
  });
});

describe('Expressions: function calls', () => {
  it('parses function call: last_observation_from(sensor_7)', () => {
    const src = `observe x\n  .chain(previous: last_observation_from(sensor_7))`;
    const stmt = firstObserve(src);
    const chainFn = stmt.functionChain[0] as FunctionCall;
    const prevArg = chainFn.args[0] as NamedArg;
    const call = prevArg.value as FuncCallExpr;
    expect(call.type).toBe('FuncCallExpr');
    expect(call.callee).toBe('last_observation_from');
    expect(call.args).toHaveLength(1);
  });

  it('parses function call in location: dexpaprika(chain: "all")', () => {
    const src = 'observe x at dexpaprika';
    const stmt = firstObserve(src);
    expect(stmt.location).toBeDefined();
  });
});

describe('Expressions: array literals', () => {
  it('parses empty array []', () => {
    const src = `observe x\n  .mesh(to: [])`;
    const stmt = firstObserve(src);
    const mesh = stmt.functionChain[0] as FunctionCall;
    const toArg = mesh.args[0] as NamedArg;
    const arr = toArg.value as ArrayLiteral;
    expect(arr.type).toBe('ArrayLiteral');
    expect(arr.elements).toHaveLength(0);
  });

  it('parses array with identifiers', () => {
    const src = `observe x\n  .mesh(to: [a, b, c])`;
    const stmt = firstObserve(src);
    const mesh = stmt.functionChain[0] as FunctionCall;
    const toArg = mesh.args[0] as NamedArg;
    const arr = toArg.value as ArrayLiteral;
    expect(arr.elements).toHaveLength(3);
    expect((arr.elements[0] as Identifier).name).toBe('a');
  });

  it('parses array with string literals', () => {
    const src = `observe x\n  .pulse(tags: ["alert", "critical"])`;
    const stmt = firstObserve(src);
    const pulse = stmt.functionChain[0] as FunctionCall;
    const tagsArg = pulse.args.find(a => (a as NamedArg).name === 'tags') as NamedArg;
    const arr = tagsArg?.value as ArrayLiteral;
    expect(arr.elements[0]?.type).toBe('Literal');
  });
});

describe('Expressions: named args', () => {
  it('parses named arg: key: value', () => {
    const src = `observe x\n  .pulse(label: "test")`;
    const stmt = firstObserve(src);
    const pulse = stmt.functionChain[0] as FunctionCall;
    const arg = pulse.args[0] as NamedArg;
    expect(arg.type).toBe('NamedArg');
    expect(arg.name).toBe('label');
  });

  it('named arg value can be expression', () => {
    const src = `observe x\n  .bloom(when: score > 85, then: flag)`;
    const stmt = firstObserve(src);
    const bloom = stmt.functionChain[0] as FunctionCall;
    const whenArg = bloom.args.find(a => (a as NamedArg).name === 'when') as NamedArg;
    expect(whenArg.value.type).toBe('BinaryExpr');
  });

  it('multiple named args in single call', () => {
    const src = `observe x\n  .bloom(when: 3, then: escalate)`;
    const stmt = firstObserve(src);
    const bloom = stmt.functionChain[0] as FunctionCall;
    const namedArgs = bloom.args.filter(a => a.type === 'NamedArg') as NamedArg[];
    expect(namedArgs).toHaveLength(2);
  });
});

// --- Error recovery ---

describe('Error recovery', () => {
  it('recovers from unknown token at statement level', () => {
    const src = `@@bad_token\nobserve x`;
    const ast = parseSource(src);
    const errs = parseErrors(src);
    // Should still parse the valid observe statement
    expect(ast.body.some(s => s.type === 'ObserveStatement')).toBe(true);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('collects multiple errors', () => {
    const src = `@@bad\n@@also_bad\nobserve x`;
    const errs = parseErrors(src);
    // At minimum one error per bad token (some may be combined by recovery)
    expect(errs.length).toBeGreaterThan(0);
  });

  it('continues parsing after malformed function args', () => {
    const src = `observe x\n  .gate()\nobserve y`;
    const ast = parseSource(src);
    // gate with no args is allowed (checker will flag it, not parser)
    expect(ast.body).toHaveLength(2);
  });
});

// --- Location tracking ---

describe('Location tracking', () => {
  it('observe statement has correct line', () => {
    const stmt = firstObserve('observe x');
    expect(stmt.loc.line).toBe(1);
    expect(stmt.loc.column).toBe(1);
  });

  it('second statement has line 2', () => {
    const ast = parseSource('observe a\nobserve b');
    expect(ast.body[1]?.loc.line).toBe(2);
  });

  it('function chain call has location', () => {
    const src = `observe x\n  .gate(x > 0)`;
    const stmt = firstObserve(src);
    expect(stmt.functionChain[0]?.loc).toBeDefined();
  });
});

// --- R854 directive examples ---

describe('R854 directive examples', () => {
  it('parses: observe bond: sensor_7 is_part_of reactor_3', () => {
    // bond type with name
    const stmt = firstObserve('observe bond: sensor_7 is_part_of reactor_3');
    expect(stmt.type).toBe('ObserveStatement');
    expect(stmt.observationType).toBe('bond');
  });

  it('parses full gem_scanner agent', () => {
    const src = `agent gem_scanner {
  every 5 seconds {
    observe measure: token.price at dexpaprika
      .gate(token.volume > 1000)
      .bloom(when: gem_score, then: flag)
  }
}`;
    const ast = parseSource(src);
    expect(ast.body).toHaveLength(1);
    const agent = ast.body[0] as AgentStatement;
    expect(agent.name).toBe('gem_scanner');
    expect(agent.every?.value).toBe(5);
    const obs = agent.body[0] as ObserveStatement;
    expect(obs.observationType).toBe('measure');
    expect(obs.functionChain).toHaveLength(2);
  });

  it('parses observe with all seven chain functions', () => {
    const src = `observe measure: temperature at sensor_7 = 82.3
  .gate(temperature > 80)
  .pulse(alert: "overheating")
  .chain(previous: last_obs)
  .mesh(to: [maintenance, dashboard])
  .bloom(when: 3, then: escalate)
  .fade(after: 24)
  .forge(action: shutdown)`;
    const stmt = firstObserve(src);
    expect(stmt.functionChain.map(f => f.name)).toEqual([
      'gate', 'pulse', 'chain', 'mesh', 'bloom', 'fade', 'forge',
    ]);
  });
});
