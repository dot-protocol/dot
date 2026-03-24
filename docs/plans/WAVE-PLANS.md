# R854 Wave Execution Plans — All Waves

**Generated:** March 24, 2026
**Status:** Wave 1 EXECUTING, Waves 2-6 PLANNED

---

## WAVE 1: FOUNDATION CORE (Weeks 1-2) — EXECUTING

### Agents Active

| Agent | Focus | Branch | Tests | Status |
|-------|-------|--------|-------|--------|
| Agent 1 | Crypto (BLAKE3 + Ed25519 + libsodium + metrics) | worktree | 60+ | BUILDING |
| Agent 2 | DOT Types + observe/sign/verify/chain/encode/trust | worktree | 190+ | BUILDING |
| Agent 3 | Rust mirror (dot-core crate) | worktree | 200+ | BUILDING |

### Merge Order
1. Agent 1 (crypto) → main
2. Agent 2 (types+core) → main (depends on crypto)
3. Agent 3 (rust) → main (independent, just needs Cargo.toml)

### Gate Criteria
- [ ] All TypeScript tests green
- [ ] All Rust tests green
- [ ] Cross-language test vectors match (crypto.json, dot-roundtrip.json)
- [ ] sign < 1ms, verify < 0.5ms, hash(1KB) < 0.01ms
- [ ] Empty DOT {} is valid at every layer
- [ ] FHE mode flag works (actual encryption in Wave 2)

---

## WAVE 2: CHAIN + FS + BRIDGE (Weeks 3-4)

### Prerequisites
- Wave 1 merged and green
- Core API stable: observe, sign, verify, chain, hash, encode, trust

### Agent Deployment — 5 parallel agents

#### Agent 4: Chain Operations (TypeScript)
**Package:** `packages/chain/`

```
FILES:
├── src/dag.ts              — Merkle DAG: append, walk, verify_chain, root, tip
├── src/crdt.ts             — CRDT merge: detect_fork, merge, resolve_conflict
├── src/query.ts            — Query: by_hash, by_depth_range, by_time_range, by_type, by_observer
├── src/storage/interface.ts — StorageBackend interface
├── src/storage/memory.ts   — In-memory (Map-based, for tests)
├── src/storage/sqlite.ts   — SQLite via better-sqlite3
├── src/health.ts           — Chain health DOT: depth, integrity %, last verified, storage status
├── src/index.ts
├── tests/dag.test.ts       — 50+ (append, walk, depth, integrity, genesis, 1000-DOT chain)
├── tests/crdt.test.ts      — 40+ (fork detect, merge 2 chains, concurrent append, conflict resolution)
├── tests/query.test.ts     — 20+ (by hash, time range, type filter, observer filter)
├── tests/storage.test.ts   — 20+ per backend (memory + sqlite)
└── tests/self-aware.test.ts — 15+ (health DOT chain, integrity self-check)
```

**Key behaviors:**
- append() is O(1) — hash previous, link, store
- walk() returns DOTs from hash A to hash B (or tip)
- verify_chain() walks entire chain, verifies every hash link + every signature
- CRDT merge: if two chains share a common ancestor, merge creates a DAG (not linear chain)
- Storage interface: get(hash), put(dot), has(hash), list(options), count()
- Health chain runs parallel: every 100 appends, emit health DOT

**Tests:** 145+

#### Agent 5: Chain Operations (Rust)
**Package:** `rust/dot-chain/`

Mirror of Agent 4 in Rust. Same DAG, CRDT, query, storage interface.
Uses same cross-language test vectors.

```
rust/dot-chain/
├── src/lib.rs
├── src/dag.rs
├── src/crdt.rs
├── src/query.rs
├── src/storage/mod.rs
├── src/storage/memory.rs
├── src/health.rs
├── tests/
└── Cargo.toml
```

**Tests:** 100+

#### Agent 6: DOT-FS (TypeScript)
**Package:** `packages/fs/`

```
FILES:
├── src/dotfs.ts            — DotFS class: write, read, history, verify, list, stat
├── src/backends/interface.ts — FSBackend interface
├── src/backends/node.ts    — Node.js fs module (works on NTFS/APFS/ext4)
├── src/backends/memory.ts  — In-memory for tests
├── src/backends/browser.ts — IndexedDB/OPFS (stub, full impl in Wave 5)
├── src/sidecar.ts          — .dot sidecar file: stores DOT chain per file
├── src/integrity.ts        — Auto-verify on read, corruption detection
├── src/query.ts            — Query files by: observer, time range, chain depth, type
├── src/health.ts           — FS health DOT: total files, chain depths, verification rate
├── src/index.ts
├── tests/write.test.ts     — 40+ (create, overwrite, binary, large file, concurrent writes)
├── tests/read.test.ts      — 30+ (verify on read, corrupted payload, missing sidecar, binary)
├── tests/history.test.ts   — 25+ (walk versions, depth limit, branching files)
├── tests/integrity.test.ts — 20+ (tamper detection, hash mismatch, recovery)
├── tests/backend.test.ts   — 20+ per backend
└── tests/self-aware.test.ts — 15+ (FS health chain, auto-repair tracking)
```

**Key behaviors:**
- write(path, content) → creates file + DOT sidecar, returns the DOT
- read(path) → returns { content, dot, verified: boolean }
- history(path, depth?) → walk chain of all writes to this file
- verify(path) → full integrity check (content hash vs sidecar chain)
- Sidecar format: `.filename.dot` adjacent file containing the DOT chain for that file
- Every read auto-verifies by default (can disable for performance)
- Corrupted files emit event DOTs with exact corruption location

**Tests:** 150+

#### Agent 7: DOT-FS Integration Tests
**Package:** `packages/fs/` (separate test file)

```
FILES:
├── tests/integration/cross-backend.test.ts  — Write on Node, read metadata matches memory
├── tests/integration/concurrent.test.ts     — 10 concurrent writers to same file
├── tests/integration/large-chain.test.ts    — File with 1000+ versions
├── tests/integration/corruption.test.ts     — Manually corrupt file, verify detection
└── tests/integration/perf.test.ts           — write < 5ms, read+verify < 2ms
```

**Tests:** 30+

#### Agent 8: Bridge (v0.3.0 → R854)
**Package:** `packages/bridge/`

```
FILES:
├── src/reader.ts           — Read 153-byte v0.3.0 DOTs (SHA-256 hashes, @noble/ed25519 signatures)
├── src/converter.ts        — v0.3.0 DOT → R854 DOT (re-hash BLAKE3, map fields, preserve Ed25519 sig)
├── src/bridge-dot.ts       — Create Bridge DOT: bond observation linking v0.3.0 chain X → R854 chain Y
├── src/verify-legacy.ts    — Verify v0.3.0 DOTs using their original SHA-256 + @noble/ed25519
├── src/batch.ts            — Convert entire v0.3.0 chain in one pass, emit progress DOTs
├── src/index.ts
├── tests/reader.test.ts    — 30+ (read all v0.3.0 DOT types, PUBLIC/CIRCLE/PRIVATE/EPHEMERAL)
├── tests/converter.test.ts — 30+ (convert, verify R854 output, roundtrip, field mapping)
├── tests/bridge.test.ts    — 20+ (bridge DOT creation, chain continuity proof)
├── tests/batch.test.ts     — 10+ (convert 100+ DOTs, progress tracking)
└── tests/cross-gen.test.ts — 10+ (sign v0.3.0, bridge, verify in R854 — unbroken chain)
```

**Key behaviors:**
- reader: parse 153-byte format (pubkey[32] + sig[64] + chain[32] + ts[8] + type[1] + payload[16])
- converter: map v0.3.0 fields to R854 fields, re-hash chain links from SHA-256 to BLAKE3
- Ed25519 signatures are PRESERVED (same algorithm, just different library)
- Bridge DOT is a `bond` type observation linking two chain roots
- batch: convert entire chain with progress (% complete, errors, skipped)
- Must import @noble/ed25519 as devDependency for v0.3.0 verification

**Dependencies:** @noble/ed25519 (devDep only, for legacy verification)

**Tests:** 100+

### Wave 2 Gate Criteria
- [ ] Chain: 1000-DOT chain appends in < 500ms
- [ ] Chain: CRDT merge of 2 divergent chains produces valid DAG
- [ ] FS: write → read → verify roundtrip works on Node.js
- [ ] FS: corrupted file detected on read
- [ ] Bridge: 100 real v0.3.0 DOTs converted and verified in R854
- [ ] Bridge DOT created and verifiable
- [ ] Cross-language: Rust chain and TS chain produce same hashes for same DOTs
- [ ] All self-awareness health DOTs emit correctly

### Wave 2 Test Total: 525+

---

## WAVE 3: THE LANGUAGE (Weeks 5-8)

### Prerequisites
- Waves 1+2 merged and green
- Core + Chain + FS + Bridge all stable

### Agent Deployment — 4 parallel agents

#### Agent 9: Lexer + Parser
**Package:** `packages/lang/`

```
FILES:
├── src/lexer/tokenizer.ts  — Hand-written tokenizer (NO regexps for keywords)
├── src/lexer/tokens.ts     — Token types: OBSERVE, MEASURE, STATE, EVENT, CLAIM, BOND, GATE, PULSE, CHAIN, MESH, BLOOM, FADE, FORGE, AGENT, EVERY, AT, PLAIN, IF, WHEN, THEN, TO, AFTER, DOT, COLON, LBRACE, RBRACE, LPAREN, RPAREN, COMMA, NUMBER, STRING, IDENTIFIER, NEWLINE, EOF
├── src/parser/parser.ts    — Recursive descent → AST
├── src/parser/ast.ts       — AST node types (all carry source location: line, column, offset)
├── src/parser/errors.ts    — Error recovery + helpful messages (show source, highlight error, suggest fix)
├── src/index.ts
├── tests/lexer.test.ts     — 70+ (all token types, whitespace, comments, Unicode identifiers, edge cases, error recovery)
├── tests/parser.test.ts    — 80+ (every syntax form from R854 directive)
└── tests/errors.test.ts    — 20+ (every error type produces helpful message)
```

**DOT Syntax to parse (from R854 directive):**
```dot
observe temperature at sensor_7
observe measure: temperature at sensor_7 = 82.3 C
  .gate(temperature > 80)
  .pulse(alert: "overheating")
  .chain(previous: last_observation_from(sensor_7))
  .mesh(to: [maintenance, dashboard])
  .bloom(when: 3 consecutive > 80, then: escalate)
  .fade(after: 24 hours, to: archive)
  .forge(action: shutdown(reactor_3))

agent gem_scanner {
  every 5 seconds {
    observe measure: token.price at dexpaprika(chain: "all")
      .gate(token.volume > 1000)
      .bloom(when: gem_score > 85, then: flag)
  }
}

observe bond: sensor_7 is_part_of reactor_3
observe plain: "this is public"
```

**AST structure:**
- Program → Statement[]
- Statement → ObserveStatement | AgentStatement | BlockStatement
- ObserveStatement → type?, identifier, location?, value?, FunctionChain[]
- FunctionChain → .gate() | .pulse() | .chain() | .mesh() | .bloom() | .fade() | .forge()
- AgentStatement → name, body (with `every` scheduler)
- Expression → BinaryExpr | UnaryExpr | Literal | Identifier | FunctionCall | MemberAccess

**Tests:** 170+

#### Agent 10: Type Checker + Semantic Analysis
**Package:** `packages/lang/` (continues from Agent 9's AST)

```
FILES:
├── src/checker/checker.ts      — Type inference, validate function chains
├── src/checker/scope.ts        — Scope management (global, block, agent, function chain)
├── src/checker/types.ts        — The 5 observation types as compiler types + function signatures
├── src/checker/constraints.ts  — Validate: gate conditions are boolean, mesh targets are lists, bloom has threshold, fade has duration, forge has action
├── src/checker/errors.ts       — Semantic error messages
├── tests/checker.test.ts       — 50+ (type inference, invalid chains, missing targets)
├── tests/scope.test.ts         — 15+ (nested blocks, agent scope, bond references)
└── tests/constraints.test.ts   — 15+ (invalid gate condition, mesh without targets, bloom without threshold)
```

**Key rules:**
- observe must have at most one type (measure/state/event/claim/bond)
- .gate() condition must evaluate to boolean
- .mesh(to: [...]) must be a list of identifiers
- .bloom(when: ..., then: ...) must have both clauses
- .fade(after: ...) must have a duration expression
- .forge(action: ...) must reference a callable
- agent blocks must have `every` with a duration
- bonds reference existing observers or identifiers

**Tests:** 80+

#### Agent 11: Code Generators
**Package:** `packages/lang/` (continues from Agent 9+10)

```
FILES:
├── src/codegen/typescript.ts   — AST → TypeScript that imports @dot-protocol/core
├── src/codegen/english.ts      — AST → readable English explanation
├── src/codegen/rust.ts         — AST → Rust that imports dot-core (stub, basic)
├── src/codegen/common.ts       — Shared codegen utilities (indentation, identifier mapping)
├── src/repl.ts                 — `dot run file.dot`: parse → check → generate TS → execute with tsx
├── src/cli.ts                  — CLI: dot run, dot check, dot explain, dot compile
├── tests/codegen-ts.test.ts    — 50+ (all constructs → valid TS → can be type-checked)
├── tests/codegen-en.test.ts    — 20+ (every program → readable English)
├── tests/roundtrip.test.ts     — 30+ (DOT → TS → execute → produces DOTs → verify chain)
└── tests/cli.test.ts           — 20+ (dot run, dot check, dot explain)
```

**TypeScript output example:**
```typescript
// Input: observe measure: temperature at sensor_7 = 82.3
//          .gate(temperature > 80)
//          .pulse(alert: "overheating")

import { observe, sign, chain } from '@dot-protocol/core';

const dot = observe({ temperature: 82.3 }, { type: 'measure' });
if (dot.payload && decode(dot.payload).temperature > 80) {
  // gate passed
  const alertDot = observe('overheating', { type: 'event' });
  mesh.broadcast(alertDot, ['maintenance', 'dashboard']);
}
```

**English output example:**
```
Observe the temperature at sensor 7 (82.3°C).
If the temperature exceeds 80°C, send an alert labeled "overheating"
to the maintenance team and dashboard.
```

**Tests:** 120+

#### Agent 12: LM Compiler (English ↔ DOT)
**Package:** `packages/lm-compiler/`

```
FILES:
├── src/compile.ts          — English → DOT source code (via Claude API)
├── src/explain.ts          — DOT source → English explanation (via Claude API or local codegen)
├── src/prompts/system.ts   — System prompt: full DOT language spec + 20 few-shot examples
├── src/prompts/examples.ts — Categorized examples: measure, state, event, claim, bond, agent, chain
├── src/validate.ts         — LLM output → parse with @dot-protocol/lang → retry if invalid (max 3 retries)
├── src/stream.ts           — Streaming compilation (SSE/stream from Claude API)
├── src/config.ts           — API config: Anthropic (primary), OpenAI-compat (fallback)
├── src/index.ts
├── tests/compile.test.ts   — 50+ (English → valid DOT for all observation types + agents)
├── tests/explain.test.ts   — 30+ (DOT programs → readable English)
├── tests/roundtrip.test.ts — 20+ (English → DOT → English, semantic preservation check)
└── tests/validate.test.ts  — 10+ (invalid LLM output triggers retry, eventually succeeds)
```

**System prompt structure:**
```
You are the DOT Language Compiler.

DOT has four bases (STCV): Sign, Time, Chain, Verify.
DOT has seven functions: gate, pulse, chain, mesh, bloom, fade, forge.
DOT has five observation types: measure, state, event, claim, bond.

[20 few-shot examples covering every construct]

Convert the following English to DOT source code.
Output ONLY valid DOT syntax. No markdown. No explanation.
```

**Tests:** 110+

### Wave 3 Gate Criteria
- [ ] `echo "observe temperature at sensor_7" | dot check` → no errors
- [ ] `echo "observe temperature at sensor_7" | dot run` → produces valid DOT
- [ ] `echo "observe temperature at sensor_7" | dot explain` → readable English
- [ ] Full R854 directive example programs parse + check + compile
- [ ] English → DOT → English roundtrip preserves meaning
- [ ] Agent blocks with `every` scheduler compile to working TS
- [ ] All 7 functions (.gate through .forge) compile correctly

### Wave 3 Test Total: 480+

---

## WAVE 4: THE NETWORK (Weeks 9-12)

### Prerequisites
- Waves 1-3 merged and green
- Core + Chain + FS + Bridge + Lang + LM-Compiler all stable

### Agent Deployment — 4 parallel agents

#### Agent 13: Trust Assessment + DOT-SEAL Handshake
**Package:** `packages/seal/`

```
FILES:
├── src/trust.ts            — assess_trust(identity): query chain for depth, consistency, attestations
├── src/handshake.ts        — DOT-SEAL handshake: mutual identity verification via chain depth exchange
├── src/quantum.ts          — ML-KEM key exchange (via liboqs bindings or pure JS impl)
├── src/fallback.ts         — Legacy TLS handshake fallback for non-DOT peers
├── src/trust-cache.ts      — Cache trust scores with TTL, invalidate on new DOTs
├── src/index.ts
├── tests/trust.test.ts     — 40+ (new=0 trust, deep chain=high, contradictions reduce, consistency)
├── tests/handshake.test.ts — 40+ (mutual auth, replay attack, MITM, timeout, reconnect)
├── tests/quantum.test.ts   — 20+ (ML-KEM exchange, hybrid classical+quantum, key sizes)
└── tests/fallback.test.ts  — 10+ (TLS fallback triggers when peer doesn't speak DOT-SEAL)
```

**Trust computation inputs:**
- chain_depth: how many DOTs has this identity signed (query chain package)
- consistency: has the identity ever contradicted itself (conflicting claims)
- peer_attestations: how many OTHER identities reference this one in their chains
- time_active: first DOT timestamp → now
- computed_trust: weighted combination with Correction #47 formula from R854.1

**DOT-SEAL handshake:**
1. Initiator sends: identity DOT (latest from their chain)
2. Responder sends: identity DOT (latest from their chain)
3. Both compute trust score of the other
4. If trust > threshold (configurable): exchange FHE evaluation keys
5. If trust < threshold: proceed with warning (never reject — Correction #47 spirit)
6. Establish AES-256-GCM session key via X25519 key exchange
7. All subsequent DOTs are transport-encrypted on top of FHE payload encryption

**Tests:** 110+

#### Agent 14: Secure Channel + Session Management
**Package:** `packages/seal/` (continues)

```
FILES:
├── src/channel.ts          — Encrypted channel: AES-256-GCM after handshake
├── src/session.ts          — Session as DOT chain: start, message, heartbeat, end
├── src/keys.ts             — Session key derivation, rotation (every N messages or T seconds)
├── src/forward-secrecy.ts  — Ratchet: derive new keys from previous, delete old
├── tests/channel.test.ts   — 30+ (encrypt/decrypt, key rotation, tampering detection)
├── tests/session.test.ts   — 30+ (start/end DOTs, heartbeat, interruption recovery, timeout)
└── tests/forward.test.ts   — 10+ (ratchet advances, old keys deleted, can't decrypt old messages)
```

**Tests:** 70+

#### Agent 15: Mesh Node + Routing
**Package:** `packages/mesh/`

```
FILES:
├── src/node.ts             — MeshNode: join, leave, peer discovery (mDNS + bootstrap peers)
├── src/routing.ts          — Content-addressed: request DOT by hash from mesh
├── src/broadcast.ts        — Fan-out with dedup (bloom filter for seen hashes)
├── src/gossip.ts           — Gossip protocol: each node shares random subset of known DOTs
├── src/transport/interface.ts — Transport interface
├── src/transport/ws.ts     — WebSocket transport (Node.js + browser)
├── src/transport/webrtc.ts — WebRTC transport (browser-to-browser)
├── src/transport/memory.ts — In-process transport (for tests)
├── src/index.ts
├── tests/node.test.ts      — 40+ (join, leave, reconnect, partition, discovery)
├── tests/routing.test.ts   — 30+ (request by hash, not-found propagation, caching, stale)
├── tests/broadcast.test.ts — 25+ (fan-out reaches all peers, dedup prevents loops, partition tolerance)
├── tests/gossip.test.ts    — 15+ (convergence, partial knowledge, anti-entropy)
└── tests/transport.test.ts — 20+ per transport (ws + memory at minimum)
```

**Key behaviors:**
- Node maintains peer table: { publicKey, transport, lastSeen, trustScore }
- Request(hash): ask peers, forward if not found locally, cache result
- Broadcast(dot): fan-out to all peers, each peer deduplicates
- Gossip: periodically share random DOT hashes with random peers → they request missing ones
- All messages between peers are DOT-SEAL encrypted channels

**Tests:** 130+

#### Agent 16: Mesh Health + Self-Observation
**Package:** `packages/mesh/` (continues)

```
FILES:
├── src/health.ts           — MeshHealth: peer count, latency map, partition detection
├── src/monitor.ts          — Continuous self-observation: every 10s emit mesh health DOT
├── src/anomaly.ts          — Detect: sudden peer loss, latency spike, hash request failure rate
├── tests/health.test.ts    — 20+ (healthy, degraded, partitioned, recovery scenarios)
├── tests/monitor.test.ts   — 10+ (health DOT chain forms correctly, interval respects)
└── tests/anomaly.test.ts   — 10+ (peer loss detected, latency spike flagged, failure rate alert)
```

**Self-awareness:**
- health DOT emitted every 10 seconds to mesh_health chain
- Contains: peer_count, avg_latency_ms, max_latency_ms, partition_detected, requests_served, requests_failed
- Anomaly detection runs on the health chain itself — looks for degradation patterns
- Emits event DOTs when anomaly detected

**Tests:** 40+

### Wave 4 Gate Criteria
- [ ] Two nodes can complete DOT-SEAL handshake in < 50ms
- [ ] Handshake produces trust scores for both sides
- [ ] DOTs transmitted over encrypted channel are verified at both ends
- [ ] Mesh of 5 nodes: broadcast reaches all within 500ms
- [ ] Content-addressed request finds DOT within 200ms on 5-node mesh
- [ ] Partition of 2+3 nodes detected, DOTs merge on reconnect
- [ ] Health DOT chain forms correctly with 10s intervals
- [ ] Forward secrecy: old session keys cannot decrypt new messages

### Wave 4 Test Total: 350+

---

## WAVE 5: THE INTERFACE (Weeks 13-16)

### Prerequisites
- Waves 1-4 merged and green
- Full stack: Core + Chain + FS + Bridge + Lang + LM + Seal + Mesh

### Agent Deployment — 3 parallel agents

#### Agent 17: DOT-MARK Parser + Compiler
**Package:** `packages/mark/`

```
FILES:
├── src/parser.ts           — DOT-MARK syntax → AST (extends lang parser with rendering constructs)
├── src/compiler.ts         — AST → HTML+CSS (inline styles, no framework)
├── src/trust-ui.ts         — Trust indicator renderer: chain depth → visual bar/badge
├── src/phishing.ts         — Zero-depth identity detection + warning injection
├── src/sanitizer.ts        — XSS prevention: DOT-MARK output is sanitized HTML
├── src/index.ts
├── tests/parser.test.ts    — 50+ (DOT-MARK elements, nesting, attributes, trust directives)
├── tests/compiler.test.ts  — 40+ (output is valid HTML, styles correct, responsive)
├── tests/trust.test.ts     — 15+ (trust badges render, chain depth shown, zero-depth warned)
├── tests/phishing.test.ts  — 10+ (fake identity flagged, missing chain warned, impersonation caught)
└── tests/sanitizer.test.ts — 15+ (script injection blocked, event handlers stripped, safe output)
```

**DOT-MARK syntax:**
```dotmark
page "Sensor Dashboard" {
  observe measure: temperature at sensor_7
    render {
      display: gauge
      range: [0, 100]
      unit: "°C"
      trust: show            // Shows chain depth badge
    }

  observe state: reactor_status
    render {
      display: status-badge
      colors: { active: green, shutdown: red }
    }
}
```

**Tests:** 130+

#### Agent 18: DOT-MARK Components + Interactivity
**Package:** `packages/mark/` (continues)

```
FILES:
├── src/components/observation.ts  — Render a single DOT observation (type-aware display)
├── src/components/chain-viewer.ts — Interactive chain visualization (depth, links, timestamps)
├── src/components/trust-badge.ts  — Trust score badge (color-coded: red/yellow/green/gold)
├── src/components/mesh-status.ts  — Live mesh health display
├── src/components/identity.ts     — Observer identity card (public key, chain depth, trust score)
├── src/components/feed.ts         — Live DOT feed (scrolling observations)
├── tests/components.test.ts       — 30+ (each component renders correctly for all DOT levels)
└── tests/interactive.test.ts      — 10+ (click events, expand/collapse, filter)
```

**Tests:** 40+

#### Agent 19: DOT-SCRIPT Browser Runtime
**Package:** `packages/script/`

```
FILES:
├── src/runtime.ts          — DOT runtime initialization: load identity, connect mesh, init FHE keys
├── src/dom.ts              — DOM integration: DOT-aware event handling (every click = observation)
├── src/state.ts            — State management via DOT chains (replaces React useState/Redux)
├── src/fetch.ts            — DOT-native fetch: request → receive DOTs, verify, decrypt for display
├── src/render.ts           — Render DOT-MARK in the browser (dynamic, reactive)
├── src/fhe-client.ts       — Browser-side FHE: decrypt DOTs for display, encrypt user input
├── src/bundle/entry.ts     — Bundle entry point (target: <50KB)
├── src/index.ts
├── tests/runtime.test.ts   — 30+ (init, identity load, mesh connect, shutdown)
├── tests/dom.test.ts       — 20+ (event observation, click tracking, form input as DOTs)
├── tests/state.test.ts     — 20+ (state as chain, subscribe to changes, undo = walk chain back)
├── tests/fetch.test.ts     — 10+ (request DOT by hash, verify response, decrypt for display)
└── tests/bundle.test.ts    — 10+ (bundle size < 50KB, no unused code, tree-shaking works)
```

**Key behaviors:**
- Runtime boots in <100ms: generate or load identity, connect to mesh, init FHE client keys
- Every user interaction (click, type, scroll) CAN be observed as a DOT (opt-in per element)
- State is a DOT chain: "undo" = walk back one link, "redo" = walk forward
- Fetch returns verified DOTs: if verification fails, component shows trust warning
- FHE client: decrypt server-sent DOTs for display, encrypt user input before sending
- Bundle target: <50KB including WASM for crypto (aggressive tree-shaking required)

**Tests:** 90+

### Wave 5 Gate Criteria
- [ ] DOT-MARK page renders in browser from DOT-MARK source
- [ ] Trust badges show correctly for all chain depths
- [ ] Zero-depth identity produces phishing warning
- [ ] DOT-SCRIPT runtime boots in <100ms
- [ ] State management via chains: create state, update, undo, redo
- [ ] FHE decrypt-for-display works in browser
- [ ] Bundle size < 50KB
- [ ] Full pipeline: DOT-MARK source → compile → render in browser → interact → DOTs produced

### Wave 5 Test Total: 260+

---

## WAVE 6: SELF-HOSTING + APPLICATIONS (Weeks 17+)

### Prerequisites
- ALL previous waves merged and green
- Full DOT stack: Core + Chain + FS + Bridge + Lang + LM + Seal + Mesh + Mark + Script

### Agent Deployment — 4 parallel agents

#### Agent 20: DOT Compiler Self-Hosting
**Package:** `packages/lang/` (rewrite)

```
TASK:
1. Take the existing TypeScript compiler (lang package)
2. Rewrite it AS a DOT program
3. The DOT program, when compiled to TypeScript and executed, produces identical output to the original
4. This is the self-hosting milestone: DOT compiles DOT

FILES:
├── src/self-host/lexer.dot      — Lexer rewritten in DOT language
├── src/self-host/parser.dot     — Parser rewritten in DOT language
├── src/self-host/checker.dot    — Type checker rewritten in DOT language
├── src/self-host/codegen.dot    — Code generator rewritten in DOT language
├── tests/self-host.test.ts      — 50+ (compile .dot files → TS → execute → compare output to TS compiler)
```

**The test:** `dot compile lexer.dot | node` produces the same tokens as the TypeScript lexer for every test input.

**Tests:** 50+

#### Agent 21: OpenScreener DOT-Native
**Package:** `packages/openscreener/` (or separate repo)

The OpenScreener product brief rewritten as DOT agents:

```dot
agent gem_scanner {
  every 5 seconds {
    observe measure: token.price at dexpaprika(chain: "all")
      .gate(token.volume > 1000 and token.age > 1 hour)
      .bloom(when: gem_score > 85, then: flag)
      .mesh(to: [telegram_bot, mcp_server, web_ui])
      .fade(after: 24 hours, to: archive)
  }
}

agent whale_watcher {
  observe event: large_transfer at chain(min_usd: 100000)
    .gate(wallet in smart_money_list)
    .pulse(alert: "whale moved")
    .mesh(to: [subscribers])
}

agent arb_detector {
  every 10 seconds {
    observe measure: odds at pmxt(platforms: ["polymarket", "kalshi"])
      .gate(spread > 0.05)
      .pulse(alert: "arbitrage opportunity")
      .mesh(to: [pro_subscribers])
  }
}
```

**Tests:** 30+

#### Agent 22: DOT-NEWS
**Package:** `packages/news/`

Real-time DOT-native news aggregator where every fact is a signed observation chain.

```dot
agent news_observer {
  observe event: article at rss_feeds
    .gate(relevance_score > 0.7)
    .chain(previous: same_topic_chain)
    .mesh(to: [readers, fact_checkers])
    .bloom(when: 3 sources confirm, then: promote_to_verified)
    .fade(after: 7 days, to: archive)
}
```

**Tests:** 30+

#### Agent 23: DOT-SCIENCE
**Package:** `packages/science/`

Scientific knowledge as composable DOT observations.

```dot
agent research_observer {
  observe claim: "compound X inhibits protein Y" at paper(doi: "10.1234/xyz")
    .sign(observer: researcher_identity)
    .chain(previous: same_hypothesis_chain)
    .bloom(when: 3 independent_replications, then: upgrade_to_consensus)
    .fade(after: 5 years without citation, to: archive)
    .forge(action: update_knowledge_graph)
}
```

**Tests:** 30+

### Wave 6 Gate Criteria
- [ ] DOT compiler compiles ITSELF: `.dot` source → TS → execute → same output as original TS compiler
- [ ] OpenScreener agents compile and execute (even if against mock data sources)
- [ ] NEWS agent processes real RSS feeds and produces signed observation chains
- [ ] SCIENCE agent creates verifiable claim chains with citation links
- [ ] The chain is complete: from v0.3.0 (ancestor) through Bridge DOT through R854 through self-hosting

### Wave 6 Test Total: 140+

---

## GRAND TOTALS

| Wave | Packages | Agents | Tests | Weeks |
|------|----------|--------|-------|-------|
| 1 | core (TS+Rust) | 3 | 450+ | 1-2 |
| 2 | chain, fs, bridge (TS+Rust) | 5 | 525+ | 3-4 |
| 3 | lang, lm-compiler | 4 | 480+ | 5-8 |
| 4 | seal, mesh | 4 | 350+ | 9-12 |
| 5 | mark, script | 3 | 260+ | 13-16 |
| 6 | self-host, apps | 4 | 140+ | 17+ |
| **TOTAL** | **13 packages** | **23 agents** | **2,205+** | **17+ weeks** |

Exceeds the 1,500 test target by 47%.
23 sub-agents across 6 waves.
13 packages (10 TypeScript + 3 Rust).
Self-hosting at Month 3.

---

*757 tests are the seed. 2,205 tests are the tree. The Bridge DOT links the generations. Every DOT is self-aware. Build it so the Gate opens.*
