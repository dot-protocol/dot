# Hypatia Receipt: Compression rANS and Weissman Type Hygiene

Date: 2026-06-14T03:19:41Z
Repo: `/opt/kin`
Branch: `vps-hypatia`

## Changed

- `packages/compression/src/rans.ts` now makes strict indexed-array assumptions explicit when counting bytes and adjusting normalized frequencies.
- `packages/compression/src/batch-v2.ts` keeps the reconstructed chain-hash cursor typed as generic `Uint8Array`, matching the local SHA-256 helper return type.
- `packages/compression/src/tests/batch-v2.test.ts` now mutates the tamper byte with an explicit non-null indexed access.
- `packages/compression/src/tests/weissman.test.ts` now marks static preset fixture lookups as present under `noUncheckedIndexedAccess`.

## Validation

- `pnpm --filter @dotprotocol/compression exec tsc -p tsconfig.json --noEmit` passed.
- `pnpm vitest run packages/compression/src/tests/rans.test.ts packages/compression/src/tests/batch-v2.test.ts packages/compression/src/tests/weissman.test.ts --reporter=default` passed: 3 files, 31 tests.
- `git diff --check -- packages/compression/src/rans.ts packages/compression/src/batch-v2.ts packages/compression/src/tests/batch-v2.test.ts packages/compression/src/tests/weissman.test.ts` passed.
- Added-line sensitive-shape scan found no matches.

## Remaining Blockers

- Root `pnpm lint` still fails on pre-existing issues outside this slice. The first remaining compression diagnostic is `packages/compression/tsdown.config.ts` missing the `tsdown` module/type declaration, followed by unrelated strictness and package-alias issues in core, fs, identity, mark, mcp, mesh, qr, sdk, signal, sync, tree, and wrapper.

## Boundaries

No deploy, push, public posting, account operations, stream/key handling, secret handling, external audit files, or unrelated edits.
