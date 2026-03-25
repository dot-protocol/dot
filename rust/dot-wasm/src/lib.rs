use wasm_bindgen::prelude::*;
use ed25519_dalek::{SigningKey, VerifyingKey, Signer, Verifier, Signature};
use rand::rngs::OsRng;
use serde::{Serialize, Deserialize};

/// DOT observation types
#[wasm_bindgen]
#[derive(Clone, Copy, Serialize, Deserialize)]
pub enum ObservationType {
    Measure = 0,
    State = 1,
    Event = 2,
    Claim = 3,
    Bond = 4,
}

/// Keypair result returned to JS
#[wasm_bindgen]
pub struct DotKeypair {
    public_key: Vec<u8>,
    secret_key: Vec<u8>,
}

#[wasm_bindgen]
impl DotKeypair {
    #[wasm_bindgen(getter)]
    pub fn public_key(&self) -> Vec<u8> {
        self.public_key.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn secret_key(&self) -> Vec<u8> {
        self.secret_key.clone()
    }
}

/// Generate Ed25519 keypair
#[wasm_bindgen]
pub fn generate_keypair() -> DotKeypair {
    let signing_key = SigningKey::generate(&mut OsRng);
    let verifying_key = signing_key.verifying_key();
    DotKeypair {
        public_key: verifying_key.to_bytes().to_vec(),
        secret_key: signing_key.to_bytes().to_vec(),
    }
}

/// Sign a message with Ed25519
#[wasm_bindgen]
pub fn sign(message: &[u8], secret_key: &[u8]) -> Result<Vec<u8>, JsError> {
    let sk_bytes: [u8; 32] = secret_key.try_into()
        .map_err(|_| JsError::new("Secret key must be 32 bytes"))?;
    let signing_key = SigningKey::from_bytes(&sk_bytes);
    let signature = signing_key.sign(message);
    Ok(signature.to_bytes().to_vec())
}

/// Verify an Ed25519 signature
#[wasm_bindgen]
pub fn verify(message: &[u8], signature: &[u8], public_key: &[u8]) -> Result<bool, JsError> {
    let pk_bytes: [u8; 32] = public_key.try_into()
        .map_err(|_| JsError::new("Public key must be 32 bytes"))?;
    let sig_bytes: [u8; 64] = signature.try_into()
        .map_err(|_| JsError::new("Signature must be 64 bytes"))?;

    let verifying_key = VerifyingKey::from_bytes(&pk_bytes)
        .map_err(|e| JsError::new(&format!("Invalid public key: {}", e)))?;
    let sig = Signature::from_bytes(&sig_bytes);

    Ok(verifying_key.verify(message, &sig).is_ok())
}

/// BLAKE3 hash
#[wasm_bindgen]
pub fn hash(data: &[u8]) -> Vec<u8> {
    blake3::hash(data).as_bytes().to_vec()
}

/// BLAKE3 hash as hex string
#[wasm_bindgen]
pub fn hash_hex(data: &[u8]) -> String {
    blake3::hash(data).to_hex().to_string()
}

/// Create a signed DOT (simplified for WASM)
/// Returns JSON string with all DOT fields
#[wasm_bindgen]
pub fn create_dot(
    payload: &[u8],
    dot_type: ObservationType,
    secret_key: &[u8],
    previous_hash: Option<Vec<u8>>,
    depth: Option<u32>,
) -> Result<String, JsError> {
    let sk_bytes: [u8; 32] = secret_key.try_into()
        .map_err(|_| JsError::new("Secret key must be 32 bytes"))?;
    let signing_key = SigningKey::from_bytes(&sk_bytes);
    let public_key = signing_key.verifying_key().to_bytes();

    let timestamp = js_sys::Date::now() as u64;
    let chain_previous = previous_hash.unwrap_or_else(|| vec![0u8; 32]);
    let chain_depth = depth.unwrap_or(0);

    // Build signed bytes: payload + timestamp + chain_previous + type
    let mut signed_bytes = Vec::new();
    signed_bytes.extend_from_slice(payload);
    signed_bytes.extend_from_slice(&timestamp.to_be_bytes());
    signed_bytes.extend_from_slice(&chain_previous);
    signed_bytes.push(dot_type as u8);

    let signature = signing_key.sign(&signed_bytes);

    // Compute DOT hash (for chaining)
    let mut hash_input = Vec::new();
    hash_input.extend_from_slice(&public_key);
    hash_input.extend_from_slice(&signature.to_bytes());
    hash_input.extend_from_slice(payload);
    hash_input.extend_from_slice(&timestamp.to_be_bytes());
    hash_input.extend_from_slice(&chain_previous);
    hash_input.push(dot_type as u8);
    let dot_hash = blake3::hash(&hash_input);

    let dot = serde_json::json!({
        "payload": hex::encode(payload),
        "payload_text": String::from_utf8_lossy(payload),
        "type": dot_type as u8,
        "sign": {
            "observer": hex::encode(&public_key),
            "signature": hex::encode(&signature.to_bytes()),
        },
        "time": {
            "utc": timestamp,
        },
        "chain": {
            "previous": hex::encode(&chain_previous),
            "depth": chain_depth,
        },
        "hash": dot_hash.to_hex().to_string(),
    });

    Ok(dot.to_string())
}

/// Verify a DOT from its JSON representation
#[wasm_bindgen]
pub fn verify_dot(dot_json: &str) -> Result<bool, JsError> {
    let dot: serde_json::Value = serde_json::from_str(dot_json)
        .map_err(|e| JsError::new(&format!("Invalid JSON: {}", e)))?;

    let payload = hex::decode(dot["payload"].as_str().unwrap_or(""))
        .map_err(|_| JsError::new("Invalid payload hex"))?;
    let sig_hex = dot["sign"]["signature"].as_str().unwrap_or("");
    let pub_hex = dot["sign"]["observer"].as_str().unwrap_or("");
    let timestamp = dot["time"]["utc"].as_u64().unwrap_or(0);
    let chain_prev = hex::decode(dot["chain"]["previous"].as_str().unwrap_or(""))
        .unwrap_or_else(|_| vec![0u8; 32]);
    let dot_type = dot["type"].as_u64().unwrap_or(2) as u8;

    let mut signed_bytes = Vec::new();
    signed_bytes.extend_from_slice(&payload);
    signed_bytes.extend_from_slice(&timestamp.to_be_bytes());
    signed_bytes.extend_from_slice(&chain_prev);
    signed_bytes.push(dot_type);

    let signature = hex::decode(sig_hex)
        .map_err(|_| JsError::new("Invalid signature hex"))?;
    let public_key = hex::decode(pub_hex)
        .map_err(|_| JsError::new("Invalid public key hex"))?;

    verify(&signed_bytes, &signature, &public_key)
}

// hex encode/decode helpers (inline to avoid extra dep)
mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{:02x}", b)).collect()
    }

    pub fn decode(s: &str) -> Result<Vec<u8>, String> {
        if s.len() % 2 != 0 {
            return Err("Odd length hex string".into());
        }
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|e| e.to_string()))
            .collect()
    }
}
