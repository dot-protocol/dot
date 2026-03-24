// chain_dot() and hash_dot() integration tests.

use crate::{observe, sign_dot, chain_dot, hash_dot, hash_dot_hex, generate_keypair, init};
use crate::types::{DOT, ChainData};

fn setup() { init().unwrap(); }

#[test]
fn test_genesis_has_no_chain() {
    let dot = observe(Some(b"genesis"), None);
    let chained = chain_dot(dot, None);
    assert!(chained.chain.is_none());
}

#[test]
fn test_chain_to_previous_sets_prev() {
    let prev = observe(Some(b"prev"), None);
    let next = chain_dot(observe(Some(b"next"), None), Some(&prev));
    let c = next.chain.unwrap();
    assert_eq!(c.prev.len(), 32);
}

#[test]
fn test_chain_depth_is_1_for_second_dot() {
    let prev = observe(Some(b"genesis"), None);
    let next = chain_dot(observe(Some(b"second"), None), Some(&prev));
    assert_eq!(next.chain.unwrap().depth, 1);
}

#[test]
fn test_chain_depth_increments_linearly() {
    let mut prev = observe(Some(b"genesis"), None);
    for expected_depth in 1..=10u64 {
        let next = chain_dot(observe(Some(b"step"), None), Some(&prev));
        assert_eq!(next.chain.as_ref().unwrap().depth, expected_depth);
        prev = next;
    }
}

#[test]
fn test_hash_dot_deterministic() {
    let dot = observe(Some(b"deterministic hash"), None);
    let h1 = hash_dot(&dot);
    let h2 = hash_dot(&dot);
    assert_eq!(h1, h2);
}

#[test]
fn test_hash_dot_empty_dot() {
    let dot = DOT::default();
    let h = hash_dot(&dot);
    assert_eq!(h.len(), 32);
    // Empty DOT → empty bytes → BLAKE3("")
    let h2 = hash_dot(&dot);
    assert_eq!(h, h2);
}

#[test]
fn test_hash_dot_differs_for_different_payloads() {
    let d1 = observe(Some(b"aaa"), None);
    let d2 = observe(Some(b"bbb"), None);
    assert_ne!(hash_dot(&d1), hash_dot(&d2));
}

#[test]
fn test_hash_dot_hex_is_64_hex_chars() {
    let dot = observe(Some(b"hex test"), None);
    let hex = hash_dot_hex(&dot);
    assert_eq!(hex.len(), 64);
    assert!(hex.chars().all(|c| c.is_ascii_hexdigit()));
}

#[test]
fn test_chain_prev_matches_hash_of_prev() {
    let prev = observe(Some(b"the prev dot"), None);
    let expected = hash_dot(&prev);
    let next = chain_dot(observe(Some(b"next"), None), Some(&prev));
    assert_eq!(next.chain.unwrap().prev, expected.to_vec());
}

#[test]
fn test_chain_preserves_payload() {
    let prev = observe(Some(b"prev"), None);
    let next = chain_dot(observe(Some(b"payload preserved"), None), Some(&prev));
    assert_eq!(next.payload.unwrap(), b"payload preserved");
}

#[test]
fn test_chain_signed_dots() {
    setup();
    let (_, sk) = generate_keypair();
    let d0 = sign_dot(observe(Some(b"genesis"), None), &sk);
    let d1 = sign_dot(chain_dot(observe(Some(b"second"), None), Some(&d0)), &sk);
    assert!(d1.chain.is_some());
    assert_eq!(d1.chain.unwrap().depth, 1);
}

#[test]
fn test_chain_long_10_dots() {
    let mut dots = vec![observe(Some(b"genesis"), None)];
    for i in 0..9 {
        let prev = &dots[i];
        let next = chain_dot(observe(Some(b"step"), None), Some(prev));
        dots.push(next);
    }
    assert_eq!(dots.last().unwrap().chain.as_ref().unwrap().depth, 9);
}

#[test]
fn test_hash_changes_after_sign() {
    setup();
    let (_, sk) = generate_keypair();
    let dot = observe(Some(b"before sign"), None);
    let h1 = hash_dot(&dot);
    let signed = sign_dot(dot, &sk);
    let h2 = hash_dot(&signed);
    assert_ne!(h1, h2, "hash should change after signing");
}

#[test]
fn test_hash_dot_consistent_across_calls() {
    setup();
    let (_, sk) = generate_keypair();
    let dot = sign_dot(observe(Some(b"consistent"), None), &sk);
    let h1 = hash_dot(&dot);
    let h2 = hash_dot(&dot);
    let h3 = hash_dot(&dot);
    assert_eq!(h1, h2);
    assert_eq!(h2, h3);
}

#[test]
fn test_chain_depth_based_on_prev_chain() {
    // d0: depth=None (genesis)
    // d1 → d0: depth=1
    // d2 → d1: depth=2
    // d3 → d2: depth=3
    let d0 = observe(Some(b"0"), None);
    let d1 = chain_dot(observe(Some(b"1"), None), Some(&d0));
    let d2 = chain_dot(observe(Some(b"2"), None), Some(&d1));
    let d3 = chain_dot(observe(Some(b"3"), None), Some(&d2));
    assert!(d0.chain.is_none());
    assert_eq!(d1.chain.as_ref().unwrap().depth, 1);
    assert_eq!(d2.chain.as_ref().unwrap().depth, 2);
    assert_eq!(d3.chain.as_ref().unwrap().depth, 3);
}

#[test]
fn test_hash_dot_hex_lowercase() {
    let dot = observe(Some(b"lowercase test"), None);
    let hex = hash_dot_hex(&dot);
    assert_eq!(hex, hex.to_lowercase());
}

#[test]
fn test_chain_preserves_dot_type() {
    use crate::{ObserveOptions, ObservationType};
    let prev = observe(None, None);
    let opts = ObserveOptions { dot_type: Some(ObservationType::Event), ..Default::default() };
    let next = chain_dot(observe(Some(b"event"), Some(opts)), Some(&prev));
    assert_eq!(next.dot_type, Some(ObservationType::Event));
}

#[test]
fn test_chain_with_empty_prev() {
    let prev = DOT::default();
    let next = chain_dot(observe(Some(b"after empty"), None), Some(&prev));
    // prev hash is BLAKE3("") = the hash of empty bytes
    let expected = hash_dot(&prev);
    assert_eq!(next.chain.unwrap().prev, expected.to_vec());
}
