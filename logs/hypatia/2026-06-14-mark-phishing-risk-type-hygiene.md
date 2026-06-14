# Hypatia Receipt: Mark Phishing Risk Type Hygiene

Date: 2026-06-14
Branch: vps-hypatia

## Changed

- Added a small risk-order helper in `packages/mark/src/phishing.ts` so phishing risk escalation keeps "worst risk wins" semantics without TypeScript literal narrowing false positives.
- Updated `packages/mark/tsconfig.json` from `rootDir: "src"` to `rootDir: "."` so the package-local typecheck can include its existing tests.

## Validated

- `pnpm exec tsc -p packages/mark/tsconfig.json --noEmit`
- `pnpm vitest run packages/mark/tests --reporter=default`
- `pnpm lint 2>&1 | rg 'packages/mark'` returned no matches.
- `git diff --check`

## Blockers

- Full root `pnpm lint` still fails on unrelated existing blockers outside `packages/mark`, including missing `tsdown` declarations, MCP strict casts, QR legacy DOT drift, SDK alias/export drift, and other package strictness issues.

## Boundaries

- No deploy, push, public posting, account operations, stream/key handling, external audit files, credential handling, or unrelated edits.
