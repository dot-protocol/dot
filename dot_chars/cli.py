# SPDX-License-Identifier: Apache-2.0
"""dotchars CLI.

  dotchars encode 28.6139 77.2090 [alt] [--enc unicode|alnum|emoji]
  dotchars decode <chars> [--enc unicode|alnum|emoji]
  dotchars info
"""

import argparse

from .geo import (
    unicode_to_dotchars, dotchars_to_unicode,
    alphanumeric_to_dotchars, dotchars_to_alphanumeric,
    emoji_to_dotchars, dotchars_to_emoji,
    RESOLUTION,
)

_ENCODERS = {
    "unicode": unicode_to_dotchars,
    "alnum": alphanumeric_to_dotchars,
    "emoji": emoji_to_dotchars,
}
_DECODERS = {
    "unicode": dotchars_to_unicode,
    "alnum": dotchars_to_alphanumeric,
    "emoji": dotchars_to_emoji,
}


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="dotchars")
    sub = p.add_subparsers(dest="cmd", required=True)

    e = sub.add_parser("encode", help="coords -> chars")
    e.add_argument("lat", type=float)
    e.add_argument("lon", type=float)
    e.add_argument("alt", type=float, nargs="?", default=0.0)
    e.add_argument("--enc", choices=list(_ENCODERS), default="unicode")

    d = sub.add_parser("decode", help="chars -> coords")
    d.add_argument("chars")
    d.add_argument("--enc", choices=list(_DECODERS), default="unicode")

    sub.add_parser("info", help="show per-encoding resolution")

    a = p.parse_args(argv)

    if a.cmd == "encode":
        print(_ENCODERS[a.enc](a.lat, a.lon, a.alt))
    elif a.cmd == "decode":
        lat, lon, alt = _DECODERS[a.enc](a.chars)
        print(f"{lat:.6f} {lon:.6f} {alt:.1f}")
    elif a.cmd == "info":
        for name, r in RESOLUTION.items():
            print(f"{name:12s} total={r['total_bits']}b "
                  f"(lat={r['lat_bits']} lon={r['lon_bits']} alt={r['alt_bits']})  "
                  f"~lat {r['lat_m']:.2f}m  ~lon {r['lon_m_equator']:.2f}m  "
                  f"~alt {r['alt_m']:.2f}m")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
