// TLV encode/decode integration tests.

use crate::{observe, sign_dot, chain_dot, to_bytes, from_bytes, generate_keypair, init};
use crate::{ObserveOptions, ObservationType, PayloadMode, DecodeError};
use crate::types::{DOT, TimeData, ChainData, VerifyData, FheData, MetaData, SignData};
use crate::encode::tags;

fn setup() { init().unwrap(); }

#[test]
fn test_empty_dot_encodes_empty() {
    let dot = DOT::default();
    assert_eq!(to_bytes(&dot), &[] as &[u8]);
}

#[test]
fn test_empty_bytes_decode_empty_dot() {
    let dot = from_bytes(&[]).unwrap();
    assert!(dot.payload.is_none());
    assert!(dot.sign.is_none());
    assert!(dot.chain.is_none());
    assert!(dot.time.is_none());
    assert!(dot.fhe.is_none());
    assert!(dot.meta.is_none());
}

#[test]
fn test_roundtrip_plain_payload() {
    let opts = ObserveOptions { plaintext: true, ..Default::default() };
    let dot = observe(Some(b"hello world"), Some(opts));
    let decoded = from_bytes(&to_bytes(&dot)).unwrap();
    assert_eq!(decoded.payload.unwrap(), b"hello world");
    assert_eq!(decoded.payload_mode, Some(PayloadMode::Plain));
}

#[test]
fn test_roundtrip_fhe_payload() {
    let dot = observe(Some(b"fhe payload"), None);
    let decoded = from_bytes(&to_bytes(&dot)).unwrap();
    assert_eq!(decoded.payload_mode, Some(PayloadMode::Fhe));
    assert!(decoded.fhe.is_some());
    let fhe = decoded.fhe.unwrap();
    assert_eq!(fhe.scheme, "tfhe-rs-stub");
}

#[test]
fn test_roundtrip_all_dot_types() {
    for (t, expected_byte) in [
        (ObservationType::Measure, 0u8),
        (ObservationType::State, 1u8),
        (ObservationType::Event, 2u8),
        (ObservationType::Claim, 3u8),
        (ObservationType::Bond, 4u8),
    ] {
        let opts = ObserveOptions { dot_type: Some(t), ..Default::default() };
        let dot = observe(None, Some(opts));
        let bytes = to_bytes(&dot);
        // Find the dot_type TLV entry
        let dot_type_pos = bytes.windows(1).position(|w| w[0] == tags::DOT_TYPE);
        assert!(dot_type_pos.is_some(), "dot_type tag not found for {:?}", t);
        let decoded = from_bytes(&bytes).unwrap();
        assert_eq!(decoded.dot_type, Some(t));
    }
}

#[test]
fn test_roundtrip_signed_dot() {
    setup();
    let (pk, sk) = generate_keypair();
    let dot = sign_dot(observe(Some(b"signed"), None), &sk);
    let decoded = from_bytes(&to_bytes(&dot)).unwrap();
    let s = decoded.sign.unwrap();
    assert_eq!(s.observer, pk.0.to_vec());
    assert_eq!(s.sig.len(), 64);
}

#[test]
fn test_roundtrip_timestamps() {
    setup();
    let (_, sk) = generate_keypair();
    let dot = sign_dot(observe(None, None), &sk);
    let orig_ts = dot.time.as_ref().unwrap().ts;
    let decoded = from_bytes(&to_bytes(&dot)).unwrap();
    assert_eq!(decoded.time.unwrap().ts, orig_ts);
}

#[test]
fn test_roundtrip_time_seq() {
    let mut dot = DOT::default();
    dot.time = Some(TimeData { ts: 999_999_999, seq: Some(42) });
    let decoded = from_bytes(&to_bytes(&dot)).unwrap();
    let t = decoded.time.unwrap();
    assert_eq!(t.ts, 999_999_999);
    assert_eq!(t.seq, Some(42));
}

#[test]
fn test_roundtrip_chain_fields() {
    let prev = observe(Some(b"prev"), None);
    let next = chain_dot(observe(Some(b"next"), None), Some(&prev));
    let decoded = from_bytes(&to_bytes(&next)).unwrap();
    let c = decoded.chain.unwrap();
    assert_eq!(c.prev.len(), 32);
    assert_eq!(c.depth, 1);
}

#[test]
fn test_roundtrip_verify_valid() {
    let mut dot = DOT::default();
    dot.verify = Some(VerifyData {
        valid: true,
        reason: None,
        checked: vec!["sig".to_string()],
    });
    let decoded = from_bytes(&to_bytes(&dot)).unwrap();
    let v = decoded.verify.unwrap();
    assert!(v.valid);
    assert_eq!(v.checked, vec!["sig"]);
}

#[test]
fn test_roundtrip_verify_invalid_with_reason() {
    let mut dot = DOT::default();
    dot.verify = Some(VerifyData {
        valid: false,
        reason: Some("signature mismatch".to_string()),
        checked: vec!["sign.sig".to_string()],
    });
    let decoded = from_bytes(&to_bytes(&dot)).unwrap();
    let v = decoded.verify.unwrap();
    assert!(!v.valid);
    assert_eq!(v.reason.unwrap(), "signature mismatch");
}

#[test]
fn test_roundtrip_fhe_data() {
    let mut dot = DOT::default();
    dot.fhe = Some(FheData {
        scheme: "my-scheme".to_string(),
        ciphertext: vec![0xAB, 0xCD, 0xEF],
    });
    let decoded = from_bytes(&to_bytes(&dot)).unwrap();
    let fhe = decoded.fhe.unwrap();
    assert_eq!(fhe.scheme, "my-scheme");
    assert_eq!(fhe.ciphertext, vec![0xAB, 0xCD, 0xEF]);
}

#[test]
fn test_roundtrip_meta() {
    use std::collections::HashMap;
    let mut entries = HashMap::new();
    entries.insert("k1".to_string(), "v1".to_string());
    entries.insert("k2".to_string(), "v2".to_string());
    let opts = ObserveOptions { meta: Some(entries.clone()), ..Default::default() };
    let dot = observe(None, Some(opts));
    let decoded = from_bytes(&to_bytes(&dot)).unwrap();
    let meta = decoded.meta.unwrap();
    assert_eq!(meta.entries["k1"], "v1");
    assert_eq!(meta.entries["k2"], "v2");
}

#[test]
fn test_tlv_format_tag_length_value() {
    let opts = ObserveOptions { plaintext: true, ..Default::default() };
    let dot = observe(Some(b"abc"), Some(opts));
    let bytes = to_bytes(&dot);
    // First TLV entry: 0x01 (PAYLOAD) | 0x00 0x03 (length=3) | 0x61 0x62 0x63 ('abc')
    assert_eq!(bytes[0], tags::PAYLOAD);
    let len = u16::from_be_bytes([bytes[1], bytes[2]]) as usize;
    assert_eq!(len, 3);
    assert_eq!(&bytes[3..6], b"abc");
}

#[test]
fn test_big_endian_length_encoding() {
    // Payload of 256 bytes — length should be 0x01 0x00 in big-endian
    let payload = vec![0x55u8; 256];
    let opts = ObserveOptions { plaintext: true, ..Default::default() };
    let dot = observe(Some(&payload), Some(opts));
    let bytes = to_bytes(&dot);
    assert_eq!(bytes[0], tags::PAYLOAD);
    let len = u16::from_be_bytes([bytes[1], bytes[2]]) as usize;
    assert_eq!(len, 256);
}

#[test]
fn test_unknown_tag_decode_error() {
    let bad = vec![0xFE, 0x00, 0x01, 0x42];
    let result = from_bytes(&bad);
    assert!(matches!(result, Err(DecodeError::UnknownTag { .. })));
}

#[test]
fn test_truncated_length_decode_error() {
    let bad = vec![tags::PAYLOAD, 0x00]; // length needs 2 bytes, only 1 available
    let result = from_bytes(&bad);
    assert!(result.is_err());
}

#[test]
fn test_truncated_value_decode_error() {
    // Declares 10-byte value but only 2 bytes follow
    let bad = vec![tags::PAYLOAD, 0x00, 0x0A, 0x01, 0x02];
    let result = from_bytes(&bad);
    assert!(matches!(result, Err(DecodeError::TruncatedInput { .. })));
}

#[test]
fn test_invalid_payload_mode_byte() {
    let bad = vec![tags::PAYLOAD_MODE, 0x00, 0x01, 0xFF]; // 0xFF is invalid mode
    let result = from_bytes(&bad);
    assert!(matches!(result, Err(DecodeError::InvalidValue { .. })));
}

#[test]
fn test_invalid_dot_type_byte() {
    let bad = vec![tags::DOT_TYPE, 0x00, 0x01, 0xAA]; // 0xAA is invalid type
    let result = from_bytes(&bad);
    assert!(matches!(result, Err(DecodeError::InvalidValue { .. })));
}

#[test]
fn test_full_dot_encode_decode_preserves_all_fields() {
    setup();
    use std::collections::HashMap;
    let (_, sk) = generate_keypair();
    let prev = observe(Some(b"genesis"), None);
    let mut meta = HashMap::new();
    meta.insert("env".to_string(), "test".to_string());
    let opts = ObserveOptions {
        dot_type: Some(ObservationType::Event),
        meta: Some(meta),
        ..Default::default()
    };
    let dot = sign_dot(chain_dot(observe(Some(b"full"), Some(opts)), Some(&prev)), &sk);
    let decoded = from_bytes(&to_bytes(&dot)).unwrap();
    assert!(decoded.payload.is_some());
    assert!(decoded.sign.is_some());
    assert!(decoded.time.is_some());
    assert!(decoded.chain.is_some());
    assert!(decoded.meta.is_some());
    assert_eq!(decoded.dot_type, Some(ObservationType::Event));
}

#[test]
fn test_encode_decode_empty_fhe_ciphertext() {
    let mut dot = DOT::default();
    dot.fhe = Some(FheData { scheme: "stub".to_string(), ciphertext: vec![] });
    let decoded = from_bytes(&to_bytes(&dot)).unwrap();
    let fhe = decoded.fhe.unwrap();
    assert_eq!(fhe.ciphertext, &[] as &[u8]);
}

#[test]
fn test_encode_large_payload() {
    let payload = vec![0xBBu8; 65535];
    let opts = ObserveOptions { plaintext: true, ..Default::default() };
    let dot = observe(Some(&payload), Some(opts));
    let bytes = to_bytes(&dot);
    let decoded = from_bytes(&bytes).unwrap();
    assert_eq!(decoded.payload.unwrap().len(), 65535);
}
