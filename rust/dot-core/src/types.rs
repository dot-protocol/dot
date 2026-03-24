// DOT Protocol R854 — Core Types
// ALL fields are optional per Correction #47 (graceful degradation).
// A DOT with zero fields is valid — it is the contact itself.

use serde::{Deserialize, Serialize};

/// Observation type — what kind of contact this DOT represents.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ObservationType {
    Measure,
    State,
    Event,
    Claim,
    Bond,
}

/// Payload encoding mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PayloadMode {
    /// Payload is FHE-encrypted (default when payload present).
    Fhe,
    /// Payload is plaintext.
    Plain,
    /// No payload.
    None,
}

/// Identity trust level — how much is known about the signer.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum IdentityLevel {
    Unknown = 0,
    /// Has a public key only.
    Anonymous = 1,
    /// Has signed a DOT.
    Pseudonymous = 2,
    /// Has a chain (multiple DOTs).
    Established = 3,
    /// Has been attested by another observer.
    Attested = 4,
    /// Has a rotation proof (long-lived identity).
    Rooted = 5,
    /// Full trust: signed + chain + attested + rooted.
    Trusted = 6,
}

/// Signing data — Ed25519 signature and signer public key.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignData {
    /// 32-byte Ed25519 public key of the signer.
    #[serde(with = "hex_bytes")]
    pub observer: Vec<u8>,
    /// 64-byte Ed25519 signature over the signable fields.
    #[serde(with = "hex_bytes")]
    pub sig: Vec<u8>,
}

/// Timing data — when the observation was made.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeData {
    /// Unix milliseconds timestamp.
    pub ts: u64,
    /// Optional monotonic sequence counter.
    pub seq: Option<u64>,
}

/// Chain link data — cryptographic chain to previous DOT.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainData {
    /// BLAKE3 hash (32 bytes) of the previous DOT's encoded bytes.
    #[serde(with = "hex_bytes")]
    pub prev: Vec<u8>,
    /// Chain depth (how many DOTs in the chain, counting from genesis = 1).
    pub depth: u64,
}

/// Verification result embedded in a DOT.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyData {
    /// Whether the DOT was valid when it was last verified.
    pub valid: bool,
    /// Optional reason string when invalid.
    pub reason: Option<String>,
    /// Which fields were checked.
    pub checked: Vec<String>,
}

/// FHE (Fully Homomorphic Encryption) stub.
/// In R854, FHE is the default payload mode — this struct holds the stub.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FheData {
    /// FHE scheme identifier (stub: "tfhe-rs").
    pub scheme: String,
    /// The encrypted ciphertext (stub: just the raw bytes encrypted with a dummy key).
    #[serde(with = "hex_bytes")]
    pub ciphertext: Vec<u8>,
}

/// Metadata — arbitrary key-value annotations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetaData {
    pub entries: std::collections::HashMap<String, String>,
}

/// DOT — the core observation primitive.
///
/// ALL fields are optional per Correction #47. An empty DOT (all None) is valid.
/// It represents the contact itself — the act of observation.
///
/// Wire format uses TLV encoding (see encode.rs). Tags:
///   0x01 = payload
///   0x02 = payload_mode
///   0x03 = dot_type
///   0x10 = sign.observer
///   0x11 = sign.sig
///   0x20 = time.ts
///   0x21 = time.seq
///   0x30 = chain.prev
///   0x31 = chain.depth
///   0x40 = verify.valid
///   0x41 = verify.reason
///   0x42 = verify.checked
///   0x50 = fhe.scheme
///   0x51 = fhe.ciphertext
///   0x60 = meta (JSON-encoded)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DOT {
    /// The raw payload bytes. Meaning determined by payload_mode.
    pub payload: Option<Vec<u8>>,
    /// How the payload is encoded.
    pub payload_mode: Option<PayloadMode>,
    /// What kind of observation this is.
    pub dot_type: Option<ObservationType>,
    /// Cryptographic signature and signer identity.
    pub sign: Option<SignData>,
    /// When this observation was made.
    pub time: Option<TimeData>,
    /// Chain link to previous DOT.
    pub chain: Option<ChainData>,
    /// Embedded verification result.
    pub verify: Option<VerifyData>,
    /// FHE encryption data (stub).
    pub fhe: Option<FheData>,
    /// Arbitrary metadata annotations.
    pub meta: Option<MetaData>,
}

/// Compute the identity/trust level of a DOT based on present fields.
///
/// Level 0: empty DOT
/// Level 1: has sign.observer (public key exists)
/// Level 2: has sign.sig (has signed a DOT)
/// Level 3: has chain (has a chain — established identity)
/// Level 4: has time (temporal anchoring)
/// Level 5: has fhe (encrypted — private capability)
/// Level 6: all of the above
pub fn compute_level(dot: &DOT) -> u8 {
    let mut level = 0u8;

    // Level 1+: has a public key
    if dot.sign.as_ref().map(|s| !s.observer.is_empty()).unwrap_or(false) {
        level += 1;
    }

    // Level 2: has a signature
    if dot.sign.as_ref().map(|s| !s.sig.is_empty()).unwrap_or(false) {
        level += 1;
    }

    // Level 3: has a chain
    if dot.chain.as_ref().map(|c| !c.prev.is_empty()).unwrap_or(false) {
        level += 1;
    }

    // Level 4: has time
    if dot.time.is_some() {
        level += 1;
    }

    // Level 5: has fhe (encrypted payload capability)
    if dot.fhe.is_some() {
        level += 1;
    }

    // Level 6: has payload
    if dot.payload.as_ref().map(|p| !p.is_empty()).unwrap_or(false) {
        level += 1;
    }

    level
}

/// Encode bytes as lowercase hex string.
pub fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Decode a hex string to bytes.
pub fn hex_to_bytes(s: &str) -> Result<Vec<u8>, String> {
    if s.len() % 2 != 0 {
        return Err("odd hex length".into());
    }
    (0..s.len() / 2)
        .map(|i| u8::from_str_radix(&s[2 * i..2 * i + 2], 16).map_err(|e| e.to_string()))
        .collect()
}

/// Serde helper: serialize Vec<u8> as lowercase hex string.
pub mod hex_bytes {
    use serde::{Deserialize, Deserializer, Serializer};
    use super::{bytes_to_hex, hex_to_bytes};

    pub fn serialize<S: Serializer>(bytes: &Vec<u8>, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&bytes_to_hex(bytes))
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<u8>, D::Error> {
        let s = String::deserialize(d)?;
        hex_to_bytes(&s).map_err(serde::de::Error::custom)
    }
}
