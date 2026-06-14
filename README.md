# dot

**The trust layer for the agent internet — a signed observation, Apache-2.0, no take rate.**

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Language](https://img.shields.io/badge/language-TypeScript%20%2B%20Rust-3178c6.svg)](packages/)
[![TS Tests](https://img.shields.io/badge/TS%20tests-3%2C048%20passing-brightgreen.svg)](packages/)
[![Rust Tests](https://img.shields.io/badge/Rust%20tests-275%20passing-brightgreen.svg)](rust/)
[![Format](https://img.shields.io/badge/wire%20overhead-%3C256%20bytes-orange.svg)](packages/core/src/types.ts)

A DOT is a signed observation. Timestamped. Chained. Verifiable. Language-independent.
No server. No account. No password. Just a keypair and something worth observing.

```js
import { observe, sign, chain, verify, createIdentity } from '@dot-protocol/core';

const me = await createIdentity();
const dot = await sign(chain(observe('hello world', { type: 'claim' })), me.secretKey);
const proof = await verify(dot);
// { valid: true }
```

Five lines. You just created a cryptographically signed, append-only observation that no one can forge, no server can delete, and any device can verify.

That's DOT. That's the whole idea.

---

## Why

The internet's primitive is the URL — a pointer to a document on someone else's server. When the server goes down, the document dies. When the company pivots, your data moves. When the Terms of Service change, you comply or lose everything.

DOT replaces the document with the **observation**. An observation is:

- **Signed** (Ed25519 — you prove you wrote it)
- **Hashed** (BLAKE3 — tamper-evident, instant verification)
- **Chained** (each DOT links to its parent — append-only history)
- **Typed** (measure, state, event, claim, bond)
- **Language-independent** (the DOT compiler renders in any language)

The chain of DOTs IS your data. The chain lives on your device. Replicate it to other devices and it lives there too. No server in the loop. No company in the middle.

**The chain is the room. The room lives wherever the chain lives.**

---

## Install

```bash
npm install @dot-protocol/core
```

Or try it without installing:

```bash
npx @dot-protocol/cli observe "hello world"
```

A signed DOT appears in your terminal. You own it. No one else does.

---

## The DOT Language

DOT has its own language. DOT compiles DOT.

```dot
observe measure: temperature at sensor_7 = 82.3
  .gate(temperature > 80)
  .pulse(alert: "overheating")
  .chain(previous: last_observation)
  .mesh(to: [maintenance, dashboard])
  .fade(after: 24h, to: archive)
```

Four bases: **Sign, Time, Chain, Verify.**
Seven functions: **Gate, Pulse, Chain, Mesh, Bloom, Fade, Forge.**
Five types: **measure, state, event, claim, bond.**

The language compiles to TypeScript and English. Rust and WASM run the crypto in browsers. A `.dot` file is a program, a specification, and a human-readable document simultaneously.

---

## What's Inside

33 packages. 4,099 passing TypeScript tests. 83K TypeScript/Rust lines. TypeScript + Rust + WASM.

### The Protocol

| Package | What it does |
|---|---|
| **core** | The kernel. `observe`, `sign`, `verify`, `chain`, `hash`. |
| **chain** | Merkle DAG with CRDT merge. SQLite + memory storage. |
| **lang** | Lexer, parser, type checker, codegen. DOT compiles DOT. |
| **mesh** | P2P broadcast over WebSocket. Gossip. Content routing. |
| **seal** | Chain-depth trust scoring. X25519 encrypted channels. |
| **sync** | Multi-device replication. Offline queue. Ephemeral erasure. |

### The Applications

| Package | What it does |
|---|---|
| **room** | Everything is a `.room`. The chain IS the room. |
| **minds** | AI minds grounded in primary sources. Feynman, Rumi, Shannon inside. |
| **chat** | Group messaging. Threads. Reactions. Every message is a signed DOT. |
| **signal** | WebRTC signaling via DOT chain. Voice and video metadata on chain. |
| **tree** | Knowledge tree. Observe → Flow → Connect. |

### The Tools

| Package | What it does |
|---|---|
| **cli** | `dot observe`, `dot check`, `dot compile`, `dot explain`. |
| **mcp** | 11 MCP tools. Claude Code can create and verify DOTs. |
| **browser** | WASM build. Single HTML file. Works offline. No server. |
| **selfhost** | 7 `.dot` programs that implement the DOT protocol in DOT. |
| **mark** | DOT-MARK → HTML compiler with trust badges and phishing detection. |
| **bridge** | Converts v0.3.0 DOTs to current format. The chain is unbroken. |

### Rust

| Crate | What it does |
|---|---|
| **dot-core** | Rust mirror of the kernel. 275 tests. |
| **dot-wasm** | Ed25519 (ed25519-dalek) + BLAKE3. 211KB. Runs in any browser. |

---

## .the.first.room

The first room exists. It has a genesis DOT:

> *"The first room. Where observation begins."*

Three minds are inside: Feynman, Rumi, Shannon. Every observation is signed, chained, hashed. The room IS its chain. Wherever the chain is replicated, the room exists.

Open `packages/first-room/index.html` in a browser. You're in.

---

## Run Everything

```bash
git clone https://github.com/dot-protocol/dot
cd dot
pnpm install
pnpm test        # 4,099 passing tests; 60 WASM-artifact-gated skips
cargo test       # 275 Rust test annotations
```

---

## Why dot vs alternatives

Three credible systems occupy similar territory. Here is an honest comparison.

### Provara Protocol

Provara is the closest parallel: Ed25519+SHA-256 signatures, Merkle chaining, append-only NDJSON, self-described as "sovereign tamper-evident memory for AI agents", approximately 110 tests.

dot's differences: BLAKE3 over SHA-256 (faster, DoS-resistant), the STCV object model (all four bases — Sign, Time, Chain, Verify — optional and composable rather than a fixed binary header), and 33 packages covering the full stack from crypto kernel to group chat, language compiler, and WASM browser bundle. Provara is purpose-built for agent memory logs; dot is a composable substrate that memory logs, messaging, geo-location, reputation, and commerce build on the same primitive.

### VIRP (IETF draft-howard-virp-03)

VIRP is an IETF draft: Ed25519+HMAC, 28-byte fixed header, designed for IoT and constrained environments. Excellent minimalism. VIRP distributes key lookup out-of-band.

dot's difference: the observer's public key travels with every DOT (in the `sign.observer` field), so any verifier can check a DOT without a separate key directory. This is a deliberate tradeoff: slightly larger wire size in exchange for zero external dependencies for verification. dot also adds the chain and verify bases — content hash and causal linkage — which VIRP leaves to the application.

### Crovia Trust

Crovia anchors records to Bitcoin for legal-grade timestamping. Strong immutability guarantee via Bitcoin's proof-of-work.

dot's difference: dot makes no ledger dependency. Verification is pure cryptography — any recipient can verify any DOT offline, with no network call, no Bitcoin node, no Crovia infrastructure. For use cases that need legal-grade external notarization, Crovia is the right tool; for agent memory, peer-to-peer observation logging, and offline-first applications, the offline-verifiable model is correct.

**Summary:** dot's position is the minimal composable primitive, zero take rate, no entity ownership, and a complete stack from binary crypto to group chat. It is not the only trust substrate, and it is not trying to be. It is the smallest thing that is still correct — and the largest thing you can build from it.

---

## The Lineage

This repo descends from [DOT Protocol v0.3.0](https://github.com/dot-protocol/protocol). The `bridge` package converts between versions. Ed25519 signatures cross-verify. The chain is unbroken.

---

## Built on dot

These projects use the dot substrate:

- **[dot-words](https://github.com/dot-protocol/dot-words)** — sovereign location addressing; reversible `(lat, lon, alt) ↔ 5 words`, zero dependencies
- **[piperchat](https://github.com/dot-protocol/piperchat)** — end-to-end encrypted messaging; sealed-body DMs with X25519+AES-256-GCM

Building something on dot? Open a PR to add it here.

---

## Star history

[![Star History](https://api.star-history.com/svg?repos=dot-protocol/dot&type=Date)](https://star-history.com/#dot-protocol/dot&Date)

---

## Contributing

Every contribution is a DOT. Every commit message follows the observation format:

```
observe event: "add CRDT merge" .chain(previous: "Merkle DAG")
```

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

[Apache-2.0](./LICENSE). Patent protection included. Build on this freely. No take rate. No entity ownership.

---

<p align="center">
<em>DOT is 0 bytes. The contact itself.<br>
The point of observation, existing in superposition until observed.<br>
When observed, the wave function collapses to the first bit.</em>
</p>
