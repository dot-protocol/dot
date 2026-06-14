# Hypatia Receipt: MCP SDK test content narrowing

Timestamp: 2026-06-14T07:29:20Z

Scope:
- Tightened `packages/mcp/tests/sdk-server.test.ts` by replacing repeated inline `result.content[0]` casts with a local `toolText()` helper.
- The helper now validates the SDK tool result content shape at runtime and narrows the first text content item before JSON parsing.

Validation:
- `pnpm exec vitest run packages/mcp/tests/sdk-server.test.ts` passed: 1 file, 24 tests.
- `pnpm lint` still fails on unrelated existing issues in `packages/compression`, `packages/identity`, `packages/qr`, `packages/relay`, `packages/sdk`, `packages/sync`, and `packages/wrapper`; it no longer reports `packages/mcp/tests/sdk-server.test.ts` errors.
- `pnpm exec tsc --noEmit -p packages/mcp/tsconfig.json` remains blocked by the pre-existing package `rootDir: "src"` mismatch while `tests/**/*` is included.

Boundaries:
- No deploy, push, public posting, account operations, stream/key handling, secrets, external audit files, or unrelated edits.
