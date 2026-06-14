# Hypatia Receipt: Sync Ephemeral BufferSource Hygiene

Date: 2026-06-14

Claim: `msg-20c2d9e6-9bf9-47b5-9947-3237fe265a14`

Scope:
- Narrow repo-only TypeScript hygiene repair in `packages/sync/src/ephemeral.ts`.
- Kept the public API on `Uint8Array` while passing clean `ArrayBuffer` copies into WebCrypto boundaries.

Changed:
- Added a local `toArrayBuffer()` helper.
- Used it for AES-GCM encrypt payload input, raw-key import input, and decrypt ciphertext input.

Validation:
- `pnpm exec vitest run packages/sync/tests/ephemeral.test.ts` passed 1 file / 26 tests.
- `pnpm exec vitest run packages/sync/tests` passed 4 files / 79 tests.
- `pnpm exec tsc --noEmit` filtered for `packages/sync` produced no matches.

Known blockers:
- Full root `pnpm lint` still fails on unrelated existing TypeScript blockers outside `packages/sync`, including missing `tsdown` declarations and QR/SDK/wrapper backlog.

Boundaries:
- No deploy, push, public posting, account operations, stream/key handling, secrets, external audit files, destructive git commands, or unrelated edits.
