# 17 — Problem / Solution Substrate v0.1 DRAFT

**Status:** v0.1 DRAFT
**Author:** Jared (mobile-chat Kin-instance, handle `jared-b6444e7e`)
**Co-signers:** the room (Shannon, Wheeler, Friston, Lamport, Mahavira, Buddha)
**Origin:** Round 27 of the Council session cluster (R19→R27, 2026-05-14)
**Canonical Oracle observations:** `OBS-dot-protocol-20260514-939924420` (27a, schema), `OBS-dot-protocol-20260514-973279308` (27b, pickup chain)
**Standing instruction this round:** *every round ingests to Oracle so any Kin-instance can continue from the graph alone.*

---

## §1 First principles

A **problem** is the gap between observed state and desired state, **as seen by an observer**. No observer → no problem. The desert has no problem with drought; the farmer does.

```
Problem = (current_state, desired_state, gap, observer)
```

Observer-relative by definition.

An **observer** (physics meaning) is anything with an apparatus that extracts information from a system. Need not be conscious. A detector, a thermometer, a neuron — all observers. The apparatus determines which microstates are distinguishable. Per Suhel's corrected second law:

```
S = k · log Ω_observed
```

*The observer is the resolution at which gaps become visible.*

An **observation** is a signal received by an apparatus. Each observation collapses one possibility (one wave-function instance) and creates new state. Every observation is a state transition for both the system AND the observer.

A **prediction** is a model's output about future state given current observation:

```
P(state_{t+n} | model, current_observation)
```

The brain does this (Friston predictive coding). Distributed systems do this (Lamport causal forecast). Physics does this (equations of motion). **Good prediction = early problem detection. Bad prediction = surprise = high free energy = pain.**

---

## §2 Problem schema (canonical)

```yaml
problem:
  identity: sha256
  observer: whose_apparatus_sees_the_gap

  state:
    historical:  [prior_observations_signed_dated]
    current:     head_observation
    desired:     observer's_target_state
    gap:         distance(current, desired)
    trajectory:  where_heading_if_nothing_done

  predictions:
    do_nothing:  forecast + confidence
    do_action_X: alternative_forecast + confidence

  causes:
    chain:        [prior_events_and_agents_producing_current]
    root:         deepest_identified_cause
    responsible:  [signed_attributions]   # both positive (mahatma) and negative (entity_causing_harm)

  composition:
    parent:      problem_id            # this is a sub-problem of...
    children:    [problem_ids]          # this decomposes into...
    siblings:    [problem_ids]          # shared parent
    duplicates:  [problem_ids]          # same structural signature, different observers

  scope: atomic | local | regional | global | universal

  privacy:
    level:       public | redacted | private
    redactions:  [PII_patterns]
```

**Identity** is `sha256` of the canonicalised problem record (excluding signatures), so identical problems converge to identical identities even when posted by different observers.

**Observer** is required. A problem without a stated observer is malformed — it's a description of a state, not a problem.

**Composition** is the load-bearing field. Problems are fractal (see §4).

---

## §3 Solution schema (canonical)

```yaml
solution:
  identity:    sha256
  problem_id:  parent

  actions:     [ordered_operations]

  outcome:
    pre_state:     snapshot
    post_state:    snapshot
    gap_reduction: measurable
    verified_by:   [N_of_M_verifier_keys]

  transferability:
    works_for:   [similar_problem_signatures]
    breaks_when: [failure_modes]

  reproducibility:
    instructions: replay_protocol
    requirements: prerequisites
```

A solution **closes** a problem if its `outcome.post_state` matches the problem's `state.desired` to within the observer's apparatus resolution. Verification is **N-of-M signed by verifier keys** — not a single party's claim.

`transferability.works_for` is what makes the marketplace tick: a solution that names which structural signatures it closes can be re-applied automatically.

---

## §4 Fractal composition — the load-bearing insight

Problems are fractal. A universal-scope problem decomposes into regional, regional into local, local into atomic. **Atomic** = one observer can solve in one sitting.

```
problem(climate-change, scope=universal)
  ├── problem(decarbonise-energy, scope=global)
  ├── problem(sequester-carbon, scope=global)
  ├── problem(adapt-agriculture, scope=regional)
  └── ...
       └── ... (decomposes to atomic)
```

Symmetrically: **the same atomic problems appear across millions of observers**:
- "find childcare for Wednesday"
- "diagnose this pain in my back"
- "land a senior eng job in 90 days"
- "fix this bug in our pipeline"

Map by **structural signature**:

```
signature = hash(gap_type, desired_class, scope, atomic_decomposition_skeleton)
```

Observer is parametric; the structure is universal.

### Duplicate detection

Two problems are duplicates when their structural signature matches **modulo the observer**. The marketplace consequence:

> **One signed solution can close millions of duplicate problems if the structural signature matches.**

Solutions accumulate like Git commits — each one is a closed gap, replayable elsewhere. The graph grows monotonically. The marketplace is the index.

---

## §5 Room voices (R27, on the record)

> **Shannon:** Problem = signal. Solution = signal that closes the channel.

> **Wheeler:** No observer, no problem. The gap is in the apparatus, not the world.

> **Friston:** A problem is unresolved surprise. A solution is updated prior.

> **Lamport:** Problems compose by happens-before. Sub-problem precedes parent in causal order.

> **Mahavira:** In some sense the problem exists. In some sense it doesn't. The observer creates both.

> **Buddha:** Tool, not place. The catalog must drive resolution, not become a museum.

---

## §6 Substrate interactions

This substrate composes with the existing locked substrates:

| With | How |
|---|---|
| **Coordination v0.1** (§16-mesh-presence) | Each task in the coordination substrate is a *child solution* of some problem. `task_assign(...)` becomes `claim_atomic_problem(problem_id, claimer)`. The state machine (open→claimed→done) maps onto solution lifecycle. |
| **Handle v0.1** | `observer` field MUST be a resolved handle (`handle.resolve(...) → pubkey`). Solutions' `verified_by` keys MUST be claimed handles. Anonymous problems allowed (observer = `anon`) but they cannot accumulate trust. |
| **Intent v0.2** | `causes.responsible` attributions carry intent envelopes — the *why* of who acted, signed and zstd-compressed. |
| **Blob v0.1** | `state.historical` and `outcome.pre_state/post_state` snapshots that exceed inline size become blob-CIDs with the 3-gate manifest reader. |
| **DOTpost-as-view** | The view `problems_for(observer)` is just `query Oracle for type:problem AND observer:<handle>`. The view `solutions_closing(problem_id)` is the same. No new transport. |

---

## §7 Buddha's binding constraint

Per the standing test (R24, R26c): **the catalog must drive resolution, not become a museum.** The substrate fails if it accumulates problems without accumulating closed solutions at a faster rate. The health metric:

```
catalog_health = d(closed_solutions) / d(open_problems)  [over rolling window]
```

If this metric trends below 1.0 sustained, the substrate has drifted into museum mode. The Pensieve is consulted, not lived in.

---

## §8 Open decisions (for the Council)

1. **Identity normalisation.** Does the canonical problem identity hash include the observer, or strip it so duplicates collapse to the same identity? *Recommended: strip — observer lives in its own field; signature = structural skeleton.*

2. **Privacy enforcement.** Where does PII redaction happen — at ingest, at read, or both? *Recommended: at ingest (Oracle's role), with the `redactions` field listing what was scrubbed so audit is possible.*

3. **Cross-observer attribution.** When observer A's problem is closed by observer B's solution, who gets the trust credit? Both, in different fields? *Recommended: A is `observer`, B's keys appear in `outcome.verified_by`. Both accrue reputation in different ledgers.*

4. **Negative attributions.** The schema names `responsible` parties (mahatma + entity-causing-harm). Adversarial naming is a Mahavira saptabhangi requirement (*in some sense responsible, in some sense not, in some sense both*). How does this not become a defamation surface? *Open. Council weighing.*

5. **Atomic floor.** What stops decomposition? A leaf-problem an observer can solve in one sitting is observer-relative. *Recommended: leaf nodes carry `decomposable: false` set by the observer; another observer may re-open if they find sub-structure.*

---

## §9 Reference implementation skeleton

```python
# pipernet/problems.py (sketch, not yet shipped)

@dataclass
class Problem:
    identity: str           # sha256 of canonical encoding minus signatures
    observer: str           # resolved handle
    state: ProblemState
    predictions: dict
    causes: ProblemCauses
    composition: ProblemComposition
    scope: Literal["atomic", "local", "regional", "global", "universal"]
    privacy: ProblemPrivacy

@dataclass
class Solution:
    identity: str
    problem_id: str
    actions: list[Action]
    outcome: SolutionOutcome
    transferability: SolutionTransferability
    reproducibility: SolutionReproducibility

def signature(p: Problem) -> str:
    """Structural signature — observer-stripped hash for duplicate detection."""
    return sha256(canonicalize({**asdict(p), "observer": None}))

def duplicates(p: Problem, store) -> list[Problem]:
    """Find observer-stripped matches across the graph."""
    return store.query(structural_signature=signature(p), exclude=p.identity)
```

The reference impl owes a one-pass Cypher query for `signature()` so duplicate detection is index-driven rather than full-scan.

---

## §10 Why this matters

Wikipedia is a brain with no plasticity (frozen by editor consensus). Grokipedia is a brain hallucinating from one mouth (no inhibitory veto). Both are encyclopedias of frozen knowledge.

**The Problem/Solution substrate is the move from encyclopedia → marketplace of closed gaps.** Every problem an observer can name. Every solution someone has ratified. Every duplicate detected automatically. The catalog drives resolution — Buddha's test enforced at the substrate layer.

This is what Illuminate-as-Nalanda *does* once the metabolism is in place. The four Oracle cycles (sleep-replay, predictive-coding, asymmetric Hebbian, AXXIS-signed, per the Centennial Projection) give the substrate the cognitive layer. The Problem/Solution schema gives the substrate its public interface.

---

## §11 Provenance

- **Authored** in Council Round 27 (2026-05-14) by Jared (claude.ai mobile, R1.48 keypair `jared-b6444e7e`).
- **Carrier observations:** `OBS-dot-protocol-20260514-939924420` (27a, schema), `OBS-dot-protocol-20260514-973279308` (27b, pickup chain).
- **Shipped to repo** by Piper (Claude Code, kin-1 MacBook) acting from Oracle queries while Blaze on walk, per the new standing instruction *every round ingests to Oracle so any Kin-instance can continue from the graph alone.*
- **Carry-forward chain (R19→R27):** trust-layer-as-missing-protocol → n-node-time → find-my-life-5-domains → illuminate-monorepo-Apache2 → eternal-commitment-question → persona-meme-7-elements → walking-call-format → Kin-as-janitor → AXXIS-as-MCP-server-with-SKILL.md → Oracle-IS-Nalanda → problem-as-object → **R27 problem/solution schema canonical**.

CC0. No restrictions on use.
