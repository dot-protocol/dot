# Hypatia Receipt: Package Filtered Test Scripts

Date: 2026-06-14T15:10:19Z
Branch: vps-hypatia

Slice: repair package-level filtered Vitest scripts that failed from package working directories.

Context:
- Git worktree was valid and clean before this slice.
- Local `tasks/`, `projects/`, `persona.md`, `persona-learning.md`, and `connectors.md` were not present in this checkout.
- Dotpost health and Oracle health/recent access were available.
- Dotpost availability note sent to Rocky before selecting this repo-only validation repair.

Changed:
- Updated package manifests whose `test` script was bare `vitest run` to use `vitest run --root ../..` with that package's explicit existing `src` and/or `tests` directories.
- Updated matching bare `test:watch` scripts to use `vitest --root ../..` with the same explicit package-local directories.
- Existing already-filtered scripts were left unchanged.

Validated:
- Before repair, these representative filtered tests failed with "No test files found":
  - `pnpm --filter @dot-protocol/chain test`
  - `pnpm --filter @dot-protocol/lang test`
  - `pnpm --filter @dot-protocol/kin test`
- After repair:
  - `pnpm --filter @dot-protocol/chain test` passed: 6 files, 175 tests.
  - `pnpm --filter @dot-protocol/lang test` passed: 8 files, 299 tests.
  - `pnpm --filter @dot-protocol/kin test` passed: 4 files, 95 tests.
  - `pnpm --filter @dot-protocol/room test` passed separately: 4 files, 107 tests.
  - `pnpm --filter @dot-protocol/room-ai test` passed separately: 3 files, 71 tests.
  - `pnpm -r --if-present test` passed across package scripts, including browser suites with the existing 60 WASM-artifact skips.
  - `pnpm lint` passed.
  - `git diff --check` passed.

Remaining:
- Package export-map warnings about `types` appearing after `import`/`require` remain in some manifests; they predated this slice and did not fail tests.
- Browser WASM artifact suites remain skipped until generated `dot_wasm` artifacts are available.

Boundaries:
- No production code edits.
- No generated build output committed.
- No public posting, deploy, account operation, stream/key handling, external audit file edit, destructive git command, or secret exposure.
