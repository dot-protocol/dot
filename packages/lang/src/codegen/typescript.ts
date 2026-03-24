/**
 * TypeScript code generator for the DOT language.
 *
 * Transforms a parsed DOT AST into valid TypeScript source code that
 * imports and uses @dot-protocol/core primitives.
 *
 * Generated pattern for an observation:
 *   const dot = await sign(chain(observe(...), prev), key);
 *
 * Function chain mapping:
 *   .gate(cond)            → if (cond) { ... }
 *   .pulse(label)          → emit('label', dot)
 *   .mesh([a, b])          → broadcast([a, b], dot)
 *   .bloom(when:, then:)   → if (thresholdCheck(when)) { then }
 *   .fade(after:)          → setTimeout(() => { expire(dot) }, ms)
 *   .forge(action:)        → action(dot)
 */

import type {
  Program,
  Statement,
  ObserveStatement,
  AgentStatement,
  FunctionCall,
  Expression,
  NamedArg,
  BinaryExpr,
  Literal,
  Identifier,
  FuncCallExpr,
  MemberAccess,
  ArrayLiteral,
} from '../ast.js';

// ---------------------------------------------------------------------------
// Expression → TypeScript string
// ---------------------------------------------------------------------------

function genExpr(expr: Expression): string {
  switch (expr.type) {
    case 'Literal': {
      const lit = expr as Literal;
      if (typeof lit.value === 'string') return JSON.stringify(lit.value);
      return String(lit.value);
    }
    case 'Identifier':
      return (expr as Identifier).name;
    case 'BinaryExpr': {
      const bin = expr as BinaryExpr;
      return `${genExpr(bin.left)} ${bin.op} ${genExpr(bin.right)}`;
    }
    case 'FuncCallExpr': {
      const fn = expr as FuncCallExpr;
      const args = fn.args.map(genExpr).join(', ');
      return `${fn.callee}(${args})`;
    }
    case 'MemberAccess': {
      const mem = expr as MemberAccess;
      return `${genExpr(mem.object)}.${mem.property}`;
    }
    case 'ArrayLiteral': {
      const arr = expr as ArrayLiteral;
      const elements = arr.elements.map(genExpr).join(', ');
      return `[${elements}]`;
    }
    default:
      return '/* unknown expr */';
  }
}

function genNamedArgValue(arg: NamedArg): string {
  return genExpr(arg.value);
}

// ---------------------------------------------------------------------------
// Function chain → TypeScript statements (indented)
// ---------------------------------------------------------------------------

function genFunctionChain(
  chain: FunctionCall[],
  dotVar: string,
  indent: string,
): string {
  if (chain.length === 0) return '';

  const lines: string[] = [];

  for (const fc of chain) {
    switch (fc.name) {
      case 'gate': {
        // .gate(cond) → if (cond) {
        const firstArg = fc.args[0];
        if (firstArg && firstArg.type !== 'NamedArg') {
          const cond = genExpr(firstArg as Expression);
          lines.push(`${indent}if (${cond}) {`);
        }
        break;
      }
      case 'pulse': {
        // .pulse(label) → emit(label, dot)
        const firstArg = fc.args[0];
        const label =
          firstArg && firstArg.type !== 'NamedArg'
            ? genExpr(firstArg as Expression)
            : '"event"';
        lines.push(`${indent}  emit(${label}, ${dotVar});`);
        break;
      }
      case 'mesh': {
        // .mesh([targets]) → broadcast([targets], dot)
        const positionalArgs = fc.args.filter(a => a.type !== 'NamedArg') as Expression[];
        if (positionalArgs.length === 1) {
          lines.push(`${indent}  broadcast(${genExpr(positionalArgs[0]!)}, ${dotVar});`);
        } else if (positionalArgs.length > 1) {
          const targets = positionalArgs.map(genExpr).join(', ');
          lines.push(`${indent}  broadcast([${targets}], ${dotVar});`);
        } else {
          lines.push(`${indent}  broadcast([], ${dotVar});`);
        }
        break;
      }
      case 'bloom': {
        // .bloom(when: cond, then: action) → if (thresholdCheck(cond)) { action(dot) }
        const whenArg = fc.args.find(a => a.type === 'NamedArg' && (a as NamedArg).name === 'when') as NamedArg | undefined;
        const thenArg = fc.args.find(a => a.type === 'NamedArg' && (a as NamedArg).name === 'then') as NamedArg | undefined;
        const whenVal = whenArg ? genNamedArgValue(whenArg) : 'true';
        const thenVal = thenArg ? genNamedArgValue(thenArg) : 'undefined';
        lines.push(`${indent}if (thresholdCheck(${whenVal})) {`);
        lines.push(`${indent}  ${thenVal}(${dotVar});`);
        lines.push(`${indent}}`);
        break;
      }
      case 'fade': {
        // .fade(after: duration) → setTimeout(() => { expire(dot) }, ms)
        const afterArg = fc.args.find(a => a.type === 'NamedArg' && (a as NamedArg).name === 'after') as NamedArg | undefined;
        const duration = afterArg ? genNamedArgValue(afterArg) : '0';
        lines.push(`${indent}setTimeout(() => { expire(${dotVar}); }, ${duration});`);
        break;
      }
      case 'forge': {
        // .forge(action: fn) → fn(dot)
        const actionArg = fc.args.find(a => a.type === 'NamedArg' && (a as NamedArg).name === 'action') as NamedArg | undefined;
        if (actionArg) {
          lines.push(`${indent}${genNamedArgValue(actionArg)}(${dotVar});`);
        } else {
          // positional action
          const firstArg = fc.args[0];
          if (firstArg && firstArg.type !== 'NamedArg') {
            lines.push(`${indent}${genExpr(firstArg as Expression)}(${dotVar});`);
          }
        }
        break;
      }
      default:
        lines.push(`${indent}/* unknown: ${fc.name}(${fc.args.map(a => a.type === 'NamedArg' ? `${(a as NamedArg).name}: ...` : '...').join(', ')}) */`);
        break;
    }
  }

  // Close gate if-blocks
  const gateCount = chain.filter(fc => fc.name === 'gate').length;
  for (let i = 0; i < gateCount; i++) {
    lines.push(`${indent}}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Statement generators
// ---------------------------------------------------------------------------

let dotCounter = 0;
function freshDotVar(): string {
  return `dot${++dotCounter}`;
}

function genObserveStatement(stmt: ObserveStatement, indent: string): string {
  const lines: string[] = [];
  const dotVar = stmt.name ? stmt.name : freshDotVar();

  // Build observe() args
  const observeArgs: string[] = [];

  if (stmt.value !== undefined) {
    observeArgs.push(genExpr(stmt.value));
  } else {
    observeArgs.push('undefined');
  }

  const optionParts: string[] = [];
  if (stmt.observationType !== undefined) {
    optionParts.push(`type: ${JSON.stringify(stmt.observationType)}`);
  }
  if (optionParts.length > 0) {
    observeArgs.push(`{ ${optionParts.join(', ')} }`);
  }

  const observeCall = `observe(${observeArgs.join(', ')})`;

  // Generate: const dotVar = await sign(chain(observe(...), prev), key);
  lines.push(`${indent}const ${dotVar} = await sign(chain(${observeCall}, prev), key);`);

  // Generate chain body
  const chainBody = genFunctionChain(stmt.functionChain, dotVar, indent);
  if (chainBody) {
    lines.push(chainBody);
  }

  return lines.join('\n');
}

function genAgentStatement(stmt: AgentStatement, indent: string): string {
  const lines: string[] = [];

  const intervalMs = stmt.every
    ? toMilliseconds(stmt.every.value, stmt.every.unit)
    : 1000;

  lines.push(`${indent}setInterval(async () => {`);

  for (const bodyStmt of stmt.body) {
    lines.push(genStatement(bodyStmt, indent + '  '));
  }

  lines.push(`${indent}}, ${intervalMs});`);
  return lines.join('\n');
}

function genStatement(stmt: Statement, indent: string): string {
  switch (stmt.type) {
    case 'ObserveStatement':
      return genObserveStatement(stmt as ObserveStatement, indent);
    case 'AgentStatement':
      return genAgentStatement(stmt as AgentStatement, indent);
    default:
      return `${indent}/* unknown statement */`;
  }
}

// ---------------------------------------------------------------------------
// Interval unit → milliseconds
// ---------------------------------------------------------------------------

function toMilliseconds(value: number, unit: string): number {
  const raw = unit.toLowerCase();
  // Check for milliseconds BEFORE stripping trailing 's'
  if (raw === 'ms' || raw === 'millisecond' || raw === 'milliseconds') return value;

  const u = raw.replace(/s$/, ''); // strip trailing 's' for plural forms
  switch (u) {
    case 'second':
    case 'sec':
    case 's':
      return value * 1000;
    case 'minute':
    case 'min':
    case 'm':
      return value * 60_000;
    case 'hour':
    case 'h':
      return value * 3_600_000;
    case 'day':
    case 'd':
      return value * 86_400_000;
    default:
      return value * 1000; // default to seconds
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generate TypeScript source code from a parsed DOT AST.
 *
 * @param ast - The parsed Program AST
 * @returns Valid TypeScript source string
 *
 * @example
 * const ts = generateTypeScript(ast);
 * console.log(ts);
 */
export function generateTypeScript(ast: Program): string {
  // Reset counter for deterministic output
  dotCounter = 0;

  const lines: string[] = [];

  // Header imports
  lines.push(`import { observe, sign, chain } from '@dot-protocol/core';`);
  lines.push('');

  // Generate each statement
  for (const stmt of ast.body) {
    lines.push(genStatement(stmt, ''));
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}
