# Hypatia Receipt: seal TypeScript config and sodium type hygiene

Date: 2026-06-14
Branch: vps-hypatia

## Changed

- Updated `packages/seal/tsconfig.json` so seal typecheck can include its tests and the existing relative core sodium helper import without `rootDir` aborts.
- Extended the local `libsodium-wrappers-sumo` facade type in `packages/core/src/crypto/sodium-init.ts` with the sodium APIs already used by seal.
- Made three seal tamper-test byte mutations explicit under `noUncheckedIndexedAccess`.

## Validation

- `pnpm --filter @dot-protocol/seal exec tsc -p tsconfig.json --noEmit` passed.
- `pnpm vitest run packages/seal/tests --reporter=default` passed: 5 files, 120 tests.
- `pnpm --filter @dot-protocol/core build` passed.

## Notes

- The package-local command `pnpm --filter @dot-protocol/seal test -- --reporter=default` still does not discover tests from the package working directory because the root Vitest include pattern is workspace-relative. Running Vitest from the repo root with `packages/seal/tests` is the working focused invocation.
- Boundary: repo-only config/type/test hygiene. No deploy, push, account operation, public posting, stream/key handling, credentials, or unrelated files.
