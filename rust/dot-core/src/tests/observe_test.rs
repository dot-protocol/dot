// observe() integration tests.

use crate::{observe, ObserveOptions, ObservationType, PayloadMode, init};
use crate::types::DOT;

fn setup() { init().unwrap(); }

#[test]
fn test_observe_no_args_valid() {
    let dot = observe(None, None);
    assert!(dot.sign.is_none());
    assert!(dot.chain.is_none());
    assert_eq!(dot.payload_mode, Some(PayloadMode::None));
}

#[test]
fn test_observe_with_payload_defaults_to_fhe() {
    let dot = observe(Some(b"data"), None);
    assert_eq!(dot.payload_mode, Some(PayloadMode::Fhe));
    assert!(dot.fhe.is_some());
    let fhe = dot.fhe.unwrap();
    assert_eq!(fhe.scheme, "tfhe-rs-stub");
    assert!(!fhe.ciphertext.is_empty());
}

#[test]
fn test_observe_plain_mode() {
    let opts = ObserveOptions { plaintext: true, ..Default::default() };
    let dot = observe(Some(b"plain"), Some(opts));
    assert_eq!(dot.payload_mode, Some(PayloadMode::Plain));
    assert!(dot.fhe.is_none());
    assert_eq!(dot.payload.unwrap(), b"plain");
}

#[test]
fn test_observe_all_observation_types() {
    for t in [
        ObservationType::Measure,
        ObservationType::State,
        ObservationType::Event,
        ObservationType::Claim,
        ObservationType::Bond,
    ] {
        let opts = ObserveOptions { dot_type: Some(t), ..Default::default() };
        let dot = observe(None, Some(opts));
        assert_eq!(dot.dot_type, Some(t));
    }
}

#[test]
fn test_observe_empty_bytes_payload() {
    let dot = observe(Some(b""), None);
    assert!(dot.payload.is_none());
    assert_eq!(dot.payload_mode, Some(PayloadMode::None));
}

#[test]
fn test_observe_binary_payload() {
    let payload = vec![0x00u8, 0xFF, 0xAB, 0x42, 0x00];
    let dot = observe(Some(&payload), Some(ObserveOptions { plaintext: true, ..Default::default() }));
    assert_eq!(dot.payload.unwrap(), payload);
}

#[test]
fn test_observe_returns_default_fields_none() {
    let dot = observe(None, None);
    assert!(dot.sign.is_none());
    assert!(dot.chain.is_none());
    assert!(dot.time.is_none());
    assert!(dot.verify.is_none());
    assert!(dot.meta.is_none());
}

#[test]
fn test_observe_with_meta() {
    use std::collections::HashMap;
    let mut m = HashMap::new();
    m.insert("source".to_string(), "sensor-1".to_string());
    m.insert("unit".to_string(), "celsius".to_string());
    let opts = ObserveOptions { meta: Some(m), ..Default::default() };
    let dot = observe(Some(b"42.5"), Some(opts));
    let meta = dot.meta.unwrap();
    assert_eq!(meta.entries["source"], "sensor-1");
    assert_eq!(meta.entries["unit"], "celsius");
}

#[test]
fn test_observe_fhe_ciphertext_differs_from_plaintext() {
    let payload = b"hello world";
    let dot = observe(Some(payload), None);
    let fhe = dot.fhe.unwrap();
    assert_ne!(fhe.ciphertext, payload.to_vec());
}

#[test]
fn test_observe_fhe_ciphertext_same_length_as_payload() {
    let payload = b"exact length check";
    let dot = observe(Some(payload), None);
    let fhe = dot.fhe.unwrap();
    assert_eq!(fhe.ciphertext.len(), payload.len());
}

#[test]
fn test_observe_claim_type_with_payload() {
    let _opts = ObserveOptions {
        dot_type: Some(ObservationType::Claim),
        plaintext: true,
        ..Default::default()
    };
    let _dot = observe(Some(b"I claim this"), None);
    let opts = ObserveOptions {
        dot_type: Some(ObservationType::Claim),
        plaintext: true,
        ..Default::default()
    };
    let dot = observe(Some(b"I claim this"), Some(opts));
    assert_eq!(dot.dot_type, Some(ObservationType::Claim));
    assert_eq!(dot.payload.unwrap(), b"I claim this");
}

#[test]
fn test_observe_bond_type() {
    let opts = ObserveOptions { dot_type: Some(ObservationType::Bond), ..Default::default() };
    let dot = observe(Some(b"bonded"), Some(opts));
    assert_eq!(dot.dot_type, Some(ObservationType::Bond));
    assert!(dot.fhe.is_some());
}

#[test]
fn test_observe_measure_type() {
    let opts = ObserveOptions { dot_type: Some(ObservationType::Measure), ..Default::default() };
    let dot = observe(Some(b"temperature: 22.4C"), Some(opts));
    assert_eq!(dot.dot_type, Some(ObservationType::Measure));
}

#[test]
fn test_observe_state_type() {
    let opts = ObserveOptions { dot_type: Some(ObservationType::State), ..Default::default() };
    let dot = observe(None, Some(opts));
    assert_eq!(dot.dot_type, Some(ObservationType::State));
}

#[test]
fn test_observe_event_type_no_payload() {
    let opts = ObserveOptions { dot_type: Some(ObservationType::Event), ..Default::default() };
    let dot = observe(None, Some(opts));
    assert_eq!(dot.dot_type, Some(ObservationType::Event));
    assert_eq!(dot.payload_mode, Some(PayloadMode::None));
}

#[test]
fn test_observe_large_payload_fhe() {
    let payload = vec![0xCAu8; 100_000];
    let dot = observe(Some(&payload), None);
    let fhe = dot.fhe.unwrap();
    assert_eq!(fhe.ciphertext.len(), 100_000);
    assert_eq!(fhe.scheme, "tfhe-rs-stub");
}

#[test]
fn test_observe_zero_payload_mode_none() {
    let dot = observe(None, None);
    assert_eq!(dot.payload_mode, Some(PayloadMode::None));
    assert!(dot.payload.is_none());
    assert!(dot.fhe.is_none());
}

#[test]
fn test_observe_does_not_sign() {
    // observe() never signs — sign_dot() does
    let dot = observe(Some(b"unsigned"), None);
    assert!(dot.sign.is_none());
}

#[test]
fn test_observe_does_not_chain() {
    // observe() never chains — chain_dot() does
    let dot = observe(Some(b"unchained"), None);
    assert!(dot.chain.is_none());
}

#[test]
fn test_observe_does_not_set_time() {
    // observe() never sets time — sign_dot() does
    let dot = observe(Some(b"timeless"), None);
    assert!(dot.time.is_none());
}

#[test]
fn test_observe_unicode_payload() {
    let payload = "こんにちは R854".as_bytes();
    let opts = ObserveOptions { plaintext: true, ..Default::default() };
    let dot = observe(Some(payload), Some(opts));
    assert_eq!(dot.payload.unwrap(), payload);
}

#[test]
fn test_observe_single_byte_payload() {
    let dot = observe(Some(&[0x42]), None);
    assert!(dot.payload.is_some());
    assert_eq!(dot.payload_mode, Some(PayloadMode::Fhe));
}

#[test]
fn test_observe_type_and_payload_together() {
    let opts = ObserveOptions {
        dot_type: Some(ObservationType::Event),
        plaintext: true,
        meta: None,
    };
    let dot = observe(Some(b"event data"), Some(opts));
    assert_eq!(dot.dot_type, Some(ObservationType::Event));
    assert_eq!(dot.payload_mode, Some(PayloadMode::Plain));
    assert_eq!(dot.payload.unwrap(), b"event data");
}

#[test]
fn test_fhe_stub_is_reversible() {
    use crate::{fhe_stub_encrypt, fhe_stub_decrypt};
    let data = b"reversibility test 123";
    let fhe = fhe_stub_encrypt(data);
    let plain = fhe_stub_decrypt(&fhe);
    assert_eq!(plain, data.to_vec());
}

#[test]
fn test_fhe_stub_different_inputs_different_ciphertext() {
    use crate::fhe_stub_encrypt;
    let f1 = fhe_stub_encrypt(b"aaa");
    let f2 = fhe_stub_encrypt(b"bbb");
    assert_ne!(f1.ciphertext, f2.ciphertext);
}

#[test]
fn test_observe_meta_is_optional() {
    let dot = observe(None, None);
    assert!(dot.meta.is_none());

    let opts = ObserveOptions { meta: None, ..Default::default() };
    let dot2 = observe(None, Some(opts));
    assert!(dot2.meta.is_none());
}
