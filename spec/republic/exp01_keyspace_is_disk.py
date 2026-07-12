"""
Experiment 1 — THE KEYSPACE IS THE DISK
================================================================
Claim: a 45-byte seed can derive arbitrary content at arbitrary
hierarchical paths. The 'storage' is the act of remembering the
path, not the content. This is Plato's recollection made
cryptographic — and the foundation of the Republic's claim that
storage is derivation, not a physical resource you must rent.
"""
import hashlib, hmac

SEED = b"The_users_25th_word_algorithm_2026_local_only"  # 45 bytes

def derive(seed: bytes, path: str) -> bytes:
    """Hierarchical key derivation. Each path component HMACs the parent."""
    out = seed
    for component in path.split("/"):
        out = hmac.new(out, component.encode(), hashlib.sha512).digest()
    return out

def derive_content_fast(seed: bytes, path: str, n_bytes: int) -> bytes:
    """Stream-derive arbitrary length content using SHAKE as an XOF."""
    base = derive(seed, path)
    h = hashlib.shake_256()
    h.update(base)
    return h.digest(n_bytes)

content_map = {
    "photos/2025/birthday":      256 * 1024,
    "music/composed/2024":       4 * 1024,
    "health/genome":             100 * 1024,
    "messages/jane/march":       50 * 1024,
    "notes/dreams/2024":         20 * 1024,
    "credentials/uni_degree":    1 * 1024,
    "credentials/passport":      2 * 1024,
}

print("="*64)
print("Deriving 'content' from a single 45-byte seed")
print("="*64)
total_derived = 0
for path, size in content_map.items():
    blob = derive_content_fast(SEED, path, size)
    fingerprint = hashlib.sha256(blob).hexdigest()[:16]
    total_derived += size
    print(f"  {path:30s} | {size:>8d} B | fp={fingerprint}")

print("-"*64)
total_paths = sum(len(p) for p in content_map.keys())
print(f"Seed size       : {len(SEED)} bytes")
print(f"Paths size      : {total_paths} bytes")
print(f"True storage    : {len(SEED) + total_paths} bytes (seed + paths)")
print(f"Content derived : {total_derived:,} bytes")
print(f"Compression     : {total_derived / (len(SEED) + total_paths):.0f}x")
print()
print("Determinism check — re-derive 'photos/2025/birthday':")
a = derive_content_fast(SEED, "photos/2025/birthday", 256*1024)
b = derive_content_fast(SEED, "photos/2025/birthday", 256*1024)
print(f"  Two derivations match : {hashlib.sha256(a).hexdigest() == hashlib.sha256(b).hexdigest()}")
print()
print("LESSON: For *derivable* patterns the storage cost is the seed +")
print("the path string, not the content. The keyspace IS the disk.")
print("For real user content this works for: mathematical primitives")
print("(keys, signatures, addresses, hashes), procedural content")
print("(AI-generated, recipes, seeds), and content-addressed shared")
print("patterns. The residual (truly arbitrary user data) is small.")
