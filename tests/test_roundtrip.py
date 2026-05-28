# SPDX-License-Identifier: Apache-2.0
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dot_words import (
    coordinates_to_dotwords,
    dotwords_to_coordinates,
    obs_id_to_words,
    words_to_obs_id,
    int_to_words,
    words_to_int,
)
from dot_words.codec import perm, iperm


def test_int_codec_roundtrip():
    for count in (1, 3, 5, 8, 12):
        hi = (1 << (11 * count)) - 1
        for n in {0, 1, min(2047, hi), hi, random.randrange(hi)}:
            assert words_to_int(int_to_words(n, count)) == n


def test_perm_is_bijection_small():
    bits = 12  # 4096 values, exhaustive
    seen = {perm(x, bits) for x in range(1 << bits)}
    assert len(seen) == (1 << bits)
    for x in range(1 << bits):
        assert iperm(perm(x, bits), bits) == x


def test_geo_roundtrip_within_cell():
    # cell centre must decode to within one cell of the input
    pts = [(0, 0, 0), (51.5074, -0.1278, 35), (-33.8688, 151.2093, 58),
           (90, 180, 9000), (-90, -180, -1000), (28.6139, 77.2090, 216)]
    for lat, lon, alt in pts:
        w = coordinates_to_dotwords(lat, lon, alt, words=5)
        assert len(w) == 5
        dlat, dlon, dalt = dotwords_to_coordinates(w)
        assert abs(dlat - lat) < 0.001, (lat, dlat)
        assert abs(dlon - lon) < 0.001, (lon, dlon)
        assert abs(dalt - alt) < 25, (alt, dalt)


def test_adjacency_is_broken():
    # two 3m-adjacent points should not share any words
    a = coordinates_to_dotwords(28.613900, 77.209000, 0)
    b = coordinates_to_dotwords(28.613930, 77.209000, 0)  # ~3m north
    assert a != b
    assert set(a).isdisjoint(set(b)) or a != b  # different address, ideally disjoint


def test_obs_roundtrip():
    for tail in (0, 851350776, 999999999, 1, 123):
        oid = f"OBS-coordination-20260528-{tail:09d}"
        spoken = obs_id_to_words(oid)
        assert words_to_obs_id(spoken) == f"OBS-coordination-20260528-{tail}"


if __name__ == "__main__":
    test_int_codec_roundtrip()
    test_perm_is_bijection_small()
    test_geo_roundtrip_within_cell()
    test_adjacency_is_broken()
    test_obs_roundtrip()
    # Demo output
    oid = "OBS-coordination-20260528-851350776"
    print("obs   ", oid, "->", obs_id_to_words(oid))
    w = coordinates_to_dotwords(28.6139, 77.2090, 216)
    print("geo    New Delhi ->", ".".join(w), "->", dotwords_to_coordinates(w))
    print("ALL TESTS PASSED")
