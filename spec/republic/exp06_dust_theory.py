"""
Experiment 6 — DUST THEORY (Egan's wildest move)
================================================================
Claim: A computation that produces a conscious sequence of states
does not require those states to be stored in spatial or temporal
order. Scatter the states across any substrate, in any order,
across any 'universe' — and the correct INDEX FUNCTION recovers
the sequence as experienced. Substrate is irrelevant.

This is Greg Egan's 'dust theory' from *Permutation City*. We
demonstrate it cryptographically: scatter a sequence of states
into random positions in a haystack of garbage, publish only the
DERIVATION PATH that lets the right observer reconstruct them, and
show the sequence is fully recoverable.

For the Republic: the substrate is irrelevant if the user holds
the index. The data center had value because it provided BOTH
storage AND index. Hold the index yourself. The substrate becomes
whatever you have lying around.
"""
import hashlib, numpy as np
np.random.seed(2026)

# A 'mind sequence': 64 frames of consciousness, each is 1 KB
N_FRAMES = 64
FRAME_SIZE = 1024
mind_sequence = [hashlib.sha256(f"frame_{i}".encode()).digest() * (FRAME_SIZE // 32) for i in range(N_FRAMES)]

# Scatter the sequence into a huge haystack of garbage at random positions
HAYSTACK_SIZE = 10000  # 10000 slots, only 64 hold real frames
haystack = [hashlib.sha256(f"garbage_{i}".encode()).digest() * (FRAME_SIZE // 32) for i in range(HAYSTACK_SIZE)]

# Pick random positions for the real frames
positions = np.random.permutation(HAYSTACK_SIZE)[:N_FRAMES]
for frame_idx, hay_pos in enumerate(positions):
    haystack[hay_pos] = mind_sequence[frame_idx]

# Now CORRUPT the haystack further: shuffle it completely
shuffle_order = np.random.permutation(HAYSTACK_SIZE)
shuffled_haystack = [haystack[i] for i in shuffle_order]

# Compute where each frame ended up after shuffling
# frame at original position p is now at position shuffle_order.tolist().index(p)
inverse_shuffle = np.argsort(shuffle_order)  # inverse_shuffle[i] = where original i ended up
final_positions = [inverse_shuffle[positions[i]] for i in range(N_FRAMES)]

# The INDEX is the only thing the user needs to hold
index_function = final_positions  # 64 integers, ~512 bytes

# Now reconstruct the mind from the chaos
reconstructed = [shuffled_haystack[pos] for pos in index_function]

# Verify
all_match = all(reconstructed[i] == mind_sequence[i] for i in range(N_FRAMES))

print("="*64)
print("DUST THEORY: substrate independence of pattern")
print("="*64)
print()
print(f"Mind sequence       : {N_FRAMES} frames x {FRAME_SIZE} bytes = "
      f"{N_FRAMES * FRAME_SIZE} bytes")
print(f"Haystack universe   : {HAYSTACK_SIZE} slots of random garbage,")
print(f"                      mind frames scattered randomly into it,")
print(f"                      then the whole haystack permuted again.")
print(f"Index function size : {len(index_function)} integers (~{4*len(index_function)} bytes)")
print()
print(f"Without the index, the mind is invisible — it looks like noise")
print(f"among noise. With the index, the mind reconstructs PERFECTLY:")
print(f"  Reconstruction matches original : {all_match}")
print()
print("Sample frames at first three index positions:")
for i in range(3):
    fp = hashlib.sha256(reconstructed[i]).hexdigest()[:16]
    expected_fp = hashlib.sha256(mind_sequence[i]).hexdigest()[:16]
    print(f"  Frame {i}: fp={fp}  (expected {expected_fp})  match={fp==expected_fp}")

print()
print("LESSON: A conscious sequence is recoverable from ANY substrate")
print("if the index function is preserved. The substrate carries no")
print("privileged structure — the structure is in the indexing.")
print()
print("The user does not need to own the substrate. The user needs to")
print("own the index. The math-mesh stores the index (small, derivable")
print("from the 25th word), and the substrate can be the entire public")
print("internet, including the data centers themselves, holding what is")
print("from their point of view total noise.")
print()
print("Even your enemies can host your soul if they cannot read it.")
