/**
 * executor.ts — Execute DOT programs using the script runtime.
 *
 * Takes compiled DOT programs and runs them against a live DotRuntime,
 * producing real signed DOTs. This is the self-hosting execution proof:
 * DOT programs that describe observations actually produce DOT observations.
 */

import { lex, parse, checkProgram } from '@dot-protocol/lang';
import type { ObserveStatement, AgentStatement } from '@dot-protocol/lang';
import { createRuntime } from '@dot-protocol/script';
import type { DotRuntime } from '@dot-protocol/script';
import type { DOT } from '@dot-protocol/core';

// ---------------------------------------------------------------------------
// ExecutionResult
// ---------------------------------------------------------------------------

/** Result of executing a DOT program. */
export interface ExecutionResult {
  /** All DOTs produced during execution. */
  dots: DOT[];
  /** Any errors encountered during execution (non-fatal). */
  errors: string[];
  /** Execution wall-clock duration in milliseconds. */
  duration_ms: number;
  /** The runtime used (for inspection). */
  runtime?: DotRuntime;
}

// ---------------------------------------------------------------------------
// executeDotProgram
// ---------------------------------------------------------------------------

/**
 * Execute a DOT source program against a runtime, producing real signed DOTs.
 *
 * Pipeline:
 * 1. Lex + parse the source
 * 2. Walk the AST and execute each statement
 * 3. Collect produced DOTs
 *
 * Each `observe` statement in the program produces one real signed DOT
 * via the runtime's `observe()` method.
 *
 * @param source  - Raw DOT source code
 * @param runtime - Optional pre-existing DotRuntime. Created if not provided.
 * @returns ExecutionResult with produced DOTs and timing
 */
export async function executeDotProgram(
  source: string,
  runtime?: DotRuntime,
): Promise<ExecutionResult> {
  const start = Date.now();
  const dots: DOT[] = [];
  const errors: string[] = [];

  // Create runtime if not provided
  const rt = runtime ?? (await createRuntime());

  try {
    // 1. Lex
    const { tokens, errors: lexErrors } = lex(source);
    if (lexErrors.length > 0) {
      for (const e of lexErrors) {
        errors.push(`Lex error at ${e.location.line}:${e.location.column}: ${e.message}`);
      }
      return { dots, errors, duration_ms: Date.now() - start, runtime: rt };
    }

    // 2. Parse
    const { ast, errors: parseErrors } = parse(tokens, source);
    if (parseErrors.length > 0) {
      for (const e of parseErrors) {
        errors.push(`Parse error at ${e.location.line}:${e.location.column}: ${e.message}`);
      }
      return { dots, errors, duration_ms: Date.now() - start, runtime: rt };
    }

    // 3. Check (semantic validation)
    const { errors: semanticErrors } = checkProgram(ast);
    if (semanticErrors.length > 0) {
      for (const e of semanticErrors) {
        errors.push(`Semantic error at ${e.line}:${e.column}: ${e.message}`);
      }
      return { dots, errors, duration_ms: Date.now() - start, runtime: rt };
    }

    // 4. Execute each statement
    for (const stmt of ast.body) {
      if (stmt.type === 'ObserveStatement') {
        const produced = await executeObserve(stmt as ObserveStatement, rt);
        dots.push(...produced);
      } else if (stmt.type === 'AgentStatement') {
        const produced = await executeAgentOnce(stmt as AgentStatement, rt);
        dots.push(...produced);
      }
    }
  } catch (err) {
    errors.push(`Execution error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    dots,
    errors,
    duration_ms: Date.now() - start,
    runtime: rt,
  };
}

// ---------------------------------------------------------------------------
// Internal: execute a single observe statement
// ---------------------------------------------------------------------------

async function executeObserve(
  stmt: ObserveStatement,
  rt: DotRuntime,
): Promise<DOT[]> {
  // Extract payload: use value if present, else name if present, else type label
  const payload = extractPayload(stmt);

  // Map observe type
  const observeType = mapObserveType(stmt.observationType);

  // Check gate condition — for self-hosting execution, we evaluate simple
  // numeric comparisons; complex expressions always pass
  const gateResult = evaluateGate(stmt);
  if (!gateResult) {
    // Gate condition not met — skip this observation
    return [];
  }

  // Produce the DOT via runtime
  const dot = await rt.observe(payload, {
    type: observeType,
    plaintext: true, // self-hosting uses plaintext for simplicity
  });

  return [dot];
}

// ---------------------------------------------------------------------------
// Internal: execute an agent (one tick only — for testing)
// ---------------------------------------------------------------------------

async function executeAgentOnce(
  stmt: AgentStatement,
  rt: DotRuntime,
): Promise<DOT[]> {
  const dots: DOT[] = [];

  // Execute body statements (one tick)
  for (const bodyStmt of stmt.body) {
    if (bodyStmt.type === 'ObserveStatement') {
      const produced = await executeObserve(bodyStmt as ObserveStatement, rt);
      dots.push(...produced);
    }
  }

  return dots;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Extract a meaningful payload from an observe statement. */
function extractPayload(stmt: ObserveStatement): unknown {
  if (stmt.value !== undefined) {
    // Literal value
    if (stmt.value.type === 'Literal') {
      return (stmt.value as { type: 'Literal'; value: string | number | boolean }).value;
    }
    // Identifier — use as string label
    if (stmt.value.type === 'Identifier') {
      return (stmt.value as { type: 'Identifier'; name: string }).name;
    }
  }

  if (stmt.name !== undefined) {
    return stmt.name;
  }

  if (stmt.observationType !== undefined) {
    return stmt.observationType;
  }

  return undefined;
}

/** Map DOT language observe type string to core ObservationType. */
function mapObserveType(
  typeStr: string | undefined,
): 'measure' | 'state' | 'event' | 'claim' | 'bond' | undefined {
  switch (typeStr) {
    case 'measure': return 'measure';
    case 'state': return 'state';
    case 'event': return 'event';
    case 'claim': return 'claim';
    case 'bond': return 'bond';
    default: return undefined;
  }
}

/**
 * Evaluate gate conditions for self-hosting execution.
 *
 * We evaluate simple binary comparisons with a numeric value context.
 * Complex conditions (identifiers, member access) default to true.
 */
function evaluateGate(stmt: ObserveStatement): boolean {
  const gate = stmt.functionChain.find(fc => fc.name === 'gate');
  if (!gate) return true; // no gate — always pass

  const condition = gate.args[0];
  if (!condition || condition.type === 'NamedArg') return true;

  // Try to evaluate binary comparison
  if (condition.type === 'BinaryExpr') {
    const bin = condition as {
      type: 'BinaryExpr';
      left: { type: string; value?: unknown; name?: string };
      op: string;
      right: { type: string; value?: unknown };
    };

    // For self-hosting: extract numeric value from observe statement
    // and compare against the gate threshold
    const observedValue = extractNumericValue(stmt);
    const threshold = bin.right.type === 'Literal'
      ? Number(bin.right.value)
      : null;

    if (observedValue !== null && threshold !== null) {
      switch (bin.op) {
        case '>': return observedValue > threshold;
        case '<': return observedValue < threshold;
        case '>=': return observedValue >= threshold;
        case '<=': return observedValue <= threshold;
        case '==': return observedValue === threshold;
        case '!=': return observedValue !== threshold;
        default: return true;
      }
    }
  }

  // Boolean literal condition
  if (condition.type === 'Literal') {
    const lit = condition as { type: 'Literal'; value: unknown };
    return Boolean(lit.value);
  }

  // Identifiers and complex expressions — default to pass
  return true;
}

/** Extract numeric value from observe statement value node. */
function extractNumericValue(stmt: ObserveStatement): number | null {
  if (stmt.value?.type === 'Literal') {
    const v = (stmt.value as { type: 'Literal'; value: unknown }).value;
    if (typeof v === 'number') return v;
  }
  return null;
}
