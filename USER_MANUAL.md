# USER_MANUAL — dot-protocol/dot

## What it is

A TypeScript + Rust monorepo implementing the DOT Protocol: a system for creating cryptographically signed, append-only, verifiable observations (called DOTs). No server, no accounts — just a keypair and a chain.

## Install

```bash
npm install @dot-protocol/core      # kernel only
# or install any sub-package:
npm install @dot-protocol/chain     # Merkle DAG + storage
npm install @dot-protocol/chat      # group chat on DOT chains
```

```bash
# Run from source (requires pnpm):
git clone https://github.com/dot-protocol/dot
cd dot
pnpm install
pnpm test        # 4,099 TypeScript tests; 60 WASM-artifact-gated skips
cargo test       # 275 Rust tests
```

## API surface — @dot-protocol/core

All functions are named exports from `@dot-protocol/core`.

```ts
import { createIdentity, observe, sign, verify, chain, hash } from '@dot-protocol/core';

// 1. Create a keypair identity
const me = await createIdentity();
// -> { secretKey: Uint8Array, publicKey: Uint8Array, id: string }

// 2. Create an unsigned observation
const dot = observe('hello world', { type: 'claim' });
// type: 'measure' | 'state' | 'event' | 'claim' | 'bond'

// 3. Chain it to a parent (optional but recommended)
const chained = chain(dot /*, parentDot */);

// 4. Sign it
const signed = await sign(chained, me.secretKey);
// signed is a DOT — immutable, serialisable object

// 5. Verify (any holder can verify against the embedded pubkey)
const proof = await verify(signed);
// -> { valid: true } or { valid: false, reason: string }

// 6. Hash (BLAKE3, deterministic)
const h = await hash(signed);
// -> Uint8Array (32 bytes)
```

### Safe wrappers (never throw)

```ts
import { safeSign, safeVerify, safeDecode, safeHash } from '@dot-protocol/core';
const result = await safeVerify(dot);
// -> Result<VerifyResult, DOTError>  — use isOk(result) / unwrap(result)
```

## API surface — @dot-protocol/chain

```ts
import { createChain, append, walk, tip, verify_chain, health,
         SQLiteStorage, MemoryStorage } from '@dot-protocol/chain';

const store = new SQLiteStorage('./my.db');
const c = await createChain({ storage: store });
await append(c, signedDot);

// Walk all DOTs oldest→newest
for await (const dot of walk(c)) { ... }

// Health report
const report = await health(c);
// -> HealthReport { total, verified, verified_pct, valid, errors, storage_backend, append_count, observed_at }
```

### Chain health monitoring

`health(chain)` returns a `HealthReport` DOT (type `measure`) describing verification state. `checkAutoEmit()` auto-emits a health DOT every 100 appends into a per-chain meta chain.

```ts
import { health, getMetaChain } from '@dot-protocol/chain';
const report = await health(c);
console.log(report.valid, report.verified_pct); // true, 100

const meta = getMetaChain(c.id);
// Append-only chain of past health snapshots
```

## API surface — @dot-protocol/chat

```ts
import {
  createChatRoom, sendMessage, replyToThread, addReaction,
  editMessage, getMessages, getThread, getUnreadCount,
  setTyping, updatePresence, getOnlineMembers
} from '@dot-protocol/chat';
```

Every message is a signed DOT. The room chain IS the message history; wherever the chain is replicated, the chat exists.

## Packages table

| Package | npm name | Purpose |
|---------|----------|---------|
| **core** | `@dot-protocol/core` | observe / sign / verify / chain / hash — the kernel |
| **chain** | `@dot-protocol/chain` | Merkle DAG, CRDT merge, SQLite + memory storage |
| **lang** | `@dot-protocol/lang` | Lexer, parser, type checker, codegen (DOT compiles DOT) |
| **mesh** | `@dot-protocol/mesh` | P2P broadcast over WebSocket, gossip, content routing |
| **seal** | `@dot-protocol/seal` | Chain-depth trust scoring, X25519 encrypted channels |
| **sync** | `@dot-protocol/sync` | Multi-device replication, offline queue, ephemeral erasure |
| **chat** | `@dot-protocol/chat` | Group messaging: threads, reactions, presence |
| **room** | `@dot-protocol/room` | Everything is a `.room`; chain IS the room |
| **minds** | `@dot-protocol/minds` | AI minds grounded in primary sources |
| **signal** | `@dot-protocol/signal` | WebRTC signaling via DOT chain |
| **tree** | `@dot-protocol/tree` | Knowledge tree: observe → flow → connect |
| **mcp** | `@dot-protocol/mcp` | 11 MCP tools for Claude Code integration |
| **browser** | `@dot-protocol/browser` | WASM build, single HTML file, works offline |
| **bridge** | `@dot-protocol/bridge` | Converts v0.3.0 DOTs to current format |
| **selfhost** | `@dot-protocol/selfhost` | 7 `.dot` programs implementing the protocol in DOT |
| **mark** | `@dot-protocol/mark` | DOT-MARK → HTML with trust badges + phishing detection |
| **cli** | `@dot-protocol/cli` | `dot observe`, `dot check`, `dot compile`, `dot explain` |

Rust crates: `dot-core` (Rust kernel, 275 tests), `dot-wasm` (Ed25519 + BLAKE3, 211 KB, runs in any browser).

## Observe state / health

```ts
import { health, checkAutoEmit } from '@dot-protocol/chain';

// One-shot health report
const r = await health(myChain);
// r.valid           — boolean: chain integrity OK?
// r.total           — total DOTs in chain
// r.verified        — count that pass causal verification
// r.verified_pct    — percentage
// r.errors[]        — list of integrity errors
// r.append_count    — monotonic append counter
// r.observed_at     — ISO 8601 timestamp

// Auto-emit health DOT every 100 appends
checkAutoEmit(myChain); // call after each append
```

## Run tests

```bash
pnpm test        # all TypeScript (vitest, 4,099 passing tests; 60 WASM-artifact-gated skips)
cargo test       # all Rust (275 tests)
pnpm run build   # compile all packages
pnpm run lint    # TypeScript type check only
```

## DOT type schema

```ts
type ObservationType = 'measure' | 'state' | 'event' | 'claim' | 'bond';

interface DOT {
  id: string;           // BLAKE3 hash of canonical payload
  observer: string;     // public key hex
  type: ObservationType;
  content: string;
  timestamp: string;    // ISO 8601
  signature?: string;   // Ed25519 hex (absent on unsigned DOTs)
  parent?: string;      // parent DOT id (chain link)
  // ... additional payload fields depending on type
}
```

## Bridge (v0.3.0 → current)

```ts
import { bridgeDot, batchBridge, readLegacy, verifyLegacy } from '@dot-protocol/bridge';

const current = await bridgeDot(legacyDot);
const batch = await batchBridge([dot1, dot2, dot3]);
const legacy = await readLegacy('./old-chain.jsonl');
const ok = await verifyLegacy(legacyDot); // cross-verify Ed25519
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `verify()` returns `{ valid: false }` | Signature mismatch or tampered content | Use `safeVerify()` and check `result.reason`; ensure you're signing the canonical form |
| `append()` throws on chain | DAG integrity check failed | Run `verify_chain(chain)` to find the first broken link |
| WASM not loading in browser | WASM module not initialised | Call the init export from `@dot-protocol/browser` before any crypto calls |
| `createIdentity()` hangs | libsodium not seeded | Ensure `sodium-init` has resolved; in Node it is automatic, in browser await the WASM loader |
| SQLiteStorage "database locked" | Multiple writers on same file | Use one SQLiteStorage instance per file; use MemoryStorage for tests |
| pnpm install fails | Wrong Node version | Requires Node 20+; check `node --version` |
