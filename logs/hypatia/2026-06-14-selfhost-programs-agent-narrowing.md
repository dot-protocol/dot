# Hypatia Receipt: selfhost programs agent narrowing

Date: 2026-06-14

Claim: `msg-85bb3168-79db-4394-bf47-6e1391cdef56`

Changed:
- Replaced a stale `@ts-expect-error` in `packages/selfhost/tests/programs.test.ts` with an explicit AgentStatement narrowing branch before asserting the parsed lexer agent name.

Validated:
- `pnpm exec vitest run packages/selfhost/tests/programs.test.ts --reporter=default` passed 37 tests.
- Root lint filtered for `packages/selfhost/tests/programs.test.ts` / unused `@ts-expect-error` produced no matches.
- `git diff --check` passed.

Blockers:
- Full root `pnpm lint` still fails on unrelated existing blockers in other packages.

Boundaries:
- No deploy, push, public posting, account operations, stream/key handling, secrets, external audit files, or unrelated edits.
