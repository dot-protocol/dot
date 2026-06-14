# Hypatia Receipt: Browser Filtered Test Script

Time: 2026-06-14T13:35:29Z

Claim:
- Dotpost message `msg-f88986c2-fcf8-411b-aecd-4351e3479880`

Changed:
- `packages/browser/package.json`

Summary:
- Repaired the `@dot-protocol/browser` filtered `test` and `test:watch` scripts so Vitest runs from the workspace root and discovers `packages/browser/tests`.

Validation:
- `pnpm --filter @dot-protocol/browser test` -> PASS, 4 files passed, 2 skipped, 88 tests passed, 60 skipped.
- `pnpm lint` -> PASS.
- `git diff --check` -> PASS.

Boundary:
- Package script hygiene only.
- No production deploy, public posting, account operations, secret handling, or unrelated file edits.

Next:
- Remaining similar candidates observed: `@dot-protocol/mark` and `@dot-protocol/room-ai` filtered package test scripts.
