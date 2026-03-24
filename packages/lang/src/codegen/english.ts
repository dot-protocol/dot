/**
 * English prose generator for the DOT language.
 *
 * Transforms a parsed DOT AST into readable English descriptions.
 *
 * Examples:
 *   ObserveStatement → "Observe the temperature at sensor 7 (82.3)."
 *   .gate → "If the temperature exceeds 80,"
 *   .pulse → "send an alert labeled 'overheating'"
 *   .mesh → "to the maintenance team and dashboard."
 *   Agent → "Every 5 seconds, the gem scanner agent..."
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
// Expression → human-readable string
// ---------------------------------------------------------------------------

function exprToEnglish(expr: Expression): string {
  switch (expr.type) {
    case 'Literal': {
      const lit = expr as Literal;
      if (typeof lit.value === 'string') return lit.value;
      if (typeof lit.value === 'boolean') return lit.value ? 'true' : 'false';
      return String(lit.value);
    }
    case 'Identifier':
      return humanize((expr as Identifier).name);
    case 'BinaryExpr': {
      const bin = expr as BinaryExpr;
      return `${exprToEnglish(bin.left)} ${opToEnglish(bin.op)} ${exprToEnglish(bin.right)}`;
    }
    case 'FuncCallExpr': {
      const fn = expr as FuncCallExpr;
      const args = fn.args.map(exprToEnglish).join(', ');
      return `${humanize(fn.callee)}(${args})`;
    }
    case 'MemberAccess': {
      const mem = expr as MemberAccess;
      return `${exprToEnglish(mem.object)}'s ${humanize(mem.property)}`;
    }
    case 'ArrayLiteral': {
      const arr = expr as ArrayLiteral;
      return listToEnglish(arr.elements.map(exprToEnglish));
    }
    default:
      return 'something';
  }
}

/** Convert an operator symbol to an English phrase. */
function opToEnglish(op: string): string {
  switch (op) {
    case '>': return 'exceeds';
    case '<': return 'is below';
    case '>=': return 'is at least';
    case '<=': return 'is at most';
    case '==': return 'equals';
    case '!=': return 'does not equal';
    case '&&': return 'and';
    case '||': return 'or';
    case '+': return 'plus';
    case '-': return 'minus';
    case '*': return 'times';
    case '/': return 'divided by';
    default: return op;
  }
}

/** Convert snake_case/camelCase identifier to spaced words. */
function humanize(name: string): string {
  // snake_case → spaces
  return name.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

/** Join an array of strings into a readable list ("a, b, and c"). */
function listToEnglish(items: string[]): string {
  if (items.length === 0) return 'nobody';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  const last = items[items.length - 1];
  const rest = items.slice(0, -1);
  return `${rest.join(', ')}, and ${last}`;
}

// ---------------------------------------------------------------------------
// Function chain → English sentences
// ---------------------------------------------------------------------------

function functionChainToEnglish(chain: FunctionCall[], _observationType?: string): string {
  if (chain.length === 0) return '';

  const parts: string[] = [];

  for (const fc of chain) {
    switch (fc.name) {
      case 'gate': {
        const firstArg = fc.args[0];
        if (firstArg && firstArg.type !== 'NamedArg') {
          const cond = exprToEnglish(firstArg as Expression);
          parts.push(`If ${cond}`);
        }
        break;
      }
      case 'pulse': {
        const firstArg = fc.args[0];
        if (firstArg && firstArg.type !== 'NamedArg') {
          const label = exprToEnglish(firstArg as Expression);
          parts.push(`send an alert labeled '${label}'`);
        } else {
          parts.push('send an event');
        }
        break;
      }
      case 'mesh': {
        const positionalArgs = fc.args.filter(a => a.type !== 'NamedArg') as Expression[];
        if (positionalArgs.length > 0) {
          const firstArg = positionalArgs[0]!;
          if (firstArg.type === 'ArrayLiteral') {
            const targets = (firstArg as ArrayLiteral).elements.map(exprToEnglish);
            parts.push(`broadcast to ${listToEnglish(targets)}`);
          } else {
            parts.push(`broadcast to ${exprToEnglish(firstArg)}`);
          }
        } else {
          parts.push('broadcast to all targets');
        }
        break;
      }
      case 'bloom': {
        const whenArg = fc.args.find(a => a.type === 'NamedArg' && (a as NamedArg).name === 'when') as NamedArg | undefined;
        const thenArg = fc.args.find(a => a.type === 'NamedArg' && (a as NamedArg).name === 'then') as NamedArg | undefined;
        const whenDesc = whenArg ? exprToEnglish(whenArg.value) : 'the threshold is reached';
        const thenDesc = thenArg ? exprToEnglish(thenArg.value) : 'trigger action';
        parts.push(`when ${whenDesc}, trigger ${thenDesc}`);
        break;
      }
      case 'fade': {
        const afterArg = fc.args.find(a => a.type === 'NamedArg' && (a as NamedArg).name === 'after') as NamedArg | undefined;
        const duration = afterArg ? exprToEnglish(afterArg.value) : 'some time';
        parts.push(`expire after ${duration} milliseconds`);
        break;
      }
      case 'forge': {
        const actionArg = fc.args.find(a => a.type === 'NamedArg' && (a as NamedArg).name === 'action') as NamedArg | undefined;
        if (actionArg) {
          parts.push(`invoke ${exprToEnglish(actionArg.value)} as a side effect`);
        } else {
          const firstArg = fc.args[0];
          if (firstArg && firstArg.type !== 'NamedArg') {
            parts.push(`invoke ${exprToEnglish(firstArg as Expression)} as a side effect`);
          } else {
            parts.push('invoke a side effect');
          }
        }
        break;
      }
      default:
        parts.push(`apply ${fc.name}`);
        break;
    }
  }

  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Statement generators
// ---------------------------------------------------------------------------

function observeToEnglish(stmt: ObserveStatement): string {
  const parts: string[] = [];

  // Lead: "Observe the <type>"
  const typeLabel = stmt.observationType ? stmt.observationType : 'value';
  let lead = `Observe the ${typeLabel}`;

  // Location: "at sensor 7"
  if (stmt.location !== undefined) {
    lead += ` at ${exprToEnglish(stmt.location)}`;
  }

  // Value: "(82.3)"
  if (stmt.value !== undefined) {
    lead += ` (${exprToEnglish(stmt.value)})`;
  }

  // Name alias
  if (stmt.name !== undefined) {
    lead += ` as '${stmt.name}'`;
  }

  parts.push(lead);

  // Chain
  if (stmt.functionChain.length > 0) {
    const chainDesc = functionChainToEnglish(stmt.functionChain, stmt.observationType);
    if (chainDesc) {
      parts.push(chainDesc);
    }
  }

  return parts.join('. ') + '.';
}

function agentToEnglish(stmt: AgentStatement): string {
  const agentName = humanize(stmt.name);

  let lead: string;
  if (stmt.every) {
    const unit = stmt.every.value === 1
      ? stmt.every.unit.replace(/s$/, '')
      : stmt.every.unit;
    lead = `Every ${stmt.every.value} ${unit}, the ${agentName} agent`;
  } else {
    lead = `The ${agentName} agent`;
  }

  if (stmt.body.length === 0) {
    return `${lead} runs with no observations.`;
  }

  const bodyDescs = stmt.body.map(s => statementToEnglish(s));
  return `${lead} performs the following: ${bodyDescs.join(' ')}`;
}

function statementToEnglish(stmt: Statement): string {
  switch (stmt.type) {
    case 'ObserveStatement':
      return observeToEnglish(stmt as ObserveStatement);
    case 'AgentStatement':
      return agentToEnglish(stmt as AgentStatement);
    default:
      return 'performs an unknown action.';
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generate readable English descriptions from a parsed DOT AST.
 *
 * @param ast - The parsed Program AST
 * @returns Human-readable English string describing the program
 *
 * @example
 * const english = generateEnglish(ast);
 * console.log(english);
 * // "Observe the temperature at sensor 7 (82.3). If temperature exceeds 80, ..."
 */
export function generateEnglish(ast: Program): string {
  const sentences = ast.body.map(statementToEnglish);
  return sentences.join('\n');
}
