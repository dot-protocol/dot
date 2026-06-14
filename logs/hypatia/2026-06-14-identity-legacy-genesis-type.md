# Hypatia Receipt: identity legacy genesis type

Timestamp: 2026-06-14T05:33:28Z

Scope:
- Tightened `packages/identity/src/identity.ts` so identity genesis DOTs are typed as `LegacyDOT`, matching `createDOT`, `toBytes`, and `verifyDOT`.
- Added a local runtime guard for imported genesis DOT bytes before returning an `Identity`.

Validation:
- `pnpm --filter @dotprotocol/identity typecheck` passed.
- `pnpm exec vitest run packages/identity/src/tests/identity.test.ts` passed: 1 file, 8 tests.
- Root `pnpm lint` filtered for `packages/identity` no longer reports `src/identity.ts`; remaining identity blocker is missing `tsdown` module/type declarations in `packages/identity/tsdown.config.ts`.
- `git diff --check` passed.
- Added-line sensitive-shape scan found no matches.

Boundaries:
- No deploy, push, public posting, account operations, stream/key handling, secrets, external audit files, or unrelated edits.
