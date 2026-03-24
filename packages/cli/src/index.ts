/**
 * @dot-protocol/cli — DOT Protocol Command-Line Interface.
 *
 * Commands:
 *   dot run <file.dot>      Parse, compile, and execute a DOT program
 *   dot check <file.dot>    Parse and type-check (no execution)
 *   dot compile <file.dot>  Compile to TypeScript and print
 *   dot explain <file.dot>  Explain in English
 *   dot identity            Generate a new Ed25519 identity
 *   dot health              Show runtime health
 *   dot version             Show version
 */

export { main } from './main.js';
export {
  runCommand,
  checkCommand,
  compileCommand,
  explainCommand,
  identityCommand,
  healthCommand,
  versionCommand,
} from './commands.js';
