# Hypatia Receipt: Core Large-Payload Timeout

Timestamp: 2026-06-14T10:07:51Z

Claim:
- Dotpost and Oracle were reachable.
- Full test validation showed browser WASM tests blocked by missing generated `packages/wasm/pkg` artifacts, plus one core 1MB payload test timing out at Vitest's default 5s limit.

Changed:
- `packages/core/src/__tests__/core.test.ts` now gives `observe with very large payload (1MB)` an explicit 15s timeout.

Validated:
- `pnpm vitest run packages/core/src/__tests__/core.test.ts` -> 190 passed.
- `pnpm lint` -> PASS.

Remaining blocker:
- `pnpm test` still requires generated WASM package artifacts before browser WASM tests can pass.

Boundary:
- Test metadata and receipt only.
- No WASM generation, public posting, account operation, stream action, launch claim, or secret handling.
