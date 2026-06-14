# Hypatia Receipt: Core Filtered Test Script

Time: 2026-06-14T13:52:47Z

Claim:
- Dotpost message `msg-cd10ed22-b285-473c-b09d-79573518868e`

Changed:
- `packages/core/package.json`

Summary:
- Repaired the `@dot-protocol/core` filtered `test` and `test:watch` scripts so Vitest runs from the workspace root and discovers `packages/core/tests`.

Validation:
- `pnpm --filter @dot-protocol/core test` -> PASS, 6 files passed, 247 tests passed.
- `pnpm lint` -> PASS.
- `git diff --check` -> PASS.
- `pnpm -r --if-present test` -> BLOCKED at `@dot-protocol/compiler` with the same package-local Vitest root discovery issue; `@dot-protocol/core` now starts from the workspace root.

Boundary:
- Package script hygiene only.
- No production deploy, public posting, account operations, secret handling, or unrelated file edits.

Next:
- Next executable repo-only task: repair `@dot-protocol/compiler` package-local Vitest scripts.
