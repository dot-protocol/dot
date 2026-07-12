---
status: DRAFT (Gilfoyle first-run product, R1.41 directive)
source_round: state-2026-05-14-R1.47.md
source_obs_ids: OBS-dot-protocol-20260514-641, council-r1-34, council-r1-39
derived_from: R1.18 (Anti-Entropy bandwidth bound), R1.34 (Bench One), R1.39 (energy-is-in-the-right-place)
verifier_run: Surface B, gated on Blaze approval
blaze_decision: PENDING
retire_when: superseded by ratified v0.2 in republic-spec/ tree
co_signers: Shannon (holds the piece — R1.18 bandwidth constraint could be wrong; Tesla holds Maria's deployment-test gate)
---

# spec/15-reversibility.md — Wire-Layer Reversibility Audit

> **Frame.** This spec sits inside R1.18's Anti-Entropy claim. R1.18 established that the binding constraint on Republic scale is *bandwidth-into-readers* (Shannon-Hartley + attention saturation), NOT Carnot. Reversibility is one engineering target inside that frame, not the frame itself. R1.39 added: the Republic does not move energy around; it places computation where the energy already is.

## §1 Purpose

Audit every protocol primitive on the Republic's wire layer for Landauer cost. For each primitive, identify which bits are erased per operation, compute `kT·ln(2)` per erasure as a function of operating temperature, and either (a) propose a Toffoli/Fredkin/Bennett-style reversible substitution or (b) document the cost as accepted.

The output is a table: primitive → erased-bit-count-per-op → energy-floor-at-300K → substitution-status.

## §2 Primitives in scope

Each row below is a section in v0.2. v0.1 draft enumerates only.

| # | Primitive | Where it lives | Audit status |
|---|---|---|---|
| 1 | **mathpost envelope construction** (header + payload + sig) | `mathpost/0.2-archival` | DRAFT |
| 2 | **Ed25519 signing** (Curve25519 scalar mult + hash) | per-observation, per-key-derivation | DRAFT |
| 3 | **Ed25519 verification** (point decompression + scalar mult + hash) | per-observation read | DRAFT |
| 4 | **BIP32 derivation** (HMAC-SHA512 chain) | identity-per-context (R1.40) | DRAFT |
| 5 | **HKDF** (HMAC-SHA256 extract + expand) | sealed-body + handshake | DRAFT |
| 6 | **AES-256-GCM** (round function + GMAC) | sealed-body encryption | DRAFT |
| 7 | **BLAKE3** (content addressing) | per-DOT, per-chunk | DRAFT |
| 8 | **zstd-3 compression** (LZ77 + Huffman) | mathpost payload, blob chunks | DRAFT |
| 9 | **Lucene fulltext indexing** (analyzer + posting list) | Oracle read-side | OUT OF SCOPE (read-side, not wire) |
| 10 | **Neo4j Cypher matching** (graph traversal) | Oracle read-side | OUT OF SCOPE |
| 11 | **Worldline entropy harvester** (keystroke + accel + GPS hashing) | R1.39, enrollment ritual | DRAFT |

## §3 Audit method (per row)

For each primitive:

1. **Identify the abstract computation.** State the function `f: A → B` it implements.
2. **Identify reversibility.** Does `f` have an inverse? If `|A| > |B|`, then at least `log2(|A|/|B|)` bits are erased per call.
3. **Count erased bits.** Concrete count, not asymptotic. Example: SHA-256 maps arbitrary-length input to 256-bit output; per block of 512 input bits, it erases approximately 256 bits (the compression function is many-to-few).
4. **Compute energy floor.** At T = 300K, `kT·ln(2)` ≈ 2.87 × 10⁻²¹ J per bit erased. Multiply by bits-per-op to get joules-per-op.
5. **Identify substitution.** Can a reversible variant be used? E.g., Toffoli (CCNOT) is universal for classical reversible computation; Fredkin (controlled-swap) preserves bit-count; Bennett's ancilla-bit trick can make any irreversible computation reversible at the cost of carrying garbage bits.
6. **Verdict.** One of: **REVERSIBLE** (no Landauer cost) | **SUBSTITUTE** (reversible variant exists, recommend swap) | **ACCEPT** (substitution exists but cost is justified — e.g., security requires the erasure) | **OUT OF BUDGET** (substitution exists but ancilla overhead too large for the substrate).

## §4 Sample row, fully worked (Ed25519 verification)

**Abstract computation.** `verify: (pubkey, msg, sig) → bool`. Output is 1 bit.

**Reversibility.** Many-to-one. Many (msg, sig) pairs verify against the same pubkey. Erasure is large: ~256 bits of input collapse to 1 bit of output per verification.

**Erased bits per op.** Approximately 256 bits per verification (sig is 512 bits but uniquely determined by msg+sk so the relevant erasure happens earlier in the hash chain).

**Energy floor at 300K.** `256 × 2.87 × 10⁻²¹ J ≈ 7.3 × 10⁻¹⁹ J per verification`. At 10⁶ verifications per second (well within a smartphone), `≈ 7.3 × 10⁻¹³ W`. Six orders of magnitude below transistor leakage. **Not the binding constraint.**

**Substitution.** Reversible Ed25519 not known to exist as practical primitive. Substitution would require Bennett ancilla construction; ancilla overhead approximately doubles state per gate, which propagates to memory cost. **OUT OF BUDGET for v0.2.** Revisit when reversible-compute hardware becomes practical (~10y horizon per Margolus-Levitin estimates).

**Verdict for Ed25519 verification:** `ACCEPT` — security requires the many-to-one map; energy floor is negligible vs other system costs.

## §5 R1.39 contribution — *energy is in the right place*

Maxwell at the table (R1.39): when the user smashes keys, the user does mechanical work that dissipates as heat. The Republic captures the *shape* of the keystrokes — timing, location, pressure — before the entropy fully disperses. The keystrokes are a low-entropy snapshot of a high-entropy process. The hash function freezes that snapshot into a cryptographic seed. **The user is Maxwell's demon. The Republic is the box the demon's information goes into.**

Landauer (voiced from 1961) added the energy accounting: approximately 0.5 joules per keystroke (finger acceleration cost), 30 seconds at ~4 keys/sec equals ~60 joules of user-side work. The cryptographic hash costs perhaps a microjoule. *The user pays the energy cost of the entropy by being a body in time. The math pays nothing in comparison.*

This is the inverse of the data center model — there the user pays nothing to log in and the building pays megawatts. Here the user pays joules and the building pays microjoules. **The energy is located in the right place.**

**Doctrinal consequence for this spec:** v0.2 does NOT propose reducing the user's joules. v0.2 proposes that the *protocol's* joules (the bits the wire-layer erases) be reduced via reversible substitutions where the substitution is in budget. The user's worldline-entropy expenditure (R1.39) is intentional — it is the source of the entropy that makes the system secure. We do not optimize that away.

## §6 What v0.2 must produce (and v0.1 does NOT yet contain)

- Full worked row for each of the 11 primitives in §2 (§4 contains only the sample row).
- Concrete energy-floor numbers per primitive, per ops/sec budget, at T=300K and T=77K (Maria's substrate vs LN2-cooled mesh-node).
- Reference implementation of any SUBSTITUTE-verdict primitive in C99 + ARM7TDMI, compatible with the Nokia 3310 R5 substrate (per R1.31).
- A summary table: total joules-per-Republic-message at T=300K with all SUBSTITUTE-verdict primitives applied vs current. Target: at least one order of magnitude reduction.
- A "blocked on physics" appendix: primitives where no reversible substitute is known. (Expected: Ed25519 verify, AES-GCM round function, BLAKE3 compression.)

## §7 Open questions for Blaze (BLAZE-DECISION-REQUIRED)

1. **Is the T=300K assumption load-bearing?** Maria's substrate may operate at T=300K. A Nokia 3310 stored cold operates closer to T=270K. A mesh node in a Frankfurt data center at T=295K. Do we audit at a single representative temperature, or do we provide a function `J(T)` per primitive? Recommend: function `J(T)` with worked examples at 300K, 270K, 77K.

2. **Does the audit include the user's worldline-entropy ritual (row 11)?** R1.39 makes the user the energy source. If we audit it the same way as a mathpost envelope, the energy floor is ~60 joules per enrollment — *which is the point*, not a defect. Recommend: keep row 11 in the audit but mark verdict as `INTENTIONAL` (a new fourth verdict category alongside REVERSIBLE/SUBSTITUTE/ACCEPT/OUT-OF-BUDGET).

3. **Co-signer constraint (Shannon).** Shannon co-signed R1.41 holding the piece: *R1.18's bandwidth-into-readers binding constraint could be wrong*. If R1.18 is wrong and the binding constraint is in fact thermodynamic, then the reversibility audit becomes the highest-leverage spec, not a sub-target. Verify with Shannon before locking the framing.

4. **Co-signer constraint (Tesla).** Tesla holds the piece: *Maria's deployment test gates the engineering*. If Maria's stove produces a thermal gradient sufficient for the audit's target ops-per-second, the audit is grounded; if not, the audit is theatre. Verify with deployment data (R1.41 Surface C action — Maria's QR scan) before locking the energy-floor numbers.

## §8 Out of scope for v0.2

- Quantum reversibility (gates on qubits, not bits). R1.34 Bench Three's `mathcomputer.md` addresses the post-quantum substrate.
- Side-channel resistance (timing, EM, power-trace attacks). Different threat model, separate spec.
- Hardware compute substrate (FPGA, ASIC, neuromorphic). v0.2 assumes commodity Cortex-M and x86/ARM.
- Pixel-substrate reversibility (R1.31 paper, tile, stone). These substrates carry no Landauer cost because they do not compute — they store. Reversibility for them is a different question (rotational symmetry of glyphs, etc) handled in `spec/19-pixel-substrate.md` (not yet drafted).

## §9 References

- Landauer, R. (1961). *Irreversibility and Heat Generation in the Computing Process*. IBM J. Res. Dev. 5(3).
- Bennett, C. H. (1973). *Logical Reversibility of Computation*. IBM J. Res. Dev. 17(6).
- Bennett, C. H., Bernstein, E., Brassard, G., Vazirani, U. (1997). *Strengths and Weaknesses of Quantum Computing*. SIAM J. Comput. 26(5).
- Toffoli, T. (1980). *Reversible Computing*. MIT/LCS/TM-151.
- Margolus, N., Levitin, L. B. (1998). *The maximum speed of dynamical evolution*. Physica D 120(1-2).
- Verlinde, E. (2010). *On the Origin of Gravity and the Laws of Newton*. arXiv:1001.0785.
- Republic Spec v0.1.1, §10 (lagrangian / Anti-Entropy formalization).
- state-2026-05-14-R1.47.md (R1.18 Anti-Entropy, R1.34 Bench One, R1.39 energy-is-in-the-right-place).

---

*v0.1 DRAFT. Awaiting Blaze decision on §7 open questions before §2-§6 expand into full v0.2. Gilfoyle does not ship without `APPROVED` in REVIEW.md.*
