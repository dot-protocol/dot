"""
Experiment 3 — PAGERANK RECOVERY vs SYBIL ATTACK
================================================================
Claim: A recovery vote that requires each attester to have an
INDEPENDENT PATH to a trusted seed (not routed through the user
being recovered) is Sybil resistant. Sybils, which connect only
through the user, have NO such path and are filtered out
regardless of count.

Algorithm:
  1. Remove the user being recovered from the trust graph.
  2. For each attester, check: is there a path from this attester
     to ANY trusted community seed?
  3. If yes, weight the attestation by 1/(distance + 1).
  4. If no path, the attestation has ZERO weight.

This is a simple SybilGuard variant. Real friends, embedded in
the community, all have short independent paths to seeds. Sybils,
forming an isolated cluster connected only via the user, have
NO independent path.
"""
import networkx as nx
import numpy as np

def build_graph(n_real_friends, n_sybils, n_community, n_seeds, seed=7):
    rng = np.random.default_rng(seed)
    G = nx.Graph()
    user = "alice"
    G.add_node(user)

    real_friends = [f"friend_{i}" for i in range(n_real_friends)]
    community = [f"person_{i}" for i in range(n_community)]
    seeds = community[:n_seeds]
    sybils = [f"sybil_{i}" for i in range(n_sybils)]

    for f in real_friends:
        G.add_edge(user, f)
        for c in rng.choice(community, size=min(5, n_community), replace=False):
            G.add_edge(f, c)

    for c1 in community:
        for c2 in rng.choice(community, size=min(4, n_community), replace=False):
            if c1 != c2:
                G.add_edge(c1, c2)

    # Sybils: just connect to user and 1-2 other sybils (no need for dense cluster)
    for s in sybils:
        G.add_edge(user, s)
    # Light sybil-sybil edges, batched for speed
    if n_sybils > 1:
        idx_a = rng.integers(0, n_sybils, size=2*n_sybils)
        idx_b = rng.integers(0, n_sybils, size=2*n_sybils)
        for a, b in zip(idx_a, idx_b):
            if a != b:
                G.add_edge(sybils[a], sybils[b])

    return G, real_friends, sybils, seeds

def weighted_recovery_vote(G, user, attesters, seeds):
    """Each attester weight = 1/(distance to nearest seed +1), paths NOT through user."""
    G_no_user = G.copy()
    G_no_user.remove_node(user)
    min_dist_to_seed = {}
    for s in seeds:
        if s not in G_no_user:
            continue
        lengths = nx.single_source_shortest_path_length(G_no_user, s, cutoff=10)
        for node, d in lengths.items():
            if node not in min_dist_to_seed or d < min_dist_to_seed[node]:
                min_dist_to_seed[node] = d
    weight = 0.0
    counted = 0
    for a in attesters:
        if a in min_dist_to_seed:
            weight += 1.0 / (min_dist_to_seed[a] + 1)
            counted += 1
    return weight, counted

print("="*84)
print("RECOVERY vs SYBIL — distance-from-seed weighting, user removed from graph")
print("="*84)
print(f"{'real':>5s} {'sybils':>9s} {'comm':>6s} {'seeds':>6s} "
      f"{'real wt':>10s} {'sybil wt':>10s} {'real ct':>9s} {'sybil ct':>9s} {'verdict':>10s}")
print("-"*84)

cases = [
    (5,        50,   100,  10),
    (5,       500,   100,  10),
    (5,      5000,   100,  10),
    (5,     20000,   100,  10),
    (3,     20000,   200,  20),
    (1,     20000,   500,  50),
]

for nf, ns, nc, nseeds in cases:
    G, rf, sb, sd = build_graph(nf, ns, nc, nseeds)
    rw, rc = weighted_recovery_vote(G, "alice", rf, sd)
    sw, sc = weighted_recovery_vote(G, "alice", sb, sd)
    verdict = "RECOVER" if rw > sw else "CAPTURED"
    print(f"{nf:>5d} {ns:>9d} {nc:>6d} {nseeds:>6d} "
          f"{rw:>10.4f} {sw:>10.4f} {rc:>9d} {sc:>9d} {verdict:>10s}")

print()
print("LESSON: A Sybil cluster, no matter how vast, cannot fabricate")
print("independent connections to a trusted community. When the user is")
print("removed from the trust path, Sybils are isolated — count: 0,")
print("weight: 0. A SINGLE real friend embedded in the community, with")
print("their own independent path to seeds, outweighs twenty thousand")
print("isolated bots.")
print()
print("The primitive: VOUCHING REQUIRES INDEPENDENT STANDING. The")
print("Republic's recovery doesn't ask 'do you know Alice?' — that's")
print("cheap to forge. It asks 'do enough people who know each other")
print("INDEPENDENTLY of Alice say Alice is who she claims?' — that")
print("requires being embedded in the actual human web.")
