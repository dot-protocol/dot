#!/usr/bin/env python3
"""Reconstruct republic-spec.md from the chunk bundle and verify hashes."""
import hashlib
import json
import sys
from pathlib import Path

import blake3
import zstandard as zstd


def b3(data: bytes) -> str:
    return blake3.blake3(data).hexdigest()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main():
    here = Path(__file__).resolve().parent.parent
    bundle = here / "bundle"
    manifest = json.loads((bundle / "chunks-manifest.json").read_text())

    # 1. verify manifest hash matches stored value
    manifest_bytes = json.dumps(manifest, indent=2, sort_keys=True).encode()
    stored_b3 = (bundle / "chunks-manifest.blake3").read_text().strip()
    computed_b3 = b3(manifest_bytes)
    assert stored_b3 == computed_b3, f"manifest hash mismatch: {stored_b3} != {computed_b3}"
    print(f"  manifest BLAKE3 OK:    {computed_b3}")

    # 2. verify every chunk hash + zstd-decompress in order
    dctx = zstd.ZstdDecompressor()
    chunks_in_order = sorted(manifest["chunks"], key=lambda c: c["index"])
    parts = []
    for c in chunks_in_order:
        comp = (bundle / c["chunk_file"]).read_bytes()
        assert b3(comp) == c["chunk_blake3"], (
            f"chunk {c['index']} hash mismatch")
        raw = dctx.decompress(comp)
        assert b3(raw) == c["raw_blake3"], (
            f"chunk {c['index']} raw-hash mismatch after decompress")
        parts.append(raw)
    print(f"  {len(chunks_in_order)} chunks: all BLAKE3 hashes verified")

    # 3. verify reconstructed document hash
    doc = b"".join(parts)
    assert b3(doc) == manifest["doc"]["doc_blake3"], "reconstructed BLAKE3 mismatch"
    assert sha256(doc) == manifest["doc"]["doc_sha256"], "reconstructed SHA-256 mismatch"
    assert len(doc) == manifest["doc"]["raw_size_bytes"], "size mismatch"

    # 4. byte-equality vs source on disk (paranoid)
    src = (here / manifest["doc"]["path"]).read_bytes()
    assert src == doc, "byte-equality with source failed"

    print(f"  reconstructed size:    {len(doc):,} bytes")
    print(f"  reconstructed BLAKE3:  {b3(doc)}")
    print(f"  reconstructed SHA-256: {sha256(doc)}")
    print(f"  byte-identical to {manifest['doc']['path']}: yes")
    print()
    print("  Bundle verified end-to-end.")


if __name__ == "__main__":
    main()
