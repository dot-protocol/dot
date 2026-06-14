# Hypatia Receipt: Tree Signature Indexed Access

Date: 2026-06-14

## Claim

Repair one strict indexed-access TypeScript failure in the tree test suite without changing runtime behavior.

## Changed

- `packages/tree/tests/tree.test.ts` now stores the optional signature in a local variable, checks it exists and has at least one byte, then flips the first byte with a non-null indexed access.

## Validation

- `pnpm exec vitest run packages/tree/tests/tree.test.ts`
  - PASS: 50 tests
- `pnpm lint`
  - Still fails on unrelated existing TypeScript errors in other packages.
  - The prior `packages/tree/tests/tree.test.ts` error is no longer present.
- `git diff --check -- packages/tree/tests/tree.test.ts`
  - PASS

## Blockers

- `pnpm --filter @dot-protocol/tree test` currently reports no test files because the shared Vitest include pattern is repo-root relative while the filtered package script runs from the package directory.
- Full repo lint remains blocked by unrelated backlog errors in MCP, QR, SDK, sync, wrapper, and missing `tsdown` typings.

## Next

Continue narrow strict TypeScript hygiene, preferably another isolated test-only or validator-only repair.
