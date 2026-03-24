// DOT verification — validate Ed25519 signatures and DOT integrity.

use crate::types::DOT;
use crate::sign::signable_bytes;
use crate::crypto::ed25519::{verify, public_key_from_bytes, signature_from_bytes};

/// Result of verifying a DOT.
#[derive(Debug, Clone)]
pub struct VerifyResult {
    /// Whether the DOT is valid.
    pub valid: bool,
    /// Human-readable reason when invalid. None when valid.
    pub reason: Option<String>,
    /// Which fields were checked during verification.
    pub checked: Vec<String>,
}

impl VerifyResult {
    pub fn ok(checked: Vec<String>) -> Self {
        VerifyResult { valid: true, reason: None, checked }
    }

    pub fn fail(reason: impl Into<String>, checked: Vec<String>) -> Self {
        VerifyResult {
            valid: false,
            reason: Some(reason.into()),
            checked,
        }
    }
}

/// Verify a DOT's signature (if present).
///
/// Per Correction #47:
/// - An unsigned DOT (sign field is None) is VALID — all fields are optional.
/// - A signed DOT with a bad signature is INVALID.
/// - A DOT with sign.observer but no sign.sig is INVALID.
/// - A DOT with sign.sig but no sign.observer is INVALID.
pub fn verify_dot(dot: &DOT) -> VerifyResult {
    let mut checked = Vec::new();

    match &dot.sign {
        None => {
            // Unsigned DOT — valid per Correction #47
            checked.push("unsigned".to_string());
            VerifyResult::ok(checked)
        }
        Some(sign_data) => {
            checked.push("sign.observer".to_string());
            checked.push("sign.sig".to_string());

            // Validate observer key length
            if sign_data.observer.len() != 32 {
                return VerifyResult::fail(
                    format!("sign.observer must be 32 bytes, got {}", sign_data.observer.len()),
                    checked,
                );
            }

            // Validate signature length
            if sign_data.sig.len() != 64 {
                return VerifyResult::fail(
                    format!("sign.sig must be 64 bytes, got {}", sign_data.sig.len()),
                    checked,
                );
            }

            // Parse public key
            let pk = match public_key_from_bytes(&sign_data.observer) {
                Some(pk) => pk,
                None => {
                    return VerifyResult::fail("invalid Ed25519 public key", checked);
                }
            };

            // Parse signature
            let sig = match signature_from_bytes(&sign_data.sig) {
                Some(sig) => sig,
                None => {
                    return VerifyResult::fail("invalid Ed25519 signature bytes", checked);
                }
            };

            // Rebuild signable bytes (same as during signing)
            let signable = signable_bytes(dot);
            checked.push("signable_bytes".to_string());

            // Verify
            if verify(&signable, &sig, &pk) {
                VerifyResult::ok(checked)
            } else {
                VerifyResult::fail("Ed25519 signature verification failed", checked)
            }
        }
    }
}

/// Check whether a sequence of DOTs forms a valid chain.
///
/// A chain is valid if:
/// 1. Each DOT verifies independently.
/// 2. Each DOT's chain.prev == BLAKE3(encoded_bytes_of_previous_dot).
pub fn verify_chain(dots: &[&DOT]) -> VerifyResult {
    if dots.is_empty() {
        return VerifyResult::ok(vec!["empty_chain".to_string()]);
    }

    let mut checked = Vec::new();

    for (i, dot) in dots.iter().enumerate() {
        // Each DOT must verify individually
        let r = verify_dot(dot);
        if !r.valid {
            return VerifyResult::fail(
                format!("DOT at index {} failed verification: {:?}", i, r.reason),
                checked,
            );
        }
        checked.push(format!("dot[{}].signature", i));

        // Check chain link
        if i > 0 {
            let prev = dots[i - 1];
            let expected_prev_hash = crate::chain::hash_dot(prev);

            match &dot.chain {
                None => {
                    return VerifyResult::fail(
                        format!("DOT at index {} has no chain link but is not genesis", i),
                        checked,
                    );
                }
                Some(chain_data) => {
                    if chain_data.prev != expected_prev_hash {
                        return VerifyResult::fail(
                            format!("DOT at index {} has broken chain link", i),
                            checked,
                        );
                    }
                    checked.push(format!("dot[{}].chain.prev", i));
                }
            }
        }
    }

    VerifyResult::ok(checked)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::observe::observe;
    use crate::sign::sign_dot;
    use crate::chain::chain_dot;
    use crate::crypto::ed25519::generate_keypair;
    use crate::types::SignData;

    fn init() {
        let _ = sodiumoxide::init();
    }

    #[test]
    fn test_unsigned_dot_is_valid() {
        let dot = observe(None, None);
        let result = verify_dot(&dot);
        assert!(result.valid);
        assert!(result.checked.contains(&"unsigned".to_string()));
    }

    #[test]
    fn test_signed_dot_is_valid() {
        init();
        let (_, sk) = generate_keypair();
        let dot = observe(Some(b"test"), None);
        let signed = sign_dot(dot, &sk);
        let result = verify_dot(&signed);
        assert!(result.valid);
    }

    #[test]
    fn test_tampered_payload_fails() {
        init();
        let (_, sk) = generate_keypair();
        let dot = observe(Some(b"original"), None);
        let mut signed = sign_dot(dot, &sk);
        // Tamper the payload
        signed.payload = Some(b"tampered".to_vec());
        let result = verify_dot(&signed);
        assert!(!result.valid);
        assert!(result.reason.is_some());
    }

    #[test]
    fn test_tampered_sig_fails() {
        init();
        let (_, sk) = generate_keypair();
        let dot = observe(Some(b"original"), None);
        let mut signed = sign_dot(dot, &sk);
        // Flip first byte of sig
        if let Some(ref mut s) = signed.sign {
            s.sig[0] ^= 0xFF;
        }
        let result = verify_dot(&signed);
        assert!(!result.valid);
    }

    #[test]
    fn test_wrong_key_fails() {
        init();
        let (_, sk1) = generate_keypair();
        let (pk2, _) = generate_keypair();
        let dot = observe(Some(b"test"), None);
        let mut signed = sign_dot(dot, &sk1);
        // Replace observer with a different key
        if let Some(ref mut s) = signed.sign {
            s.observer = pk2.0.to_vec();
        }
        let result = verify_dot(&signed);
        assert!(!result.valid);
    }

    #[test]
    fn test_invalid_observer_length_fails() {
        let mut dot = observe(None, None);
        dot.sign = Some(SignData {
            observer: vec![0u8; 16], // wrong length
            sig: vec![0u8; 64],
        });
        let result = verify_dot(&dot);
        assert!(!result.valid);
        assert!(result.reason.unwrap().contains("32 bytes"));
    }

    #[test]
    fn test_invalid_sig_length_fails() {
        init();
        let (pk, _) = generate_keypair();
        let mut dot = observe(None, None);
        dot.sign = Some(SignData {
            observer: pk.0.to_vec(),
            sig: vec![0u8; 32], // wrong length
        });
        let result = verify_dot(&dot);
        assert!(!result.valid);
        assert!(result.reason.unwrap().contains("64 bytes"));
    }

    #[test]
    fn test_verify_includes_checked_fields() {
        init();
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
    fn test_single_dot_chain_is_valid() {
        init();
        let (_, sk) = generate_keypair();
        let dot = sign_dot(observe(Some(b"genesis"), None), &sk);
        let result = verify_chain(&[&dot]);
        assert!(result.valid);
    }

    #[test]
    fn test_valid_chain_verifies() {
        init();
        let (_, sk) = generate_keypair();
        let d0 = sign_dot(observe(Some(b"genesis"), None), &sk);
        // Chain THEN sign — so chain.prev is included in signed bytes
        let d1 = sign_dot(chain_dot(observe(Some(b"second"), None), Some(&d0)), &sk);
        let result = verify_chain(&[&d0, &d1]);
        assert!(result.valid, "chain verification failed: {:?}", result.reason);
    }

    #[test]
    fn test_tampered_chain_link_fails() {
        init();
        let (_, sk) = generate_keypair();
        let d0 = sign_dot(observe(Some(b"genesis"), None), &sk);
        // Chain THEN sign (correct order — chain.prev is signed)
        let mut d1 = sign_dot(chain_dot(observe(Some(b"second"), None), Some(&d0)), &sk);
        // Tamper chain.prev — now the signature check WILL fail because chain.prev is signed
        if let Some(ref mut c) = d1.chain {
            c.prev[0] ^= 0xFF;
        }
        let result = verify_chain(&[&d0, &d1]);
        assert!(!result.valid);
    }

    #[test]
    fn test_verify_fail_gives_reason() {
        init();
        let (_, sk) = generate_keypair();
        let mut dot = sign_dot(observe(Some(b"test"), None), &sk);
        dot.payload = Some(b"modified".to_vec());
        let result = verify_dot(&dot);
        assert!(result.reason.is_some());
        assert!(!result.reason.unwrap().is_empty());
    }
}
