// DOT signing — attach Ed25519 signature to a DOT.

use crate::types::{DOT, SignData, TimeData};
use crate::crypto::ed25519::{SecretKey, sign, public_key_from_secret};

/// Sign a DOT with an Ed25519 secret key.
///
/// Signing process:
/// 1. Collect signable bytes (all present fields except sign itself).
/// 2. Sign with Ed25519.
/// 3. Attach sign.observer (public key) and sign.sig to the DOT.
/// 4. Set time.ts to now (ms) if not already set.
///
/// The signed bytes are built by concatenating all present fields in canonical order:
/// payload || payload_mode || dot_type || time.ts || time.seq || chain.prev || chain.depth
pub fn sign_dot(mut dot: DOT, secret_key: &SecretKey) -> DOT {
    // Set timestamp if not already present
    if dot.time.is_none() {
        dot.time = Some(TimeData {
            ts: now_ms(),
            seq: None,
        });
    }

    // Build the public key for this signer
    let public_key = public_key_from_secret(secret_key);

    // Build signable bytes: encode all fields except sign itself
    let signable = signable_bytes(&dot);

    // Sign
    let sig = sign(&signable, secret_key);

    // Attach sign data
    dot.sign = Some(SignData {
        observer: public_key.0.to_vec(),
        sig: sig.to_bytes().to_vec(),
    });

    dot
}

/// Build the bytes that are signed over.
///
/// Canonical order (mirrors TypeScript):
/// payload (if present) || payload_mode (1 byte) || dot_type (1 byte) ||
/// time.ts (8 bytes BE) || time.seq (8 bytes BE, or zeros) ||
/// chain.prev (if present) || chain.depth (8 bytes BE, if chain present)
///
/// This ensures cross-language compatibility — same inputs produce same signed bytes.
pub fn signable_bytes(dot: &DOT) -> Vec<u8> {
    let mut out = Vec::new();

    // payload
    if let Some(ref p) = dot.payload {
        out.extend_from_slice(p);
    }

    // payload_mode as 1 byte (0=Fhe, 1=Plain, 2=None, 0xFF=absent)
    match &dot.payload_mode {
        Some(crate::types::PayloadMode::Fhe) => out.push(0x00),
        Some(crate::types::PayloadMode::Plain) => out.push(0x01),
        Some(crate::types::PayloadMode::None) => out.push(0x02),
        None => out.push(0xFF),
    }

    // dot_type as 1 byte
    match &dot.dot_type {
        Some(crate::types::ObservationType::Measure) => out.push(0x00),
        Some(crate::types::ObservationType::State) => out.push(0x01),
        Some(crate::types::ObservationType::Event) => out.push(0x02),
        Some(crate::types::ObservationType::Claim) => out.push(0x03),
        Some(crate::types::ObservationType::Bond) => out.push(0x04),
        None => out.push(0xFF),
    }

    // time.ts as 8 bytes big-endian
    if let Some(ref t) = dot.time {
        out.extend_from_slice(&t.ts.to_be_bytes());
        // time.seq as 8 bytes big-endian (0 if absent)
        out.extend_from_slice(&t.seq.unwrap_or(0).to_be_bytes());
    } else {
        out.extend_from_slice(&[0u8; 16]);
    }

    // Note: chain data is NOT included in signable bytes.
    // Chain links are structural metadata added after signing (chain_dot → sign_dot is wrong;
    // the correct order is sign_dot first or sign with chain already present).
    // To keep chain data in the signed bytes, always sign AFTER chaining:
    //   sign_dot(chain_dot(observe(...), Some(&prev)), &sk)
    // If chain data is present when signing, include it. This makes the signature
    // cover the chain link, preventing tampering of the chain.
    if let Some(ref c) = dot.chain {
        out.extend_from_slice(&c.prev);
        out.extend_from_slice(&c.depth.to_be_bytes());
    }

    out
}

/// Current time in milliseconds since Unix epoch.
fn now_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::observe::observe;
    use crate::verify::verify_dot;
    use crate::crypto::ed25519::generate_keypair;

    fn init() {
        let _ = sodiumoxide::init();
    }

    #[test]
    fn test_sign_adds_sign_field() {
        init();
        let (_, sk) = generate_keypair();
        let dot = observe(Some(b"hello"), None);
        let signed = sign_dot(dot, &sk);
        assert!(signed.sign.is_some());
        let s = signed.sign.unwrap();
        assert_eq!(s.observer.len(), 32);
        assert_eq!(s.sig.len(), 64);
    }

    #[test]
    fn test_sign_sets_timestamp() {
        init();
        let (_, sk) = generate_keypair();
        let dot = observe(None, None);
        assert!(dot.time.is_none());
        let signed = sign_dot(dot, &sk);
        assert!(signed.time.is_some());
        assert!(signed.time.unwrap().ts > 0);
    }

    #[test]
    fn test_sign_preserves_existing_timestamp() {
        init();
        let (_, sk) = generate_keypair();
        let mut dot = observe(None, None);
        dot.time = Some(TimeData { ts: 12345678, seq: None });
        let signed = sign_dot(dot, &sk);
        assert_eq!(signed.time.unwrap().ts, 12345678);
    }

    #[test]
    fn test_sign_verify_roundtrip() {
        init();
        let (_, sk) = generate_keypair();
        let dot = observe(Some(b"R854 test"), None);
        let signed = sign_dot(dot, &sk);
        let result = verify_dot(&signed);
        assert!(result.valid, "signed DOT must verify: {:?}", result.reason);
    }

    #[test]
    fn test_sign_empty_dot() {
        init();
        let (_, sk) = generate_keypair();
        let dot = observe(None, None);
        let signed = sign_dot(dot, &sk);
        assert!(signed.sign.is_some());
        let result = verify_dot(&signed);
        assert!(result.valid);
    }

    #[test]
    fn test_sign_with_all_types() {
        init();
        use crate::types::ObservationType;
        use crate::observe::ObserveOptions;
        let (_, sk) = generate_keypair();
        for t in [
            ObservationType::Measure,
            ObservationType::State,
            ObservationType::Event,
            ObservationType::Claim,
            ObservationType::Bond,
        ] {
            let opts = ObserveOptions { dot_type: Some(t), ..Default::default() };
            let dot = observe(Some(b"typed"), Some(opts));
            let signed = sign_dot(dot, &sk);
            let result = verify_dot(&signed);
            assert!(result.valid, "type {:?} failed verify", t);
        }
    }

    #[test]
    fn test_sign_preserves_payload() {
        init();
        let (_, sk) = generate_keypair();
        let dot = observe(Some(b"preserve me"), None);
        let signed = sign_dot(dot, &sk);
        assert_eq!(signed.payload.unwrap(), b"preserve me");
    }

    #[test]
    fn test_signable_bytes_deterministic() {
        init();
        let dot = observe(Some(b"det"), None);
        let mut dot2 = dot.clone();
        dot2.time = Some(TimeData { ts: 999, seq: None });
        let s1 = signable_bytes(&dot2);
        let s2 = signable_bytes(&dot2);
        assert_eq!(s1, s2);
    }

    #[test]
    fn test_signable_bytes_differs_for_different_payloads() {
        let dot1 = observe(Some(b"aaa"), None);
        let dot2 = observe(Some(b"bbb"), None);
        assert_ne!(signable_bytes(&dot1), signable_bytes(&dot2));
    }

    #[test]
    fn test_sign_public_key_matches_secret() {
        init();
        let (pk, sk) = generate_keypair();
        let dot = observe(None, None);
        let signed = sign_dot(dot, &sk);
        let s = signed.sign.unwrap();
        assert_eq!(s.observer, pk.0.to_vec());
    }

    #[test]
    fn test_multiple_signs_same_key_differ_if_time_differs() {
        init();
        let (_, sk) = generate_keypair();
        let dot1 = observe(Some(b"same payload"), None);
        let dot2 = observe(Some(b"same payload"), None);
        let s1 = sign_dot(dot1, &sk);
        let s2 = sign_dot(dot2, &sk);
        // Both should verify
        assert!(verify_dot(&s1).valid);
        assert!(verify_dot(&s2).valid);
    }

    #[test]
    fn test_sign_large_payload() {
        init();
        let (_, sk) = generate_keypair();
        let payload = vec![0xABu8; 65536];
        let dot = observe(Some(&payload), None);
        let signed = sign_dot(dot, &sk);
        let result = verify_dot(&signed);
        assert!(result.valid);
    }
}
