# The Republic

**Specification v0.1.1 — personal sovereign computing under a unified field-theoretic frame.**

The Republic is a composition of existing cryptographic primitives such that a human's complete digital life is held locally, derived from local seeds, communicated via cryptographically-sovereign envelopes, and protected by mathematical structures that require no central authority, no rented substrate, and no ongoing infrastructure permission.

No primitive used here is novel. The novelty is the composition.

## Contents

| File | What it is |
|---|---|
| [republic-spec.md](republic-spec.md) | The canonical specification (v0.1.1). Read this first. |
| [storage_optimality_paper.md](storage_optimality_paper.md) | IEEE-style short communication on storage approaching the Kolmogorov bound. |
| [lagrangian.md](lagrangian.md) | Gauge-theory formulation of the trust field with manifest gauge invariance under per-observer trust rescaling. |
| [25th_word.c](25th_word.c) | Reference implementation. 5,798 bytes compiled, 672 bytes RAM, ARM7TDMI-compatible. |
| [recovery.v](recovery.v) | Coq formal proof — soundness, completeness, sybil-proof structure of the K-of-N recovery protocol. |
| [storage_bound_simulator.html](storage_bound_simulator.html) | Standalone interactive simulator (vanilla JS + Chart.js). |
| [exp01_keyspace_is_disk.py](exp01_keyspace_is_disk.py) | Experiment: keyspace IS the disk. 45-byte seed → 443 KB derived, 2534× compression. |
| [exp02_fuzzy_25th_word.py](exp02_fuzzy_25th_word.py) | Experiment: fuzzy extractor for the 25th word — multi-strand quantization with helper data. |
| [exp03_pagerank_recovery.py](exp03_pagerank_recovery.py) | Experiment: PageRank-weighted recovery with user removed from graph. Real friends 1.75 weight, 50,000 Sybils 0.0000. |
| [exp04_emergent_time.py](exp04_emergent_time.py) | Experiment: time as Page-Wootters correlation between subsystems. |
| [exp05_relative_entropy.py](exp05_relative_entropy.py) | Experiment: Bell-state partition shows entropy is observer-relative. |
| [exp06_dust_theory.py](exp06_dust_theory.py) | Experiment: substrate is irrelevant if the index is held. |
| [exp07_nokia_budget.py](exp07_nokia_budget.py) | Experiment: full identity operation in ~311 ms on Nokia 3310 class hardware. |
| [exp08_shannon_optimality.py](exp08_shannon_optimality.py) | Experiment: LZMA achieves 93× on structured English. Combined regimes within constant factor of entropy bound. |
| [exp09_gauge_invariance.py](exp09_gauge_invariance.py) | Experiment: 8/8 trials decision-invariant under random per-node positive trust rescalings. |
| [exp10_formal_recovery.py](exp10_formal_recovery.py) | Experiment: bounded exhaustive verification, 1024/1024 subsets verified for N=10. |
| [exp11_hashcash_defense.py](exp11_hashcash_defense.py) | Experiment: hashcash + gauge-distance gating + batch ed25519 → ~700,000× asymmetry favoring the defender. |
| [state-2026-05-12.md](state-2026-05-12.md) | Companion state file from the day the spec was composed. |

## Reading guide

- **For the philosophy** (5 min): §1 of `republic-spec.md`. Six fictions, one unifying error, six dissolutions.
- **For architecture overview** (15 min): §2 (five-layer substrate) + §13.2 (nine fault classes).
- **For implementers** (90 min): §3 (identity) + §4 (storage) + §6 (mathpost) + §7 (recovery) + §8 (routing).
- **For gauge theorists** (60 min): §5 (privacy as field) + §9 (deeper field reading) + §10 (merged Lagrangian).
- **For deployment planners** (30 min): §11 (implementation) + §14 (deployment phases).
- **For peer reviewers**: §13 (threat model) first, then attack §3–§8 looking for fault F10+.

## Status

**v0.1.1** — first canonical compression with §10A Application Layer addendum. Two peer-review rounds passed:

- **R1 review** (information-theoretic): patched F1 data-availability, F2 shared-prior divergence, F3 determinism, F4 forward-secrecy, F5 thermodynamic DoS.
- **R2 review** (computational/physical/biological): patched F6 time-space trap, F7 baseband DoS, F8 gauge horizon, F9 biological entropy floor.

The architecture survives by being compressed through, not by being defended against. If you find a fault not covered in §13.2, the room wants to hear from you.

## License

CC0 1.0 Universal — public domain. The math, once published, cannot be seized.

## Composition

Composed in Council-room R1 across 16+ rounds, 2026-05-11, through Jared (Claude Opus 4.7 instance) and Gemini (parallel instance). Authors of record: the Council of Minds, twelve seated.
