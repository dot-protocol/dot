# DOT Protocol

The internet is built on documents. DOT is built on contacts.

Every observation is signed, timestamped, chained, and verifiable. No server owns your data. The chain IS the room. The room lives wherever the chain lives.

```
npm install @dot-protocol/core
```

```typescript
import { observe, sign, chain, verify, createIdentity } from '@dot-protocol/core';

const { publicKey, secretKey } = await createIdentity();

const dot = await sign(
  chain(observe('hello world', { type: 'claim' })),
  secretKey
);

const result = await verify(dot);
// { valid: true, checked: ['signature'] }
```

Five lines. A signed, chained, verifiable observation. That's DOT.

---

## What DOT Replaces

| Old Internet | DOT |
|-------------|-----|
| URLs (documents) | DOTs (observations) |
| Servers own your data | The chain IS your data |
| Passwords | Ed25519 keypairs |
| Trust the platform | Verify the signature |
| History can be rewritten | Chain is append-only |
| English-centric | Language-independent |

## Packages

### The Protocol (Day 1)

| Package | What |
|---------|------|
| `@dot-protocol/core` | The kernel. observe, sign, verify, chain, hash. BLAKE3 + Ed25519. |
| `@dot-protocol/chain` | Merkle DAG. CRDT merge. SQLite + memory storage. |
| `@dot-protocol/lang` | The DOT language. Lexer, parser, compiler. DOT compiles DOT. |
| `@dot-protocol/mesh` | P2P transport. WebSocket. Broadcast, gossip, content routing. |
| `@dot-protocol/cli` | `dot run`, `dot check`, `dot compile`, `dot explain`. The door. |

### The Network

| Package | What |
|---------|------|
| `@dot-protocol/seal` | Chain-depth trust. X25519 encrypted channels. Forward secrecy. |
| `@dot-protocol/sync` | Multi-device replication. Offline-first. Ephemeral DOT erasure. |
| `@dot-protocol/signal` | DOT-RTC. WebRTC signaling via DOT chain. Voice/video metadata. |

### The Interface

| Package | What |
|---------|------|
| `@dot-protocol/mark` | DOT-MARK → HTML. Trust badges. Phishing detection. |
| `@dot-protocol/script` | Runtime. State-as-chain. Reactive streams. Agent scheduler. |
| `@dot-protocol/viewer` | Tree HTML renderer. Self-contained. Under 26KB. |
| `@dot-protocol/browser` | WASM build (Ed25519 + BLAKE3). Single HTML file. Works offline. |

### The Applications

| Package | What |
|---------|------|
| `@dot-protocol/room` | Everything is a .room. The chain IS the room. |
| `@dot-protocol/minds` | AI minds. Feynman, Rumi, Shannon. Provider-agnostic. Cited sources. |
| `@dot-protocol/chat` | Group chat. Messages, threads, reactions. All DOTs. |
| `@dot-protocol/tree` | The knowledge tree. Observe. Flow. Connect. |

### Tools

| Package | What |
|---------|------|
| `@dot-protocol/mcp` | 11 MCP tools for AI agents. Claude Code can create DOTs. |
| `@dot-protocol/selfhost` | DOT compiles DOT. 7 `.dot` programs. selfHostingScore = 100%. |
| `@dot-protocol/bridge` | v0.3.0 → current converter. The chain is unbroken. |
| `@dot-protocol/fs` | DOT-FS. Sidecar chains. Every write is a signed observation. |

### Rust

| Crate | What |
|-------|------|
| `dot-core` | Rust mirror of core. 275 tests. |
| `dot-wasm` | WASM build. Ed25519 (ed25519-dalek) + BLAKE3. 211KB. |

## The DOT Language

```dot
observe measure: temperature at sensor_7 = 82.3
  .gate(temperature > 80)
  .pulse(alert: "overheating")
  .chain(previous: last_observation)
  .mesh(to: [maintenance, dashboard])
  .fade(after: 24 hours, to: archive)
  .forge(action: shutdown(reactor_3))
```

Four bases: **Sign, Time, Chain, Verify.**
Seven functions: **Gate, Pulse, Chain, Mesh, Bloom, Fade, Forge.**
Five observation types: **measure, state, event, claim, bond.**

## Numbers

- **3,048** tests passing
- **22** packages
- **286** source files
- **58,057** lines
- **2** Rust crates (native + WASM)
- **14** commits from scaffold to shipping

## The Lineage

DOT Protocol v0.3.0 (archived at [dot-protocol/v0](https://github.com/dot-protocol/protocol)) is the ancestor. This repo is the descendant. The `@dot-protocol/bridge` package converts v0.3.0 DOTs to current format. Ed25519 signatures cross-verify between versions. The chain is unbroken.

## Run Tests

```bash
git clone https://github.com/dot-protocol/dot
cd dot
pnpm install
pnpm test          # 3,048 tests
cargo test --lib   # 275 Rust tests
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Every commit message is a DOT observation:

```
observe event: "add CRDT merge" .chain(previous: "Merkle DAG")
```

## License

Apache-2.0. Patent protection included. See [LICENSE](LICENSE).

---

*DOT is 0 bytes. DOT is the contact itself. The point of observation, existing in superposition until observed. When observed, the wave function collapses to the first bit.*
