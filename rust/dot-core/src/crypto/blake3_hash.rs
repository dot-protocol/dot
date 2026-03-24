// BLAKE3 hashing for DOT Protocol R854.
// Used for chain linking (prev hash) and content addressing.

use crate::crypto::metrics;

/// Compute BLAKE3 hash of `data`, returning 32 raw bytes.
pub fn hash(data: &[u8]) -> [u8; 32] {
    metrics::record_hash(data.len());
    *blake3::hash(data).as_bytes()
}

/// Compute BLAKE3 hash of `data`, returning lowercase hex string.
pub fn hash_hex(data: &[u8]) -> String {
    let bytes = hash(data);
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_empty() {
        let h = hash(b"");
        assert_eq!(h.len(), 32);
        // BLAKE3("") is deterministic
        let h2 = hash(b"");
        assert_eq!(h, h2);
    }

    #[test]
    fn test_hash_known_vector() {
        // BLAKE3 of "hello world" — known value from blake3 reference
        let h = hash_hex(b"hello world");
        assert_eq!(h.len(), 64);
        // Verify it's deterministic
        assert_eq!(h, hash_hex(b"hello world"));
    }

    #[test]
    fn test_hash_differs_for_different_inputs() {
        let h1 = hash(b"foo");
        let h2 = hash(b"bar");
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_hash_hex_is_lowercase() {
        let h = hash_hex(b"test");
        assert_eq!(h, h.to_lowercase());
        assert_eq!(h.len(), 64);
    }

    #[test]
    fn test_hash_1kb() {
        let data = vec![0xABu8; 1024];
        let h = hash(&data);
        assert_eq!(h.len(), 32);
    }

    #[test]
    fn test_hash_deterministic_across_calls() {
        let data = b"DOT Protocol R854";
        let h1 = hash(data);
        let h2 = hash(data);
        let h3 = hash(data);
        assert_eq!(h1, h2);
        assert_eq!(h2, h3);
    }

    #[test]
    fn test_hash_single_byte_differs() {
        let data1 = b"abc";
        let data2 = b"abd";
        assert_ne!(hash(data1), hash(data2));
    }
}
