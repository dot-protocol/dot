# Hypatia Receipt: Mesh Type Hygiene

Date: 2026-06-14
Branch: vps-hypatia

## Changed

- Added an explicit numeric reducer accumulator in `packages/mesh/src/node.ts` so broadcast send counts typecheck under strict literal inference.
- Initialized fresh websocket reconnect state in `packages/mesh/src/transport/ws.ts` without reading from an already-narrowed absent existing state.

## Validated

- `pnpm exec tsc -p packages/mesh/tsconfig.json --noEmit`
- `pnpm exec vitest run packages/mesh/tests`
- `git diff --check -- packages/mesh/src/node.ts packages/mesh/src/transport/ws.ts`

## Blockers

- `pnpm --filter @dot-protocol/mesh test` exits before running tests because the workspace Vitest include pattern does not match mesh tests when the package script is run from the package root. The same mesh tests pass when invoked from the repo root.
- Full root `pnpm lint` still has unrelated existing failures outside `packages/mesh`.

## Boundaries

- No deploy, push, public posting, account operations, stream/key handling, external audit files, credential handling, or unrelated edits.
