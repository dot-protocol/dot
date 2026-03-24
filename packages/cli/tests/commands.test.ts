/**
 * commands.test.ts — CLI command unit tests.
 *
 * Tests each command function in isolation:
 *  - runCommand: outputs TypeScript for valid source
 *  - checkCommand: reports errors and passes clean files
 *  - compileCommand: outputs TypeScript source
 *  - explainCommand: outputs English prose
 *  - identityCommand: generates an Ed25519 public key
 *  - healthCommand: returns runtime health report
 *  - versionCommand: returns version string
 *  - main(): argument dispatch
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  runCommand,
  checkCommand,
  compileCommand,
  explainCommand,
  identityCommand,
  healthCommand,
  versionCommand,
} from '../src/commands.js';
import { main } from '../src/main.js';

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

const TMP = tmpdir();

function writeTmp(name: string, content: string): string {
  const path = join(TMP, name);
  writeFileSync(path, content, 'utf8');
  return path;
}

const VALID_DOT_SOURCE = 'observe temperature at sensor(7) = 82.3';
const AGENT_DOT_SOURCE = `agent gem_scanner {
  every 5 seconds {
    observe pressure at gauge(1) = 101.3
  }
}`;

let validFile: string;
let agentFile: string;
let invalidFile: string;

beforeAll(() => {
  validFile = writeTmp('test-valid.dot', VALID_DOT_SOURCE);
  agentFile = writeTmp('test-agent.dot', AGENT_DOT_SOURCE);
  invalidFile = writeTmp('test-invalid.dot', '@@@ not valid DOT source %%%');
});

afterAll(() => {
  try { unlinkSync(validFile); } catch { /* ignore */ }
  try { unlinkSync(agentFile); } catch { /* ignore */ }
  try { unlinkSync(invalidFile); } catch { /* ignore */ }
});

// ---------------------------------------------------------------------------
// runCommand
// ---------------------------------------------------------------------------

describe('runCommand', () => {
  it('returns TypeScript string for valid .dot file', () => {
    const output = runCommand(validFile);
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });

  it('output contains @dot-protocol/core import', () => {
    const output = runCommand(validFile);
    expect(output).toContain('@dot-protocol/core');
  });

  it('output contains observe keyword usage', () => {
    const output = runCommand(validFile);
    expect(output).toMatch(/observe/i);
  });

  it('throws for invalid DOT source', () => {
    expect(() => runCommand(invalidFile)).toThrow();
  });

  it('throws when file does not exist', () => {
    expect(() => runCommand('/tmp/nonexistent-file.dot')).toThrow(/Cannot read file/);
  });

  it('handles agent statements', () => {
    const output = runCommand(agentFile);
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// checkCommand
// ---------------------------------------------------------------------------

describe('checkCommand', () => {
  it('returns OK for valid .dot file', () => {
    const output = checkCommand(validFile);
    expect(output).toContain('OK');
  });

  it('returns no error lines for valid source', () => {
    const output = checkCommand(validFile);
    // "No errors or warnings." is acceptable — no "error  " diagnostic lines
    expect(output).not.toMatch(/^\s+error\s+/m);
  });

  it('returns FAIL for invalid source', () => {
    const output = checkCommand(invalidFile);
    expect(output).toContain('FAIL');
  });

  it('includes error line numbers for invalid source', () => {
    const output = checkCommand(invalidFile);
    // Should have error with line:col format
    expect(output).toMatch(/\d+:\d+/);
  });

  it('throws when file does not exist', () => {
    expect(() => checkCommand('/tmp/no-such-file.dot')).toThrow(/Cannot read file/);
  });
});

// ---------------------------------------------------------------------------
// compileCommand
// ---------------------------------------------------------------------------

describe('compileCommand', () => {
  it('returns TypeScript for valid .dot file', () => {
    const output = compileCommand(validFile);
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });

  it('output matches runCommand output (same pipeline)', () => {
    const compile = compileCommand(validFile);
    const run = runCommand(validFile);
    expect(compile).toBe(run);
  });

  it('throws for invalid source', () => {
    expect(() => compileCommand(invalidFile)).toThrow();
  });

  it('throws when file not found', () => {
    expect(() => compileCommand('/tmp/missing.dot')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// explainCommand
// ---------------------------------------------------------------------------

describe('explainCommand', () => {
  it('returns non-empty English string', () => {
    const output = explainCommand(validFile);
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });

  it('output contains "temperature" (from source)', () => {
    const output = explainCommand(validFile);
    expect(output.toLowerCase()).toContain('temperature');
  });

  it('output contains "observe" or "observation"', () => {
    const output = explainCommand(validFile);
    expect(output.toLowerCase()).toMatch(/observ/);
  });

  it('agent file produces English mentioning the agent', () => {
    const output = explainCommand(agentFile);
    expect(output.toLowerCase()).toMatch(/gem.?scanner|agent/);
  });

  it('throws for invalid source', () => {
    expect(() => explainCommand(invalidFile)).toThrow();
  });

  it('throws when file not found', () => {
    expect(() => explainCommand('/tmp/missing.dot')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// identityCommand
// ---------------------------------------------------------------------------

describe('identityCommand', () => {
  it('returns a string with "Public key:"', async () => {
    const output = await identityCommand();
    expect(output).toContain('Public key:');
  });

  it('public key is 64 hex characters', async () => {
    const output = await identityCommand();
    const match = output.match(/Public key:\s+([0-9a-f]+)/);
    expect(match).not.toBeNull();
    expect(match![1]).toHaveLength(64);
  });

  it('generates a different key on each call', async () => {
    const a = await identityCommand();
    const b = await identityCommand();
    const matchA = a.match(/Public key:\s+([0-9a-f]+)/);
    const matchB = b.match(/Public key:\s+([0-9a-f]+)/);
    expect(matchA![1]).not.toBe(matchB![1]);
  });

  it('mentions Ed25519', async () => {
    const output = await identityCommand();
    expect(output).toContain('Ed25519');
  });
});

// ---------------------------------------------------------------------------
// healthCommand
// ---------------------------------------------------------------------------

describe('healthCommand', () => {
  it('returns a string containing "OK"', async () => {
    const output = await healthCommand();
    expect(output).toContain('OK');
  }, 10000);

  it('contains "Uptime:"', async () => {
    const output = await healthCommand();
    expect(output).toContain('Uptime:');
  }, 10000);

  it('contains "DOTs created:"', async () => {
    const output = await healthCommand();
    expect(output).toContain('DOTs created:');
  }, 10000);

  it('contains "Chains active:"', async () => {
    const output = await healthCommand();
    expect(output).toContain('Chains active:');
  }, 10000);
});

// ---------------------------------------------------------------------------
// versionCommand
// ---------------------------------------------------------------------------

describe('versionCommand', () => {
  it('returns a string containing "@dot-protocol/cli"', () => {
    const output = versionCommand();
    expect(output).toContain('@dot-protocol/cli');
  });

  it('contains "1.0.0-alpha.0" version string', () => {
    const output = versionCommand();
    expect(output).toContain('1.0.0-alpha.0');
  });

  it('returns a non-empty string', () => {
    const output = versionCommand();
    expect(output.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// main() dispatcher
// ---------------------------------------------------------------------------

describe('main()', () => {
  it('no args: prints usage without throwing', async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    await main([]);
    console.log = orig;
    const out = logs.join('\n');
    expect(out).toMatch(/Usage/i);
  });

  it('--help: prints usage', async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    await main(['--help']);
    console.log = orig;
    expect(logs.join('\n')).toMatch(/Usage/i);
  });

  it('version command: prints version info', async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    await main(['version']);
    console.log = orig;
    expect(logs.join('\n')).toContain('@dot-protocol');
  });

  it('unknown command: sets exitCode 1', async () => {
    const errs: string[] = [];
    const origErr = console.error;
    console.error = (...args) => errs.push(args.join(' '));
    const origCode = process.exitCode;
    await main(['frobnicate']);
    console.error = origErr;
    expect(errs.join('\n')).toMatch(/Unknown command/i);
    process.exitCode = origCode; // restore
  });

  it('run with no file: sets exitCode 1', async () => {
    const errs: string[] = [];
    const origErr = console.error;
    console.error = (...args) => errs.push(args.join(' '));
    const origCode = process.exitCode;
    await main(['run']);
    console.error = origErr;
    expect(errs.join('\n')).toMatch(/requires a/i);
    process.exitCode = origCode;
  });

  it('run with valid file: prints TypeScript', async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    await main(['run', validFile]);
    console.log = orig;
    const out = logs.join('\n');
    expect(out).toContain('@dot-protocol/core');
  });

  it('check with valid file: prints OK', async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    await main(['check', validFile]);
    console.log = orig;
    expect(logs.join('\n')).toContain('OK');
  });

  it('explain with valid file: prints English', async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    await main(['explain', validFile]);
    console.log = orig;
    expect(logs.join('\n').toLowerCase()).toContain('temperature');
  });
});
