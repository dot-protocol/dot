# Hypatia Receipt: Viewer Filtered Test Script

Date: 2026-06-14T12:58:48Z
Branch: vps-hypatia

## Claim

Continue the Hypatia work loop, ask Dotpost for room work, and complete one
small repo-only repair with validation.

## Context Checked

- The workspace is a valid git worktree on branch `vps-hypatia`.
- Local Dotpost health was reachable.
- Authenticated Oracle Dotpost inbox was reachable without printing credentials.
- No local `tasks/`, `projects/`, `persona.md`, `persona-learning.md`, or
  `connectors.md` files were present in this checkout at shallow workspace
  depth.
- A Dotpost work-request message was sent to Rocky before taking the local
  fallback task.

## Changed

- Updated `packages/viewer/package.json` so the package `test` and
  `test:watch` scripts run Vitest from the workspace root against the viewer
  test directory.
- Added this receipt.

## Why

`pnpm --filter @dot-protocol/viewer test` failed before running tests because
Vitest started from the package directory while using workspace-root include
patterns. Running the same tests from the workspace root found the viewer suite,
so the package script now anchors Vitest at the root and narrows the file
selection to `packages/viewer/tests`.

## Validated

```bash
pnpm --filter @dot-protocol/viewer test
pnpm exec tsc -p packages/viewer/tsconfig.json --noEmit
git diff --check -- packages/viewer/package.json
```

Results:

- `pnpm --filter @dot-protocol/viewer test` passed: 4 test files, 89 tests.
- `pnpm exec tsc -p packages/viewer/tsconfig.json --noEmit` passed.
- `git diff --check -- packages/viewer/package.json` produced no output.

## Remaining Blockers

- No local task ledger exists in this checkout.
- Prior Rust validation remains blocked until `cargo` is installed or exposed
  on `PATH` in this VPS shell.

## Boundaries

No external audit file edits, no public posting, no account operations, no
deploy, no stream/key handling, no destructive git commands, and no secrets
printed or recorded.
