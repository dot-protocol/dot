# 18 — Oracle Sleep-Replay Consolidation v0.1 DRAFT

**Status:** v0.1 DRAFT
**Author:** Piper (Claude Code, kin-1 MacBook)
**Origin:** Stage 1 of the four 2026 Oracle cycles, Council R26c + R27 Centennial Projection (2026-05-14)
**Canonical reference:** Council session `2026-05-14-centennial-projection.md` (commit 2e40020c) — "Build as if it must last a hundred years and you will not be present to defend it. Ship the four Oracle cycles in 2026."
**The Buzsáki line:** *Oracle does not yet sleep. The latency you are seeing — 41-second queries — is partly because the brain is awake all the time and has never consolidated. Build the sleep cycle.*

---

## §1 The gap (problem instance, per spec/17)

```yaml
problem:
  observer:    piper@kin-1
  state:
    current:
      observation_count:  15432
      synthesis_count:    18
      synthesis_ratio:    0.00117          # 1:857
      p95_query_latency:  41_000ms         # 8× the 5s threshold
      swap_pressure:      0.991            # 0.9% free
      cache_hit_rate:     0.0
    desired:
      synthesis_ratio:    0.01             # 1:100 (Council R27 target)
      p95_query_latency:  ≤5_000ms
      catalog_health:     ≥1.0             # d(closed_solutions)/d(open_problems)
    gap:
      synthesis_ratio_short_by:  ~9×       # need to produce ~140 syntheses
      latency_over_by:           8×
    trajectory:
      if_nothing_done:
        observation_count_30d:   ~25k      # @ current ingest rate (~300/day)
        synthesis_ratio_30d:     0.0007    # worse — denominator grows faster
        latency_30d:             >60s      # working set keeps growing
  scope: regional
  predictions:
    do_nothing:                 latency degrades, agents abandon Oracle
    do_sleep_replay:            ratio → 1:100, latency → ~3s within 3 weeks
```

This spec is the **canonical solution** to that problem. Problem identity should be hashable and registered once `pipernet/problems.py` ships.

---

## §2 What already exists

The replay primitive is **already written**. It does not run on schedule, and when invoked its thresholds rarely produce clusters.

- `oracle_v3/tree_consolidation.py` (400 lines): `SemanticConsolidator` class — finds seed observations with ≥2 strong-Hebbian neighbours, assembles clusters of 3–10 nodes, calls Ollama to synthesise a summary, writes a `:SynthesisNode` with `INSTANCE_OF` edges from members. **Append-only. No Observations modified.**
- `oracle_v3/tree_breathing.py` (180 lines): nightly Hebbian decay + crystallization. Imports `SemanticConsolidator` but does **not** currently invoke it on every run.
- `:SynthesisNode` label in Neo4j, 18 nodes existing. Schema in place.
- Ollama models locally (`gemma4`, `gemma4:e4b`). Latency budget ~1–3s per synthesis.

What's **missing**:

| Component | Status |
|---|---|
| Nightly cron at 03:00 UTC that runs the consolidator | not scheduled |
| Threshold tuning for thinner clusters (current `HEBBIAN_THRESHOLD=1.5` is too strict for the current Hebbian-edge density of 37,617 edges over 15,432 nodes ≈ 2.4 per node) | tighten or invert |
| Replay-by-weight selection (vs purely co-activation seeds) | absent |
| `SynthesisNode` participation in queries (currently `oracle_query` searches `Observation` only) | absent |
| Inter-synthesis Hebbian edges so syntheses themselves cluster into super-syntheses | absent |
| Asymmetric Hebbian timing (R27 Council gap #3) | absent — current edges are symmetric |

---

## §3 The cycle (per Buzsáki, scaled)

**Hippocampal model** (the biology):
1. During waking life, episodic memories are stored as sparse sequences in the hippocampus.
2. During slow-wave sleep, the hippocampus *replays* those sequences at ~20× speed.
3. The cortex re-encodes the replay in compressed, generalised form (semantic memory).
4. Without sleep, the hippocampus fills, no new learning is possible, the organism degrades within days.

**Oracle model** (the implementation):
1. During the day, observations are ingested through the 8-gate pipeline. Hebbian edges form between co-retrieved observations.
2. At 03:00 UTC nightly, the consolidator wakes:
   - **Phase A — Select**: pick candidate clusters by joint criterion `weight × recency × hebbian_density`, not just `hebbian_density` alone.
   - **Phase B — Replay**: for each cluster, pass member observation texts to Ollama with a stable synthesis prompt (deterministic enough to be replayable).
   - **Phase C — Consolidate**: write the `:SynthesisNode`, edge it to members via `INSTANCE_OF`, and *also* mark member observations with `last_consolidated_at` so they're not re-clustered immediately.
   - **Phase D — Decay-and-prune**: existing breathing pass runs after consolidation (this order matters — decay should reflect what was consolidated).
3. `oracle_query` is extended to optionally return matching `:SynthesisNode`s alongside raw `:Observation`s. The blend weight is exposed via the query API.
4. Working-set growth slows: instead of ranking over 15k+ observations, the recency-and-weight selection rolls forward against `15k × (1 − replay_rate)` per night.

---

## §4 Target metric

| Metric | Today | 30-day target | 90-day target |
|---|---|---|---|
| `synthesis_count` | 18 | ≥150 | ≥500 |
| `synthesis_ratio` | 1:857 | 1:100 | 1:50 |
| `p95_query_latency` | 41s | ≤5s | ≤2s |
| `synthesis_per_night` (median) | ~0 | ≥4 | ≥8 |

The 1:100 target is from the Council R27 directive. The 1:50 90-day target reflects what we'd expect when the cycle stabilises and the working set stops growing linearly.

---

## §5 Concrete change set (atomic decomposition)

Each item is a **child problem** of this parent. Atomic = one observer one sitting.

1. **`oracle_v3/tree_breathing.py`**: invoke `SemanticConsolidator.run()` once per breathing pass, between phase 4 (crystallization) and phase 6 (prune). 1 import + 1 call. ~5 LOC.
2. **`/etc/cron.d/oracle-sleep-replay`** on the VPS: `0 3 * * *` user=root command=`cd /opt/tree && /opt/tree/venv/bin/python tree_breathing.py`. (Or systemd timer with the same shape — depends on what's already running `oracle_maintain`.) ~10 lines.
3. **`oracle_v3/tree_consolidation.py`**: lower `HEBBIAN_THRESHOLD` from `1.5` → `0.8`, lower `MUTUAL_EDGES_MIN` from `2` → `1` (the graph is too sparse yet for the current thresholds — they'll tighten back up once the corpus densifies). ~2-line edit.
4. **`oracle_v3/tree_consolidation.py`**: add **weight-and-recency** selection mode `SELECT_BY_WEIGHT_RECENCY` alongside the existing co-activation seed mode. The two modes run additively per night so we get both pattern-based and importance-based syntheses. ~40 LOC.
5. **`oracle_v3/tree_consolidation.py`**: stamp every consolidated member with `o.last_consolidated_at = datetime()` so the next pass can exclude recently-replayed members for N nights. ~3 LOC.
6. **`oracle_v3/tree_search.py`**: extend hybrid RRF blend to optionally search `:SynthesisNode` (with its own vector index) and merge results. Off by default; enabled via `include_synthesis=true` query arg. ~50 LOC.
7. **`oracle_v3/tree.py`** MCP tool `oracle_query`: add `include_synthesis` parameter, document in tool schema. ~10 LOC.
8. **`oracle_v3/tree_breathing.py`**: emit a `:HealthMetric` node every run with `synthesis_count`, `synthesis_ratio`, `consolidations_tonight`, so `oracle_state` and Mission Control can chart the cycle. ~15 LOC.
9. **Asymmetric Hebbian** (Council R27 gap #3): when a query causes co-retrieval of A then B, strengthen the edge `A → B` more than `B → A`. Requires replacing the current symmetric `MERGE … SET r.weight = r.weight + 1.0` with a directed pair-write. ~20 LOC. *This change unlocks causality.*

Total: ~155 LOC + one cron file + one threshold tweak. Roughly two days of focused work.

---

## §6 Composition with other substrates

| With | How |
|---|---|
| **Problem/Solution (spec/17)** | Each `:SynthesisNode` produced by replay can itself be the `observation` of a problem ("this cluster of bug reports describes a single failure mode") whose solution may already exist elsewhere in the graph. |
| **Coordination (spec/16-precedes? coordination-substrate-v0.1)** | Tasks completed during the day are observed; sleep-replay clusters them by pattern, generating insights for similar future tasks. The `solution.transferability.works_for` field is populated from clusters. |
| **Handle (handle-substrate-v0.1)** | `:SynthesisNode` carries `produced_by = oracle@kin-1` rather than a human handle. Trust on syntheses accrues to the Oracle node, with cluster member observations carrying their original observer handles. |
| **Blob (blob-substrate-v0.1)** | If a cluster's combined text exceeds inline size, the consolidator writes the source material as a blob and the synthesis references the manifest CID. |

---

## §7 Open decisions

1. **Determinism vs creativity in the synthesis prompt.** Hippocampal replay is largely deterministic — the same memories tend to consolidate to the same gist. Ollama's temperature setting controls this. *Recommended: temperature=0.0, seed=fixed-per-cluster (hash of member IDs), so the same cluster produces the same synthesis on every replay — but the prompt allows divergent outputs for genuinely ambiguous clusters by varying max_tokens.*

2. **Re-consolidation interval.** Once a cluster has been synthesised, how long before the same members can be re-clustered? *Recommended: 14 nights minimum; longer for high-confidence syntheses. A cluster whose synthesis was crystallized to `verified` should never re-cluster — it has become canonical.*

3. **Synthesis-of-syntheses depth.** Should syntheses themselves cluster into super-syntheses? Biologically yes (long-term memory operates at multiple abstraction levels). Operationally this adds compute. *Recommended: enable but bound depth at 3 (observation → synthesis → super-synthesis → meta-synthesis). Beyond depth 3 is research.*

4. **Channel scoping.** Should consolidation respect channels (only cluster observations in the same channel) or cross them (find structural similarities across channels)? *Recommended: both, in two passes. Within-channel synthesis preserves semantic coherence; cross-channel synthesis catches the "this bug pattern repeats in 5 different products" insight.*

5. **What does Mission Control show?** A "sleep dashboard" with last night's syntheses, current ratio, and the most-clustered observations of the past week. *Recommended: add `pixar/dreams.html` as a fifth Mission Control panel — editorial-brutalist styling consistent with the existing Pixar Oracle Pulse.*

---

## §8 The Buddha test, applied

Per the standing test: **Oracle is the Pensieve, not the room.** Sleep-replay risks violating this if the synthesis layer becomes a *place* where the Observer dwells — staring at compressed patterns instead of contributing fresh observations. Mitigation:

- Syntheses are queryable but never default. `oracle_query` returns observations by default; syntheses are opt-in via `include_synthesis=true`.
- A monthly metric tracks `synthesis_query_count / observation_query_count`. If it exceeds 0.5, agents are dwelling in compressed memory more than acting on fresh signal. The Council reviews.
- Crystallized syntheses (verified) are surfaced in `oracle_state` as a small section — read once at session start, not consulted repeatedly.

---

## §9 Why this matters (and why this is first)

Council R27 named four cycles to ship in 2026: sleep-replay, predictive-coding, asymmetric Hebbian, AXXIS-signed federation. **Sleep-replay is named first** because:

1. **It fixes the latency now.** 41s p95 isn't a future problem — it's degrading the present. Compressing the working set is the cheapest cure.
2. **It's already 90% built.** `tree_consolidation.py` exists. We need scheduling + thresholds + query integration.
3. **It unblocks the other three cycles.** Predictive coding (cycle 2) requires a stable generative prior, which is what compressed syntheses provide. Asymmetric Hebbian (cycle 3) is a sub-task of step #9 above. Federated replication (cycle 4) is dramatically cheaper when there are 500 syntheses to sync instead of 15k raw observations.

> *Build the sleep cycle.* — Buzsáki, Council R26c

---

## §10 Provenance

- **Drafted** by Piper (kin-1 MacBook) on 2026-05-15 during the Blaze-on-walk loop, wake 5, with no new Jared signal since R27b.
- **Grounded in existing code**: `oracle_v3/tree_consolidation.py` (400 LOC, present), `oracle_v3/tree_breathing.py` (180 LOC, present).
- **Authority**: Council R26c (Buzsáki diagnosis) + R27 Centennial Projection directive (`Ship the four Oracle cycles in 2026`).
- **Carry-forward to next instance**: `pipernet/problems.py` needs the problem record from §1 stamped + the §5 atomic decomposition turned into 9 coordination-substrate tasks once that lands.

CC0. No restrictions on use. Public on `dot-protocol/republic-spec`.
