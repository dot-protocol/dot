// DOT observation — the fundamental act of creating a DOT.
// Per Correction #47: ALL fields are optional. observe() with no args produces a valid DOT.

use crate::types::{DOT, ObservationType, PayloadMode, FheData, MetaData};

/// Options for creating an observation.
#[derive(Debug, Default, Clone)]
pub struct ObserveOptions {
    /// The observation type (Measure, State, Event, Claim, Bond).
    pub dot_type: Option<ObservationType>,
    /// Force plaintext mode (skip FHE stub). Default: FHE when payload present.
    pub plaintext: bool,
    /// Arbitrary metadata key-value pairs.
    pub meta: Option<std::collections::HashMap<String, String>>,
}

/// Create a new DOT observation.
///
/// Logic (mirrors TypeScript):
/// - No payload → `payload_mode = None`
/// - Payload + no plaintext flag → `payload_mode = Fhe` (FHE stub: identity transform)
/// - Payload + plaintext flag → `payload_mode = Plain`
///
/// Per Correction #47: unsigned DOTs are valid. Calling observe() alone is enough.
pub fn observe(payload: Option<&[u8]>, options: Option<ObserveOptions>) -> DOT {
    let opts = options.unwrap_or_default();

    let (payload_bytes, mode) = match payload {
        None => (None, Some(PayloadMode::None)),
        Some(raw) if raw.is_empty() => (None, Some(PayloadMode::None)),
        Some(raw) => {
            if opts.plaintext {
                (Some(raw.to_vec()), Some(PayloadMode::Plain))
            } else {
                // FHE stub: payload field holds the plaintext reference; fhe field holds ciphertext
                (Some(raw.to_vec()), Some(PayloadMode::Fhe))
            }
        }
    };

    let fhe = if matches!(mode, Some(PayloadMode::Fhe)) {
        payload.filter(|p| !p.is_empty()).map(|raw| fhe_stub_encrypt(raw))
    } else {
        None
    };

    let meta = opts.meta.map(|entries| MetaData { entries });

    DOT {
        payload: payload_bytes,
        payload_mode: mode,
        dot_type: opts.dot_type,
        sign: None,
        time: None,
        chain: None,
        verify: None,
        fhe,
        meta,
    }
}

/// FHE stub: "encrypts" payload by storing it as-is with a dummy scheme tag.
/// In production, this would use tfhe-rs to generate a real ciphertext.
pub fn fhe_stub_encrypt(plaintext: &[u8]) -> FheData {
    // Stub: XOR each byte with 0xAA (trivial "encryption" for now).
    // This is explicitly a stub as per the R854 spec — tfhe-rs not yet integrated.
    let ciphertext: Vec<u8> = plaintext.iter().map(|&b| b ^ 0xAA).collect();
    FheData {
        scheme: "tfhe-rs-stub".to_string(),
        ciphertext,
    }
}

/// FHE stub: "decrypts" payload (reverse of the stub encryption).
pub fn fhe_stub_decrypt(fhe: &FheData) -> Vec<u8> {
    // Reverse the XOR stub
    fhe.ciphertext.iter().map(|&b| b ^ 0xAA).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_observe_no_payload() {
        let dot = observe(None, None);
        assert!(dot.payload.is_none());
        assert_eq!(dot.payload_mode, Some(PayloadMode::None));
        assert!(dot.sign.is_none());
        assert!(dot.chain.is_none());
        assert!(dot.fhe.is_none());
    }

    #[test]
    fn test_observe_empty_payload() {
        let dot = observe(Some(&[]), None);
        assert!(dot.payload.is_none());
        assert_eq!(dot.payload_mode, Some(PayloadMode::None));
    }

    #[test]
    fn test_observe_payload_fhe_default() {
        let dot = observe(Some(b"hello"), None);
        assert!(dot.payload.is_some());
        assert_eq!(dot.payload_mode, Some(PayloadMode::Fhe));
        assert!(dot.fhe.is_some());
        let fhe = dot.fhe.unwrap();
        assert_eq!(fhe.scheme, "tfhe-rs-stub");
        assert_eq!(fhe.ciphertext.len(), 5);
    }

    #[test]
    fn test_observe_payload_plain() {
        let opts = ObserveOptions { plaintext: true, ..Default::default() };
        let dot = observe(Some(b"plaintext data"), Some(opts));
        assert!(dot.payload.is_some());
        assert_eq!(dot.payload_mode, Some(PayloadMode::Plain));
        assert!(dot.fhe.is_none());
        assert_eq!(dot.payload.unwrap(), b"plaintext data");
    }

    #[test]
    fn test_observe_with_type() {
        let opts = ObserveOptions {
            dot_type: Some(ObservationType::Event),
            ..Default::default()
        };
        let dot = observe(Some(b"event"), Some(opts));
        assert_eq!(dot.dot_type, Some(ObservationType::Event));
    }

    #[test]
    fn test_observe_all_types() {
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
    fn test_observe_with_meta() {
        use std::collections::HashMap;
        let mut m = HashMap::new();
        m.insert("key".to_string(), "value".to_string());
        let opts = ObserveOptions { meta: Some(m), ..Default::default() };
        let dot = observe(None, Some(opts));
        assert!(dot.meta.is_some());
        let meta = dot.meta.unwrap();
        assert_eq!(meta.entries.get("key").unwrap(), "value");
    }

    #[test]
    fn test_observe_default_is_valid_dot() {
        // Per Correction #47: empty DOT is valid
        let dot = observe(None, None);
        // All fields except payload_mode are None — this is valid per R854
        assert!(dot.sign.is_none());
        assert!(dot.chain.is_none());
        assert!(dot.time.is_none());
    }

    #[test]
    fn test_fhe_stub_roundtrip() {
        let plaintext = b"test fhe roundtrip";
        let fhe = fhe_stub_encrypt(plaintext);
        let decrypted = fhe_stub_decrypt(&fhe);
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_fhe_stub_ciphertext_differs() {
        let plaintext = b"hello";
        let fhe = fhe_stub_encrypt(plaintext);
        assert_ne!(fhe.ciphertext, plaintext.to_vec());
    }

    #[test]
    fn test_observe_large_payload() {
        let payload = vec![0x42u8; 10000];
        let dot = observe(Some(&payload), None);
        assert_eq!(dot.payload_mode, Some(PayloadMode::Fhe));
        let fhe = dot.fhe.unwrap();
        assert_eq!(fhe.ciphertext.len(), 10000);
    }

    #[test]
    fn test_observe_single_byte_payload() {
        let dot = observe(Some(&[0xFF]), None);
        assert!(dot.payload.is_some());
        assert_eq!(dot.payload_mode, Some(PayloadMode::Fhe));
    }

    #[test]
    fn test_observe_returns_dot_struct() {
        let dot = observe(Some(b"R854"), None);
        // dot_type is None by default
        assert!(dot.dot_type.is_none());
        // verify is None — not yet verified
        assert!(dot.verify.is_none());
    }
}
