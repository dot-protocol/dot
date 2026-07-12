#!/usr/bin/env python3
"""
Republic spec bundle chunker — Mathpost v0.2 archival envelope shape.

Splits republic-spec.md into ~1KB compressed chunks suitable for any
constrained substrate (SMS-multipart, LoRa, QR, paper microdot, etc.),
content-addresses each chunk with BLAKE3, and emits a manifest that
lets a verifier reassemble the document deterministically.

The mathpost shape here is *archival*: it captures the v0.2 envelope
fields that exist for any chunk (Magic, Version, Origin, Lamport seq,
zstd compression, BLAKE3 hash, chunk-index, total-chunks) but does
NOT include live session keys / AES-GCM payload encryption — the spec
is public-domain CC0 content, so encryption would be theater. The
fields that would only exist in a live wire envelope (To_*, Nonce,
PoW, Signature over private key) are documented as `archival=true`.

Output layout:
  republic-spec/bundle/
    chunks/0000.zst, 0001.zst, ...        # raw compressed payload
    envelopes/0000.json, 0001.json, ...   # mathpost v0.2 archival envelopes
    chunks-manifest.json                  # ordered manifest + total hash
    chunks-manifest.blake3                # 32-byte BLAKE3 of manifest (broadcast target)
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import sys
from pathlib import Path

import blake3
import zstandard as zstd

MAGIC = 0x4D503032  # "MP02"
VERSION = "mathpost/0.2-archival"
ORIGIN = "dot1:kin-1-piper:shannon"


def b3(data: bytes) -> str:
    return blake3.blake3(data).hexdigest()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def chunk_text(text: bytes, target_compressed: int = 1024,
               cctx: zstd.ZstdCompressor | None = None) -> list[bytes]:
    """
    Greedy splitter: grow chunk byte-by-byte until zstd(payload) is just
    under target_compressed bytes. Boundaries land on byte positions
    chosen for compressed size, not text structure — the manifest carries
    the ordering, so cuts can fall anywhere.
    """
    if cctx is None:
        cctx = zstd.ZstdCompressor(level=3)
    chunks: list[bytes] = []
    i = 0
    n = len(text)
    while i < n:
        lo, hi = 1, n - i
        # binary search for the largest slice whose compressed size <= target
        best = 1
        while lo <= hi:
            mid = (lo + hi) // 2
            comp = cctx.compress(text[i:i + mid])
            if len(comp) <= target_compressed:
                best = mid
                lo = mid + 1
            else:
                hi = mid - 1
        chunks.append(text[i:i + best])
        i += best
    return chunks


def build_envelope(chunk_index: int, total_chunks: int,
                   raw_chunk: bytes, comp_chunk: bytes,
                   doc_path: str, lamport_seq: int) -> dict:
    """Build an archival mathpost v0.2 envelope wrapper around one chunk."""
    return {
        "header": {
            "magic": MAGIC,
            "version": VERSION,
            "origin_cell": ORIGIN,
            "target_cell": "dot1:broadcast:republic-spec/v0.1.1",
            "lamport_seq": lamport_seq,
            "doc_path": doc_path,
            "chunk_index": chunk_index,
            "total_chunks": total_chunks,
            "raw_size_bytes": len(raw_chunk),
            "compressed_size_bytes": len(comp_chunk),
        },
        "cryptography": {
            "bip32_path": "m/44'/0'/0'/0/0",
            "archival": True,
            "note": (
                "v0.2 envelope shape preserved for spec-conformance. "
                "Session-key fields (To_ed25519, To_x25519, Nonce, PoW, "
                "AES-GCM ciphertext, Signature) intentionally omitted: "
                "payload is CC0 public-domain text, content-addressing "
                "via BLAKE3 is the integrity primitive."
            ),
        },
        "payload": {
            "compression": "zstd-level-3",
            "encryption": "none-cc0-public",
            "chunk_blake3": b3(comp_chunk),
            "chunk_sha256": sha256(comp_chunk),
            "raw_blake3": b3(raw_chunk),
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="republic-spec.md",
                    help="Source file under republic-spec/")
    ap.add_argument("--target-bytes", type=int, default=1024,
                    help="Target compressed bytes per chunk (default 1024)")
    ap.add_argument("--out-dir", default="bundle",
                    help="Output dir under republic-spec/")
    args = ap.parse_args()

    here = Path(__file__).resolve().parent.parent  # republic-spec/
    src = here / args.source
    out = here / args.out_dir
    chunks_dir = out / "chunks"
    env_dir = out / "envelopes"
    chunks_dir.mkdir(parents=True, exist_ok=True)
    env_dir.mkdir(parents=True, exist_ok=True)

    raw_text = src.read_bytes()
    doc_blake3 = b3(raw_text)
    doc_sha256 = sha256(raw_text)

    cctx = zstd.ZstdCompressor(level=3)
    raw_chunks = chunk_text(raw_text, args.target_bytes, cctx)
    n = len(raw_chunks)

    manifest_chunks = []
    total_compressed = 0
    for i, raw in enumerate(raw_chunks):
        comp = cctx.compress(raw)
        total_compressed += len(comp)
        (chunks_dir / f"{i:04d}.zst").write_bytes(comp)
        env = build_envelope(i, n, raw, comp, args.source, lamport_seq=i)
        (env_dir / f"{i:04d}.json").write_text(json.dumps(env, indent=2, sort_keys=True))
        manifest_chunks.append({
            "index": i,
            "chunk_file": f"chunks/{i:04d}.zst",
            "envelope_file": f"envelopes/{i:04d}.json",
            "raw_size_bytes": len(raw),
            "compressed_size_bytes": len(comp),
            "chunk_blake3": b3(comp),
            "raw_blake3": b3(raw),
        })

    manifest = {
        "schema": "republic-spec/chunks-manifest/v0.1",
        "doc": {
            "path": args.source,
            "raw_size_bytes": len(raw_text),
            "doc_blake3": doc_blake3,
            "doc_sha256": doc_sha256,
        },
        "encoding": {
            "compression": "zstd-level-3",
            "target_compressed_bytes": args.target_bytes,
            "envelope": "mathpost/0.2-archival",
        },
        "reconstruction_recipe": [
            "1. Verify each chunk_file matches its chunk_blake3.",
            "2. zstd-decompress each chunk_file in order (by 'index').",
            "3. Concatenate raw outputs.",
            "4. Verify the concatenated bytes' BLAKE3 matches doc.doc_blake3.",
            "5. Verify the concatenated bytes' SHA-256 matches doc.doc_sha256.",
        ],
        "totals": {
            "chunk_count": n,
            "total_compressed_bytes": total_compressed,
            "compression_ratio": round(total_compressed / max(1, len(raw_text)), 4),
        },
        "chunks": manifest_chunks,
        "generator": {
            "tool": "republic-spec/tools/bundle_chunker.py",
            "generated_at_utc": dt.datetime.now(dt.UTC).isoformat(),
            "origin_cell": ORIGIN,
        },
    }

    manifest_bytes = json.dumps(manifest, indent=2, sort_keys=True).encode()
    (out / "chunks-manifest.json").write_bytes(manifest_bytes)
    manifest_b3 = b3(manifest_bytes)
    manifest_sha256 = sha256(manifest_bytes)
    (out / "chunks-manifest.blake3").write_text(manifest_b3 + "\n")
    (out / "chunks-manifest.sha256").write_text(manifest_sha256 + "\n")

    print(f"  source:                {src.relative_to(here)}")
    print(f"  raw size:              {len(raw_text):,} bytes")
    print(f"  doc BLAKE3:            {doc_blake3}")
    print(f"  doc SHA-256:           {doc_sha256}")
    print(f"  chunks emitted:        {n}")
    print(f"  total compressed:      {total_compressed:,} bytes "
          f"({total_compressed/len(raw_text)*100:.1f}% of raw)")
    print(f"  manifest BLAKE3:       {manifest_b3}")
    print(f"  manifest SHA-256:      {manifest_sha256}")
    print()
    print("  Broadcast this hash via DOTpost:")
    print(f"    BLAKE3({args.source}/manifest) = {manifest_b3}")
    print()


if __name__ == "__main__":
    main()
