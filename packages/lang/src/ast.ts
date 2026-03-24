/**
 * AST type definitions for the DOT language.
 *
 * These types define the structure of the Abstract Syntax Tree produced
 * by the DOT language parser. They are shared between the parser,
 * checker, and code generators.
 */

/** Source location for error reporting and source maps. */
export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

/**
 * The observation type — maps to the DOT observation type classification.
 * Matches the DOT protocol ObservationType with additional 'plain' variant.
 */
export type ObserveType = 'measure' | 'state' | 'event' | 'claim' | 'bond' | 'plain';

/** Root node of a parsed DOT program. */
export interface Program {
  type: 'Program';
  body: Statement[];
  loc: SourceLocation;
}

/** Any top-level statement in a DOT program. */
export type Statement = ObserveStatement | AgentStatement;

/**
 * An observation statement.
 * @example observe temperature at sensor(7) = 82.3 .gate(...)
 */
export interface ObserveStatement {
  type: 'ObserveStatement';
  /** Observation type label (e.g. "temperature", "state", "event"). */
  observationType?: string;
  /** Optional named alias for the observed value. */
  name?: string;
  /** Target location expression (e.g. sensor(7)). */
  location?: Expression;
  /** The observed value expression. */
  value?: Expression;
  /** Chained function calls (.gate, .pulse, .mesh, etc.). */
  functionChain: FunctionCall[];
  loc: SourceLocation;
}

/**
 * An agent statement — a periodic autonomous observation loop.
 * @example agent gem_scanner every 5 seconds { ... }
 */
export interface AgentStatement {
  type: 'AgentStatement';
  /** Agent identifier name. */
  name: string;
  /** Polling interval. */
  every?: { value: number; unit: string };
  /** Statements executed on each tick. */
  body: Statement[];
  loc: SourceLocation;
}

/**
 * A chained function call (.gate, .pulse, .mesh, .bloom, .fade, .forge).
 */
export interface FunctionCall {
  type: 'FunctionCall';
  /** Function name (gate, pulse, mesh, bloom, fade, forge). */
  name: string;
  /** Positional and named arguments. */
  args: (Expression | NamedArg)[];
  loc: SourceLocation;
}

/** Any expression node. */
export type Expression =
  | BinaryExpr
  | UnaryExpr
  | Literal
  | Identifier
  | FuncCallExpr
  | MemberAccess
  | ArrayLiteral;

/**
 * Binary expression (comparisons, logic, arithmetic).
 * @example temperature > 80
 */
export interface UnaryExpr {
  type: 'UnaryExpr';
  op: string;
  operand: Expression;
  loc: SourceLocation;
}

export interface BinaryExpr {
  type: 'BinaryExpr';
  left: Expression;
  /** Operator string: >, <, >=, <=, ==, !=, &&, ||, +, -, *, / */
  op: string;
  right: Expression;
  loc: SourceLocation;
}

/** A literal value (string, number, or boolean). */
export interface Literal {
  type: 'Literal';
  value: string | number | boolean;
  loc: SourceLocation;
}

/** An identifier reference. */
export interface Identifier {
  type: 'Identifier';
  name: string;
  loc: SourceLocation;
}

/** A function call expression within an expression context. */
export interface FuncCallExpr {
  type: 'FuncCallExpr';
  callee: string;
  args: Expression[];
  loc: SourceLocation;
}

/** Member access expression (object.property). */
export interface MemberAccess {
  type: 'MemberAccess';
  object: Expression;
  property: string;
  loc: SourceLocation;
}

/** An array literal expression. */
export interface ArrayLiteral {
  type: 'ArrayLiteral';
  elements: Expression[];
  loc: SourceLocation;
}

/** A named argument (name: value) in a function call. */
export interface NamedArg {
  type: 'NamedArg';
  name: string;
  value: Expression;
  loc: SourceLocation;
}
