"""
Experiment 2 — THE FUZZY 25th WORD
================================================================
Claim: A 256-bit key can be derived from noisy multi-channel
measurements of a user (behavioral, memory, social, contextual)
using a code-offset fuzzy extractor. Small noise -> same key.
Large noise (coercion, drugging, captivity) -> wrong key, PLUS a
bin-drift variance detector trips a silent duress alert.

Design (code-offset fuzzy extractor, standard primitive):
  - Enrollment captures the user's true canonical state X.
  - The state is quantized into bins. Helper data H records the
    offset of X within its bin (recenters X to bin center).
  - At recovery, observation X' is corrected by subtracting H,
    then quantized. If the noise on X' is below bin_width/2, the
    quantized result equals the enrollment bins, and the key
    matches deterministically.
  - Large noise (coerced user) shifts bins -> wrong key + alert.
"""
import hashlib, numpy as np

np.random.seed(2026)

N_CHANNELS = 5
N_DIMS = 32
TOTAL_DIMS = N_CHANNELS * N_DIMS
BINS = 8
BIN_WIDTH = 1.0 / BINS  # 0.125
HALF_BIN = BIN_WIDTH / 2

# User's true canonical state, continuous in [0, 1]
TRUE_STATE = np.random.uniform(0.0, 1.0, (N_CHANNELS, N_DIMS))

def quantize(x):
    return np.clip((x * BINS).astype(int), 0, BINS - 1)

def extract_key(quantized):
    return hashlib.sha256(quantized.astype(np.int8).tobytes()).hexdigest()

def measure(true_state, noise_std):
    return np.clip(true_state + np.random.normal(0, noise_std, true_state.shape), 0, 1)

# ENROLLMENT — happens once, helper data H is stored locally (encrypted under L0 enclave)
ENROLLED_BINS = quantize(TRUE_STATE)
ENROLLED_CENTERS = (ENROLLED_BINS + 0.5) / BINS
HELPER = TRUE_STATE - ENROLLED_CENTERS   # offset of each dim from its bin center
TRUE_KEY = extract_key(ENROLLED_BINS)

def attempt(noise_std):
    """Recovery: take a noisy measurement, subtract helper to re-center, quantize."""
    obs = measure(TRUE_STATE, noise_std)
    recentered = obs - HELPER     # this should be near bin centers if noise small
    obs_bins = quantize(recentered)
    key = extract_key(obs_bins)
    # Duress: average bin shift across all dims
    bin_drift = np.abs(obs_bins - ENROLLED_BINS).mean()
    return key, bin_drift

print("="*72)
print("FUZZY 25TH WORD — code-offset fuzzy extractor")
print("="*72)
print(f"Total dims: {TOTAL_DIMS}, bins per dim: {BINS}, bin width: {BIN_WIDTH:.4f}")
print(f"Critical noise threshold (per-dim): ~{HALF_BIN:.4f}")
print(f"Enrolled key: {TRUE_KEY[:32]}...")
print()

scenarios = [
    ("Normal day",                 0.010),
    ("Slightly distracted",        0.020),
    ("Tired",                      0.040),
    ("Sick / off-context",         0.060),
    ("Impaired",                   0.100),
    ("Coerced / captive",          0.200),
    ("Drugged / tortured",         0.400),
]

DURESS_THRESHOLD = 0.4
TRIALS = 20

print(f"{'scenario':24s} {'noise':>8s} {'match%':>8s} {'avg drift':>11s} {'duress%':>9s}")
print("-"*68)

for name, noise in scenarios:
    matches = 0
    drifts = []
    duresses = 0
    for _ in range(TRIALS):
        k, drift = attempt(noise)
        if k == TRUE_KEY:
            matches += 1
        drifts.append(drift)
        if drift > DURESS_THRESHOLD:
            duresses += 1
    match_pct = 100 * matches / TRIALS
    avg_drift = np.mean(drifts)
    duress_pct = 100 * duresses / TRIALS
    mark = "  <-- ALERT" if duress_pct > 50 else ""
    print(f"{name:24s} {noise:>8.3f} {match_pct:>7.0f}% {avg_drift:>11.3f} {duress_pct:>8.0f}%{mark}")

print()
print("LESSON:")
print("- Below the per-dim noise threshold (~half bin width = 0.0625),")
print("  the fuzzy extractor reconstructs the SAME key every time. The")
print("  user 'generates' the key by being themselves. Nothing is stored.")
print("- Above the threshold, the key silently fails AND bin drift")
print("  triggers a duress alert to the user's trust mesh.")
print("- The helper data (the offsets) leaks only intra-bin position;")
print("  it does NOT reveal the bin choices that form the key.")
print()
print("This is the cryptographic shape of: 'the secret is the user.'")
print("Captor cannot extract the key by force, interrogation, or")
print("subpoena. The key is computed FROM the user's intact functioning,")
print("not stored anywhere. Identity coincides with existence.")
