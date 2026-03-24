// Ed25519 signing via sodiumoxide for DOT Protocol R854.

pub use sodiumoxide::crypto::sign::ed25519::{PublicKey, SecretKey, Signature};
use sodiumoxide::crypto::sign::ed25519;

use crate::crypto::metrics;

/// Generate a new random Ed25519 keypair.
/// Returns (PublicKey, SecretKey).
pub fn generate_keypair() -> (PublicKey, SecretKey) {
    metrics::record_keygen();
    ed25519::gen_keypair()
}

/// Sign `message` with `secret_key`, returning an Ed25519 signature (64 bytes).
pub fn sign(message: &[u8], secret_key: &SecretKey) -> Signature {
    metrics::record_sign(message.len());
    // sodiumoxide sign_detached returns the ed25519::Signature (re-exported)
    ed25519::sign_detached(message, secret_key)
}

/// Verify `signature` over `message` with `public_key`.
pub fn verify(message: &[u8], signature: &Signature, public_key: &PublicKey) -> bool {
    metrics::record_verify(message.len());
    // Signature is already the sodiumoxide re-export of ed25519::Signature
    ed25519::verify_detached(signature, message, public_key)
}

/// Derive the public key from a secret key.
pub fn public_key_from_secret(secret_key: &SecretKey) -> PublicKey {
    // sodiumoxide's SecretKey is 64 bytes: seed(32) || public_key(32)
    let pk_bytes = &secret_key.0[32..];
    PublicKey::from_slice(pk_bytes)
        .expect("last 32 bytes of SecretKey are always a valid PublicKey")
}

/// Create a SecretKey from raw 64-byte bytes.
pub fn secret_key_from_bytes(bytes: &[u8]) -> Option<SecretKey> {
    SecretKey::from_slice(bytes)
}

/// Create a PublicKey from raw 32 bytes.
pub fn public_key_from_bytes(bytes: &[u8]) -> Option<PublicKey> {
    PublicKey::from_slice(bytes)
}

/// Create a Signature from raw 64 bytes.
pub fn signature_from_bytes(bytes: &[u8]) -> Option<Signature> {
    if bytes.len() != 64 { return None; }
    let mut arr = [0u8; 64];
    arr.copy_from_slice(bytes);
    Some(Signature::new(arr))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn init() {
        let _ = sodiumoxide::init();
    }

    #[test]
    fn test_generate_keypair_lengths() {
        init();
        let (pk, sk) = generate_keypair();
        assert_eq!(pk.0.len(), 32);
        assert_eq!(sk.0.len(), 64);
    }

    #[test]
    fn test_sign_verify_roundtrip() {
        init();
        let (pk, sk) = generate_keypair();
        let msg = b"hello DOT Protocol R854";
        let sig = sign(msg, &sk);
        assert!(verify(msg, &sig, &pk));
    }

    #[test]
    fn test_verify_fails_wrong_message() {
        init();
        let (pk, sk) = generate_keypair();
        let sig = sign(b"original", &sk);
        assert!(!verify(b"tampered", &sig, &pk));
    }

    #[test]
    fn test_verify_fails_wrong_key() {
        init();
        let (_pk, sk) = generate_keypair();
        let (pk2, _sk2) = generate_keypair();
        let msg = b"test message";
        let sig = sign(msg, &sk);
        assert!(!verify(msg, &sig, &pk2));
    }

    #[test]
    fn test_verify_fails_tampered_sig() {
        init();
        let (pk, sk) = generate_keypair();
        let msg = b"test";
        let sig = sign(msg, &sk);
        let mut sig_bytes = sig.to_bytes();
        sig_bytes[0] ^= 0xFF;
        let bad_sig = Signature::new(sig_bytes);
        assert!(!verify(msg, &bad_sig, &pk));
    }

    #[test]
    fn test_public_key_from_secret() {
        init();
        let (pk, sk) = generate_keypair();
        let derived = public_key_from_secret(&sk);
        assert_eq!(pk.0, derived.0);
    }

    #[test]
    fn test_sign_empty_message() {
        init();
        let (pk, sk) = generate_keypair();
        let sig = sign(b"", &sk);
        assert!(verify(b"", &sig, &pk));
    }

    #[test]
    fn test_sign_large_message() {
        init();
        let (pk, sk) = generate_keypair();
        let msg = vec![0x42u8; 65536];
        let sig = sign(&msg, &sk);
        assert!(verify(&msg, &sig, &pk));
    }

    #[test]
    fn test_keypairs_are_unique() {
        init();
        let (pk1, _) = generate_keypair();
        let (pk2, _) = generate_keypair();
        assert_ne!(pk1.0, pk2.0);
    }

    #[test]
    fn test_secret_key_round_trip() {
        init();
        let (pk, sk) = generate_keypair();
        let restored = secret_key_from_bytes(&sk.0).unwrap();
        let msg = b"restore test";
        let sig = sign(msg, &restored);
        assert!(verify(msg, &sig, &pk));
    }

    #[test]
    fn test_public_key_from_bytes() {
        init();
        let (pk, _sk) = generate_keypair();
        let restored = public_key_from_bytes(&pk.0).unwrap();
        assert_eq!(pk.0, restored.0);
    }

    #[test]
    fn test_signature_from_bytes() {
        init();
        let (_pk, sk) = generate_keypair();
        let sig = sign(b"test", &sk);
        let bytes = sig.to_bytes();
        let restored = signature_from_bytes(&bytes).unwrap();
        assert_eq!(sig.to_bytes(), restored.to_bytes());
    }

    #[test]
    fn test_sign_is_deterministic() {
        // Ed25519 is deterministic for the same key+message
        init();
        let (_, sk) = generate_keypair();
        let msg = b"deterministic test";
        let sig1 = sign(msg, &sk);
        let sig2 = sign(msg, &sk);
        assert_eq!(sig1.to_bytes(), sig2.to_bytes());
    }
}
