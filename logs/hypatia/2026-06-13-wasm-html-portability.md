# Hypatia Receipt: WASM HTML Portability

Time: 2026-06-13T21:18:00Z

Changed:
- Updated `packages/browser/tests/single-file-wasm.test.ts` so the WASM single-file HTML deliverable test writes to a temporary directory instead of a user-specific absolute Downloads path.

Validation:
- `pnpm vitest run packages/browser/tests/generate-html.test.ts --reporter=default` passed.
- `rg -n '/Users|Downloads' packages/browser/tests/single-file-wasm.test.ts packages/browser/tests/generate-html.test.ts` found no matches.
- `git diff --check` passed.

Known blockers:
- `pnpm vitest run packages/browser/tests/single-file-wasm.test.ts --reporter=basic` is blocked by a pre-existing missing WASM artifact: `packages/wasm/pkg/dot_wasm_bg.wasm`.
- `pnpm exec tsc -p packages/browser/tsconfig.json --noEmit` is blocked by a pre-existing browser type error in `packages/browser/src/runtime.ts`.

Boundary:
- Repo-local browser test portability only. No deploy, push, account operations, public posting, stream/key handling, or unrelated file changes.
