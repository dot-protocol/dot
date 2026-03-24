/**
 * main.ts — DOT CLI entry point.
 *
 * Usage:
 *   dot <command> [options]
 *
 * Commands:
 *   dot run <file.dot>      Parse, compile, and execute a DOT program
 *   dot check <file.dot>    Parse and type-check (no execution)
 *   dot compile <file.dot>  Compile to TypeScript and print
 *   dot explain <file.dot>  Explain in English
 *   dot identity            Generate or show current identity
 *   dot health              Show runtime health
 *   dot version             Show version
 *
 * Args are parsed manually — no commander dependency.
 */

import {
  runCommand,
  checkCommand,
  compileCommand,
  explainCommand,
  identityCommand,
  healthCommand,
  versionCommand,
} from './commands.js';

const USAGE = `
Usage: dot <command> [options]

Commands:
  run <file.dot>      Parse, compile, and execute a DOT program (prints TypeScript)
  check <file.dot>    Parse and type-check without executing
  compile <file.dot>  Compile to TypeScript and print
  explain <file.dot>  Explain the program in English
  identity            Generate a new Ed25519 identity
  health              Show runtime health
  version             Show version information

Examples:
  dot run sensor.dot
  dot check sensor.dot
  dot compile sensor.dot
  dot explain sensor.dot
  dot identity
  dot health
  dot version
`.trim();

/**
 * Main CLI dispatcher.
 *
 * @param argv - process.argv slice (from index 2)
 */
export async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    console.log(USAGE);
    return;
  }

  switch (command) {
    case 'run': {
      const filePath = rest[0];
      if (!filePath) {
        console.error('Error: dot run requires a <file.dot> argument');
        console.error('Usage: dot run <file.dot>');
        process.exitCode = 1;
        return;
      }
      try {
        const output = runCommand(filePath);
        console.log(output);
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
      break;
    }

    case 'check': {
      const filePath = rest[0];
      if (!filePath) {
        console.error('Error: dot check requires a <file.dot> argument');
        console.error('Usage: dot check <file.dot>');
        process.exitCode = 1;
        return;
      }
      try {
        const output = checkCommand(filePath);
        console.log(output);
        // Exit 1 if there are errors
        if (output.startsWith('FAIL')) {
          process.exitCode = 1;
        }
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
      break;
    }

    case 'compile': {
      const filePath = rest[0];
      if (!filePath) {
        console.error('Error: dot compile requires a <file.dot> argument');
        console.error('Usage: dot compile <file.dot>');
        process.exitCode = 1;
        return;
      }
      try {
        const output = compileCommand(filePath);
        console.log(output);
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
      break;
    }

    case 'explain': {
      const filePath = rest[0];
      if (!filePath) {
        console.error('Error: dot explain requires a <file.dot> argument');
        console.error('Usage: dot explain <file.dot>');
        process.exitCode = 1;
        return;
      }
      try {
        const output = explainCommand(filePath);
        console.log(output);
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
      break;
    }

    case 'identity': {
      try {
        const output = await identityCommand();
        console.log(output);
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
      break;
    }

    case 'health': {
      try {
        const output = await healthCommand();
        console.log(output);
      } catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
      break;
    }

    case 'version':
    case '--version':
    case '-v': {
      console.log(versionCommand());
      break;
    }

    default: {
      console.error(`Error: Unknown command "${command}"`);
      console.error('');
      console.error(USAGE);
      process.exitCode = 1;
    }
  }
}

// Run when invoked directly
// In ESM, use import.meta.url detection instead of require.main
const isMain = process.argv[1]?.endsWith('main.ts') ||
               process.argv[1]?.endsWith('main.js') ||
               process.argv[1]?.endsWith('dot');

if (isMain) {
  main(process.argv.slice(2)).catch((err) => {
    console.error('Fatal:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
