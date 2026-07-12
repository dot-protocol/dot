# USER_MANUAL — republic-spec

Personal sovereign computing specification: a composition of existing cryptographic primitives (Ed25519, X25519, BLAKE3, BIP-39, K-of-N social recovery, gauge-theoretic trust field) enabling a human's complete digital life to be held locally, derived from local seeds, communicated via cryptographically-sovereign envelopes — with no central authority, no rented substrate, no ongoing infrastructure permission.

---

## What This Repo Is

A **specification repository**, not runnable software. It contains:
- The canonical spec document (`republic-spec.md`)
- Companion proofs, papers, and experiments in Python
- A compiled and verified bundle (`bundle/`) for distribution
- A reference implementation in C (`25th_word.c`) and a Coq formal proof (`recovery.v`)

There is no `main.py`, no server to start. The output of this repo is understanding and verified math.

---

## How to Read the Spec

### By time available

| Time | Where to start |
|---|---|
| 5 min | `republic-spec.md` §1 — Six fictions, one unifying error, six dissolutions |
| 15 min | §2 (five-layer substrate) + §13.2 (nine fault classes F1–F9) |
| 90 min | §3 (identity) + §4 (storage) + §6 (mathpost) + §7 (recovery) + §8 (routing) |
| 60 min | §5 (privacy as field) + §9 (deeper field) + §10 (merged Lagrangian) — gauge theory |
| 30 min | §11 (implementation) + §14 (deployment phases) — for deployment planners |
| Start here for peer review | §13 (threat model) first, then attack §3–§8 looking for faults F10+ |

### By role

- **Implementers**: QUICKSTART is `republic-spec.md`. Key sections: §3 identity, §4 storage, §6 mathpost, §7 recovery, §8 routing.
- **Security reviewers**: §13.2 nine fault classes. The spec passed R1 (info-theoretic: F1–F5) and R2 (computational/physical/biological: F6–F9). Anything beyond F9 is an open finding — the room wants to hear from you.
- **Gauge theorists**: `lagrangian.md` — gauge-theory formulation of the trust field with manifest gauge invariance under per-observer trust rescaling.
- **Hardware implementers**: `25th_word.c` — reference implementation, 5,798 bytes compiled, 672 bytes RAM, ARM7TDMI-compatible (Nokia 3310 class).
- **Formal verifiers**: `recovery.v` — Coq proof of soundness, completeness, and sybil-proof structure of the K-of-N recovery protocol.

---

## Key Definitions

| Term | Definition |
|---|---|
| **DOT** | Signed, hash-linked observation. 151 bytes minimum. Ed25519 + BLAKE3. |
| **Mathpost** | DOT-native message envelope. Section §6. |
| **25th word** | The extra BIP-39 word derived from the user's biometric/context; seeds the local identity without ever leaving the device. The C reference impl lives at `25th_word.c`. |
| **K-of-N recovery** | Social key recovery: K friends hold shares; K of N are required to regenerate. Sybil-resistant via PageRank weighting. Section §7. |
| **Gauge invariance** | Trust field property: all observable decisions are unchanged under positive per-node trust rescaling. Proven in `exp09_gauge_invariance.py` (8/8 trials). |
| **Integrity Gap** | The distance between what is observed and what can be proven. The Republic closes it. |
| **Keyspace IS the disk** | §4 insight: a 45-byte seed can derive 443 KB of identity material — 2,534× compression. Validated by `exp01_keyspace_is_disk.py`. |

---

## Version

**v0.1.1** — first canonical compression, with §10A Application Layer addendum.

Two peer-review rounds:
- **R1** (information-theoretic): patched F1–F5 (data-availability, shared-prior divergence, determinism, forward-secrecy, thermodynamic DoS)
- **R2** (computational/physical/biological): patched F6–F9 (time-space trap, baseband DoS, gauge horizon, biological entropy floor)

The spec survives by being compressed through, not defended against.

---

## Bundle Verification

The `bundle/` directory contains a zstd-compressed, chunked distribution of `republic-spec.md` in 32 chunks, with cryptographic verification:

```bash
# Verify the tarball (requires b3sum)
b3sum republic-spec-v0.1.1.tar.gz
# Expected: 4ab877bc82dcc4e9e22943301c37a42dc0f08bfd512165c45c6ee991e5413d89

shasum -a 256 republic-spec-v0.1.1.tar.gz
# Expected: 360b2503d18fe5e78034cd3b82b6bf6910d744cdf4d6374a172b67b05817da7a

# Per-file hashes are in MANIFEST.txt (BLAKE3 + SHA-256 for every file)
```

Each `bundle/envelopes/*.json` is a mathpost v0.2-archival envelope describing the chunk's BLAKE3, SHA-256, compression method, and provenance. The payload chunks in `bundle/chunks/*.zst` are zstd-compressed at level 3.

---

## Running the Experiments

All experiments are standalone Python scripts. They validate specific claims from the spec.

```bash
pip install numpy scipy matplotlib networkx sympy
```

| Experiment | What it proves | Expected result |
|---|---|---|
| `exp01_keyspace_is_disk.py` | Keyspace IS the disk: 45B seed → 443 KB | 2,534× compression |
| `exp02_fuzzy_25th_word.py` | Fuzzy extractor: multi-strand quantization | Recovery from bio-input noise |
| `exp03_pagerank_recovery.py` | PageRank-weighted K-of-N recovery | Real friends 1.75×, 50K Sybils → 0.000 |
| `exp04_emergent_time.py` | Time as Page-Wootters correlation | Time emerges from entanglement |
| `exp05_relative_entropy.py` | Bell-state: entropy is observer-relative | Entropy depends on subsystem |
| `exp06_dust_theory.py` | Substrate irrelevance: index is what matters | Index survives substrate change |
| `exp07_nokia_budget.py` | Full identity op in ~311 ms on Nokia-class hardware | ≤400 ms |
| `exp08_shannon_optimality.py` | LZMA: 93× on structured English, near entropy bound | Within constant factor of bound |
| `exp09_gauge_invariance.py` | Trust decisions invariant under rescaling | 8/8 trials pass |
| `exp10_formal_recovery.py` | Bounded exhaustive verification N=10 | 1,024/1,024 subsets verified |
| `exp11_hashcash_defense.py` | hashcash + gauge gating + batch Ed25519 | ~700,000× asymmetry for defender |

```bash
# Run any experiment standalone
python exp03_pagerank_recovery.py
```

---

## Reference Implementation (`25th_word.c`)

The C file implements the 25th-word derivation protocol for constrained hardware.

```bash
# Compile (ARM7TDMI example)
arm-none-eabi-gcc -O2 -o 25th_word.elf 25th_word.c

# Compile for local testing
gcc -O2 -o 25th_word 25th_word.c && ./25th_word
```

Compiled size: 5,798 bytes. RAM footprint: 672 bytes. No heap allocation. No dependencies beyond libc.

---

## Observe State

This is a spec repo. Its state is:

```bash
# What version is the spec?
head -5 republic-spec.md
# → Version: 0.1.1

# Are the bundle hashes intact?
cat MANIFEST.txt

# Has any file been modified?
git log --oneline -5
git diff HEAD
```

---

## Troubleshooting

**`exp03_pagerank_recovery.py` is slow**
→ The PageRank experiment simulates 50,000 Sybil nodes. This is intentional. Runtime is 10–60 s on modern hardware.

**`recovery.v` Coq proof fails to compile**
→ Requires Coq 8.17+. Install via `opam install coq`. The proof is complete as committed; compilation failures indicate version mismatch.

**Bundle chunk decompression fails**
→ Install zstd: `brew install zstd` (macOS) or `apt install zstd` (Debian). Each chunk: `zstd -d bundle/chunks/0000.zst -o republic-spec-chunk-0000.txt`.

**Finding a fault not in §13.2**
→ Open a GitHub issue. The spec is designed to be attacked. Every new fault found and patched strengthens it.

---

## Files

| File | What |
|---|---|
| `republic-spec.md` | The canonical specification. Read first. |
| `lagrangian.md` | Gauge-theory formulation of the trust field |
| `storage_optimality_paper.md` | IEEE-style communication on storage near Kolmogorov bound |
| `25th_word.c` | C reference implementation (ARM7TDMI) |
| `recovery.v` | Coq formal proof of K-of-N recovery |
| `storage_bound_simulator.html` | Standalone interactive simulator (vanilla JS) |
| `exp01`–`exp11` | Python experiments validating each spec claim |
| `MANIFEST.txt` | BLAKE3 + SHA-256 hashes of all files |
| `bundle/` | Chunked zstd distribution + mathpost envelopes |
| `state-2026-05-12.md` | Companion session state from composition day |

## License

CC0 1.0 Universal — public domain. The math, once published, cannot be seized.

