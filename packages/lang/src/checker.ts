/**
 * Type checker / semantic analyser for the DOT language.
 *
 * Validates:
 * - gate conditions must be comparison or boolean expressions
 * - mesh targets must be arrays
 * - bloom requires both `when` and `then` named args
 * - fade requires `after` named arg
 * - forge requires `action` named arg
 * - agent requires an `every` clause
 *
 * Also infers observation type from context where possible.
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
  ArrayLiteral,
} from './ast.js';

/** A semantic error with location and message. */
export interface SemanticError {
  message: string;
  line: number;
  column: number;
}

/** Result of type checking a program. */
export interface CheckResult {
  errors: SemanticError[];
  warnings: string[];
}

/** Valid comparison/boolean operators for gate conditions. */
const COMPARISON_OPS = new Set(['>', '<', '>=', '<=', '==', '!=']);
const BOOLEAN_OPS = new Set(['&&', '||']);

/**
 * Checks whether an expression is a valid gate condition.
 * Gate conditions must be:
 *   - binary comparison/boolean expressions
 *   - boolean literals
 *   - identifiers (assumed boolean from context)
 *   - function calls returning boolean
 */
function isValidGateCondition(expr: Expression): boolean {
  switch (expr.type) {
    case 'BinaryExpr': {
      const bin = expr as BinaryExpr;
      if (COMPARISON_OPS.has(bin.op)) return true;
      if (BOOLEAN_OPS.has(bin.op)) {
        return isValidGateCondition(bin.left) && isValidGateCondition(bin.right);
      }
      return false;
    }
    case 'Literal': {
      const lit = expr as Literal;
      return typeof lit.value === 'boolean';
    }
    case 'Identifier':
      // Identifiers are assumed boolean from context (e.g. isReady)
      return true;
    case 'FuncCallExpr':
      // Function calls are assumed to return boolean if used in gate
      return true;
    case 'MemberAccess':
      // Member accesses may be boolean (e.g. sensor.isActive)
      return true;
    default:
      return false;
  }
}

/**
 * Checks whether an expression is a valid mesh target (array).
 */
function isValidMeshTarget(expr: Expression): boolean {
  return expr.type === 'ArrayLiteral' || expr.type === 'Identifier';
}

/** Extract named args by name from a function call's args list. */
function findNamedArg(fc: FunctionCall, name: string): NamedArg | undefined {
  for (const arg of fc.args) {
    if (arg.type === 'NamedArg' && (arg as NamedArg).name === name) {
      return arg as NamedArg;
    }
  }
  return undefined;
}

/** Check a single function call in a chain. */
function checkFunctionCall(fc: FunctionCall, errors: SemanticError[], _warnings: string[]): void {
  switch (fc.name) {
    case 'gate': {
      // gate must have at least one arg and it must be a comparison/boolean expr
      if (fc.args.length === 0) {
        errors.push({
          message: 'gate() requires a condition argument',
          line: fc.loc.line,
          column: fc.loc.column,
        });
        break;
      }
      const firstArg = fc.args[0];
      if (!firstArg) {
        errors.push({
          message: 'gate() requires a condition argument',
          line: fc.loc.line,
          column: fc.loc.column,
        });
        break;
      }
      // Named args not allowed as gate condition
      if (firstArg.type === 'NamedArg') {
        errors.push({
          message: 'gate() condition must be a comparison or boolean expression, not a named argument',
          line: fc.loc.line,
          column: fc.loc.column,
        });
        break;
      }
      if (!isValidGateCondition(firstArg as Expression)) {
        errors.push({
          message:
            `gate() condition must be a comparison or boolean expression (got '${(firstArg as BinaryExpr).op ?? firstArg.type}')`,
          line: fc.loc.line,
          column: fc.loc.column,
        });
      }
      break;
    }

    case 'mesh': {
      // mesh must have at least one target arg that is an array or identifier
      if (fc.args.length === 0) {
        errors.push({
          message: 'mesh() requires at least one target (array or identifier)',
          line: fc.loc.line,
          column: fc.loc.column,
        });
        break;
      }
      for (const arg of fc.args) {
        if (arg.type === 'NamedArg') continue; // named args are fine for mesh options
        const expr = arg as Expression;
        if (!isValidMeshTarget(expr)) {
          errors.push({
            message: `mesh() target must be an array literal or identifier, got ${expr.type}`,
            line: fc.loc.line,
            column: fc.loc.column,
          });
        }
      }
      break;
    }

    case 'bloom': {
      // bloom requires both `when` and `then` named args
      const whenArg = findNamedArg(fc, 'when');
      const thenArg = findNamedArg(fc, 'then');
      if (!whenArg) {
        errors.push({
          message: 'bloom() requires a `when` named argument (threshold condition)',
          line: fc.loc.line,
          column: fc.loc.column,
        });
      }
      if (!thenArg) {
        errors.push({
          message: 'bloom() requires a `then` named argument (action on bloom)',
          line: fc.loc.line,
          column: fc.loc.column,
        });
      }
      break;
    }

    case 'fade': {
      // fade requires `after` named arg
      const afterArg = findNamedArg(fc, 'after');
      if (!afterArg) {
        errors.push({
          message: 'fade() requires an `after` named argument (TTL duration)',
          line: fc.loc.line,
          column: fc.loc.column,
        });
      }
      break;
    }

    case 'forge': {
      // forge requires `action` named arg
      const actionArg = findNamedArg(fc, 'action');
      if (!actionArg) {
        errors.push({
          message: 'forge() requires an `action` named argument (side effect to invoke)',
          line: fc.loc.line,
          column: fc.loc.column,
        });
      }
      break;
    }

    case 'pulse':
      // pulse is flexible — no strict required args but warn if empty
      if (fc.args.length === 0) {
        _warnings.push(
          `pulse() at ${fc.loc.line}:${fc.loc.column} has no arguments — event label recommended`,
        );
      }
      break;

    default:
      // Unknown function in chain — warn
      _warnings.push(
        `Unknown function '${fc.name}' in chain at ${fc.loc.line}:${fc.loc.column}`,
      );
      break;
  }
}

/** Check an observe statement. */
function checkObserveStatement(
  stmt: ObserveStatement,
  errors: SemanticError[],
  warnings: string[],
): void {
  // Infer observation type from observationType label
  if (stmt.observationType === undefined && stmt.value === undefined && stmt.location === undefined) {
    warnings.push(
      `ObserveStatement at ${stmt.loc.line}:${stmt.loc.column} has no type, value, or location — minimal observation`,
    );
  }

  // Check each function in the chain
  for (const fc of stmt.functionChain) {
    checkFunctionCall(fc, errors, warnings);
  }
}

/** Check an agent statement. */
function checkAgentStatement(
  stmt: AgentStatement,
  errors: SemanticError[],
  warnings: string[],
): void {
  // Agent must have an `every` clause
  if (!stmt.every) {
    errors.push({
      message: `agent '${stmt.name}' requires an 'every' clause (e.g., every 5 seconds)`,
      line: stmt.loc.line,
      column: stmt.loc.column,
    });
  }

  // Check body statements
  for (const bodyStmt of stmt.body) {
    checkStatement(bodyStmt, errors, warnings);
  }
}

/** Dispatch statement checking. */
function checkStatement(stmt: Statement, errors: SemanticError[], warnings: string[]): void {
  switch (stmt.type) {
    case 'ObserveStatement':
      checkObserveStatement(stmt as ObserveStatement, errors, warnings);
      break;
    case 'AgentStatement':
      checkAgentStatement(stmt as AgentStatement, errors, warnings);
      break;
  }
}

/**
 * Type-check and semantically validate a parsed DOT program.
 *
 * @param ast - The parsed Program AST
 * @returns Check result with errors and warnings
 *
 * @example
 * const result = checkProgram(ast);
 * if (result.errors.length > 0) {
 *   console.error(result.errors);
 * }
 */
export function checkProgram(ast: Program): CheckResult {
  const errors: SemanticError[] = [];
  const warnings: string[] = [];

  for (const stmt of ast.body) {
    checkStatement(stmt, errors, warnings);
  }

  return { errors, warnings };
}
