# SPDX-License-Identifier: Apache-2.0
"""dotwords CLI.

  dotwords encode 28.6139 77.2090 [alt] [--words N]
  dotwords decode dash.gloom.ripple.trap.drip
  dotwords obs OBS-coordination-20260528-851350776
  dotwords unobs OBS-coordination-20260528-ranch.crush.problem
"""

import argparse

from .geo import coordinates_to_dotwords, dotwords_to_coordinates
from .obs import obs_id_to_words, words_to_obs_id


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="dotwords")
    sub = p.add_subparsers(dest="cmd", required=True)

    e = sub.add_parser("encode", help="coords -> words")
    e.add_argument("lat", type=float)
    e.add_argument("lon", type=float)
    e.add_argument("alt", type=float, nargs="?", default=0.0)
    e.add_argument("--words", type=int, default=5)

    d = sub.add_parser("decode", help="words -> coords")
    d.add_argument("words", help="dot- or space-joined words")

    o = sub.add_parser("obs", help="obs id -> speakable id")
    o.add_argument("obs_id")

    u = sub.add_parser("unobs", help="speakable id -> obs id")
    u.add_argument("spoken_id")

    a = p.parse_args(argv)

    if a.cmd == "encode":
        print(".".join(coordinates_to_dotwords(a.lat, a.lon, a.alt, a.words)))
    elif a.cmd == "decode":
        words = a.words.replace(".", " ").split()
        lat, lon, alt = dotwords_to_coordinates(words)
        print(f"{lat:.6f} {lon:.6f} {alt:.1f}")
    elif a.cmd == "obs":
        print(obs_id_to_words(a.obs_id))
    elif a.cmd == "unobs":
        print(words_to_obs_id(a.spoken_id))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
