# Hypatia Receipt: QR Legacy DOT Type Hygiene

Date: 2026-06-14

Claim: `msg-61778905-54d4-4698-8b1f-bfad769789ea`

Scope:
- Narrow repo-only TypeScript hygiene repair in `packages/qr`.
- Kept QR binary, nested, steganographic, and physical decode result types aligned with fixed-size legacy DOT encoding.

Changed:
- Typed QR encode/decode/verify surfaces as `LegacyDOT` where the code depends on 153-byte legacy serialization.
- Added strict indexed-access guards for DOT arrays, nested indexes, and steganographic byte reads.
- Updated QR encode tests to avoid unsafe destructuring and undefined array access.

Validation:
- `pnpm --filter @dotprotocol/qr typecheck` passed.
- `pnpm vitest run packages/qr/src/tests/encode.test.ts` passed 1 file / 12 tests.
- Root `pnpm lint` no longer reports `packages/qr` errors.

Known blockers:
- Full root `pnpm lint` still fails on unrelated existing TypeScript blockers outside `packages/qr`, including missing `tsdown` declarations, SDK export/module resolution issues, and wrapper type hygiene.
- `pnpm --filter @dotprotocol/qr test` finds no tests because the shared Vitest include pattern is root-relative when invoked from the package directory; the root-level targeted QR test command above was used instead.

Boundaries:
- No deploy, push, public posting, account operations, stream/key handling, secrets, external audit files, destructive git commands, or unrelated edits.
