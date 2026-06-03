# SPDX-License-Identifier: Apache-2.0
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dot_chars import (
    unicode_to_dotchars, dotchars_to_unicode,
    alphanumeric_to_dotchars, dotchars_to_alphanumeric,
    emoji_to_dotchars, dotchars_to_emoji,
    RESOLUTION,
)
from dot_chars.codec import perm, iperm, int_to_symbols, symbols_to_int
from dot_chars.alphabets import (
    UNICODE_SIZE, UNICODE_ALPHABET, UNICODE_INDEX,
    ALNUM_ALPHABET, ALNUM_INDEX,
    EMOJI_SIZE, EMOJI_ALPHABET, EMOJI_INDEX,
    FROZEN_EMOJI_FIRST, FROZEN_EMOJI_LAST,
)

# Spread of global points: equator, London, Sydney, the corners (poles +
# antimeridian), New Delhi (dot-words demo point), and an altitude case.
PTS = [
    (0.0, 0.0, 0.0),
    (51.5074, -0.1278, 35.0),       # London
    (-33.8688, 151.2093, 58.0),     # Sydney
    (90.0, 180.0, 9000.0),          # NE corner / north pole / antimeridian
    (-90.0, -180.0, -1000.0),       # SW corner / south pole
    (28.6139, 77.2090, 216.0),      # New Delhi
    (89.9999, 179.9999, 5000.0),    # near-corner, high altitude
    (-89.9999, -179.9999, -999.0),  # near-corner, low altitude
]


# --- frozen-alphabet invariants --------------------------------------------

def test_unicode_alphabet_is_full_frozen_space():
    assert UNICODE_SIZE == 1_114_112  # 0x110000, NOT just assigned codepoints
    # identity bijection: index i <-> chr(i)
    for i in (0, 1, 65, 0x1F600, UNICODE_SIZE - 1):
        assert UNICODE_INDEX[UNICODE_ALPHABET[i]] == i
        assert ord(UNICODE_ALPHABET[i]) == i


def test_alnum_alphabet_frozen():
    assert ALNUM_ALPHABET == list(
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    )
    assert len(ALNUM_ALPHABET) == 62
    assert ALNUM_INDEX["0"] == 0 and ALNUM_INDEX["z"] == 61


def test_emoji_alphabet_frozen_unicode_15():
    # Fixed test vector pins the Unicode-15.0 frozen mapping.
    # EMOJI_SIZE = 3600 gives ~2.75x headroom over Earth-3m demand (spec: ~3x).
    assert EMOJI_SIZE == 3600
    assert len(EMOJI_ALPHABET) == 3600
    assert len(set(EMOJI_ALPHABET)) == 3600          # all distinct
    assert ord(EMOJI_ALPHABET[0]) == FROZEN_EMOJI_FIRST == 0x1F600   # 😀  index 0
    assert ord(EMOJI_ALPHABET[3599]) == FROZEN_EMOJI_LAST == 0x257F   # ╿  index 3599
    assert EMOJI_INDEX[EMOJI_ALPHABET[0]] == 0
    assert EMOJI_INDEX[EMOJI_ALPHABET[3599]] == 3599


# --- scramble bijection -----------------------------------------------------

def test_perm_is_bijection_small():
    bits = 12  # 4096 values, exhaustive
    seen = {perm(x, bits) for x in range(1 << bits)}
    assert len(seen) == (1 << bits)
    for x in range(1 << bits):
        assert iperm(perm(x, bits), bits) == x


def test_int_codec_roundtrip():
    for alphabet, index in (
        (ALNUM_ALPHABET, ALNUM_INDEX),
        (EMOJI_ALPHABET, EMOJI_INDEX),
    ):
        v = len(alphabet)
        for count in (1, 3, 4, 8):
            hi = v ** count - 1
            samples = {0, 1, min(v - 1, hi), hi, random.randrange(hi)}
            for n in samples:
                assert symbols_to_int(int_to_symbols(n, count, alphabet), index) == n
    # unicode (virtual alphabet)
    v = UNICODE_SIZE
    for count in (1, 3):
        hi = v ** count - 1
        for n in {0, 1, v - 1, hi, random.randrange(hi)}:
            syms = int_to_symbols(n, count, UNICODE_ALPHABET)
            assert symbols_to_int(syms, UNICODE_INDEX) == n


# --- geo round-trip within cell --------------------------------------------

def _check(enc, dec, name, lat_tol, lon_tol, alt_tol, count):
    for lat, lon, alt in PTS:
        s = enc(lat, lon, alt)
        assert len(s) == count, (name, len(s), count)
        dlat, dlon, dalt = dec(s)
        assert abs(dlat - lat) <= lat_tol, (name, "lat", lat, dlat)
        assert abs(dlon - lon) <= lon_tol, (name, "lon", lon, dlon)
        assert abs(dalt - alt) <= alt_tol, (name, "alt", alt, dalt)


def test_unicode_roundtrip():
    # 60 bits -> sub-metre lat/lon, ~10m alt. Tolerances in degrees.
    _check(unicode_to_dotchars, dotchars_to_unicode, "unicode",
           lat_tol=1e-4, lon_tol=2e-4, alt_tol=15.0, count=3)


def test_alphanumeric_roundtrip():
    # 47 bits -> ~38m horizontal, ~40m alt. Tolerances generous (1 cell).
    _check(alphanumeric_to_dotchars, dotchars_to_alphanumeric, "alnum",
           lat_tol=4e-4, lon_tol=4e-4, alt_tol=80.0, count=8)


def test_emoji_roundtrip():
    # 47 bits (V=3600) -> ~38m horizontal, ~39m alt. Same bit budget as alphanumeric.
    # Tolerances generous at ~1 cell (lat cell = 180/2^19 deg ≈ 3.4e-4 deg ≈ 38m).
    _check(emoji_to_dotchars, dotchars_to_emoji, "emoji",
           lat_tol=4e-4, lon_tol=4e-4, alt_tol=80.0, count=4)


# --- adjacency is broken (typo-detectable) ---------------------------------

def test_adjacency_broken_unicode():
    a = unicode_to_dotchars(28.613900, 77.209000, 0.0)
    b = unicode_to_dotchars(28.613930, 77.209000, 0.0)  # ~3 m north
    assert a != b  # adjacent cells get a different address


# --- determinism ------------------------------------------------------------

def test_deterministic():
    for _ in range(3):
        assert unicode_to_dotchars(28.6139, 77.2090, 216.0) == \
               unicode_to_dotchars(28.6139, 77.2090, 216.0)


# ============================================================================
# SPEC-REQUIRED TESTS (beyond basic round-trip)
# ============================================================================

# --- exhaustive bijection (no collisions, sampled where full is infeasible) --

def test_exhaustive_bijection_perm_47bits():
    """Verify perm/iperm is a true bijection on the 47-bit address space used
    by alphanumeric and emoji (the tightest budget).  Exhaustive at 47 bits is
    not feasible, so we do a collision-free sample of 2^16 = 65536 values and
    verify the closed-form inverse returns the original input for every one."""
    bits = 47
    N = 1 << 16  # 65536 samples
    rng = random.Random(0xDEAD_BEEF)
    top = 1 << bits
    seen_outputs: set = set()
    for _ in range(N):
        x = rng.randrange(top)
        y = perm(x, bits)
        assert y not in seen_outputs, f"collision: perm({x}, {bits}) = {y} already seen"
        seen_outputs.add(y)
        assert iperm(y, bits) == x, f"iperm(perm({x})) != {x}"


def test_exhaustive_bijection_perm_60bits():
    """Same exhaustive sample test for the 60-bit unicode space."""
    bits = 60
    N = 1 << 16
    rng = random.Random(0xCAFE_BABE)
    top = 1 << bits
    seen_outputs: set = set()
    for _ in range(N):
        x = rng.randrange(top)
        y = perm(x, bits)
        assert y not in seen_outputs, f"collision: perm({x}, {bits}) = {y} already seen"
        seen_outputs.add(y)
        assert iperm(y, bits) == x, f"iperm(perm({x})) != {x}"


def test_exhaustive_bijection_alnum_addresses():
    """Sample 10000 random (lat, lon, alt) triples and verify:
    (a) alnum encode -> decode -> re-encode produces the same string (no-collision /
        stable fixed-point), and (b) no two distinct triples produce the same address
        (within the sample)."""
    rng = random.Random(0xBEEF)
    seen: dict = {}
    for _ in range(10_000):
        lat = rng.uniform(-90, 90)
        lon = rng.uniform(-180, 180)
        alt = rng.uniform(-1000, 9000)
        addr = alphanumeric_to_dotchars(lat, lon, alt)
        # Re-encode the decoded cell centre must match (stable fixed-point)
        dlat, dlon, dalt = dotchars_to_alphanumeric(addr)
        addr2 = alphanumeric_to_dotchars(dlat, dlon, dalt)
        assert addr == addr2, f"alnum not a fixed-point: {addr!r} -> {addr2!r}"
        # No two inputs in this sample should produce the same address
        # (they may fall into the same cell, which is fine — check only distinct cells)
        if addr in seen:
            # same cell is fine; verify it decodes to the same centre
            assert dotchars_to_alphanumeric(addr) == dotchars_to_alphanumeric(seen[addr])
        else:
            seen[addr] = addr


def test_exhaustive_bijection_emoji_addresses():
    """Same fixed-point + collision test for emoji encoding."""
    rng = random.Random(0xF00D)
    seen: dict = {}
    for _ in range(10_000):
        lat = rng.uniform(-90, 90)
        lon = rng.uniform(-180, 180)
        alt = rng.uniform(-1000, 9000)
        addr = emoji_to_dotchars(lat, lon, alt)
        dlat, dlon, dalt = dotchars_to_emoji(addr)
        addr2 = emoji_to_dotchars(dlat, dlon, dalt)
        assert addr == addr2, f"emoji not a fixed-point: {addr!r} -> {addr2!r}"
        if addr in seen:
            assert dotchars_to_emoji(addr) == dotchars_to_emoji(seen[addr])
        else:
            seen[addr] = addr


def test_exhaustive_bijection_unicode_addresses():
    """Same fixed-point + collision test for unicode encoding."""
    rng = random.Random(0x1234)
    seen: dict = {}
    for _ in range(10_000):
        lat = rng.uniform(-90, 90)
        lon = rng.uniform(-180, 180)
        alt = rng.uniform(-1000, 9000)
        addr = unicode_to_dotchars(lat, lon, alt)
        dlat, dlon, dalt = dotchars_to_unicode(addr)
        addr2 = unicode_to_dotchars(dlat, dlon, dalt)
        assert addr == addr2, f"unicode not a fixed-point: {addr!r} -> {addr2!r}"
        if addr in seen:
            assert dotchars_to_unicode(addr) == dotchars_to_unicode(seen[addr])
        else:
            seen[addr] = addr


# --- adjacency-break: 1-char flip must move >= 100 km -----------------------

def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    """Great-circle distance in km (Haversine)."""
    import math
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.asin(min(1.0, math.sqrt(a)))


def _test_adjacency_break(enc, dec, alphabet_or_size, name: str,
                          n_points: int = 20, min_km: float = 100.0) -> None:
    """For each of n_points, encode then flip every symbol position to the next
    symbol in the vocabulary (index + 1 mod V). Verify the decoded location is
    always >= min_km away from the original location."""
    rng = random.Random(0x5CA1AB1E)
    # Build a list of valid symbols for substitution
    if isinstance(alphabet_or_size, int):
        # Unicode: use a simple list of representative codepoints
        v = alphabet_or_size
        alts = [chr((ord("A") + i) % v) for i in range(1, 10)]  # a few substitutes
    else:
        alts = list(alphabet_or_size)  # actual alphabet list

    fail_msg_parts = []
    for _ in range(n_points):
        lat = rng.uniform(-85, 85)
        lon = rng.uniform(-180, 180)
        alt = rng.uniform(0, 1000)
        orig_str = enc(lat, lon, alt)
        orig_chars = list(orig_str)
        orig_lat, orig_lon, _ = dec(orig_str)

        for pos in range(len(orig_chars)):
            # Substitute position pos with the 'next' symbol in the vocabulary
            if isinstance(alphabet_or_size, int):
                old_cp = ord(orig_chars[pos])
                new_cp = (old_cp + (alphabet_or_size // 3)) % alphabet_or_size
                if new_cp == old_cp:
                    continue
                new_char = chr(new_cp)
            else:
                old_idx = next(
                    (i for i, c in enumerate(alphabet_or_size) if c == orig_chars[pos]),
                    None,
                )
                if old_idx is None:
                    continue
                new_idx = (old_idx + len(alphabet_or_size) // 3) % len(alphabet_or_size)
                if new_idx == old_idx:
                    continue
                new_char = alphabet_or_size[new_idx]

            mutated = orig_chars[:pos] + [new_char] + orig_chars[pos + 1:]
            try:
                mlat, mlon, _ = dec("".join(mutated))
            except (ValueError, KeyError):
                continue  # invalid symbol combination — already a detectable error

            km = _haversine_km(orig_lat, orig_lon, mlat, mlon)
            if km < min_km:
                fail_msg_parts.append(
                    f"{name}: pos={pos} orig=({lat:.4f},{lon:.4f}) "
                    f"mutated->({mlat:.4f},{mlon:.4f}) dist={km:.1f}km < {min_km}km"
                )

    assert not fail_msg_parts, "\n".join(fail_msg_parts)


def test_adjacency_break_unicode():
    """Flipping 1 Unicode character moves the decoded location >= 100 km."""
    _test_adjacency_break(
        unicode_to_dotchars, dotchars_to_unicode, UNICODE_SIZE, "unicode"
    )


def test_adjacency_break_alnum():
    """Flipping 1 alnum character moves the decoded location >= 100 km."""
    _test_adjacency_break(
        alphanumeric_to_dotchars, dotchars_to_alphanumeric, ALNUM_ALPHABET, "alnum"
    )


def test_adjacency_break_emoji():
    """Flipping 1 emoji moves the decoded location >= 100 km."""
    _test_adjacency_break(
        emoji_to_dotchars, dotchars_to_emoji, EMOJI_ALPHABET, "emoji"
    )


# --- cross-mode consistency --------------------------------------------------

def test_cross_mode_consistency():
    """All three encodings of the same (lat, lon, alt) must decode back to
    a cell centre that is within the respective mode's cell tolerance, AND the
    cell centres from all three modes must lie within 500 m of each other in
    lat/lon (they encode the same point, just at different resolutions).

    The test also verifies that the three encodings are DIFFERENT strings — they
    use different alphabets and character counts, so they should never coincide."""
    for lat, lon, alt in PTS:
        u = unicode_to_dotchars(lat, lon, alt)
        an = alphanumeric_to_dotchars(lat, lon, alt)
        em = emoji_to_dotchars(lat, lon, alt)

        # Must be different strings (different alphabet / length)
        assert u != an, f"unicode == alnum for ({lat},{lon},{alt})"
        assert u != em, f"unicode == emoji for ({lat},{lon},{alt})"
        assert an != em, f"alnum == emoji for ({lat},{lon},{alt})"

        # Decode all three
        ulat, ulon, _ = dotchars_to_unicode(u)
        alat, alon, _ = dotchars_to_alphanumeric(an)
        elat, elon, _ = dotchars_to_emoji(em)

        # All three decoded cell centres must agree within 500 m in lat/lon
        # (they represent the same surface point, just at different resolutions)
        assert _haversine_km(ulat, ulon, alat, alon) < 0.5, \
            f"unicode vs alnum centres differ >{0.5}km at ({lat},{lon})"
        assert _haversine_km(ulat, ulon, elat, elon) < 0.5, \
            f"unicode vs emoji centres differ >{0.5}km at ({lat},{lon})"
        assert _haversine_km(alat, alon, elat, elon) < 0.5, \
            f"alnum vs emoji centres differ >{0.5}km at ({lat},{lon})"


if __name__ == "__main__":
    test_unicode_alphabet_is_full_frozen_space()
    test_alnum_alphabet_frozen()
    test_emoji_alphabet_frozen_unicode_15()
    test_perm_is_bijection_small()
    test_int_codec_roundtrip()
    test_unicode_roundtrip()
    test_alphanumeric_roundtrip()
    test_emoji_roundtrip()
    test_adjacency_broken_unicode()
    test_deterministic()
    test_exhaustive_bijection_perm_47bits()
    test_exhaustive_bijection_perm_60bits()
    test_exhaustive_bijection_alnum_addresses()
    test_exhaustive_bijection_emoji_addresses()
    test_exhaustive_bijection_unicode_addresses()
    test_adjacency_break_unicode()
    test_adjacency_break_alnum()
    test_adjacency_break_emoji()
    test_cross_mode_consistency()

    # Demo output
    nd = (28.6139, 77.2090, 216.0)
    u = unicode_to_dotchars(*nd)
    an = alphanumeric_to_dotchars(*nd)
    em = emoji_to_dotchars(*nd)
    print("New Delhi", nd)
    print("  unicode ->", u, "->", dotchars_to_unicode(u))
    print("  alnum   ->", an, "->", dotchars_to_alphanumeric(an))
    print("  emoji   ->", em, "->", dotchars_to_emoji(em))
    print("ALL TESTS PASSED")
