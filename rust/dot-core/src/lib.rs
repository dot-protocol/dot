// DOT Protocol R854 — Rust core library
// STCV kernel: observe / sign / verify / chain / encode
//
// All fields are optional per Correction #47.
// BLAKE3 for hashing, Ed25519 via sodiumoxide for signing.
// FHE is stubbed (tfhe-rs integration deferred).

pub mod crypto;
pub mod types;
pub mod observe;
pub mod sign;
pub mod verify;
pub mod chain;
pub mod encode;
pub mod trust;

#[cfg(test)]
mod tests;

// Re-exports for ergonomic use
pub use types::{DOT, ObservationType, PayloadMode, SignData, TimeData, ChainData, VerifyData, FheData, MetaData, IdentityLevel, compute_level};
pub use observe::{observe, ObserveOptions, fhe_stub_encrypt, fhe_stub_decrypt};
pub use sign::{sign_dot, signable_bytes};
pub use verify::{verify_dot, verify_chain, VerifyResult};
pub use chain::{chain_dot, hash_dot, hash_dot_hex};
pub use encode::{to_bytes, from_bytes, DecodeError, tags};
pub use trust::compute_trust;
pub use crypto::blake3_hash::{hash, hash_hex};
pub use crypto::ed25519::{generate_keypair, sign, verify, public_key_from_secret, PublicKey, SecretKey, Signature};
pub use crypto::random::{random_bytes, random_seed};
pub use crypto::metrics::{get_crypto_metrics, reset_metrics, CryptoMetrics};

/// Initialize sodiumoxide. Must be called before any cryptographic operations.
/// Safe to call multiple times.
pub fn init() -> Result<(), ()> {
    sodiumoxide::init()
}
