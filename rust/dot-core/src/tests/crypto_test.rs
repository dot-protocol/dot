// Crypto integration tests — BLAKE3, Ed25519, random, metrics.

use crate::crypto::blake3_hash::{hash, hash_hex};
use crate::crypto::ed25519::{
    generate_keypair, sign, verify, public_key_from_secret,
    public_key_from_bytes, secret_key_from_bytes, signature_from_bytes,
};
use crate::crypto::random::{random_bytes, random_seed, random_nonce};
use crate::crypto::metrics::{get_crypto_metrics, reset_metrics, time_op};
use crate::init;

fn setup() {
    init().unwrap();
}

// ===== BLAKE3 tests =====

#[test]
fn test_blake3_empty() {
    setup();
    let h = hash(b"");
    assert_eq!(h.len(), 32);
    assert_eq!(hash_hex(b"").len(), 64);
    assert_eq!(hash(b""), hash(b""));
}

#[test]
fn test_blake3_abc() {
    setup();
    let h = hash_hex(b"abc");
    assert_eq!(h.len(), 64);
    assert_eq!(h, hash_hex(b"abc"));
}

#[test]
fn test_blake3_different_inputs() {
    setup();
    let inputs: &[&[u8]] = &[b"", b"a", b"ab", b"abc", b"hello world", b"DOT Protocol R854"];
    let hashes: Vec<_> = inputs.iter().map(|i| hash(i)).collect();
    for i in 0..hashes.len() {
        for j in 0..hashes.len() {
            if i != j {
                assert_ne!(hashes[i], hashes[j]);
            }
        }
    }
}

#[test]
fn test_blake3_one_byte_change() {
    setup();
    assert_ne!(hash(b"hello world"), hash(b"hello World"));
}

#[test]
fn test_blake3_1mb() {
    setup();
    let data = vec![0x5Au8; 1024 * 1024];
    let h = hash(&data);
    assert_eq!(h.len(), 32);
    assert_eq!(hash(&data), hash(&data));
}

#[test]
fn test_blake3_hex_lowercase() {
    setup();
    for data in [b"test" as &[u8], b"UPPERCASE", b"\x00\xFF\xAB"] {
        let h = hash_hex(data);
        assert_eq!(h, h.to_lowercase());
    }
}

#[test]
fn test_blake3_consistent() {
    setup();
    let data = b"test streaming";
    assert_eq!(hash(data), hash(data));
}

// ===== Ed25519 tests =====

#[test]
fn test_ed25519_unique_keypairs() {
    setup();
    let (pk1, _) = generate_keypair();
    let (pk2, _) = generate_keypair();
    assert_ne!(pk1.0, pk2.0);
}

#[test]
fn test_ed25519_sign_verify() {
    setup();
    let (pk, sk) = generate_keypair();
    let msg = b"sign this message";
    let sig = sign(msg, &sk);
    assert!(verify(msg, &sig, &pk));
}

#[test]
fn test_ed25519_empty_message() {
    setup();
    let (pk, sk) = generate_keypair();
    let sig = sign(b"", &sk);
    assert!(verify(b"", &sig, &pk));
}

#[test]
fn test_ed25519_wrong_message() {
    setup();
    let (pk, sk) = generate_keypair();
    let sig = sign(b"correct", &sk);
    assert!(!verify(b"wrong", &sig, &pk));
}

#[test]
fn test_ed25519_wrong_key() {
    setup();
    let (_, sk) = generate_keypair();
    let (pk2, _) = generate_keypair();
    let sig = sign(b"test", &sk);
    assert!(!verify(b"test", &sig, &pk2));
}

#[test]
fn test_ed25519_tampered_sig() {
    setup();
    use crate::crypto::ed25519::Signature;
    let (pk, sk) = generate_keypair();
    let sig = sign(b"test", &sk);
    let mut bad_bytes = sig.to_bytes();
    bad_bytes[0] ^= 0x01;
    bad_bytes[31] ^= 0x01;
    let bad_sig = Signature::new(bad_bytes);
    assert!(!verify(b"test", &bad_sig, &pk));
}

#[test]
fn test_ed25519_deterministic() {
    setup();
    let (_, sk) = generate_keypair();
    let msg = b"deterministic";
    assert_eq!(sign(msg, &sk).to_bytes(), sign(msg, &sk).to_bytes());
}

#[test]
fn test_ed25519_pk_from_sk() {
    setup();
    let (pk, sk) = generate_keypair();
    assert_eq!(pk.0, public_key_from_secret(&sk).0);
}

#[test]
fn test_ed25519_pk_from_bytes() {
    setup();
    let (pk, _) = generate_keypair();
    let restored = public_key_from_bytes(&pk.0).unwrap();
    assert_eq!(pk.0, restored.0);
}

#[test]
fn test_ed25519_invalid_pk_bytes() {
    setup();
    assert!(public_key_from_bytes(&[0u8; 16]).is_none());
}

#[test]
fn test_ed25519_sk_round_trip() {
    setup();
    let (pk, sk) = generate_keypair();
    let sk2 = secret_key_from_bytes(&sk.0).unwrap();
    let sig = sign(b"round trip", &sk2);
    assert!(verify(b"round trip", &sig, &pk));
}

#[test]
fn test_ed25519_1kb() {
    setup();
    let (pk, sk) = generate_keypair();
    let msg = vec![0xABu8; 1024];
    assert!(verify(&msg, &sign(&msg, &sk), &pk));
}

#[test]
fn test_ed25519_multiple_messages() {
    setup();
    let (pk, sk) = generate_keypair();
    for i in 0..10 {
        let msg = format!("message {}", i);
        let sig = sign(msg.as_bytes(), &sk);
        assert!(verify(msg.as_bytes(), &sig, &pk));
    }
}

// ===== Random tests =====

#[test]
fn test_random_lengths() {
    setup();
    for n in [0, 1, 16, 32, 64, 128, 256, 512, 1024] {
        assert_eq!(random_bytes(n).len(), n);
    }
}

#[test]
fn test_random_seed() {
    setup();
    assert_eq!(random_seed().len(), 32);
}

#[test]
fn test_random_nonces() {
    setup();
    for n in [8, 12, 16, 24, 32] {
        assert_eq!(random_nonce(n).len(), n);
    }
}

#[test]
fn test_random_uniqueness() {
    setup();
    let mut seen = std::collections::HashSet::new();
    for _ in 0..100 {
        seen.insert(random_bytes(16));
    }
    assert_eq!(seen.len(), 100);
}

// ===== Metrics tests =====

#[test]
fn test_metrics_hash() {
    setup();
    reset_metrics();
    let before = get_crypto_metrics();
    hash(b"metrics test");
    hash(b"another");
    let after = get_crypto_metrics();
    assert!(after.hash_count >= before.hash_count + 2);
}

#[test]
fn test_metrics_sign() {
    setup();
    reset_metrics();
    let (_, sk) = generate_keypair();
    let before = get_crypto_metrics();
    sign(b"metrics sign", &sk);
    let after = get_crypto_metrics();
    assert!(after.sign_count >= before.sign_count + 1);
}

#[test]
fn test_metrics_verify() {
    setup();
    reset_metrics();
    let (pk, sk) = generate_keypair();
    let sig = sign(b"test", &sk);
    let before = get_crypto_metrics();
    verify(b"test", &sig, &pk);
    let after = get_crypto_metrics();
    assert!(after.verify_count >= before.verify_count + 1);
}

#[test]
fn test_metrics_reset() {
    setup();
    hash(b"pre-reset");
    reset_metrics();
    let m = get_crypto_metrics();
    assert_eq!(m.hash_count, 0);
    assert_eq!(m.hash_bytes, 0);
    assert_eq!(m.sign_count, 0);
    assert_eq!(m.verify_count, 0);
    assert_eq!(m.keygen_count, 0);
}

#[test]
fn test_time_op_result() {
    let (result, duration) = time_op(|| 42u64);
    assert_eq!(result, 42);
    assert!(duration.as_nanos() >= 0);
}

#[test]
fn test_time_op_duration() {
    let (_, duration) = time_op(|| {
        let mut sum = 0u64;
        for i in 0..1_000_000u64 { sum += i; }
        sum
    });
    assert!(duration.as_nanos() > 0);
}

// ===== Cross-function =====

#[test]
fn test_hash_then_sign_verify() {
    setup();
    let (pk, sk) = generate_keypair();
    let h = hash(b"hash then sign");
    assert!(verify(&h, &sign(&h, &sk), &pk));
}

#[test]
fn test_keygen_metrics_increment() {
    setup();
    // Other parallel tests also call generate_keypair, so just check the count increases
    let before = get_crypto_metrics();
    generate_keypair();
    let after = get_crypto_metrics();
    assert!(after.keygen_count > before.keygen_count, "keygen_count should increase after generate_keypair, before={} after={}", before.keygen_count, after.keygen_count);
}
