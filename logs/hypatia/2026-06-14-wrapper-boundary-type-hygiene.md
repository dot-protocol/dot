# Hypatia Receipt: Wrapper Boundary Type Hygiene

Date: 2026-06-14

Claim: `msg-b5a9fc51-74c7-4121-814b-dbd6d2f99269`

Scope:
- Narrow repo-only TypeScript hygiene repair in `packages/wrapper`.
- Kept changes at runtime boundaries where strict DOM/WebCrypto types require clean `ArrayBuffer` ownership.

Changed:
- Converted forwarded bridge request bodies to fresh `ArrayBuffer` values before passing them to `fetch`.
- Added a local bridge startup event type shim for the current `net.Server` type surface.
- Converted identity sign/verify inputs to fresh `ArrayBuffer` values before WebCrypto calls.

Validation:
- `pnpm exec vitest run packages/wrapper/src/tests/bridge.test.ts packages/wrapper/src/tests/identity.test.ts --reporter=default` passed 2 files / 20 tests.
- `pnpm exec vitest run packages/wrapper/src/tests --reporter=default` passed 4 files / 75 tests.
- Root `pnpm lint` no longer reports `packages/wrapper/src/bridge.ts` or `packages/wrapper/src/identity.ts`.

Known blockers:
- Full root `pnpm lint` still fails on unrelated existing blockers: missing `tsdown` declarations, SDK workspace/export issues, wrapper compression module resolution in other files, and wrapper tsdown config.

Boundaries:
- No deploy, push, public posting, account operations, stream/key handling, secrets, external audit files, destructive git commands, or unrelated edits.
