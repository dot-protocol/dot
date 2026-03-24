// sign_dot() integration tests.

use crate::{observe, sign_dot, verify_dot, generate_keypair, chain_dot, ObserveOptions, ObservationType, init};
use crate::types::{DOT, TimeData};

fn setup() { init().unwrap(); }

#[test]
fn test_sign_adds_observer_and_sig() {
    setup();
    let (_, sk) = generate_keypair();
    let dot = observe(None, None);
    let signed = sign_dot(dot, &sk);
    let s = signed.sign.unwrap();
    assert_eq!(s.observer.len(), 32);
    assert_eq!(s.sig.len(), 64);
}

#[test]
fn test_sign_sets_time() {
    setup();
    let (_, sk) = generate_keypair();
    let dot = observe(None, None);
    let signed = sign_dot(dot, &sk);
    assert!(signed.time.is_some());
    let t = signed.time.unwrap();
    assert!(t.ts > 0);
    assert!(t.seq.is_none());
}

#[test]
fn test_sign_preserves_existing_time() {
    setup();
    let (_, sk) = generate_keypair();
    let mut dot = observe(None, None);
    dot.time = Some(TimeData { ts: 1_000_000, seq: Some(5) });
    let signed = sign_dot(dot, &sk);
    let t = signed.time.unwrap();
    assert_eq!(t.ts, 1_000_000);
    assert_eq!(t.seq, Some(5));
}

#[test]
fn test_sign_roundtrip_verifies() {
    setup();
    let (_, sk) = generate_keypair();
    for payload in [None, Some(b"" as &[u8]), Some(b"hello")] {
        let dot = observe(payload, None);
        let signed = sign_dot(dot, &sk);
        let result = verify_dot(&signed);
        assert!(result.valid, "verify failed for payload {:?}: {:?}", payload, result.reason);
    }
}

#[test]
fn test_sign_different_keys_produce_different_sigs() {
    setup();
    let (_, sk1) = generate_keypair();
    let (_, sk2) = generate_keypair();
    let dot1 = observe(Some(b"same"), None);
    let dot2 = observe(Some(b"same"), None);
    let s1 = sign_dot(dot1, &sk1);
    let s2 = sign_dot(dot2, &sk2);
    // Different keys → different signatures
    assert_ne!(
        s1.sign.as_ref().unwrap().sig,
        s2.sign.as_ref().unwrap().sig
    );
}

#[test]
fn test_sign_preserves_payload() {
    setup();
    let (_, sk) = generate_keypair();
    let payload = b"preserve this payload";
    let dot = observe(Some(payload), Some(ObserveOptions { plaintext: true, ..Default::default() }));
    let signed = sign_dot(dot, &sk);
    assert_eq!(signed.payload.unwrap(), payload.to_vec());
}

#[test]
fn test_sign_preserves_dot_type() {
    setup();
    let (_, sk) = generate_keypair();
    let opts = ObserveOptions { dot_type: Some(ObservationType::Event), ..Default::default() };
    let dot = observe(Some(b"event"), Some(opts));
    let signed = sign_dot(dot, &sk);
    assert_eq!(signed.dot_type, Some(ObservationType::Event));
}

#[test]
fn test_sign_preserves_chain() {
    setup();
    let (_, sk) = generate_keypair();
    let prev = observe(Some(b"prev"), None);
    let next = chain_dot(observe(Some(b"next"), None), Some(&prev));
    let chain_depth = next.chain.as_ref().unwrap().depth;
    let signed = sign_dot(next, &sk);
    assert_eq!(signed.chain.as_ref().unwrap().depth, chain_depth);
}

#[test]
fn test_sign_key_matches_observer() {
    setup();
    let (pk, sk) = generate_keypair();
    let signed = sign_dot(observe(None, None), &sk);
    assert_eq!(signed.sign.unwrap().observer, pk.0.to_vec());
}

#[test]
fn test_sign_multiple_observations_different_sigs() {
    setup();
    let (_, sk) = generate_keypair();
    let s1 = sign_dot(observe(Some(b"first"), None), &sk);
    let s2 = sign_dot(observe(Some(b"second"), None), &sk);
    // Different payloads = different sigs
    assert_ne!(
        s1.sign.as_ref().unwrap().sig,
        s2.sign.as_ref().unwrap().sig
    );
}

#[test]
fn test_sign_bond_type() {
    setup();
    let (_, sk) = generate_keypair();
    let opts = ObserveOptions { dot_type: Some(ObservationType::Bond), ..Default::default() };
    let dot = observe(Some(b"bond"), Some(opts));
    let signed = sign_dot(dot, &sk);
    assert!(verify_dot(&signed).valid);
}

#[test]
fn test_sign_claim_type() {
    setup();
    let (_, sk) = generate_keypair();
    let opts = ObserveOptions {
        dot_type: Some(ObservationType::Claim),
        plaintext: true,
        ..Default::default()
    };
    let dot = observe(Some(b"I claim this"), Some(opts));
    let signed = sign_dot(dot, &sk);
    assert!(verify_dot(&signed).valid);
    assert_eq!(signed.dot_type, Some(ObservationType::Claim));
}

#[test]
fn test_sign_large_payload_verifies() {
    setup();
    let (_, sk) = generate_keypair();
    let payload = vec![0x37u8; 100_000];
    let opts = ObserveOptions { plaintext: true, ..Default::default() };
    let dot = observe(Some(&payload), Some(opts));
    let signed = sign_dot(dot, &sk);
    assert!(verify_dot(&signed).valid);
}

#[test]
fn test_sign_empty_dot_verifies() {
    setup();
    let (_, sk) = generate_keypair();
    let dot = DOT::default();
    let signed = sign_dot(dot, &sk);
    assert!(verify_dot(&signed).valid);
}

#[test]
fn test_signable_bytes_includes_payload() {
    use crate::signable_bytes;
    let dot1 = observe(Some(b"aaa"), Some(ObserveOptions { plaintext: true, ..Default::default() }));
    let dot2 = observe(Some(b"bbb"), Some(ObserveOptions { plaintext: true, ..Default::default() }));
    assert_ne!(signable_bytes(&dot1), signable_bytes(&dot2));
}

#[test]
fn test_signable_bytes_different_type() {
    use crate::signable_bytes;
    let opts1 = ObserveOptions { dot_type: Some(ObservationType::Measure), ..Default::default() };
    let opts2 = ObserveOptions { dot_type: Some(ObservationType::Event), ..Default::default() };
    let d1 = observe(None, Some(opts1));
    let d2 = observe(None, Some(opts2));
    assert_ne!(signable_bytes(&d1), signable_bytes(&d2));
}

#[test]
fn test_signable_bytes_different_time() {
    use crate::signable_bytes;
    let mut d1 = observe(None, None);
    let mut d2 = observe(None, None);
    d1.time = Some(TimeData { ts: 100, seq: None });
    d2.time = Some(TimeData { ts: 200, seq: None });
    assert_ne!(signable_bytes(&d1), signable_bytes(&d2));
}

#[test]
fn test_sign_with_chain_verifies() {
    setup();
    let (_, sk) = generate_keypair();
    let genesis = sign_dot(observe(Some(b"genesis"), None), &sk);
    let next = sign_dot(chain_dot(observe(Some(b"next"), None), Some(&genesis)), &sk);
    assert!(verify_dot(&next).valid);
}

#[test]
fn test_sign_two_keypairs_both_verify() {
    setup();
    let (_, sk1) = generate_keypair();
    let (_, sk2) = generate_keypair();
    let dot1 = sign_dot(observe(Some(b"alice"), None), &sk1);
    let dot2 = sign_dot(observe(Some(b"bob"), None), &sk2);
    assert!(verify_dot(&dot1).valid);
    assert!(verify_dot(&dot2).valid);
}

#[test]
fn test_sign_measure_observation() {
    setup();
    let (_, sk) = generate_keypair();
    let opts = ObserveOptions { dot_type: Some(ObservationType::Measure), ..Default::default() };
    let dot = sign_dot(observe(Some(b"22.4"), Some(opts)), &sk);
    let result = verify_dot(&dot);
    assert!(result.valid);
}

#[test]
fn test_sign_state_observation() {
    setup();
    let (_, sk) = generate_keypair();
    let opts = ObserveOptions { dot_type: Some(ObservationType::State), ..Default::default() };
    let dot = sign_dot(observe(None, Some(opts)), &sk);
    let result = verify_dot(&dot);
    assert!(result.valid);
}
