// trust scoring integration tests.

use crate::{observe, sign_dot, chain_dot, compute_trust, compute_level, generate_keypair, init};
use crate::{ObserveOptions, ObservationType};
use crate::types::{DOT, TimeData, ChainData, VerifyData, MetaData, SignData};

fn setup() { init().unwrap(); }

#[test]
fn test_empty_dot_trust_zero() {
    assert_eq!(compute_trust(&DOT::default()), 0.0);
}

#[test]
fn test_empty_dot_level_zero() {
    assert_eq!(compute_level(&DOT::default()), 0);
}

#[test]
fn test_trust_range_valid() {
    setup();
    let (_, sk) = generate_keypair();
    for dot in [
        DOT::default(),
        observe(None, None),
        observe(Some(b"data"), None),
        sign_dot(observe(None, None), &sk),
        sign_dot(observe(Some(b"full"), None), &sk),
    ] {
        let trust = compute_trust(&dot);
        assert!(trust >= 0.0, "trust must be >= 0.0, got {}", trust);
        assert!(trust <= 2.0, "trust must be <= 2.0 (with all bonuses), got {}", trust);
    }
}

#[test]
fn test_trust_increases_with_fields() {
    setup();
    let (_, sk) = generate_keypair();
    let t0 = compute_trust(&DOT::default());
    let t1 = compute_trust(&observe(Some(b"x"), None));
    let t2 = compute_trust(&sign_dot(observe(Some(b"x"), None), &sk));
    assert!(t1 >= t0, "unsigned with payload should be >= empty");
    assert!(t2 >= t1, "signed should be >= unsigned");
}

#[test]
fn test_trust_bonus_verified_valid() {
    let mut dot = DOT::default();
    dot.sign = Some(SignData { observer: vec![0u8; 32], sig: vec![0u8; 64] });
    let base_trust = compute_trust(&dot);
    dot.verify = Some(VerifyData { valid: true, reason: None, checked: vec![] });
    let trust_with_verify = compute_trust(&dot);
    assert!(trust_with_verify > base_trust);
}

#[test]
fn test_trust_bonus_not_applied_when_verify_false() {
    let mut dot = DOT::default();
    dot.sign = Some(SignData { observer: vec![0u8; 32], sig: vec![0u8; 64] });
    dot.verify = Some(VerifyData { valid: false, reason: Some("bad".into()), checked: vec![] });
    let base = compute_trust(&DOT { sign: Some(SignData { observer: vec![0u8; 32], sig: vec![0u8; 64] }), ..Default::default() });
    let with_invalid_verify = compute_trust(&dot);
    assert_eq!(base, with_invalid_verify, "invalid verify should not increase trust");
}

#[test]
fn test_trust_bonus_deep_chain() {
    let mut dot = DOT::default();
    dot.chain = Some(ChainData { prev: vec![0u8; 32], depth: 10 });
    let deep = compute_trust(&dot);
    dot.chain = Some(ChainData { prev: vec![0u8; 32], depth: 3 });
    let shallow = compute_trust(&dot);
    assert!(deep > shallow, "deep chain should have more trust");
}

#[test]
fn test_trust_bonus_fhe() {
    let dot_plain = observe(Some(b"test"), Some(ObserveOptions { plaintext: true, ..Default::default() }));
    let dot_fhe = observe(Some(b"test"), None);
    // dot_fhe has FHE, dot_plain does not
    assert!(compute_trust(&dot_fhe) > compute_trust(&dot_plain));
}

#[test]
fn test_trust_bonus_meta() {
    use std::collections::HashMap;
    let mut entries = HashMap::new();
    entries.insert("k".to_string(), "v".to_string());
    let opts = ObserveOptions { meta: Some(entries), ..Default::default() };
    let dot_with_meta = observe(None, Some(opts));
    let dot_without = observe(None, None);
    assert!(compute_trust(&dot_with_meta) > compute_trust(&dot_without));
}

#[test]
fn test_trust_bonus_seq() {
    let mut dot = DOT::default();
    dot.time = Some(TimeData { ts: 1234, seq: Some(5) });
    let with_seq = compute_trust(&dot);
    dot.time = Some(TimeData { ts: 1234, seq: None });
    let without_seq = compute_trust(&dot);
    assert!(with_seq > without_seq);
}

#[test]
fn test_level_increments_for_each_field() {
    let dot0 = DOT::default();
    assert_eq!(compute_level(&dot0), 0);

    // Add observer (public key)
    let mut dot1 = dot0.clone();
    dot1.sign = Some(SignData { observer: vec![1u8; 32], sig: vec![] });
    assert!(compute_level(&dot1) >= 1);

    // Add sig
    let mut dot2 = dot1.clone();
    if let Some(ref mut s) = dot2.sign { s.sig = vec![1u8; 64]; }
    assert!(compute_level(&dot2) >= 2);
}

#[test]
fn test_level_6_requires_all_fields() {
    setup();
    let (_, sk) = generate_keypair();
    let prev = observe(Some(b"prev"), None);
    let dot = sign_dot(chain_dot(observe(Some(b"full"), None), Some(&prev)), &sk);
    let level = compute_level(&dot);
    assert_eq!(level, 6, "full signed chained dot should be level 6, got {}", level);
}

#[test]
fn test_trust_max_1_5_with_all_bonuses() {
    setup();
    use std::collections::HashMap;
    let (_, sk) = generate_keypair();
    let prev = observe(Some(b"prev"), None);
    let mut dot = sign_dot(chain_dot(observe(Some(b"max"), None), Some(&prev)), &sk);
    // Apply all bonus conditions
    dot.verify = Some(VerifyData { valid: true, reason: None, checked: vec![] });
    if let Some(ref mut c) = dot.chain { c.depth = 10; }
    if let Some(ref mut t) = dot.time { t.seq = Some(1); }
    let mut entries = HashMap::new();
    entries.insert("k".to_string(), "v".to_string());
    dot.meta = Some(MetaData { entries });
    let trust = compute_trust(&dot);
    assert!(trust <= 1.5 + 1e-9, "trust {} exceeds max 1.5", trust);
}

#[test]
fn test_trust_without_any_bonus() {
    // Level 0, no bonuses = 0.0
    let dot = DOT::default();
    assert_eq!(compute_trust(&dot), 0.0);
}

#[test]
fn test_trust_is_float() {
    let dot = observe(Some(b"trust float"), None);
    let trust = compute_trust(&dot);
    assert!(trust.is_finite());
    assert!(!trust.is_nan());
}
