# Hypatia Receipt: Core Crypto Strict-Null Test Repair

Date: 2026-06-13T22:52:04Z

## Claim

Repair the narrow TypeScript strict-null blocker in `packages/core/src/crypto/crypto.test.ts`.

## Changed

- Replaced three fixed-index byte XOR mutations with explicit assignments using non-null assertions.
- Preserved the existing tampered-message and tampered-signature test behavior.

## Validation

- `pnpm --filter @dot-protocol/core build` passed.
- `pnpm vitest run packages/core/src/crypto/crypto.test.ts --reporter=default` passed: 100 tests.
- `git diff --check` passed.

## Blockers

- Repo-wide `pnpm lint` still has broad pre-existing TypeScript failures outside this slice.

## Boundary

No deploy, push, account operations, public posting, stream/key handling, secrets, or unrelated files.
