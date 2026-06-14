# Hypatia Receipt: MCP server param casts

Timestamp: 2026-06-14T05:51:29Z

Scope:
- Tightened `packages/mcp/src/server.ts` by routing MCP dispatcher params through a single `typedParams<T>()` bridge before calling typed handlers.
- Preserved the runtime dispatcher boundary as `Record<string, unknown>` while making required handler-param casts explicit for strict TypeScript.

Validation:
- `pnpm lint 2>&1 | rg 'packages/mcp/src/server.ts' || true` produced no output.
- `pnpm exec vitest run packages/mcp/tests/handlers.test.ts packages/mcp/tests/tools.test.ts` passed: 2 files, 70 tests.
- `pnpm exec vitest run packages/mcp/tests/sdk-server.test.ts` passed: 1 file, 24 tests.
- `pnpm --filter @dot-protocol/mcp test` remains blocked by the package-local Vitest include pattern finding no tests from `/opt/kin/packages/mcp`.

Boundaries:
- No deploy, push, public posting, account operations, stream/key handling, secrets, external audit files, or unrelated edits.
