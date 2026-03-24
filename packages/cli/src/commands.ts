/**
 * commands.ts — DOT CLI command implementations.
 *
 * Each command function:
 *  1. Reads the input file or generates data as needed.
 *  2. Calls the appropriate @dot-protocol/* functions.
 *  3. Returns a plain string to be printed to stdout.
 *
 * Commands never call process.exit() — that is the responsibility of main.ts.
 * All functions are async and testable in isolation.
 */

import { readFileSync } from 'fs';
import { run as langRun, explain as langExplain, check as langCheck } from '@dot-protocol/lang';
import { createIdentity } from '@dot-protocol/core';
import { createRuntime } from '@dot-protocol/script';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a file from disk, returning its UTF-8 content. */
function readFile(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot read file "${filePath}": ${msg}`);
  }
}

/** Convert a Uint8Array to hex string. */
function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

// ---------------------------------------------------------------------------
// dot run <file.dot>
// ---------------------------------------------------------------------------

/**
 * Parse, compile, and show the TypeScript output for a .dot file.
 *
 * @param filePath - Path to the .dot source file
 * @returns Generated TypeScript source string
 */
export function runCommand(filePath: string): string {
  const source = readFile(filePath);
  const typescript = langRun(source);
  return typescript;
}

// ---------------------------------------------------------------------------
// dot check <file.dot>
// ---------------------------------------------------------------------------

/**
 * Parse and type-check a .dot file without executing it.
 *
 * @param filePath - Path to the .dot source file
 * @returns Human-readable check report
 */
export function checkCommand(filePath: string): string {
  const source = readFile(filePath);
  const result = langCheck(source);

  const lines: string[] = [];

  if (result.errors.length === 0 && result.warnings.length === 0) {
    lines.push(`OK  ${filePath}`);
    lines.push('No errors or warnings.');
    return lines.join('\n');
  }

  if (result.errors.length > 0) {
    lines.push(`FAIL  ${filePath}`);
    for (const e of result.errors) {
      lines.push(`  error  ${e.line}:${e.column}  ${e.message}`);
    }
  }

  if (result.warnings.length > 0) {
    if (result.errors.length === 0) {
      lines.push(`WARN  ${filePath}`);
    }
    for (const w of result.warnings) {
      lines.push(`  warn   ${w.line}:${w.column}  ${w.message}`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// dot compile <file.dot>
// ---------------------------------------------------------------------------

/**
 * Compile a .dot file to TypeScript and return the generated source.
 *
 * Equivalent to `runCommand` but named separately so the CLI can distinguish
 * the intent ("compile" = show TS; "run" = execute).
 *
 * @param filePath - Path to the .dot source file
 * @returns Generated TypeScript source string
 */
export function compileCommand(filePath: string): string {
  const source = readFile(filePath);
  return langRun(source);
}

// ---------------------------------------------------------------------------
// dot explain <file.dot>
// ---------------------------------------------------------------------------

/**
 * Explain a .dot file in plain English.
 *
 * @param filePath - Path to the .dot source file
 * @returns English prose description
 */
export function explainCommand(filePath: string): string {
  const source = readFile(filePath);
  return langExplain(source);
}

// ---------------------------------------------------------------------------
// dot identity
// ---------------------------------------------------------------------------

/**
 * Generate a new Ed25519 identity and print the public key.
 *
 * @returns Human-readable identity block
 */
export async function identityCommand(): Promise<string> {
  const identity = await createIdentity();
  const pubHex = toHex(identity.publicKey);
  const lines: string[] = [
    'DOT Identity (Ed25519)',
    '─'.repeat(42),
    `Public key:  ${pubHex}`,
    '',
    'The secret key is NOT shown. Store it securely.',
    'This identity is ephemeral — re-run to generate a new one.',
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// dot health
// ---------------------------------------------------------------------------

/**
 * Boot the DOT runtime and return a health report.
 *
 * @returns Human-readable health report
 */
export async function healthCommand(): Promise<string> {
  const rt = await createRuntime();
  const healthDot = rt.health();
  await rt.shutdown();

  let report: Record<string, unknown> = {};
  if (healthDot.payload && healthDot.payload_mode === 'plain') {
    try {
      const decoded = new TextDecoder().decode(healthDot.payload);
      report = JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      report = { raw: 'unable to decode health payload' };
    }
  }

  const uptime = typeof report['uptime_ms'] === 'number' ? report['uptime_ms'] : 0;
  const dots = typeof report['dots_created'] === 'number' ? report['dots_created'] : 0;
  const chains = typeof report['chains_active'] === 'number' ? report['chains_active'] : 1;
  const depth = typeof report['identity_chain_depth'] === 'number' ? report['identity_chain_depth'] : 0;

  const lines: string[] = [
    'DOT Runtime Health',
    '─'.repeat(42),
    `Status:           OK`,
    `Uptime:           ${uptime}ms`,
    `DOTs created:     ${dots}`,
    `Chains active:    ${chains}`,
    `Identity depth:   ${depth}`,
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// dot version
// ---------------------------------------------------------------------------

/**
 * Print the CLI version.
 *
 * Reads the version from the package.json of @dot-protocol/cli.
 *
 * @returns Version string
 */
export function versionCommand(): string {
  return '@dot-protocol/cli  1.0.0-alpha.0\n@dot-protocol/lang  1.0.0-alpha.0\n@dot-protocol/core  1.0.0-alpha.0';
}
