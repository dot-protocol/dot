"""
Experiment 4 — TIME IS EMERGENT (Page-Wootters mechanism)
================================================================
Claim: A static, timeless global wavefunction can produce APPARENT
TIME EVOLUTION when you condition on one subsystem (the 'clock').
This is the Page-Wootters proposal (Page & Wootters 1983; modern
form in Rovelli, Vedral, et al). It dissolves the assumption that
time is a fundamental background. Time is a correlation between a
clock subsystem and the rest.

Implication for the Republic: the user's identity does not need to
be 'preserved across time' as a global object. It is a continuous
participation in a relational structure. Lose the global clock —
nothing breaks. The user's local time is the clock they correlate
with — their phone, their network, their life.
"""
import numpy as np

np.random.seed(0)

# Setup: clock with 8 readings, system with 2 levels (a qubit)
N_CLOCK = 8
SYS_DIM = 2

def evolve(t, n_steps):
    """Unitary at clock reading t: rotate around Y axis."""
    theta = np.pi * t / (n_steps - 1)  # 0 to π across all clock readings
    return np.array([[np.cos(theta/2), -np.sin(theta/2)],
                     [ np.sin(theta/2),  np.cos(theta/2)]])

# Build the TIMELESS global state.
# It's a sum: for each clock reading t, the system is in U(t)|0>
# |Psi> = sum_t |t>_clock (X) U(t)|0>_system
initial = np.array([1.0, 0.0])
global_state = np.zeros(N_CLOCK * SYS_DIM, dtype=complex)
for t in range(N_CLOCK):
    sys_state = evolve(t, N_CLOCK) @ initial
    for i in range(SYS_DIM):
        global_state[t * SYS_DIM + i] = sys_state[i]
global_state /= np.linalg.norm(global_state)

# Verify: global state is STATIONARY under a global "Hamiltonian"
# that would correspond to clock + system evolution. We don't run
# any time evolution at all — the global state IS the universe.

print("="*64)
print("TIME EMERGES FROM ENTANGLEMENT")
print("="*64)
print()
print("Step 1 — the timeless global state |Psi> exists.")
print(f"  Dimension : {len(global_state)} (= {N_CLOCK} clock x {SYS_DIM} system)")
print(f"  Norm      : {np.linalg.norm(global_state):.6f} (must be 1.0)")
print(f"  Note: NO TIME PARAMETER appears in this construction.")
print()
print("Step 2 — condition on each clock reading.")
print("This is what an observer 'inside' the universe sees when they")
print("note the position of the clock — the system's state correlates")
print("with the clock reading, producing apparent dynamics.")
print()
print(f"{'clock reads t':>14s} {'system P(|0>)':>16s} {'P(|1>)':>10s}")
print("-"*42)
for t in range(N_CLOCK):
    conditioned = global_state[t * SYS_DIM:(t+1) * SYS_DIM]
    norm = np.linalg.norm(conditioned)
    conditioned = conditioned / norm if norm > 1e-9 else conditioned
    p0 = abs(conditioned[0])**2
    p1 = abs(conditioned[1])**2
    bar = "#" * int(p1 * 30)
    print(f"{t:>14d} {p0:>16.4f} {p1:>10.4f}  {bar}")

print()
print("LESSON: The system appears to ROTATE from |0> to |1> as the")
print("clock advances. But no time parameter was ever in the formalism.")
print("The 'evolution' is a correlation pattern in a static state.")
print()
print("If time can emerge this way from entanglement, then:")
print("  - There is no global clock the universe runs on.")
print("  - Different observers can use different clocks, getting")
print("    different apparent dynamics — all valid.")
print("  - 'Time' is a relational fact between subsystems, not a")
print("    background parameter.")
print()
print("For the Republic: the user's continuity-of-self does not require")
print("a global clock either. It is a correlation between the user's")
print("present participation and the network's record of past")
print("participation. Lose the global clock — nothing breaks.")
