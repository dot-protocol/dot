# Hypatia Receipt: Compression Train Dictionary Import

Date: 2026-06-14

## Changed

- `packages/compression/scripts/train-dictionary.ts` now imports only `gzipSync` from `node:zlib`.
- The script already imports SHA-256 hashing from `node:crypto` as `cryptoHash`, so the invalid `createHash` zlib import was removed.

## Validation

- `pnpm exec tsc --noEmit 2>&1 | rg 'packages/compression/scripts/train-dictionary|packages/compression/'` no longer reports `packages/compression/scripts/train-dictionary.ts`.
- Remaining filtered compression diagnostics are in `src/batch-v2.ts`, `src/rans.ts`, compression tests, and `tsdown.config.ts`.

## Blockers

- Repo-wide `pnpm lint` still fails on unrelated TypeScript diagnostics across compression and other packages.
- A one-file ad hoc TypeScript invocation with explicit `--types node` failed to resolve the local Node type package, so validation used the repo-level `tsc` path instead.

## Boundary

- Repo-only TypeScript import repair and local receipt.
- No deploy, push, public posting, account operations, stream/key handling, secrets, external audit files, or unrelated edits.
