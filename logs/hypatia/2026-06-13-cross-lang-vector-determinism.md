# Hypatia Receipt: Cross-Language Vector Determinism

Time: 2026-06-13T20:05Z

Changed:
- `packages/core/tests/cross-lang.test.ts` now derives extended crypto vector keys from stable per-vector seeds.
- The extended vector fixture timestamp is fixed, and fixture rewriting is opt-in with `UPDATE_EXTENDED_CRYPTO_VECTORS=1`.
- `test-vectors/core/extended-crypto.json` was refreshed once from the deterministic generator.

Validation:
- `UPDATE_EXTENDED_CRYPTO_VECTORS=1 pnpm vitest run packages/core/tests/cross-lang.test.ts --reporter=basic` passed: 38 tests.
- `pnpm vitest run packages/core/tests/cross-lang.test.ts --reporter=default` passed: 38 tests.
- Two normal test reruns produced identical `test-vectors/core/extended-crypto.json` SHA-256: `1bdc6a40bdd5345767f3f8e02af1452d8e84f9df4f79eabc251f9f07855c7914`.
- `git diff --check` passed.

Blocked:
- `pnpm --filter @dot-protocol/core build` still fails on pre-existing strict-null errors in `src/crypto/crypto.test.ts` lines 233, 242, and 251.

Boundary:
- Repo-local test fixture determinism only. No remotes, deploy, account operations, public posting, stream/key handling, or unrelated file edits.
