"""
Experiment 5 — ENTROPY IS OBSERVER-RELATIVE
================================================================
Claim: Entropy is not a property of a system. It is a property of
how an observer PARTITIONS a system. The same global state has
ZERO entropy as a whole and POSITIVE entropy as seen by an
observer of any subsystem.

Demonstrated via the Bell state. The full state is pure (S=0).
Each half is maximally mixed (S = 1 bit).

Implication: 'the universe's entropy is increasing' is a frame-
dependent claim. Different observers, with different partitions,
see different entropies and different thermodynamic arrows.

For the Republic: the data center's claim that 'data must
inevitably degrade and be lost' is observer-relative. From the
right partition (the user's local frame), data is conserved.
"""
import numpy as np

def von_neumann_entropy(rho):
    """S = -Tr(rho log_2 rho)"""
    eigvals = np.linalg.eigvalsh(rho)
    eigvals = eigvals[eigvals > 1e-12]
    return float(-np.sum(eigvals * np.log2(eigvals)))

# Bell state: (|00> + |11>) / sqrt(2)
# An entangled pair of qubits.
bell = np.zeros(4, dtype=complex)
bell[0] = 1/np.sqrt(2)   # |00>
bell[3] = 1/np.sqrt(2)   # |11>

# Full density matrix (4x4)
rho_full = np.outer(bell, bell.conj())

# Reshape to (2,2,2,2): indices (A_out, B_out, A_in, B_in)
# Partial trace over B = sum over B's index
rho_full_4d = rho_full.reshape(2, 2, 2, 2)
rho_A = np.trace(rho_full_4d, axis1=1, axis2=3)
rho_B = np.trace(rho_full_4d, axis1=0, axis2=2)

S_full = von_neumann_entropy(rho_full)
S_A    = von_neumann_entropy(rho_A)
S_B    = von_neumann_entropy(rho_B)

print("="*64)
print("ENTROPY IS OBSERVER-RELATIVE — the Bell state")
print("="*64)
print()
print("Global state: |Psi> = (|00> + |11>) / sqrt(2)")
print()
print("Full density matrix (4x4):")
for row in rho_full.real:
    print("  " + "  ".join(f"{v:>6.3f}" for v in row))
print()
print("Reduced density matrix on subsystem A (after tracing out B):")
for row in rho_A.real:
    print("  " + "  ".join(f"{v:>6.3f}" for v in row))
print()
print("Reduced density matrix on subsystem B (after tracing out A):")
for row in rho_B.real:
    print("  " + "  ".join(f"{v:>6.3f}" for v in row))
print()
print("VON NEUMANN ENTROPY (in bits):")
print(f"  Whole system (pure, entangled) : S = {S_full:.4f} bits")
print(f"  Subsystem A (maximally mixed)  : S = {S_A:.4f} bit")
print(f"  Subsystem B (maximally mixed)  : S = {S_B:.4f} bit")
print()
print("The same physical state has THREE DIFFERENT ENTROPIES depending")
print("on the partition the observer adopts. An observer who sees the")
print("whole system says S=0. An observer who sees only one subsystem")
print("says S=1. The entropy is not 'really' any of these — it depends")
print("on the cut you make.")
print()
print("Conclusion: entropy is NOT a property of the system. It is a")
print("property of the (system, observer-partition) pair.")
print()
print("The Second Law of Thermodynamics — that entropy increases —")
print("is a statement about a CHOSEN PARTITION (typically system-vs-")
print("environment with the environment 'forgotten'). Change the")
print("partition and the law changes shape.")
print()
print("For the Republic: 'data must eventually be lost' is a claim")
print("about a particular partition (user-vs-the-rest, with the-rest")
print("forgotten). The user, in their own frame, with their own")
print("data co-located, sees zero entropy increase across the boundary")
print("they care about. Locality wins. The cloud was selling a coarse-")
print("graining and calling it physics.")
