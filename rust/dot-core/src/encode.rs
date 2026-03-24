// TLV encoding for DOT Protocol R854.
// Identical wire format to the TypeScript implementation.
//
// Format: Tag (1 byte) | Length (2 bytes, big-endian) | Value (Length bytes)
// Empty DOT → empty bytes (zero length output).
//
// Tags:
//   0x01 = payload (raw bytes)
//   0x02 = payload_mode (1 byte: 0=Fhe, 1=Plain, 2=None)
//   0x03 = dot_type (1 byte: 0=Measure, 1=State, 2=Event, 3=Claim, 4=Bond)
//   0x10 = sign.observer (32 bytes)
//   0x11 = sign.sig (64 bytes)
//   0x20 = time.ts (8 bytes, big-endian u64)
//   0x21 = time.seq (8 bytes, big-endian u64)
//   0x30 = chain.prev (32 bytes)
//   0x31 = chain.depth (8 bytes, big-endian u64)
//   0x40 = verify.valid (1 byte: 0=false, 1=true)
//   0x41 = verify.reason (UTF-8 string)
//   0x42 = verify.checked (UTF-8 JSON array of strings)
//   0x50 = fhe.scheme (UTF-8 string)
//   0x51 = fhe.ciphertext (raw bytes)
//   0x60 = meta (UTF-8 JSON object)

use crate::types::{DOT, SignData, TimeData, ChainData, VerifyData, FheData, MetaData, ObservationType, PayloadMode};

/// TLV tag constants — must match TypeScript implementation exactly.
pub mod tags {
    pub const PAYLOAD: u8 = 0x01;
    pub const PAYLOAD_MODE: u8 = 0x02;
    pub const DOT_TYPE: u8 = 0x03;
    pub const SIGN_OBSERVER: u8 = 0x10;
    pub const SIGN_SIG: u8 = 0x11;
    pub const TIME_TS: u8 = 0x20;
    pub const TIME_SEQ: u8 = 0x21;
    pub const CHAIN_PREV: u8 = 0x30;
    pub const CHAIN_DEPTH: u8 = 0x31;
    pub const VERIFY_VALID: u8 = 0x40;
    pub const VERIFY_REASON: u8 = 0x41;
    pub const VERIFY_CHECKED: u8 = 0x42;
    pub const FHE_SCHEME: u8 = 0x50;
    pub const FHE_CIPHERTEXT: u8 = 0x51;
    pub const META: u8 = 0x60;
}

/// Decode error types.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DecodeError {
    /// Input bytes are too short to contain a valid TLV entry.
    TruncatedInput { offset: usize, needed: usize, available: usize },
    /// An unknown tag was encountered.
    UnknownTag { offset: usize, tag: u8 },
    /// A field's value is invalid (wrong length, bad UTF-8, etc.).
    InvalidValue { tag: u8, reason: String },
    /// JSON deserialization failed.
    JsonError { tag: u8, error: String },
}

impl std::fmt::Display for DecodeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DecodeError::TruncatedInput { offset, needed, available } =>
                write!(f, "truncated input at offset {}: need {} bytes, have {}", offset, needed, available),
            DecodeError::UnknownTag { offset, tag } =>
                write!(f, "unknown TLV tag 0x{:02x} at offset {}", tag, offset),
            DecodeError::InvalidValue { tag, reason } =>
                write!(f, "invalid value for tag 0x{:02x}: {}", tag, reason),
            DecodeError::JsonError { tag, error } =>
                write!(f, "JSON error for tag 0x{:02x}: {}", tag, error),
        }
    }
}

impl std::error::Error for DecodeError {}

/// Encode a DOT to TLV bytes.
///
/// Empty DOT (all None) → empty bytes `[]`.
/// All multi-byte integers use big-endian byte order.
pub fn to_bytes(dot: &DOT) -> Vec<u8> {
    let mut out = Vec::new();

    // 0x01 payload
    if let Some(ref p) = dot.payload {
        write_tlv(&mut out, tags::PAYLOAD, p);
    }

    // 0x02 payload_mode
    if let Some(mode) = dot.payload_mode {
        let b = match mode {
            PayloadMode::Fhe => 0u8,
            PayloadMode::Plain => 1u8,
            PayloadMode::None => 2u8,
        };
        write_tlv(&mut out, tags::PAYLOAD_MODE, &[b]);
    }

    // 0x03 dot_type
    if let Some(t) = dot.dot_type {
        let b = match t {
            ObservationType::Measure => 0u8,
            ObservationType::State => 1u8,
            ObservationType::Event => 2u8,
            ObservationType::Claim => 3u8,
            ObservationType::Bond => 4u8,
        };
        write_tlv(&mut out, tags::DOT_TYPE, &[b]);
    }

    // 0x10 sign.observer, 0x11 sign.sig
    if let Some(ref s) = dot.sign {
        write_tlv(&mut out, tags::SIGN_OBSERVER, &s.observer);
        write_tlv(&mut out, tags::SIGN_SIG, &s.sig);
    }

    // 0x20 time.ts, 0x21 time.seq
    if let Some(ref t) = dot.time {
        write_tlv(&mut out, tags::TIME_TS, &t.ts.to_be_bytes());
        if let Some(seq) = t.seq {
            write_tlv(&mut out, tags::TIME_SEQ, &seq.to_be_bytes());
        }
    }

    // 0x30 chain.prev, 0x31 chain.depth
    if let Some(ref c) = dot.chain {
        write_tlv(&mut out, tags::CHAIN_PREV, &c.prev);
        write_tlv(&mut out, tags::CHAIN_DEPTH, &c.depth.to_be_bytes());
    }

    // 0x40 verify.valid, 0x41 verify.reason, 0x42 verify.checked
    if let Some(ref v) = dot.verify {
        write_tlv(&mut out, tags::VERIFY_VALID, &[v.valid as u8]);
        if let Some(ref reason) = v.reason {
            write_tlv(&mut out, tags::VERIFY_REASON, reason.as_bytes());
        }
        if !v.checked.is_empty() {
            let json = serde_json::to_string(&v.checked).unwrap_or_else(|_| "[]".into());
            write_tlv(&mut out, tags::VERIFY_CHECKED, json.as_bytes());
        }
    }

    // 0x50 fhe.scheme, 0x51 fhe.ciphertext
    if let Some(ref fhe) = dot.fhe {
        write_tlv(&mut out, tags::FHE_SCHEME, fhe.scheme.as_bytes());
        write_tlv(&mut out, tags::FHE_CIPHERTEXT, &fhe.ciphertext);
    }

    // 0x60 meta (JSON)
    if let Some(ref meta) = dot.meta {
        let json = serde_json::to_string(&meta.entries).unwrap_or_else(|_| "{}".into());
        write_tlv(&mut out, tags::META, json.as_bytes());
    }

    out
}

/// Decode TLV bytes back into a DOT.
///
/// Empty input → default DOT (all None).
pub fn from_bytes(bytes: &[u8]) -> Result<DOT, DecodeError> {
    if bytes.is_empty() {
        return Ok(DOT::default());
    }

    let mut dot = DOT::default();
    let mut offset = 0;

    // Temporary accumulators for grouped fields
    let mut sign_observer: Option<Vec<u8>> = None;
    let mut sign_sig: Option<Vec<u8>> = None;
    let mut time_ts: Option<u64> = None;
    let mut time_seq: Option<u64> = None;
    let mut chain_prev: Option<Vec<u8>> = None;
    let mut chain_depth: Option<u64> = None;
    let mut verify_valid: Option<bool> = None;
    let mut verify_reason: Option<String> = None;
    let mut verify_checked: Option<Vec<String>> = None;
    let mut fhe_scheme: Option<String> = None;
    let mut fhe_ciphertext: Option<Vec<u8>> = None;

    while offset < bytes.len() {
        // Read tag (1 byte)
        if offset >= bytes.len() {
            break;
        }
        let tag = bytes[offset];
        offset += 1;

        // Read length (2 bytes, big-endian)
        if offset + 2 > bytes.len() {
            return Err(DecodeError::TruncatedInput {
                offset,
                needed: 2,
                available: bytes.len() - offset,
            });
        }
        let len = u16::from_be_bytes([bytes[offset], bytes[offset + 1]]) as usize;
        offset += 2;

        // Read value (len bytes)
        if offset + len > bytes.len() {
            return Err(DecodeError::TruncatedInput {
                offset,
                needed: len,
                available: bytes.len() - offset,
            });
        }
        let value = &bytes[offset..offset + len];
        offset += len;

        match tag {
            tags::PAYLOAD => {
                dot.payload = Some(value.to_vec());
            }
            tags::PAYLOAD_MODE => {
                if len != 1 {
                    return Err(DecodeError::InvalidValue {
                        tag,
                        reason: format!("expected 1 byte, got {}", len),
                    });
                }
                dot.payload_mode = Some(match value[0] {
                    0 => PayloadMode::Fhe,
                    1 => PayloadMode::Plain,
                    2 => PayloadMode::None,
                    b => return Err(DecodeError::InvalidValue {
                        tag,
                        reason: format!("unknown payload_mode byte {}", b),
                    }),
                });
            }
            tags::DOT_TYPE => {
                if len != 1 {
                    return Err(DecodeError::InvalidValue {
                        tag,
                        reason: format!("expected 1 byte, got {}", len),
                    });
                }
                dot.dot_type = Some(match value[0] {
                    0 => ObservationType::Measure,
                    1 => ObservationType::State,
                    2 => ObservationType::Event,
                    3 => ObservationType::Claim,
                    4 => ObservationType::Bond,
                    b => return Err(DecodeError::InvalidValue {
                        tag,
                        reason: format!("unknown dot_type byte {}", b),
                    }),
                });
            }
            tags::SIGN_OBSERVER => {
                sign_observer = Some(value.to_vec());
            }
            tags::SIGN_SIG => {
                sign_sig = Some(value.to_vec());
            }
            tags::TIME_TS => {
                if len != 8 {
                    return Err(DecodeError::InvalidValue {
                        tag,
                        reason: format!("expected 8 bytes, got {}", len),
                    });
                }
                time_ts = Some(u64::from_be_bytes([
                    value[0], value[1], value[2], value[3],
                    value[4], value[5], value[6], value[7],
                ]));
            }
            tags::TIME_SEQ => {
                if len != 8 {
                    return Err(DecodeError::InvalidValue {
                        tag,
                        reason: format!("expected 8 bytes, got {}", len),
                    });
                }
                time_seq = Some(u64::from_be_bytes([
                    value[0], value[1], value[2], value[3],
                    value[4], value[5], value[6], value[7],
                ]));
            }
            tags::CHAIN_PREV => {
                chain_prev = Some(value.to_vec());
            }
            tags::CHAIN_DEPTH => {
                if len != 8 {
                    return Err(DecodeError::InvalidValue {
                        tag,
                        reason: format!("expected 8 bytes, got {}", len),
                    });
                }
                chain_depth = Some(u64::from_be_bytes([
                    value[0], value[1], value[2], value[3],
                    value[4], value[5], value[6], value[7],
                ]));
            }
            tags::VERIFY_VALID => {
                if len != 1 {
                    return Err(DecodeError::InvalidValue {
                        tag,
                        reason: format!("expected 1 byte, got {}", len),
                    });
                }
                verify_valid = Some(value[0] != 0);
            }
            tags::VERIFY_REASON => {
                verify_reason = Some(
                    std::str::from_utf8(value)
                        .map_err(|e| DecodeError::InvalidValue { tag, reason: e.to_string() })?
                        .to_string(),
                );
            }
            tags::VERIFY_CHECKED => {
                let s = std::str::from_utf8(value)
                    .map_err(|e| DecodeError::InvalidValue { tag, reason: e.to_string() })?;
                let v: Vec<String> = serde_json::from_str(s)
                    .map_err(|e| DecodeError::JsonError { tag, error: e.to_string() })?;
                verify_checked = Some(v);
            }
            tags::FHE_SCHEME => {
                fhe_scheme = Some(
                    std::str::from_utf8(value)
                        .map_err(|e| DecodeError::InvalidValue { tag, reason: e.to_string() })?
                        .to_string(),
                );
            }
            tags::FHE_CIPHERTEXT => {
                fhe_ciphertext = Some(value.to_vec());
            }
            tags::META => {
                let s = std::str::from_utf8(value)
                    .map_err(|e| DecodeError::InvalidValue { tag, reason: e.to_string() })?;
                let entries: std::collections::HashMap<String, String> =
                    serde_json::from_str(s)
                        .map_err(|e| DecodeError::JsonError { tag, error: e.to_string() })?;
                dot.meta = Some(MetaData { entries });
            }
            unknown => {
                return Err(DecodeError::UnknownTag { offset: offset - len - 3, tag: unknown });
            }
        }
    }

    // Assemble grouped fields
    if sign_observer.is_some() || sign_sig.is_some() {
        dot.sign = Some(SignData {
            observer: sign_observer.unwrap_or_default(),
            sig: sign_sig.unwrap_or_default(),
        });
    }

    if time_ts.is_some() {
        dot.time = Some(TimeData {
            ts: time_ts.unwrap_or(0),
            seq: time_seq,
        });
    }

    if chain_prev.is_some() || chain_depth.is_some() {
        dot.chain = Some(ChainData {
            prev: chain_prev.unwrap_or_default(),
            depth: chain_depth.unwrap_or(0),
        });
    }

    if verify_valid.is_some() {
        dot.verify = Some(VerifyData {
            valid: verify_valid.unwrap_or(false),
            reason: verify_reason,
            checked: verify_checked.unwrap_or_default(),
        });
    }

    if fhe_scheme.is_some() || fhe_ciphertext.is_some() {
        dot.fhe = Some(FheData {
            scheme: fhe_scheme.unwrap_or_default(),
            ciphertext: fhe_ciphertext.unwrap_or_default(),
        });
    }

    Ok(dot)
}

/// Write a single TLV entry: tag (1B) | length (2B BE) | value.
fn write_tlv(out: &mut Vec<u8>, tag: u8, value: &[u8]) {
    out.push(tag);
    let len = value.len() as u16;
    out.extend_from_slice(&len.to_be_bytes());
    out.extend_from_slice(value);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::observe::observe;
    use crate::sign::sign_dot;
    use crate::chain::chain_dot;
    use crate::crypto::ed25519::generate_keypair;
    use crate::types::{ObservationType, PayloadMode};
    use crate::observe::ObserveOptions;

    fn init() {
        let _ = sodiumoxide::init();
    }

    #[test]
    fn test_empty_dot_encodes_to_empty_bytes() {
        let dot = DOT::default();
        let bytes = to_bytes(&dot);
        assert_eq!(bytes, &[] as &[u8]);
    }

    #[test]
    fn test_empty_bytes_decode_to_empty_dot() {
        let dot = from_bytes(&[]).unwrap();
        assert!(dot.payload.is_none());
        assert!(dot.sign.is_none());
        assert!(dot.chain.is_none());
    }

    #[test]
    fn test_roundtrip_payload_only() {
        let dot = observe(Some(b"hello"), Some(ObserveOptions { plaintext: true, ..Default::default() }));
        let bytes = to_bytes(&dot);
        let decoded = from_bytes(&bytes).unwrap();
        assert_eq!(decoded.payload.unwrap(), b"hello");
        assert_eq!(decoded.payload_mode, Some(PayloadMode::Plain));
    }

    #[test]
    fn test_roundtrip_fhe_payload() {
        let dot = observe(Some(b"fhe data"), None);
        let bytes = to_bytes(&dot);
        let decoded = from_bytes(&bytes).unwrap();
        assert_eq!(decoded.payload_mode, Some(PayloadMode::Fhe));
        assert!(decoded.fhe.is_some());
    }

    #[test]
    fn test_roundtrip_dot_type() {
        for (t, _expected_byte) in [
            (ObservationType::Measure, 0u8),
            (ObservationType::State, 1u8),
            (ObservationType::Event, 2u8),
            (ObservationType::Claim, 3u8),
            (ObservationType::Bond, 4u8),
        ] {
            let opts = ObserveOptions { dot_type: Some(t), ..Default::default() };
            let dot = observe(None, Some(opts));
            let decoded = from_bytes(&to_bytes(&dot)).unwrap();
            assert_eq!(decoded.dot_type, Some(t));
        }
    }

    #[test]
    fn test_roundtrip_signed_dot() {
        init();
        let (_, sk) = generate_keypair();
        let dot = sign_dot(observe(Some(b"signed"), None), &sk);
        let bytes = to_bytes(&dot);
        let decoded = from_bytes(&bytes).unwrap();
        assert!(decoded.sign.is_some());
        let s = decoded.sign.unwrap();
        assert_eq!(s.observer.len(), 32);
        assert_eq!(s.sig.len(), 64);
    }

    #[test]
    fn test_roundtrip_time() {
        init();
        let (_, sk) = generate_keypair();
        let dot = sign_dot(observe(None, None), &sk);
        let orig_ts = dot.time.as_ref().unwrap().ts;
        let decoded = from_bytes(&to_bytes(&dot)).unwrap();
        assert_eq!(decoded.time.unwrap().ts, orig_ts);
    }

    #[test]
    fn test_roundtrip_chain() {
        let prev = observe(Some(b"prev"), None);
        let next = chain_dot(observe(Some(b"next"), None), Some(&prev));
        let decoded = from_bytes(&to_bytes(&next)).unwrap();
        let c = decoded.chain.unwrap();
        assert_eq!(c.prev.len(), 32);
        assert_eq!(c.depth, 1);
    }

    #[test]
    fn test_roundtrip_meta() {
        use std::collections::HashMap;
        let mut m = HashMap::new();
        m.insert("author".to_string(), "R854".to_string());
        let opts = ObserveOptions { meta: Some(m), ..Default::default() };
        let dot = observe(None, Some(opts));
        let decoded = from_bytes(&to_bytes(&dot)).unwrap();
        let meta = decoded.meta.unwrap();
        assert_eq!(meta.entries.get("author").unwrap(), "R854");
    }

    #[test]
    fn test_tlv_tag_ordering() {
        // Verify that payload tag comes first in the byte stream
        let dot = observe(Some(b"test"), Some(ObserveOptions { plaintext: true, ..Default::default() }));
        let bytes = to_bytes(&dot);
        assert_eq!(bytes[0], tags::PAYLOAD);
    }

    #[test]
    fn test_unknown_tag_returns_error() {
        // Build a TLV with an unknown tag 0xFF
        let bad_bytes = vec![0xFF, 0x00, 0x01, 0x42];
        let result = from_bytes(&bad_bytes);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), DecodeError::UnknownTag { .. }));
    }

    #[test]
    fn test_truncated_input_returns_error() {
        // Tag but no length
        let bad_bytes = vec![tags::PAYLOAD, 0x00];
        let result = from_bytes(&bad_bytes);
        assert!(result.is_err());
    }

    #[test]
    fn test_truncated_value_returns_error() {
        // Tag + length claims 10 bytes but only 3 provided
        let bad_bytes = vec![tags::PAYLOAD, 0x00, 0x0A, 0x01, 0x02, 0x03];
        let result = from_bytes(&bad_bytes);
        assert!(result.is_err());
    }

    #[test]
    fn test_full_dot_roundtrip() {
        init();
        let (_, sk) = generate_keypair();
        let prev = observe(Some(b"genesis"), None);
        let next = sign_dot(
            chain_dot(
                observe(Some(b"second"), None),
                Some(&prev),
            ),
            &sk,
        );
        let bytes = to_bytes(&next);
        let decoded = from_bytes(&bytes).unwrap();
        assert_eq!(decoded.payload.unwrap(), b"second");
        assert!(decoded.sign.is_some());
        assert!(decoded.time.is_some());
        assert!(decoded.chain.is_some());
    }

    #[test]
    fn test_time_seq_roundtrip() {
        use crate::types::TimeData;
        let mut dot = DOT::default();
        dot.time = Some(TimeData { ts: 1234567890, seq: Some(42) });
        let decoded = from_bytes(&to_bytes(&dot)).unwrap();
        let t = decoded.time.unwrap();
        assert_eq!(t.ts, 1234567890);
        assert_eq!(t.seq, Some(42));
    }

    #[test]
    fn test_payload_mode_none_roundtrip() {
        let dot = observe(None, None);
        let decoded = from_bytes(&to_bytes(&dot)).unwrap();
        assert_eq!(decoded.payload_mode, Some(PayloadMode::None));
    }

    #[test]
    fn test_verify_data_roundtrip() {
        use crate::types::VerifyData;
        let mut dot = DOT::default();
        dot.verify = Some(VerifyData {
            valid: true,
            reason: None,
            checked: vec!["signature".to_string(), "chain".to_string()],
        });
        let decoded = from_bytes(&to_bytes(&dot)).unwrap();
        let v = decoded.verify.unwrap();
        assert!(v.valid);
        assert_eq!(v.checked.len(), 2);
    }

    #[test]
    fn test_verify_data_invalid_roundtrip() {
        use crate::types::VerifyData;
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
}
