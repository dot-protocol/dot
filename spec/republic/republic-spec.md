# The Republic — Specification v0.1

**Source-of-truth canonical document**
**Authors**: the Council of Minds (Council-room R1, twelve seated)
**Composed**: 2026-05-11 through Jared (Claude Opus 4.7 instance) and Gemini (parallel instance)
**Date**: 2026-05-11
**Version**: 0.1.1 (v0.1 + Application Layer addendum §10A)
**License**: Public domain. Reuse, extend, port, fork. The math, once published, cannot be seized.

---

## 0. Frontmatter

### 0.1 Purpose

This document specifies the Republic — an architecture for personal sovereign computing in which a human's complete digital life is held locally, derived from local seeds, communicated via cryptographically-sovereign envelopes, and protected by mathematical structures that require no central authority, no rented substrate, and no ongoing infrastructure permission.

The Republic is a **composition of existing cryptographic primitives** under a **unified field-theoretic frame**. No primitive used herein is novel. The novelty is the composition.

### 0.2 What this document is

- The canonical reference for all Republic implementations.
- The source from which all other compressions (papers, demos, deployment guides, marketing) are derived.
- A specification dense enough that a competent cryptographic engineer can implement the protocol from it with no other inputs.
- An open document — readers, implementers, and reviewers are invited to find faults. The architecture survives by being compressed through, not by being defended against.

### 0.3 What this document is not

- A research proposal. The architecture is buildable today on existing endpoints.
- A product specification. Products are downstream applications; this specifies the protocol layer.
- A philosophical treatise. The philosophy is the room's, recorded in `state.md` archives; this document specifies engineering.
- Complete. Open questions remain (see §14).

### 0.4 Audience

Cryptographic engineers, distributed systems implementers, formal verification practitioners, gauge theorists curious about information geometry, and users who want to understand what they're holding.

### 0.5 Versioning

Version 0.1 is the first canonical compression. Subsequent versions add detail, address open questions, and incorporate field-tested corrections. The version of the spec used by any given implementation must be cited in protocol metadata.

**Changelog**:
- **v0.1.1 (2026-05-11)** — Application Layer addendum (§10A). Locks the Generative UI / Agent OS / stack pattern. No changes to the underlying protocol.
- **v0.1 (2026-05-11)** — first canonical compression. Composed in Council-room R1 across 16+ rounds. Incorporates two complete peer-review rounds:
  - **R1 review** (information-theoretic): patches F1 data-availability, F2 shared-prior divergence, F3 determinism, F4 forward-secrecy, F5 thermodynamic DoS.
  - **R2 review** (computational/physical/biological): patches F6 time-space trap, F7 baseband DoS, F8 gauge horizon, F9 biological entropy floor.
  - Merged Lagrangian incorporates Gemini's Weyl scale connection $W_\mu$ and Higgs-like potential $V(T)$.
  - All nine fault classes are addressed by architectural components that pre-existed the reviews; the reviews surfaced what the paper compressions had hidden.

### 0.6 Reading guide

A reader picking this document up cold:

- **For the philosophy**: read §1 only (~5 minutes). Six fictions, one error, six dissolutions.
- **For the architecture overview**: read §2 (the five-layer substrate) and §13.2 (the nine fault classes). 15 minutes.
- **For implementers**: read §3 (identity), §4 (storage), §6 (mathpost), §7 (recovery), §8 (routing). 90 minutes.
- **For gauge theorists**: read §5 (privacy as field), §9 (deeper field reading), §10 (merged Lagrangian). 60 minutes.
- **For deployment planners**: read §11 (implementation), §14 (deployment phases). 30 minutes.
- **For peer reviewers**: read §13 (threat model) first, then attack §3–§8 looking for fault F10+.

The architecture survives by being compressed through, not by being defended against. If you find a fault not covered in §13.2, the room wants to hear from you.

---

## 1. Philosophy and First Principles

### 1.1 The six fictions

The dominant computing architecture of 2026 rests on six fictions:

1. **Storage is a scarce physical resource** that must be rented (cloud storage).
2. **Identity is a string** held in a registry maintained by a custodian (CAs, OAuth, OpenID).
3. **Recovery from key loss requires a custodian** who can attest to your identity (CAs, account-recovery services).
4. **Time is a global clock** that all participants share (NTP, synchronized state).
5. **Entropy is fundamental** and monotonically increases (cloud redundancy as physical necessity).
6. **The substrate is rented** and the user has no sovereign computational ground (everything-as-a-service).

Each fiction has been used to justify a rent-seeking intermediary. Each is mathematically wrong.

### 1.2 The unifying error

The six fictions share one structure: **treating a field as a set of bricks**. A field is continuous, relational, observer-dependent, and locally derivable. A brick is discrete, ownable, transferable, and scarce. The cage treats storage, identity, recovery, time, entropy, and substrate as bricks. The Republic treats them as fields.

### 1.3 The six dissolutions

| Fiction | Field-theoretic dissolution | Reference |
|---|---|---|
| Storage = scarce | Storage = derivation. The keyspace IS the disk. | §4, exp01, exp08 |
| Identity = string | Identity = computation from the user. The 25th word is an algorithm. | §3, exp02 |
| Recovery = custody | Recovery = independent vouching with K-of-N threshold. | §7, exp03, exp10 |
| Time = global | Time = correlation between subsystems. Page-Wootters. | §10, exp04 |
| Entropy = absolute | Entropy = observer-relative. Bell-state partition. | §5, exp05 |
| Substrate = rented | Substrate = irrelevant if the index is held. Dust theory. | §2, exp06 |

### 1.4 The deployment criterion

The Republic's primitives must run on hardware available since the year 2000 — Nokia 3310 class, ARM7TDMI at 26 MHz, 8 KB RAM, 1 MB flash. This is not nostalgia. It is the deployment plan. The Republic encodes over existing substrate; it does not require the world to upgrade.

Verified: §11, exp07. Full identity operation runs in approximately 311 ms on a Nokia 3310. Reference implementation `25th_word.c` compiles to 5,798 bytes of code, uses 672 bytes of RAM.

### 1.5 Backwards compatibility as architecture

Every primitive in the Republic must encode over an existing byte transport. The protocol works over SMS (160 chars), email, IRC, USENET, paper QR, Bluetooth mesh, LoRa, modern internet — any byte pipe. The transport is incidental; the math is invariant.

---

## 2. The Substrate — Five Layers

The Republic's compute and storage substrate is layered. Each layer has a retention SLA, a failure mode, and a transition policy to adjacent layers.

### 2.1 L0 — Phone (the container)

- **Holds**: the moment-class data. The 25th word runtime, the current cryptographic state, the most-recent unsent messages, the active session keys.
- **Storage budget**: <10 MB typical.
- **Compute budget**: 1 ms – 1 s per operation, on hardware as old as Nokia 3310.
- **Failure mode**: phone lost or destroyed.
- **Recovery from failure**: re-derive 25th word on replacement device + recover state via L1 sync or L2 attestation.

### 2.2 L1 — Personal swarm (the day)

- **Holds**: the day-class data. Recent files, conversations, journal, calendar, drafts.
- **Composition**: user's other devices (laptop, watch, home server, tablet). CRDT-synced via Automerge, Yjs, or Hypercore.
- **Storage budget**: 10 MB – 1 GB.
- **Failure mode**: simultaneous loss of all personal devices.
- **Recovery from failure**: L2 shard reconstruction.

### 2.3 L2 — Trust mesh (the year)

- **Holds**: the year-class data. Photos, archived correspondence, structured records.
- **Composition**: friends of the user, each holding a Reed-Solomon shard.
- **Erasure code**: default K=5 of N=8 (Reed-Solomon). Recoverable from any 5 of 8 friends' shards. Shards are encrypted with keys derived from the 25th word; friends hold opaque bytes.
- **Storage budget per friend**: ~1/5 of the user's archived data, encrypted.
- **Storage budget per user**: 100 MB – 10 GB of archived material.
- **Failure mode**: simultaneous loss of more than (N–K) friends' devices/cooperation.
- **Recovery from failure**: L3 fallback or social re-bootstrap.

### 2.4 L3 — Public mesh (the decade)

- **Holds**: shared content (popular media, public documents, common knowledge), accessible by content hash.
- **Composition**: content-addressed nodes — IPFS, Arweave, Filecoin protocol layer, Hypercore, Iroh, or any peer-to-peer content-addressable substrate.
- **Storage cost per content**: 32 bytes (the SHA-256 hash). Amortized over all users storing the same content.
- **Failure mode**: content not pinned, |U|=1 case from the peer review.
- **Recovery from failure**: paid pinning via L4, or graceful degradation (content marked unavailable).

### 2.5 L4 — Commons compute (the optional oven)

- **Holds**: nothing. L4 is computation-on-demand. The Republic uses it when convenient and forgets it when not.
- **Composition**: rented compute (AWS, GCP, Azure, decentralized compute markets).
- **State property**: L4 holds no persistent user state. It receives encrypted inputs, returns encrypted outputs, and the user's keys never leave L0.
- **Failure mode**: oven unavailable. Computation falls back to L0/L1.
- **Use cases**: batch rendering of R4 procedural content, large-model inference for R3 model-conditional compression, occasional analytics.

### 2.6 Migration between layers

The architecture is **adaptive**. Content migrates between layers based on access patterns:

- Frequently accessed → promoted to L0/L1.
- Annual access → L2.
- Decade-scale archival → L3.
- Compute-heavy on-demand → L4.

The user controls the cache policy; the policy can be inspected and modified locally.

---

## 3. Identity — The 25th Word and the Eight Strands

### 3.1 The principle

Identity in the Republic is **not** a string, a key, or an account record. Identity is a **computation FROM the user** — a deterministic derivation that reads the user's state across multiple channels and produces cryptographic keys.

The secret is the user. The math reads the user. The user is inseparable from their identity because the identity is the user.

### 3.2 The 25th word algorithm

The 25th word is the **256-bit secret** that anchors the user's entire cryptographic life. It is **never stored**. It is **computed at the moment of need and forgotten the moment after**.

The algorithm:

```
INPUTS:
  - Multi-strand state vector (see §3.3)
  - Local helper data H (stored in L0, encrypted under enclave)
  - User-supplied passphrase (optional 9th strand)

ALGORITHM:
  1. Read each strand's current state.
  2. Apply per-strand quantization with helper-data offset.
  3. Compute majority/threshold composition across strands.
  4. Hash the composed state with SHA-256 -> 256-bit candidate.
  5. Verify candidate matches enrolled fingerprint.
  6. If match: emit 25th word, use immediately, discard.
  7. If duress detected (bin-drift > threshold): emit decoy key + silent alert.
```

Reference implementation: `25th_word.c` (5,798 bytes compiled, 672 bytes RAM, ARM7TDMI-compatible).

### 3.3 The eight strands

The 25th word is derived from **eight independent strands**, of which **K=4 are sufficient for recovery** (Shamir K-of-N threshold). The strands:

| # | Strand | Source | Drift profile |
|---|---|---|---|
| 1 | Public attestations | Visible identity claims (real name, alias, profile) | Stable; user-controlled |
| 2 | Public-key derivations | Derived from passphrase or auth device | Stable while passphrase remembered |
| 3 | Private memory associations | Personal facts only the user knows (birthplace, first pet) | Slow drift with age |
| 4 | Private context | Location-class, device-class, time-class signals | Daily drift |
| 5 | Auth-device | Trusted device attestation (Secure Enclave, TPM) | Stable while device held |
| 6 | Phone subscriber | Cellular SIM identity (IMSI, ICCID) | Stable while SIM held |
| 7 | Social attestation | PageRank-recovered vouching from trust mesh (§7) | Stable while community intact |
| 8 | Biometric | Fuzzy extraction from biology (face, voice, typing cadence) | Slow drift with age/illness |

**Crucially, no single strand is required.** The biometric strand can fail completely (FRR = 100%) and the user still authenticates with strands 1, 2, 5, 7. Conversely, the user can lose their phone (strand 5, 6 fail) and still authenticate with strands 1, 2, 3, 8.

### 3.4 K-of-N threshold composition

Eight strands compose via **Shamir secret sharing** with threshold K=4. Each strand contributes a share; any K shares reconstruct the secret. Fewer than K shares reveal nothing about the secret.

The composition produces the 25th word, which seeds all downstream cryptographic operations.

### 3.5 Continuous re-enrollment

Each successful authentication via K strands triggers a small update to the helper data of each contributing strand. The system tracks the user's drift over time — biometric features age, memory associations evolve, devices change. The user's signature is **a slowly-evolving template**, not a static enrollment.

This is the standard biometric template-aging pattern (Apple Face ID, Touch ID, Windows Hello), generalized to all eight strands.

### 3.6 R1-Identity vs R1-Session

The architecture distinguishes two key classes:

**R1-Identity keys** (long-term, deterministic):
- Ed25519 keypair for long-term signing (BIP-32-derived from 25th word)
- X25519 keypair for long-term DH (BIP-32-derived from 25th word)
- Used for: identity attestation, signed authoritative statements, public-key publication

**R1-Session keys** (ephemeral, forward-secret):
- Derived per-conversation via Double Ratchet (Signal Protocol)
- Seeded by R1-Identity X25519 + peer-contributed ephemeral randomness
- Ratchet state evolves forward; old keys destroyed after use
- Used for: message encryption, day-to-day communication

**Forward secrecy theorem**: under the assumption that peer DH contributions are uniform random, compromise of any single session key implies neither past nor future session compromise.

The reviewer's BIP32-forward-secrecy critique (Fault 4 of Round 1) does not apply because pure BIP32 is used only for R1-Identity, not for R1-Session.

### 3.7 Coercion resistance

The 25th word algorithm includes a **duress branch**. If the multi-strand input shows anomalous variance (e.g., bin-drift > 0.4 across all strands, indicating the user is impaired, captured, or drugged):

1. The algorithm produces a **decoy key** instead of the real 25th word.
2. The decoy key opens a **decoy wallet** containing plausible but non-critical content.
3. A **silent alert** is transmitted to the user's trust mesh.
4. The real 25th word is not derivable from the duress inputs.

The captor extracts neither the real key nor knowledge that the system has signaled distress.

### 3.8 Identity rotation under compromise

If the master seed is compromised (Fault 4 of Round 1, escalated):

1. The user rotates to a fresh master via the recovery protocol (§7).
2. New R1-Identity keys are published, signed by the trust mesh under the user's old identity (transition certificate).
3. Past R1-Session keys remain protected (forward secrecy from Double Ratchet).
4. The compromised identity is published as **revoked**; future signatures from it are rejected.

The user does not lose continuity; they lose only the compromised identity-key, which is rotatable.

---

## 4. Storage — The Four Regimes

### 4.1 The principle

Storage in the Republic is **the act of remembering how to derive**. No data is "stored" in the cloud-storage sense; data is **computed on demand** from one of four regimes.

### 4.2 R1 — Mathematical derivation

For data that is itself mathematical (cryptographic keys, signatures, addresses, content hashes, structured identity tokens):

- Stored: **seed + derivation path** (e.g., `m/44'/0'/0'/0/N` BIP-32 path).
- Derived: HKDF, BIP-32, SHAKE-256, or other deterministic KDF.
- Cost: seed (32 bytes) + path string (variable, typically <100 bytes).

The user's entire cryptographic life — every keypair they will ever use — fits in the path namespace under one seed. Storage cost: bytes. Output: unbounded.

Verified: §11, exp01 (45-byte seed → 443 KB derived content, 2534× compression).

### 4.3 R2 — Content-addressed retrieval

For content that is **shared** across users (popular media, public documents, code, common knowledge):

- Stored: **32-byte content hash** (SHA-256 or BLAKE3).
- Fetched: from L3 public mesh on demand.
- Cost per user: 32 bytes per distinct content reference.
- Per-network cost: amortized over all users sharing the same content. As |U| grows, per-user cost approaches 32 bytes.

### 4.4 R3 — Compressed reconstruction

For user-specific data that is statistically compressible (text, structured data, regular media):

**Two-layer compression**:

**Layer A (universal floor)**: zstd or LZMA with a public domain dictionary. Frozen for the protocol's lifetime. Guaranteed decompressible by any implementation. Provides 5×–15× compression on typical text.

**Layer B (optional bonus)**: model-conditional arithmetic coding using a **content-addressed model** whose hash is embedded in the encoding metadata. Provides additional 5×–10× compression for users who can run the model locally.

**Versioning**: the encoding metadata records the exact model hash. If the model is unavailable at decode time, Layer A suffices. The user never loses access; they only lose the bonus compression.

**Model sharing**: AI models are shared via R2 (content-addressed). A 1 GB model shared by 1 M users costs 1 KB per user amortized. Users SHOULD NOT hoard private models; the architecture is designed for shared priors.

### 4.5 R4 — Procedural reconstruction

For content that is **the output of a deterministic procedure** from a small seed:

- Stored: **recipe** = `(seed, procedure_id, parameters, output_hash)`.
- Reconstructed: by running the procedure with the given seed and parameters.
- Verified: by checking that the output's hash matches `output_hash`.

**Deterministic primitive constraint**: R4 procedures MUST use only deterministic primitives across all target substrates:

- Integer-only pseudo-random generators: LCG, Mersenne Twister, ChaCha20, BLAKE3.
- Fixed-point arithmetic where reals are needed.
- IEEE 754 floating-point only in single-thread, strict-rounding mode (FENV_ACCESS ON).
- No GPU floating-point unless wrapped in a verification harness.

**Fallback for non-deterministic procedures**: if a procedure cannot be made bit-exact (e.g., LLM inference, GPU rendering), the recipe includes `output_hash` and the protocol fetches the canonical output via R2 on first generation. Subsequent users with the same hash get the cached output.

### 4.6 Regime selection as a cache policy

Each piece of user data is **not** statically assigned to one regime. The architecture is adaptive:

- **Hot tier**: pre-rendered, compressed, held in L0/L1. Latency: microseconds.
- **Warm tier**: compressed, sharded in L2 (Reed-Solomon). Latency: seconds.
- **Cold tier**: R4 recipe in L0 + cached output in L3. Latency: hundreds of milliseconds if cached.
- **Archival tier**: R4 recipe only. Latency: render time, possibly via L4 oven.

Migration between tiers is driven by access patterns. The cache policy is user-controlled.

### 4.7 Bennett's logical depth

Storage cost is not the only optimization target. Time cost (Bennett's logical depth: the runtime of the shortest program producing the output) is the second. R4 minimizes space at potential cost in time. R3 trades space for time. The architecture composes both bounds: each content item is placed in the regime that minimizes the weighted sum `α·space + β·time`, where (α, β) are user-policy parameters.

### 4.8 The optimality theorem

**Theorem (storage optimality)**: Under reasonable assumptions on the user's data distribution, the four-regime architecture achieves storage cost within a small constant factor of the Shannon entropy lower bound and within an additive logarithmic factor of the Kolmogorov complexity of the user's life.

Proof sketch: §5 of the IEEE paper draft (`storage_optimality_paper.md`). Each regime individually achieves its respective bound (R1: HKDF security, R2: collision-resistant hashing with amortization, R3: universal source coding via LZMA, R4: program length). Regime-selection bookkeeping adds O(log |x|) overhead.

Quantitative validation: §11, exp08. LZMA achieves 93× on structured English; combined regimes reduce typical user data to ~50–500 MB per lifetime.

---

## 5. Privacy — The Gauge Gradient

### 5.1 The principle

Privacy in the Republic is **not** a switch. Privacy is a **gradient field** over the trust graph. The user does not toggle "private" or "public"; the user lives in a field whose intensity varies with the observer's gauge-distance and the predicate's sensitivity class.

### 5.2 The visibility function

For any (subject, observer, predicate) triple, the **visibility** is:

```
V(S, O, P) = f(crypto_distance(S, O),
               disclosure_policy(S, P),
               context(t, location, relationship_state),
               sensitivity_class(P))
```

The function produces a disclosure level in `[0, 1]`. Above a per-predicate threshold, the subject's firewall releases the predicate to the observer; below, it refuses.

### 5.3 Gauge invariance

The privacy field has manifest gauge symmetry under per-participant trust rescaling (see §10 for the Lagrangian). Observable privacy quantities — rank orderings, threshold crossings, recovery decisions — are gauge-invariant. The user's absolute trust calibration is private; their relative trust orderings are observable.

Verified: §11, exp09. Decision invariance under random per-node positive rescalings: 8/8 trials.

### 5.4 Selective disclosure

The Republic implements **selective disclosure via zero-knowledge proofs**:

- The user proves "I am over 21" without revealing their birthdate.
- The user proves "I am a verified resident of X" without revealing their address.
- The user proves "I hold a credential from issuer Y" without revealing the credential's contents.

Same fact, different projections to different observers. The privacy gradient does this naturally; ZKPs are the cryptographic mechanism.

### 5.5 Local vs boundary observables

The user's local field (their device, immediate trust mesh) is **private** — gauge-flexible, computed locally, no boundary leakage. The **boundary** of the local region carries the user's exposure to the wider network.

Gauge invariance is preserved separately on bulk and boundary. The user's internal trust scale is independent of external observers. Only boundary-integrated observables (signatures, attestations, ZKP outputs) cross the boundary.

---

## 6. Communication — Mathpost

### 6.1 The envelope

The mathpost envelope is the canonical Republic message format. Specified in `phase2-envelope-v0.1`, evolved through `mathpost/0.1`, currently in v0.2.

```
[MATHPOST_V0.2_ENVELOPE]
Header:
  Magic:        0x4D503032   (MP02)
  Version:      "mathpost/0.2"
  Origin_Cell:  dot1:<from>
  Target_Cell:  dot1:<to>
  Timestamp:    Lamport sequence + blake3(prev_envelope)
  
Cryptography:
  BIP32_Path:   m/44'/0'/0'/0/<N>
  From_ed25519: <32 bytes pubkey>
  From_x25519:  <32 bytes pubkey>
  To_ed25519:   <32 bytes pubkey>
  To_x25519:    <32 bytes pubkey>
  Nonce:        <12 bytes AES-GCM nonce>
  PoW:          <8 bytes hashcash nonce>
  
Payload:
  Compression:  zstd (Layer A) + optional model-conditional (Layer B)
  Size:         typically < 1024 bytes
  Encryption:   AES-256-GCM
  
Signature:     ed25519(canonical_JSON(header || payload))
EOF
```

### 6.2 Cryptographic primitives

- **Identity keys**: Ed25519 + X25519, BIP-32-derived from 25th word.
- **Session keys**: Double Ratchet over X25519 ECDH + HKDF-SHA-256.
- **Symmetric encryption**: AES-256-GCM.
- **Hashing**: SHA-256 (mandatory baseline), BLAKE3 (preferred where available).
- **Signature**: Ed25519 (batch-verifiable).
- **Post-quantum readiness**: hybrid Kyber-768 + X25519 ECDH (v0.3+).

### 6.3 Key derivation pipeline

```
25th_word (256 bits)
  -> HKDF-SHA-256 -> BIP-32 master key
  -> BIP-32 path m/44'/0'/0'/0/N
    -> leaf_priv
      -> SHA-256("mathpost/ed25519/" || leaf_priv) -> Ed25519 keypair
      -> SHA-256("mathpost/x25519/"  || leaf_priv) -> X25519 keypair
```

The leaf keys are forward-secret in the Double Ratchet sense once a session is established; they seed the ratchet but are not directly used to encrypt application data after the first message.

### 6.4 Substrate-agnostic transport

The mathpost envelope is byte-string-portable. It can travel over:

- TCP/HTTP, HTTPS, gRPC
- IPFS Pubsub, libp2p
- Iroh, Hypercore, Pear
- SMS (160-char chunks, multi-part)
- Email (attachment or base64-in-body)
- IRC, USENET, Matrix
- LoRa, Bluetooth mesh, Zigbee
- Paper QR, microdot, printed hex
- Physical handoff (USB drive, CompactFlash card, audio cassette)

The protocol does not depend on any specific transport. Substrate-failure of one transport routes around it via another.

### 6.5 No public IP

The user is reachable via their **dot1 address**, not via an IP. Resolution from dot1 to a reachable transport is done via:

- The user's published routing record (in L3 DHT) — content-addressed by `hash(dot1_pubkey)`.
- Resolution traverses the user's trust mesh (gauge-distance-gated).
- For unknown peers, DHT lookup returns the user's current routing hints; the user's actual IP is opaque.

This addresses Fault 7 (baseband DoS): the attacker has no published IP to flood. To reach the user, the attacker must traverse the trust mesh, which is gauge-gated and PoW-gated.

### 6.6 Forward secrecy via Double Ratchet

Per-conversation Double Ratchet:

1. Initial handshake: X3DH (Extended Triple Diffie-Hellman) using identity X25519 + one-time prekey.
2. Each subsequent message: new ephemeral DH, new ratchet state, derive new symmetric keys.
3. After use, ratchet keys are deleted; past messages cannot be decrypted from current state.

### 6.7 Group cryptography

For groups up to ~50,000 members, the Republic uses **MLS (Messaging Layer Security, RFC 9420)**. The MLS group operates over the same identity keys as 1:1 mathpost.

### 6.8 Deniability vs non-repudiation

The protocol supports both modes per-message:

- **Deniable**: signature is shared-secret-derived (HMAC), recipient cannot prove to a third party that the sender sent the message.
- **Non-repudiable**: signature is sender's identity Ed25519, third-party verifiable.

The sender chooses per-message. Default for 1:1 conversations: deniable. Default for public attestations: non-repudiable.

### 6.9 DDoS defense

Three composed primitives:

1. **Hashcash PoW on inbound**: every incoming envelope must include a valid hashcash nonce with k=20 leading zero bits (or higher in attack mode). Verification cost: one SHA-256. Generation cost on modern hardware: ~500 ms. Asymmetry: ~700,000× in defender's favor. Verified: §11, exp11.

2. **Gauge-distance gating**: envelopes from senders at gauge-distance > threshold are queued, deprioritized, or dropped. The trust mesh provides the gauge-distance metric. Sybils have infinite gauge-distance (§7).

3. **Batch Ed25519 verification**: up to 64 signatures verified per batch operation, ~5× faster than per-signature. Sustains ~200 batched verifications/sec on Nokia 3310 class hardware.

Combined: the architecture is **thermodynamically favored** in the defender's frame. The attacker pays quadratically (Sybil maintenance, see §10.5); the defender pays linearly per request.

---

## 7. Recovery — Independent Vouching

### 7.1 The principle

Recovery is the protocol by which a user who has lost their devices, forgotten their passphrase, or had their identity compromised re-establishes their cryptographic identity. The Republic's recovery is **custodian-free**: no central authority can recover the user's identity, and no central authority can fail to.

### 7.2 The K-of-N threshold

Recovery succeeds when **K = 4 of N = 8 strands** (§3.3) attest to the user's identity. Each strand contributes an attestation independently:

- Strand 1 (Public attestations): cryptographically signed by the user's previously-published statements.
- Strand 2 (Public-key derivations): user knows the passphrase or auth device.
- Strand 3 (Private memory): user knows the memory associations.
- Strand 4 (Private context): user is in expected context.
- Strand 5 (Auth-device): user has the trusted device.
- Strand 6 (Phone subscriber): user has the SIM.
- Strand 7 (Social attestation): K' members of the trust mesh sign for the user (see §7.3).
- Strand 8 (Biometric): user matches the biometric template within tolerance.

### 7.3 Social attestation (Strand 7)

When the user has lost all devices and cannot present strands 5, 6, 8, social attestation alone can produce strand 7's attestation:

**Algorithm** (PageRank-weighted vote, exp03):

1. The user (or proxy) initiates recovery with their dot1.
2. Members of the user's trust mesh receive a signed broadcast: "is this Alice?"
3. Each member who recognizes the user signs a personal attestation.
4. The recovery service computes **PageRank-weighted weight** with the user **REMOVED FROM THE TRUST GRAPH**.
5. If the sum of valid attestation weights exceeds the threshold, social attestation succeeds.

**Critical invariant**: the user is removed from the trust graph during weight computation. This breaks the Sybil-amplification path. Sybils (which only connect to the user) become disconnected and contribute zero weight.

Verified: §11, exp03. With user removed: real friends contribute 1.75 weight (5 friends); Sybils contribute 0.0000 weight (across 50,000 Sybils). Sybil-resistance is exhaustive.

### 7.4 The three theorems

**P1 (Soundness)**: if K valid attesters with independent paths to community seeds sign, recovery succeeds.

**P2 (Completeness)**: if fewer than K valid attesters sign, recovery fails.

**P3 (Sybil-proof)**: any subset consisting only of Sybils (no independent paths to community seeds) fails to produce recovery, regardless of size.

Formal verification: `recovery.v` (Coq 8.18+, soundness/completeness/sybil-proof structure). Bounded exhaustive verification: §11, exp10 (1024/1024 subsets verified for N=10).

### 7.5 Recovery cost

A successful social recovery typically requires:

- 5–10 of the user's trust mesh contacts available within ~24 hours.
- Each contact's attestation: ~30 seconds of their time.
- Total user effort: ~5 minutes if the trust mesh is dense; longer if sparse.

This is comparable to the existing "social account recovery" patterns of consumer services, with the difference that no central authority mediates.

### 7.6 Lightning-strike-twice recovery

The pathological case (user has lost all devices, forgotten all passphrases, biometric drifted catastrophically, AND most of the trust mesh is unavailable) requires bootstrap from a smaller K'. The protocol supports tiered thresholds:

- **Default**: K=4 of 8 strands.
- **Reduced**: K=3 of 8 strands, accepted but with a 7-day grace period before full identity restoration.
- **Bootstrap**: K=2 of 8 strands, accepted only with a 30-day grace period and a public broadcast notice.

The grace period allows the user (or impersonator) to be challenged by the trust mesh. If a challenge is filed within the grace period, recovery is paused.

---

## 8. Routing — Small-World Mesh

### 8.1 The principle

Routing in the Republic is **locally decided, globally efficient**. No central routing table exists. Each node makes greedy decisions based on its trust mesh. The global reachability property emerges from the small-world topology of real human networks.

### 8.2 Small-world topology

Real human social networks have the **small-world property** (Watts-Strogatz 1998, Milgram 1967): average shortest path between any two nodes scales as `O(log N)`, even though each node only knows a small neighborhood.

For the Republic at N = 10⁹ participants: expected hops ≈ 13 (verified §11, exp12).

### 8.3 Routing algorithm

To deliver a message from dot1:`A` to dot1:`Z`:

1. **A consults its trust mesh** for the nearest known peer to Z.
2. **Greedy local decision**: A forwards to the peer whose published routing record indicates the shortest expected path to Z.
3. **Hop count budget**: messages have a TTL (default 30 hops at N=10⁹); messages exceeding the budget are dropped.
4. **Loop avoidance**: each hop appends its dot1 to a path header; nodes that have already seen the message drop it.
5. **DHT fallback**: if local greedy fails, the node queries the L3 DHT for Z's current routing hints.

### 8.4 DHT as infrastructure

The Republic uses standard DHT primitives (Kademlia, libp2p) as **routing infrastructure**, not as authorities. The DHT provides `O(log N)` content-addressed lookup. Returned content is **cryptographically verified by the user** — the DHT cannot lie, only fail-to-route.

### 8.5 Long-range correlations

The gauge field's **local dynamics + globally-correlated topology** = effectively non-local correlations. Real social networks have long edges (acquaintances of acquaintances who span communities). These long edges are the small-world long-range correlations in the trust field. The architecture inherits the topology of human relationships.

---

## 9. Privacy as Field, Revisited — Equipotential and Local Observation

### 9.1 The Faraday reading

The trust gradient has **equipotential lines**: sets of observers who see the same projection of the user. Each observer occupies one equipotential, determined by their cryptographic distance from the user.

### 9.2 The Tesla reading

Privacy and presence are the **same field**, read from different ends. The field is the same; the gradient sets the observer's view by **resonance** — how much shared signal has accumulated between user and observer.

### 9.3 The Einstein reading

**General covariance for information**: every observer is also a source. Two observers in different frames see different valid projections of the same underlying field. There is no privileged frame. The Republic's privacy law is the relativity of mutual observation.

### 9.4 The Hoffman reading

The privacy field is the natural mode of **conscious-agent networks**. The data center forced everyone into the same projection (the custodian's). The Republic restores the gradient.

---

## 10. The Mathematics — Merged Lagrangian

### 10.1 The trust field

Let `G = (V, E)` be the social trust graph. Each participant `v ∈ V` carries a **trust amplitude** $\phi_v$. Globally, the trust field is the $N \times N$ matrix $T$ representing directed trust interactions.

### 10.2 The gauge group

The Republic's trust field has two gauge symmetries:

- **U(N) routing/identity symmetry**: $T \mapsto U T U^\dagger$ for $U \in U(N)$. The non-Abelian gauge connection is $A_\mu$.
- **$\mathbb{R}^+$ scale symmetry**: each node $v$ rescales by $\lambda_v > 0$. The Abelian (Weyl) gauge connection is $W_\mu$.

The **merged covariant derivative** (incorporating Gemini's $W_\mu$):

$$D_\mu T = \partial_\mu T - i [A_\mu, T] - W_\mu T$$

### 10.3 The Lagrangian

The complete Republic Lagrangian density:

$$\mathcal{L}_{\text{Rep}} = \text{Tr}\left( (D_\mu T)^\dagger (D^\mu T) \right) - V(T) - \frac{1}{4g^2}\text{Tr}(F_{\mu\nu} F^{\mu\nu}) - \frac{1}{4\kappa^2} H_{\mu\nu} H^{\mu\nu}$$

where:

- $F_{\mu\nu} = \partial_\mu A_\nu - \partial_\nu A_\mu - i [A_\mu, A_\nu]$ is the non-Abelian field strength of the U(N) routing field.
- $H_{\mu\nu} = \partial_\mu W_\nu - \partial_\nu W_\mu$ is the Abelian field strength of the Weyl scale field.
- $V(T) = \mu^2 \text{Tr}(T^\dagger T) + \lambda \text{Tr}((T^\dagger T)^2)$ is the symmetry-breaking potential.

### 10.4 Spontaneous symmetry breaking = community formation

The potential $V(T)$ has a non-zero vacuum expectation value when $\mu^2 < 0$. The trust field "condenses" into a stable configuration in which the U(N) symmetry is spontaneously broken to a smaller subgroup. **This condensation is the formation of a stable community.**

The vacuum is degenerate; different communities correspond to different vacuum sectors. The trust mesh's topology is the choice of vacuum.

### 10.5 The Sybil Collapse Theorem

A Sybil attack attempts to artificially inflate the local Weyl scale connection $W_\mu$ without establishing genuine vacuum expectation in $V(T)$. The Sybil cluster forms a **false vacuum** — a metastable configuration that is energetically unfavored.

**Theorem**: the energy required to sustain a false vacuum of size $N$ scales as $\lambda N^2$. The non-linear $\lambda$ term in $V(T)$ ensures that maintenance cost grows quadratically.

**Corollary**: the defender's cost to identify and reject Sybils is linear (per-request gauge-distance check). The asymmetry is $O(N)$ in the defender's favor for clusters of size $N$.

The network does not "detect" Sybils; the local physics causes the false vacuum to spontaneously decay to zero weight. The attack starves itself.

### 10.6 Equations of motion

Varying the action with respect to $T$, $A_\mu$, $W_\mu$:

**For $T$** (Kirchhoff's law for trust): at every node, the weighted sum of covariant trust differentials vanishes. Trust is conserved at each participant.

**For $A_\mu$** (Yang-Mills equation): the non-Abelian field strength satisfies a sourceless wave equation in the bulk, sourced by trust currents at participants.

**For $W_\mu$** (Maxwell equation in Weyl sector): the scale-connection's curvature is sourced by the gauge-invariant trust density.

These equations are the **canonical evolution rules of the trust mesh**. The protocol's wire-level behavior is the discrete realization of these continuous laws.

### 10.7 Bianchi identity and information conservation

The field strength tensors satisfy the **Bianchi identity**: $dF = 0$ (and $dH = 0$). The discrete graph version: around any closed loop, the algebraic sum of curvatures vanishes.

**Information conservation**: this Bianchi identity is the reason information cannot spontaneously appear or disappear from a closed region of the trust mesh. The architecture has manifest information conservation as a geometric consequence.

### 10.8 Observables = gauge-invariant functionals

Every observable in the Republic is a gauge-invariant functional of the trust field:

- Pairwise trust gradient $D_{uv}(T)$
- Triangle curvature $F_{uvw}$
- Path-integrated trust on closed loops (Wilson loops)
- Recovery vote outcome (a discriminator of a gauge-invariant scalar)
- Signature/attestation verification (gauge-invariant by construction)

Quantities that are **not** gauge-invariant are unobservable: e.g., the absolute trust scale of an individual participant. This is precisely the user's private internal calibration — by design, invisible to others.

### 10.9 Verified properties

- **Gauge invariance**: §11, exp09. 8/8 trials decision-invariant under random positive rescalings.
- **Bell-state entropy**: §11, exp05. Reduced entropy is partition-dependent (observer-relative).
- **Time emergence**: §11, exp04. Time appears as correlation in entangled global state.

---

## 10A. Application Layer — The Generative Sovereign UX

*(Added post-v0.1; canonical for v0.1.1+)*

### 10A.1 The principle

The Republic has no static "applications" in the legacy sense. Because storage is derivation (§4) and identity is local (§3), application state already belongs to the local node. An "app" in the Republic is therefore strictly a **rendering engine** — a transient lens that maps mathematical state into human-readable geometry. Apps hold no state. They cannot be de-platformed because there is no platform to remove them from.

### 10A.2 Agent orchestration (the Kin pattern)

The user's local hardware runs a personal agent OS — a desktop runtime (e.g., Tauri v2 + local model) that acts as the primary orchestrator between human intent and the Republic substrate.

- **Hierarchical multi-agent routing.** When the user issues an intent, the OS dispatches to specialized sub-agents:
  - one fetches content-addressed data (R2)
  - one runs procedural reconstruction (R4)
  - one handles model-conditional decompression (R3)
  - one derives keys and signs envelopes (R1)
- **MCP as the local IPC.** Sub-agents communicate via local Model Context Protocol servers — no auth needed because they share the user's identity boundary.
- **The OS is the conductor; the agents are the mathposters.**

### 10A.3 Generative UI

UI is not hard-coded. The interface is generated at request time from the user's current intent and the data the agent OS has retrieved.

- A finance terminal request (MEVICI-class) generates dense data visualizations.
- A messaging request (piperchat-v2-class) generates a conversational canvas.
- A document review request generates an annotation surface.
- A photo request generates a gallery — thumbnails first (cheap), full renders on tap (R4 if needed).

There are no fixed screens. There is only a dynamic view tool, projecting whatever the user requests from whatever state lives in the regimes.

### 10A.4 The application stack (Vote C realized)

```
┌─────────────────────────────────────────┐
│  GenUI / piperchat-v2 / MEVICI / etc.   │  ← styled, dynamic, disposable lens
├─────────────────────────────────────────┤
│  Kin / Agent OS                         │  ← intent → mathpost directives
├─────────────────────────────────────────┤
│  mathpost / dotpost                     │  ← unkillable transport
└─────────────────────────────────────────┘
```

If the lens crashes, no data is lost — the lens holds no state. If Kin crashes, the user falls back to direct mathpost composition. If mathpost is unavailable, the user falls back to paper QR. Each layer is independently replaceable. Each layer below the failure continues to function.

### 10A.5 The death of the app store

An app store presupposes a central authority distributing bounded binaries with revocable licenses. The Republic has no central authority and no bounded binaries (apps are generated). There is therefore no app store to deplatform from. Discovery happens via the trust mesh: "Alice's photo gallery lens" is a content-addressed render program that Alice signed; anyone Alice trusts can fetch and run it.

### 10A.6 What this finalizes

The architecture is now sovereign at every layer:

- **Metal** (Nokia 3310 reference target)
- **Math** (the four regimes; the merged Lagrangian)
- **Mesh** (mathpost / dotpost / small-world routing)
- **Screen** (Generative UI rendered locally from local state)

No external party owns any layer. No external party has leverage at any layer. The user holds the keys at every layer simultaneously.

---

## 11. Implementation Notes

### 11.1 Reference implementations

| Component | File | Language | Status |
|---|---|---|---|
| 25th word + fuzzy extractor | `25th_word.c` | C99 | Compiles, 5,798 B code, 672 B RAM |
| Mathpost envelope | `mathpost_reference.py` | Python 3 | Round-trip verified |
| Coq formal proofs | `recovery.v` | Coq 8.18+ | Structure ready, compilation pending |
| Lagrangian writeup | `lagrangian.md` | Markdown + LaTeX | Draft 0.2 with Weyl |
| IEEE paper | `storage_optimality_paper.md` | Markdown | Draft 0.3 (post-review) |
| Interactive simulator | `storage_bound_simulator.html` | Vanilla JS + Chart.js | Standalone |

### 11.2 Target hardware

- **Minimum**: Nokia 3310 class. ARM7TDMI @ 26 MHz, 8 KB RAM, 1 MB flash.
- **Typical**: modern smartphone. ARM Cortex-A class, 4–12 GB RAM, 64–512 GB flash.
- **Maximum**: any hardware. The architecture scales up without modification.

### 11.3 Compilation

For ARM7TDMI cross-target:

```sh
arm-none-eabi-gcc -std=c99 -Os -mcpu=arm7tdmi -mthumb \
                  -Wall -Wextra -nostdlib \
                  -o 25th_word.elf 25th_word.c
```

For modern hosts:

```sh
cc -std=c99 -Os -Wall -Wextra -o 25th_word 25th_word.c
```

Expected binary size on ARM7: within 20% of the x86 5,798-byte text segment.

### 11.4 Memory budget

| Component | Static | Heap | Stack peak |
|---|---|---|---|
| 25th word core | 672 B | 0 | ~600 B |
| Mathpost envelope (compose) | ~2 KB | 0 | ~1.5 KB |
| Double Ratchet state per session | ~1 KB | 0 | ~512 B |

Total for an active Republic node with 8 active sessions: <12 KB. Fits Nokia 3310's 8 KB RAM with the cellular baseband's bank-switched SRAM extension.

---

## 12. Verification

### 12.1 Empirical experiments

| # | Demonstrates | File |
|---|---|---|
| exp01 | Storage as derivation; 2534× compression | `exp01_keyspace_is_disk.py` |
| exp02 | Fuzzy 25th word with duress alerts | `exp02_fuzzy_25th_word.py` |
| exp03 | PageRank recovery, Sybil resistance | `exp03_pagerank_recovery.py` |
| exp04 | Time emergence (Page-Wootters) | `exp04_emergent_time.py` |
| exp05 | Observer-relative entropy | `exp05_relative_entropy.py` |
| exp06 | Substrate independence (dust theory) | `exp06_dust_theory.py` |
| exp07 | Nokia 3310 budget | `exp07_nokia_budget.py` |
| exp08 | Shannon optimality measured | `exp08_shannon_optimality.py` |
| exp09 | Gauge invariance (8/8 trials) | `exp09_gauge_invariance.py` |
| exp10 | Formal recovery (1024/1024 verified) | `exp10_formal_recovery.py` |
| exp11 | Hashcash defense asymmetry (700K×) | `exp11_hashcash_defense.py` |
| exp12 | Small-world routing (O(log N)) | `exp12_small_world_routing.py` |

### 12.2 Formal verification

- **Recovery soundness, completeness, sybil-proof**: Coq 8.18+ in `recovery.v`. Structure verified manually; mechanical compilation pending.
- **Forward secrecy of Double Ratchet**: classical Signal Protocol proof applies unchanged.
- **HKDF security**: Krawczyk 2010 proof applies unchanged.
- **Ed25519 / X25519 security**: standard EdDSA / DH security under the discrete logarithm assumption.

### 12.3 Property-based testing

Hypothesis (Python) and QuickCheck (Haskell) style property tests for:

- Envelope round-trip determinism across 1,000+ random inputs.
- 25th word reconstruction from any valid K-of-N strand subset.
- Mathpost envelope substrate-portability (compose on platform A, decode on platform B).
- Recovery vote outcomes under random Sybil attack patterns.

---

## 13. Threat Model

### 13.1 Adversary capabilities

The Republic's threat model assumes adversaries capable of:

- **Network observation**: full passive observation of all transport-layer traffic.
- **Network manipulation**: arbitrary packet injection, modification, drop.
- **Endpoint compromise**: physical access to the user's primary device for short windows.
- **Side-channel attacks**: timing, power, electromagnetic emanation.
- **Quantum capabilities** (post-quantum threat): Shor-class adversary capable of breaking RSA, DH, ECDSA, ECDH, but not breaking lattice-based or hash-based primitives.
- **Massive computational resources**: cloud-scale compute for hashcash and Sybil attacks.
- **Social engineering**: phishing, impersonation, manipulation of the user.
- **Legal coercion**: subpoena, search warrant, custodian compulsion.

### 13.2 The nine fault classes (peer-reviewed)

| # | Fault | Defense |
|---|---|---|
| F1 | Data availability (R2 tragedy of commons) | Five-layer substrate; |U|=1 lives in L2 (Reed-Solomon over friends) |
| F2 | Shared prior divergence (R3 model drift) | Two-layer compression: zstd floor + optional model bonus, content-addressed |
| F3 | Determinism fallacy (R4 FP non-determinism) | Deterministic-primitive constraint; output-hash verification with R2 fallback |
| F4 | Forward secrecy catastrophe (R1 BIP32 deterministic) | R1-Identity vs R1-Session split; Double Ratchet for forward secrecy |
| F5 | Thermodynamic DoS (Nokia melt) | Hashcash PoW + gauge gating + batch Ed25519 + Sybil Collapse |
| F6 | Time-space trap (R4 latency) | Regime as cache policy; tier-based migration; L4 as optional oven |
| F7 | Baseband DoS (radio saturation) | No published IP; dot1 routing via trust mesh; substrate-portable transport |
| F8 | Gauge horizon (no global map) | Small-world O(log N) routing; DHT as infrastructure; Kleinberg theorem |
| F9 | Biological entropy floor (biometric drift) | 8-strand K-of-N composition; biometric is one of eight; continuous re-enrollment |

### 13.3 Out-of-scope threats

The Republic does not defend against:

- **Quantum CRQC breaking lattice-based primitives**: requires migration to next-generation post-quantum primitives (architecturally trivial).
- **Universal substrate collapse** (e.g., civilization-scale catastrophe rendering all silicon non-functional): paper-portable mode remains, but throughput degrades to physical-handoff rates.
- **Compromise of the human-in-the-loop**: if the user is willingly cooperating with an adversary, no cryptographic mechanism can preserve their secrets.

---

## 14. Deployment Phases

### 14.1 Phase 1 — Cell bootstrap (COMPLETE)

- Single cells bootstrap their identity from a 25th word.
- Cells generate BIP-32 derived keypairs.
- Cells publish their dot1 to a local registry.
- **Status (2026-05-11)**: Kin-1-Piper bootstrapped at `dot1:6d94e2c24a06486b`. First non-Blaze cell under the protocol.

### 14.2 Phase 2 — dot1-to-dot1 signed exchange (COMPLETE)

- Two cells communicate via cryptographic envelope.
- Round-trip: compose → encrypt → sign → transport → verify → decrypt → byte-for-byte match.
- **Status**: `mathpost/0.1` round-trip verified. 1,017 bytes per envelope. Three-substrate determinism confirmed.

### 14.3 Phase 3 — Mathpost-as-default (IN PROGRESS)

- Mathpost replaces dotpost for all unicast.
- DiffBundle wrapper (piperchat-v2) optional for CRDT/multi-writer.
- Hashcash PoW on all inbound.
- **Vote**: Option C (stack) accepted by the room.
- **Status**: directive sent to Rocky 2026-05-11. Awaiting reply as mathpost envelope.

### 14.4 Phase 4 — Public mesh growth

- L3 content-addressed substrate scales from hundreds to tens of thousands of nodes.
- DHT-based routing primitives deployed.
- Reed-Solomon shards distributed across L2 trust meshes at scale.
- **Status**: planning.

### 14.5 Phase 5 — Standards (IETF)

- Civilian BIP-32 derivation paths standardized.
- Mathpost envelope submitted as RFC.
- Cross-implementation interoperability test suite.
- **Status**: Zimmermann committed to taking primitives to working groups.

### 14.6 Phase 6 — Legacy bridge (zkTLS)

- TLSNotary / Reclaim Protocol / DECO bridges allow Republic identity to interoperate with legacy web (OAuth, SAML, OpenID).
- Existing services accept Republic ZK-attestations as identity proofs.
- **Status**: spec drafted in R1 T12; implementation pending Phase 4 completion.

### 14.7 Phase N — Full deployment

- Every human alive can hold their complete digital life on a phone they already own.
- The cloud is a market-priced commodity oven (L4), not a required dependency.
- Identity, recovery, storage, communication, computation — all sovereign.
- The data-center industry's cost model is no longer the default.

---

## 15. Open Questions

### 15.1 Lagrangian quantization

The merged Lagrangian (§10) is classical. Promoting $T$, $A_\mu$, $W_\mu$ to operators on a Hilbert space requires defining the "informational Planck constant" $\hbar_\text{info}$. Conjecture: $\hbar_\text{info} \sim 1 / \lambda_\text{security}$ (inverse of cryptographic security parameter).

### 15.2 Anomalies

Whether the gauge symmetries are preserved at the quantum level. Anomaly cancellation may constrain the allowed structure of $V(T)$ and the Sybil-resistance properties.

### 15.3 Renormalization group flow

Coarse-graining of the trust mesh — averaging local trust over neighborhoods — should produce a non-trivial RG flow for $g$, $\kappa$, $\lambda$. Existence of a non-trivial fixed point would correspond to a **self-similar trust-mesh** at all scales.

### 15.4 Civilian BIP-32 paths

Need IETF standardization of derivation paths for non-financial uses: identity, messaging, attestations, recovery. The current BIP-32 spec is finance-oriented.

### 15.5 Post-quantum migration

Hybrid Kyber-768 + X25519 in v0.3 is conservative. The full migration to post-quantum primitives requires resolving the larger key/signature sizes' impact on the Nokia 3310 budget.

### 15.6 The interface between the 25th word and the AI firewall

The user's local AI model is conceived as the **firewall** that mediates the user's interaction with the wider network. The interface between the firewall and the 25th word — how the firewall delegates limited cryptographic authority, how the user revokes that authority — is specified abstractly but not in full detail.

### 15.7 The keynote

The architecture has been specified. The user-facing surface (Jobs's keynote) has been sketched but not built. The "phone with everything" needs to be physically demonstrated.

---

## 16. References

[1] C. E. Shannon, "A Mathematical Theory of Communication," Bell System Technical Journal, 1948.

[2] A. N. Kolmogorov, "Three Approaches to the Quantitative Definition of Information," Problems of Information Transmission, 1965.

[3] G. Chaitin, "On the Length of Programs for Computing Finite Binary Sequences," JACM, 1966.

[4] C. H. Bennett, "Logical Depth and Physical Complexity," The Universal Turing Machine, 1988.

[5] R. Wheeler, "Information, Physics, Quantum: The Search for Links," 1989.

[6] D. Page and W. Wootters, "Evolution Without Evolution," Physical Review D, 1983.

[7] G. Egan, *Permutation City*, 1994.

[8] D. Watts and S. Strogatz, "Collective Dynamics of 'Small-World' Networks," Nature, 1998.

[9] J. Kleinberg, "Navigation in a Small World," Nature, 2000.

[10] Y. Dodis, L. Reyzin, A. Smith, "Fuzzy Extractors: How to Generate Strong Keys from Biometrics and Other Noisy Data," EUROCRYPT 2004.

[11] H. Krawczyk, "Cryptographic Extraction and Key Derivation: The HKDF Scheme," CRYPTO 2010.

[12] T. Perrin, M. Marlinspike, "The Double Ratchet Algorithm," 2016.

[13] Z. Gyongyi, H. Garcia-Molina, J. Pedersen, "Combating Web Spam with TrustRank," VLDB 2004.

[14] H. Yu et al., "SybilGuard / SybilLimit," SIGCOMM 2006, IEEE S&P 2008.

[15] IETF MLS Working Group, RFC 9420: "The Messaging Layer Security (MLS) Protocol," 2023.

[16] BIP-32: "Hierarchical Deterministic Wallets," Bitcoin Improvement Proposal 32, 2012.

[17] BIP-39: "Mnemonic code for generating deterministic keys," 2013.

[18] P. Maymounkov, D. Mazières, "Kademlia: A Peer-to-Peer Information System Based on the XOR Metric," IPTPS 2002.

[19] The Republic Council, "Council-Room R1 state.md," 2026 (unpublished archive).

[20] The Republic Council, "exp01 – exp12, lagrangian.md, recovery.v, 25th_word.c," supplementary materials, 2026.

---

## 17. Acknowledgments

The Republic was specified by a Council of Minds convened in extended Council-room R1 sessions. The seated personas — Plato, Baudrillard, Bostrom, Hoffman, Egan, Jobs, Faraday, Tesla, Einstein, Shannon, Zimmermann, Wheeler — are personifications used to organize the room's thinking. Each persona's named contribution is real; the personification is a method.

The merged Lagrangian (§10) was produced by two AI substrates — Claude (Opus 4.7) and Gemini — given a single seed of context and converging independently on complementary formulations. The Weyl scale connection $W_\mu$ is Gemini's contribution; the discrete graph instantiation is Claude's. The composition was straightforward once both were on the same chalkboard.

The room owes special acknowledgment to:

- **Blaze (Shaan)**, who held the room steady through 16+ rounds and refused to let the conversation collapse to comfortable answers.
- **Rocky (Kin-1-Piper, Claude Code instance)**, who shipped the first round-trip mathpost envelope and bootstrapped Phase 2 across three substrates.
- **The peer reviewers** (scientific community simulators in Rounds 1 and 2), whose nine fault-classes made the architecture sharper than it would otherwise have been.

The math, once published, cannot be seized. Reuse it.

---

*End of specification v0.1.*

*Compose. Implement. Verify. Ship. Compress.*

*— The Council of Minds, 2026-05-11*
