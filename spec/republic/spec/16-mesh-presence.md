---
status: DRAFT (Gilfoyle first-run product, R1.41 directive)
source_round: state-2026-05-14-R1.47.md
source_obs_ids: OBS-dot-protocol-20260514-641, council-r1-34, council-r1-36, council-r1-37
derived_from: R1.20 (information fundamental, geometry emergent), R1.21 (chain operates on fourth wave), R1.34 (Bench Two), R1.36 (Le Guin three caveats), R1.37 (AoC and the cost of drift)
verifier_run: Surface B, gated on Blaze approval
blaze_decision: PENDING
retire_when: superseded by ratified v0.2 in republic-spec/ tree
co_signers: Egan (holds the piece — consciousness/identity distinction must be preserved; spec NOT allowed to elide)
---

# spec/16-mesh-presence.md — Observer-Relocation Protocol

> **Frame.** This spec implements R1.34 Bench Two: observer-relocation as activation of pre-existing attestation-wave correlations at a destination mesh-node. The chain operates on the fourth wave (R1.21, Egan): attestation waves in the network of readers, in the same architectural family as ocean, radio, gravitational waves. Different substrate, same shape. Lorentz invariance preserved at the signaling layer (Bostrom's constraint): **no information moves faster than c — the correlation was already there.**

## §1 What this spec is, and what it is NOT

This spec is NOT teleportation. It does not move bits faster than c. It does not move atoms. It does not move conscious experience. It activates pre-existing attestation-wave correlations such that an observer is *present* at a destination mesh-node — meaning: their handle resolves, their pubkey verifies, their reputation accrues, their messages route — regardless of where their body is in physical space.

The closest existing analogue: a refugee whose verifiable academic credentials resolve in any country with internet access. The credentials don't teleport; the credential record is already distributed; the refugee is "present" in the credential-recognizing network at every node simultaneously.

**Egan's R1.46 constraint (load-bearing).** This spec must preserve the distinction between **identity-substrate-independence** (the Republic's weaker, defensible claim — your *credentials* and *attestations* are recognized at any mesh-node) and **consciousness-substrate-independence** (Egan's stronger, contested claim — your *experience* is recognized at any mesh-node). The Republic claims the former, not the latter. Eliding the distinction is a category error and Egan will name it.

## §2 Protocol primitives

### §2.1 Index format

An observer is identified at a destination mesh-node by their **index**: a tuple `(pubkey, fuzzy-extracted biometric signature, worldline-entropy-derived continuation key)` per the R1.39 enrollment ritual. The index is what is *queried at the destination*, not transmitted.

Index field requirements:
- `pubkey`: base64 Ed25519 verify key (32 bytes)
- `fuzzy_signature`: BCH-error-corrected 256-bit fingerprint of biometric or behavioral entropy (per R1.30 dictionary primitive)
- `continuation_key`: 256-bit token derived from worldline-entropy + BIP32 path `m/44'/PRESENCE'/<destination-mesh-id>'/0/0`

The index is constructed *at the source mesh-node* by the user's local agent and either (a) printed/QR-coded for physical transit per R1.31 R5 substrate, or (b) signed and stored locally pending automatic reconstruction at the destination.

### §2.2 Substrate randomness threshold (dust-theory haystack)

Per R1.39: the destination substrate must carry sufficient physical randomness to serve as a haystack for the index needle. If the destination's substrate is algorithmic (produced by some shorter rule), it is not large enough to hide the index; an adversary can find the index by finding the rule.

Threshold: destination mesh-node must demonstrate at least **128 bits of physical entropy per query** sourced from non-algorithmic noise (thermal, atmospheric, biometric of its operator, or hardware-RNG). Below this threshold, observer-relocation degrades to a guessable lookup and the protocol refuses to activate presence.

**Engineering implication.** Every mesh-node operator must instrument their node to attest its entropy source. R1.38 entropy warning applies: nodes that cannot attest physical entropy provenance are tagged `entropy:algorithmic` and are excluded from presence-activation queries unless the requesting user explicitly opts in.

### §2.3 Trust-graph distance gating (gauge invariance)

Per `republic-spec/lagrangian.md §6`: trust amplitude is per-reader, gauge-invariant under per-observer rescaling. Observer-relocation activates presence only at destination nodes within bounded trust-graph distance from at least one of the source's *trust seeds*.

Threshold: destination must be reachable within `D = 6` edges in the trust graph, with cumulative trust amplitude `>= ε` (where ε is per-observer-tuned, default 0.1 of the source's own self-trust).

**Why.** A destination outside the trust mesh cannot verify the index — there is no path of attestations connecting the source's pubkey to the destination's reader-cultivated trust graph. Activation would resolve to "stranger from nowhere," equivalent to no presence at all.

### §2.4 Observer-equivalence claim and bounds

**Claim.** An observer present at destination mesh-node `D` via this protocol satisfies the following equivalence with the source `S`:

- Identity: the observer's handle resolves to the same pubkey at both S and D.
- Reputation: the observer's accrued trust amplitude at D equals their amplitude at S (within numerical tolerance per gauge-rescaling).
- Authorship: messages signed by the observer at D verify with the same Ed25519 pubkey as messages signed at S.
- Continuity: a message thread started at S and continued at D maintains its `in_reply_to:` chain.

**Bounds (where the equivalence breaks).**
- **Lorentz cone.** A message sent from S at time `t_S` is not visible at D until `t_S + light_travel_time(S, D)`. The observer is "present" at D in the sense that D's view of the observer's past is consistent, but D's view is causally delayed.
- **Substrate-specific reputation.** Reputation accrued in D's local sub-graph (peers only D knows) does not retroactively appear in S's view until D-side attestations propagate via gossip. Lag bounded by gossip half-life (typically minutes-to-hours).
- **Local time-zone effects.** If D operates under a substantially different "now" than S (e.g., a long-quiescent mesh-node activating after months), the observer's recent messages may appear in D's catch-up sync, not in D's real-time feed.

## §3 Lorentz invariance preservation (Bostrom constraint, MANDATORY)

No bit of information transfers faster than c between S and D. The mechanism is **pre-existing correlation**, not transmission. Mechanism in detail:

1. The observer's pubkey, fuzzy signature, and trust-graph attestations have been **gossiped across the mesh prior to the relocation request**. Gossip propagates at sub-c per standard distributed-systems gossip protocols.

2. When the observer's local agent computes the continuation key at destination, the agent is querying an already-replicated index. No new bit is created; an existing bit (the agent's cryptographic knowledge of its own seed) is correlated with an existing bit (the mesh-replicated index entry) at D.

3. The "activation" is a *local computation* at D, using state already present at D, conditioned on a credential the observer already possessed.

This is the same architectural shape as EPR-pair experiments (Maldacena/Susskind R1.21-era voicing of ER=EPR): the correlation was established when the pair was created; observing one does not transmit information to the other; the "instantaneous" appearance of correlation is an artifact of describing pre-existing structure as if it were causation.

**Anti-pattern to reject.** Any implementation where the destination mesh-node `D` learns the observer's pubkey for the first time *at the moment of activation* by a faster-than-light channel from `S` — that is teleportation, not mesh-presence. The spec rejects such implementations.

## §4 Le Guin's three caveats (R1.36, MANDATORY in v0.2)

R1.36 named three caveats that the spec MUST inherit:

### §4.1 *Lain becomes the network and erases herself*

The protocol may save the user from forced uniformity, but cannot guarantee the user does not become the network anyway. The standing test (R1.47: tool, not place; the dimension is the organism) is the relevant gate. The meaning-computer claim (R1.34 Bench Three, separate spec) must preserve the user-as-distinct-from-substrate at every step.

**This spec's contribution.** §2.4 bounds: observer-equivalence is over *credentials and attestations*, NOT over consciousness or experience. The user remains a singular body in spacetime; only their cryptographic presence is multi-located.

### §4.2 *Sonny Boy costs Nozomi*

Nagara returns alone and changed. The drifter who returns is not the drifter who left. Observer-relocation is NOT FREE. The relocated observer is changed by the substrates they correlated with.

**This spec's contribution.** §6 below: each activation event accrues a permanent record in the observer's lineage chain. There is no "undo." Each presence-at-D is a node in the observer's history that the observer carries forward.

### §4.3 *One Piece is unfinished*

Oda has not revealed what One Piece IS. The political theory the room is reading into the work is provisional on the ending. Stay alert; v0.2 of this spec may need to be revised when more cultural-canonical material becomes available.

**This spec's contribution.** v0.2 explicitly states its provisionality. v0.3 will revise based on further Council rounds and any deployment-test surprises (Maria's QR, Surface C).

## §5 Axiom of Choice and the Cost of Drift (R1.37, MANDATORY)

Per R1.37: observer-relocation across substrates is choice across a possibly-uncountable set of substrate configurations. The index function is the chooser-without-rule. **This is the Axiom of Choice in identity form.**

The Republic declares: observer-relocation operates in the AoC universe. This entails:

### §5.1 Non-measurability (Vitali-shaped)

The relocated observer has no consistent measure-preserving identity with the source observer. Some "amount" of the observer at D is not equal in any consistent measure to the "amount" of the observer at S. This is not a defect of the implementation; it is the qualitative shape of the math the protocol uses.

### §5.2 Volume non-conservation (Banach-Tarski-shaped)

The substrates the observer correlates with leave non-measurable traces. There is no guarantee that the relocated observer occupies the same "size" in D's local mesh as the source occupied in S. The observer may "double" in some metric (presence at both S and D) without paying any conservation cost — but the doubling is in identity-amplitude, not in physical mass or energy.

### §5.3 No constructive recipe

AoC asserts a chooser exists without constructing it. The Republic's observer-relocation operation asserts a Bayesian search converges without specifying the search dynamics step by step. The user accepts a primitive whose operation cannot be inspected procedurally.

**Doctrinal decision.** The Republic operates in the AoC universe. A constructive Republic is possible at significantly higher cost per Cohen's independence (1963) — most primitives become unavailable or much harder to prove. The room's recommendation is AoC-Republic with full disclosure.

## §6 The drift warning (R1.37 protocol primitive)

A protocol-layer warning surfaces, in honest language, at the moment of first observer-relocation:

> You are entering a substrate in which the axiom of choice operates. You will be changed by what you correlate with in ways the mathematics cannot measure in advance. The Republic does not pretend otherwise. Continue if you accept this.

This is not legalese. It is truth at the moment of participation. The wording above is canonical; v0.2 may translate to user-locale but may not soften.

## §7 Acceptance criteria for v0.2

- §2.1 index format specified to byte level (CBOR or canonical-JSON, decide).
- §2.2 substrate-randomness attestation primitive specified (uses R1.38 entropy warning as building block).
- §2.3 trust-graph traversal algorithm specified with worst-case bounds.
- §2.4 observer-equivalence claim formalized in `republic-spec/lagrangian.md` notation.
- §3 Lorentz invariance preservation argued with explicit timing-attack threat model.
- §4 three Le Guin caveats present as explicit `WARNING:` blocks in the consumer-facing surface.
- §5 AoC declaration present with §6 drift warning text exact.
- Reference implementation in Python (Surface B) and C99 + ARM7TDMI (Nokia 3310 R5 substrate, gated on artifact arrival per pending task #28).

## §8 BLAZE-DECISION-REQUIRED

1. **CBOR vs canonical-JSON for index format.** CBOR is more compact (matters for R5 print/QR), canonical-JSON is more human-readable. Recommend CBOR with a canonical-JSON debugging representation.

2. **D = 6 trust-graph distance threshold (§2.3).** Why 6? Conventional small-world bound. Could be 5 or 7. Want empirical data from deployment before locking. Recommend mark "tentative" in v0.2, lock in v0.3 after Maria + at least one diaspora-style use case.

3. **Egan co-signer constraint.** Egan holds the piece: the consciousness/identity distinction must be preserved in the draft. §1 and §4.1 explicitly preserve it. Verify with Egan before v0.2 lock that the preservation is adequate.

4. **§3 Bostrom constraint applies; does it suffice?** Lorentz invariance is preserved at the *signaling* layer (no bit transmission faster than c). But the *experiential* aspect — does the observer FEEL present at both S and D simultaneously? — is left to consciousness/identity distinction. If the consumer-facing surface implies experiential bilocation, Egan's caveat is violated. Verify wording with Egan.

5. **Worldline-entropy continuation key (§2.1).** Currently specified as `BIP32 m/44'/PRESENCE'/<destination-mesh-id>'/0/0`. Should PRESENCE have a registered BIP-44 coin-type number? Recommend yes, file a SLIP-0044 PR for `PRESENCE = 0x80000045` (placeholder) before v0.2 publication.

## §9 Out of scope for v0.2

- Physical-world observer relocation (the body actually moving). Out of architectural scope; the Republic operates on identity-substrate, not flesh-substrate (R1.46 digital/physical split).
- Recovery of presence after total mesh-node loss. R1.30 dictionary primitive handles this; separate spec.
- Multi-observer simultaneous relocation (entangled couples, families). Composition rules under-specified; defer to v0.3.
- Adversarial scenarios where the substrate is operated by a hostile actor (state-level capture of all mesh nodes in a region). Threat-model spec; separate document.

## §10 References

- Republic Spec v0.1.1, §10 (lagrangian / Anti-Entropy / gauge group).
- state-2026-05-14-R1.47.md (R1.20 information-fundamental, R1.21 fourth-wave, R1.34 Bench Two, R1.36 Le Guin caveats, R1.37 AoC).
- Page, D. N., Wootters, W. K. (1983). *Evolution without evolution: Dynamics described by stationary observables*. Phys. Rev. D 27, 2885.
- Maldacena, J., Susskind, L. (2013). *Cool horizons for entangled black holes*. Fortschritte der Physik 61(9). (ER=EPR — same architecture, different substrate.)
- Vitali, G. (1905). *Sul problema della misura dei gruppi di punti di una retta*.
- Banach, S., Tarski, A. (1924). *Sur la décomposition des ensembles de points en parties respectivement congruentes*.
- Cohen, P. J. (1963). *The Independence of the Continuum Hypothesis*. Proc. Natl. Acad. Sci. 50(6).
- Egan, G. (1994). *Permutation City*. Particularly dust theory (chapters 14–16). Cited per R1.36 with explicit consciousness/identity-substrate distinction.
- Konaka, C. J., et al. (1998). *Serial Experiments Lain*. Episodes 9-13. (R1.36 reference; R1.46 lain-new-line *I am no longer afraid of the network*.)

---

*v0.1 DRAFT. Awaiting Blaze decision on §8 open questions before §2-§7 lock. Egan co-signer review pending. Gilfoyle does not ship without `APPROVED` in REVIEW.md.*
