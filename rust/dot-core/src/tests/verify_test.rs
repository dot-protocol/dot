// verify_dot() and verify_chain() integration tests.

use crate::{observe, sign_dot, verify_dot, verify_chain, chain_dot, generate_keypair, init, ObserveOptions};
use crate::types::{DOT, SignData, TimeData};

fn setup() { init().unwrap(); }

#[test]
fn test_unsigned_dot_is_valid() {
    let dot = observe(None, None);
    assert!(verify_dot(&dot).valid);
}

#[test]
fn test_unsigned_dot_with_payload_is_valid() {
    let dot = observe(Some(b"unsigned payload"), None);
    assert!(verify_dot(&dot).valid);
}

#[test]
fn test_signed_dot_is_valid() {
    setup();
    let (_, sk) = generate_keypair();
    let dot = sign_dot(observe(None, None), &sk);
    assert!(verify_dot(&dot).valid);
}

#[test]
fn test_tampered_payload_invalidates() {
    setup();
    let (_, sk) = generate_keypair();
    let dot = sign_dot(observe(Some(b"original"), None), &sk);
    let mut tampered = dot;
    tampered.payload = Some(b"TAMPERED".to_vec());
    assert!(!verify_dot(&tampered).valid);
}

#[test]
fn test_tampered_sig_byte_invalidates() {
    setup();
    let (_, sk) = generate_keypair();
    let mut dot = sign_dot(observe(Some(b"test"), None), &sk);
    if let Some(ref mut s) = dot.sign {
        s.sig[0] ^= 0xFF;
    }
    assert!(!verify_dot(&dot).valid);
}

#[test]
fn test_tampered_timestamp_invalidates() {
    setup();
    let (_, sk) = generate_keypair();
    let mut dot = sign_dot(observe(Some(b"ts"), None), &sk);
    if let Some(ref mut t) = dot.time {
        t.ts += 1;
    }
    assert!(!verify_dot(&dot).valid);
}

#[test]
fn test_wrong_observer_key_invalidates() {
    setup();
    let (_, sk) = generate_keypair();
    let (pk2, _) = generate_keypair();
    let mut dot = sign_dot(observe(None, None), &sk);
    if let Some(ref mut s) = dot.sign {
        s.observer = pk2.0.to_vec();
    }
    assert!(!verify_dot(&dot).valid);
}

#[test]
fn test_short_observer_key_invalidates() {
    let mut dot = observe(None, None);
    dot.sign = Some(SignData {
        observer: vec![0u8; 16],
        sig: vec![0u8; 64],
    });
    let result = verify_dot(&dot);
    assert!(!result.valid);
    assert!(result.reason.unwrap().contains("32 bytes"));
}

#[test]
fn test_short_sig_invalidates() {
    setup();
    let (pk, _) = generate_keypair();
    let mut dot = observe(None, None);
    dot.sign = Some(SignData {
        observer: pk.0.to_vec(),
        sig: vec![0u8; 16],
    });
    let result = verify_dot(&dot);
    assert!(!result.valid);
    assert!(result.reason.unwrap().contains("64 bytes"));
}

#[test]
fn test_verify_result_has_checked_fields() {
    setup();
    let (_, sk) = generate_keypair();
    let dot = sign_dot(observe(None, None), &sk);
    let result = verify_dot(&dot);
    assert!(!result.checked.is_empty());
}

#[test]
fn test_unsigned_checked_contains_unsigned() {
    let dot = observe(None, None);
    let result = verify_dot(&dot);
    assert!(result.checked.iter().any(|s| s.contains("unsigned")));
}

#[test]
fn test_signed_checked_contains_sign_fields() {
    setup();
    let (_, sk) = generate_keypair();
    let dot = sign_dot(observe(None, None), &sk);
    let result = verify_dot(&dot);
    assert!(result.checked.contains(&"sign.observer".to_string()));
    assert!(result.checked.contains(&"sign.sig".to_string()));
}

#[test]
fn test_empty_chain_is_valid() {
    let result = verify_chain(&[]);
    assert!(result.valid);
}

#[test]
fn test_single_dot_chain() {
    setup();
    let (_, sk) = generate_keypair();
    let dot = sign_dot(observe(None, None), &sk);
    assert!(verify_chain(&[&dot]).valid);
}

#[test]
fn test_two_dot_chain() {
    setup();
    let (_, sk) = generate_keypair();
    let d0 = sign_dot(observe(Some(b"genesis"), None), &sk);
    // Correct order: chain THEN sign (chain.prev is in signed bytes)
    let d1 = sign_dot(chain_dot(observe(Some(b"second"), None), Some(&d0)), &sk);
    let result = verify_chain(&[&d0, &d1]);
    assert!(result.valid, "{:?}", result.reason);
}

#[test]
fn test_three_dot_chain() {
    setup();
    let (_, sk) = generate_keypair();
    let d0 = sign_dot(observe(Some(b"0"), None), &sk);
    let d1 = sign_dot(chain_dot(observe(Some(b"1"), None), Some(&d0)), &sk);
    let d2 = sign_dot(chain_dot(observe(Some(b"2"), None), Some(&d1)), &sk);
    let result = verify_chain(&[&d0, &d1, &d2]);
    assert!(result.valid, "{:?}", result.reason);
}

#[test]
fn test_broken_chain_link_fails() {
    setup();
    let (_, sk) = generate_keypair();
    let d0 = sign_dot(observe(Some(b"genesis"), None), &sk);
    // Correct: chain then sign
    let mut d1 = sign_dot(chain_dot(observe(Some(b"next"), None), Some(&d0)), &sk);
    // Tamper the chain link (also invalidates signature — both checks catch it)
    if let Some(ref mut c) = d1.chain {
        c.prev[0] ^= 0xFF;
    }
    let result = verify_chain(&[&d0, &d1]);
    assert!(!result.valid);
}

#[test]
fn test_tampered_dot_in_chain_fails() {
    setup();
    let (_, sk) = generate_keypair();
    let d0 = sign_dot(observe(Some(b"genesis"), None), &sk);
    let mut d1 = sign_dot(chain_dot(observe(Some(b"second"), None), Some(&d0)), &sk);
    // Tamper d1's payload (invalidates its signature)
    d1.payload = Some(b"tampered".to_vec());
    let result = verify_chain(&[&d0, &d1]);
    assert!(!result.valid);
}

#[test]
fn test_verify_fails_all_zero_sig() {
    setup();
    let (pk, _) = generate_keypair();
    let mut dot = observe(None, None);
    dot.sign = Some(SignData {
        observer: pk.0.to_vec(),
        sig: vec![0u8; 64],
    });
    // All-zero sig should not verify for any message
    assert!(!verify_dot(&dot).valid);
}

#[test]
fn test_verify_signed_dot_with_all_types() {
    setup();
    use crate::ObservationType;
    let (_, sk) = generate_keypair();
    for t in [
        ObservationType::Measure,
        ObservationType::State,
        ObservationType::Event,
        ObservationType::Claim,
        ObservationType::Bond,
    ] {
        let opts = ObserveOptions { dot_type: Some(t), ..Default::default() };
        let dot = sign_dot(observe(Some(b"typed"), Some(opts)), &sk);
        assert!(verify_dot(&dot).valid, "type {:?} failed", t);
    }
}

#[test]
fn test_verify_reason_present_on_failure() {
    setup();
    let (_, sk) = generate_keypair();
    let mut dot = sign_dot(observe(Some(b"fail test"), None), &sk);
    // Corrupt sig
    if let Some(ref mut s) = dot.sign {
        s.sig[63] ^= 0x01;
    }
    let result = verify_dot(&dot);
    assert!(!result.valid);
    assert!(result.reason.is_some());
    assert!(!result.reason.unwrap().is_empty());
}

#[test]
fn test_verify_no_reason_on_success() {
    setup();
    let (_, sk) = generate_keypair();
    let dot = sign_dot(observe(None, None), &sk);
    let result = verify_dot(&dot);
    assert!(result.valid);
    assert!(result.reason.is_none());
}

#[test]
fn test_unsigned_dot_in_chain_is_valid() {
    // Unsigned DOTs are valid per Correction #47
    let d0 = observe(Some(b"unsigned genesis"), None);
    assert!(verify_chain(&[&d0]).valid);
}

#[test]
fn test_chain_without_link_field_fails_at_index_1() {
    setup();
    let (_, sk) = generate_keypair();
    let d0 = sign_dot(observe(Some(b"genesis"), None), &sk);
    // d1 has no chain field — fails chain verification at index 1
    let d1 = sign_dot(observe(Some(b"no chain"), None), &sk);
    let result = verify_chain(&[&d0, &d1]);
    assert!(!result.valid);
}
