/**
 * Test helper factories for building DOT AST nodes.
 * These helpers make test cases concise and readable.
 */

import type {
  Program,
  ObserveStatement,
  AgentStatement,
  FunctionCall,
  Expression,
  NamedArg,
  BinaryExpr,
  Literal,
  Identifier,
  FuncCallExpr,
  ArrayLiteral,
  SourceLocation,
} from '../src/ast.js';

export const LOC: SourceLocation = { line: 1, column: 1, offset: 0 };

export function makeProgram(body: (ObserveStatement | AgentStatement)[]): Program {
  return { type: 'Program', body, loc: LOC };
}

export function makeObserve(opts: {
  observationType?: string;
  name?: string;
  location?: Expression;
  value?: Expression;
  chain?: FunctionCall[];
}): ObserveStatement {
  return {
    type: 'ObserveStatement',
    observationType: opts.observationType,
    name: opts.name,
    location: opts.location,
    value: opts.value,
    functionChain: opts.chain ?? [],
    loc: LOC,
  };
}

export function makeAgent(opts: {
  name: string;
  every?: { value: number; unit: string };
  body?: (ObserveStatement | AgentStatement)[];
}): AgentStatement {
  return {
    type: 'AgentStatement',
    name: opts.name,
    every: opts.every,
    body: opts.body ?? [],
    loc: LOC,
  };
}

export function makeGate(condition: Expression): FunctionCall {
  return { type: 'FunctionCall', name: 'gate', args: [condition], loc: LOC };
}

export function makePulse(label: Expression): FunctionCall {
  return { type: 'FunctionCall', name: 'pulse', args: [label], loc: LOC };
}

export function makeMesh(target: Expression): FunctionCall {
  return { type: 'FunctionCall', name: 'mesh', args: [target], loc: LOC };
}

export function makeBloom(when: Expression, then: Expression): FunctionCall {
  return {
    type: 'FunctionCall',
    name: 'bloom',
    args: [
      { type: 'NamedArg', name: 'when', value: when, loc: LOC } as NamedArg,
      { type: 'NamedArg', name: 'then', value: then, loc: LOC } as NamedArg,
    ],
    loc: LOC,
  };
}

export function makeFade(after: Expression): FunctionCall {
  return {
    type: 'FunctionCall',
    name: 'fade',
    args: [{ type: 'NamedArg', name: 'after', value: after, loc: LOC } as NamedArg],
    loc: LOC,
  };
}

export function makeForge(action: Expression): FunctionCall {
  return {
    type: 'FunctionCall',
    name: 'forge',
    args: [{ type: 'NamedArg', name: 'action', value: action, loc: LOC } as NamedArg],
    loc: LOC,
  };
}

export function numLit(value: number): Literal {
  return { type: 'Literal', value, loc: LOC };
}

export function strLit(value: string): Literal {
  return { type: 'Literal', value, loc: LOC };
}

export function boolLit(value: boolean): Literal {
  return { type: 'Literal', value, loc: LOC };
}

export function ident(name: string): Identifier {
  return { type: 'Identifier', name, loc: LOC };
}

export function binExpr(left: Expression, op: string, right: Expression): BinaryExpr {
  return { type: 'BinaryExpr', left, op, right, loc: LOC };
}

export function funcCall(callee: string, ...args: Expression[]): FuncCallExpr {
  return { type: 'FuncCallExpr', callee, args, loc: LOC };
}

export function arrLit(...elements: Expression[]): ArrayLiteral {
  return { type: 'ArrayLiteral', elements, loc: LOC };
}

export function namedArg(name: string, value: Expression): NamedArg {
  return { type: 'NamedArg', name, value, loc: LOC };
}

/** Make a FunctionCall with no required-arg checking (for invalid test cases). */
export function makeFnCall(name: string, args: (Expression | NamedArg)[]): FunctionCall {
  return { type: 'FunctionCall', name, args, loc: LOC };
}
