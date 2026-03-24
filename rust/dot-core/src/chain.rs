// DOT chain linking — BLAKE3-based chain of observations.

use crate::types::{DOT, ChainData};
use crate::encode::to_bytes;
use crate::crypto::blake3_hash::hash;

/// Chain a DOT to an optional previous DOT.
///
/// If `previous` is Some, computes BLAKE3(to_bytes(previous)) and sets
/// chain.prev and chain.depth on the DOT.
///
/// If `previous` is None, the DOT is a genesis DOT — no chain field set
/// (unless the DOT already has one, in which case it's preserved).
pub fn chain_dot(mut dot: DOT, previous: Option<&DOT>) -> DOT {
    match previous {
        None => {
            // Genesis DOT — no chain link needed.
            // Depth = 1 (this is the first DOT in the chain).
            if dot.chain.is_none() {
                // Leave chain as None for a true genesis DOT.
                // The caller can set chain.depth = 1 manually if desired.
            }
        }
        Some(prev) => {
            let prev_hash = hash_dot(prev);
            let prev_depth = prev
                .chain
                .as_ref()
                .map(|c| c.depth)
                .unwrap_or(0);

            dot.chain = Some(ChainData {
                prev: prev_hash.to_vec(),
                depth: prev_depth + 1,
            });
        }
    }
    dot
}

/// Compute the BLAKE3 hash of a DOT's encoded bytes.
/// This is the canonical content address of the DOT.
///
/// Uses TLV encoding (same as to_bytes), ensuring cross-language compatibility.
pub fn hash_dot(dot: &DOT) -> [u8; 32] {
    let bytes = to_bytes(dot);
    hash(&bytes)
}

/// Compute the BLAKE3 hash of a DOT as a hex string.
pub fn hash_dot_hex(dot: &DOT) -> String {
    let h = hash_dot(dot);
    h.iter().map(|b| format!("{:02x}", b)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::observe::observe;
    use crate::sign::sign_dot;
    use crate::crypto::ed25519::generate_keypair;

    fn init() {
        let _ = sodiumoxide::init();
    }

    #[test]
    fn test_chain_genesis_no_previous() {
        let dot = observe(Some(b"genesis"), None);
        let chained = chain_dot(dot, None);
        // Genesis DOT has no chain field
        assert!(chained.chain.is_none());
    }

    #[test]
    fn test_chain_sets_prev_hash() {
        init();
        let prev = observe(Some(b"first"), None);
        let next = observe(Some(b"second"), None);
        let chained = chain_dot(next, Some(&prev));
        assert!(chained.chain.is_some());
        let c = chained.chain.unwrap();
        assert_eq!(c.prev.len(), 32);
    }

    #[test]
    fn test_chain_depth_increments() {
        init();
        let d0 = observe(Some(b"genesis"), None);
        let d1 = chain_dot(observe(Some(b"second"), None), Some(&d0));
        assert_eq!(d1.chain.as_ref().unwrap().depth, 1);

        let d2 = chain_dot(observe(Some(b"third"), None), Some(&d1));
        assert_eq!(d2.chain.as_ref().unwrap().depth, 2);
    }

    #[test]
    fn test_chain_depth_long_chain() {
        let mut prev = observe(None, None);
        for i in 0..10u64 {
            let next = chain_dot(observe(None, None), Some(&prev));
            assert_eq!(next.chain.as_ref().unwrap().depth, i + 1);
            prev = next;
        }
    }

    #[test]
    fn test_hash_dot_deterministic() {
        let dot = observe(Some(b"deterministic"), None);
        let h1 = hash_dot(&dot);
        let h2 = hash_dot(&dot);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_hash_dot_differs_for_different_dots() {
        let d1 = observe(Some(b"aaa"), None);
        let d2 = observe(Some(b"bbb"), None);
        assert_ne!(hash_dot(&d1), hash_dot(&d2));
    }

    #[test]
    fn test_hash_dot_empty() {
        let dot = DOT::default();
        let h = hash_dot(&dot);
        assert_eq!(h.len(), 32);
    }

    #[test]
    fn test_chain_prev_matches_hash_of_previous() {
        let prev = observe(Some(b"prev dot"), None);
        let expected_hash = hash_dot(&prev);
        let next = chain_dot(observe(Some(b"next"), None), Some(&prev));
        assert_eq!(next.chain.unwrap().prev, expected_hash.to_vec());
    }

    #[test]
    fn test_hash_dot_hex_is_64_chars() {
        let dot = observe(Some(b"test"), None);
        let hex = hash_dot_hex(&dot);
        assert_eq!(hex.len(), 64);
        assert!(hex.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_chain_preserves_payload() {
        let prev = observe(Some(b"first"), None);
        let next = chain_dot(observe(Some(b"second"), None), Some(&prev));
        assert_eq!(next.payload.unwrap(), b"second");
    }

    #[test]
    fn test_chain_with_signed_dots() {
        init();
        let (_, sk) = generate_keypair();
        let d0 = sign_dot(observe(Some(b"genesis"), None), &sk);
        let d1 = sign_dot(chain_dot(observe(Some(b"next"), None), Some(&d0)), &sk);
        assert!(d1.chain.is_some());
        assert_eq!(d1.chain.unwrap().depth, 1);
    }

    #[test]
    fn test_hash_dot_after_sign_differs() {
        init();
        let (_, sk) = generate_keypair();
        let dot = observe(Some(b"test"), None);
        let h1 = hash_dot(&dot);
        let signed = sign_dot(dot, &sk);
        let h2 = hash_dot(&signed);
        // Signed DOT encodes differently (has sign field)
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_three_dot_chain_depths() {
        let d0 = observe(Some(b"0"), None);
        let d1 = chain_dot(observe(Some(b"1"), None), Some(&d0));
        let d2 = chain_dot(observe(Some(b"2"), None), Some(&d1));
        assert!(d0.chain.is_none());
        assert_eq!(d1.chain.as_ref().unwrap().depth, 1);
        assert_eq!(d2.chain.as_ref().unwrap().depth, 2);
    }
}
