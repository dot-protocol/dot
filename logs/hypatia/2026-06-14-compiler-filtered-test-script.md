# Hypatia receipt: compiler filtered Vitest script

Date: 2026-06-14T14:11:04Z

Claim:
- Repair the `@dot-protocol/compiler` package-local Vitest scripts so filtered and recursive package test runs discover the root-relative `packages/compiler/tests` suite.

Changed:
- `packages/compiler/package.json` now runs `test` and `test:watch` with `--root ../.. packages/compiler/tests`, matching the existing repaired package-script pattern.

Validation:
- `pnpm --filter @dot-protocol/compiler test` passed: 4 files, 107 tests.
- `pnpm lint` passed.
- `git diff --check` passed.

Recursive test note:
- `pnpm -r --if-present test` now gets past `@dot-protocol/compiler` and blocks on the same package-local Vitest root discovery issue in other packages. First reported failure: `@dot-protocol/chain`; concurrent output also showed `@dot-protocol/bridge` and `@dot-protocol/fs` with no test files found from their package directories.

Boundaries:
- Repo-only package script hygiene and receipt.
- No deploy, public posting, account operations, stream work, secret handling, or unrelated edits.

Next action:
- Repair the next package-local Vitest script blocker, starting with `@dot-protocol/chain`.
