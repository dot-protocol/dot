// DOT trust scoring — compute trust level for a DOT.

use crate::types::DOT;
use crate::types::compute_level;

/// Compute a trust score for a DOT in the range [0.0, 1.5+].
///
/// The score is based on which fields are present and valid:
///   - base: level / 6.0 → [0.0, 1.0]
///   - bonus multipliers for high-trust indicators
///
/// Trust formula:
///   base = compute_level(dot) / 6.0
///   bonus = 0.0
///   + 0.1 if has verified sign (verify.valid = true)
///   + 0.1 if chain depth > 5
///   + 0.1 if has FHE (privacy-preserving)
///   + 0.1 if has meta (additional context)
///   + 0.1 if time.seq is present (sequence-numbered)
///
/// Max trust = 1.0 base + 0.5 bonus = 1.5
pub fn compute_trust(dot: &DOT) -> f64 {
    let level = compute_level(dot) as f64;
    let base = level / 6.0;

    let mut bonus = 0.0_f64;

    // Bonus: verified (sign is present AND verify.valid is true)
    if let Some(ref v) = dot.verify {
        if v.valid && dot.sign.is_some() {
            bonus += 0.1;
        }
    }

    // Bonus: deep chain (depth > 5 indicates established identity)
    if let Some(ref c) = dot.chain {
        if c.depth > 5 {
            bonus += 0.1;
        }
    }

    // Bonus: FHE encrypted (privacy capability)
    if dot.fhe.is_some() {
        bonus += 0.1;
    }

    // Bonus: has metadata (additional context provided)
    if dot.meta.is_some() {
        bonus += 0.1;
    }

    // Bonus: sequence numbered (temporal ordering established)
    if let Some(ref t) = dot.time {
        if t.seq.is_some() {
            bonus += 0.1;
        }
    }

    base + bonus
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::observe::observe;
    use crate::observe::ObserveOptions;
    use crate::sign::sign_dot;
    use crate::chain::chain_dot;
    use crate::crypto::ed25519::generate_keypair;
    use crate::types::{compute_level, VerifyData, TimeData, ChainData};

    fn init() {
        let _ = sodiumoxide::init();
    }

    #[test]
    fn test_empty_dot_trust_is_zero() {
        let dot = DOT::default();
        assert_eq!(compute_trust(&dot), 0.0);
    }

    #[test]
    fn test_empty_dot_level_is_zero() {
        let dot = DOT::default();
        assert_eq!(compute_level(&dot), 0);
    }

    #[test]
    fn test_unsigned_dot_level_zero() {
        let dot = observe(None, None);
        // No payload, no sign — level 0
        assert_eq!(compute_level(&dot), 0);
    }

    #[test]
    fn test_payload_dot_increments_level() {
        let dot = observe(Some(b"hello"), None);
        // Has payload → level 1
        // Has payload_mode (Fhe) → but level for FHE comes from fhe field
        // Payload + fhe = at least level 1 (payload) + 1 (fhe) = 2
        let level = compute_level(&dot);
        assert!(level >= 1, "level should be >= 1, got {}", level);
    }

    #[test]
    fn test_signed_dot_level() {
        init();
        let (_, sk) = generate_keypair();
        let dot = sign_dot(observe(Some(b"test"), None), &sk);
        let level = compute_level(&dot);
        // Has: sign.observer(+1), sign.sig(+1), time(+1), payload(+1), fhe(+1) = 5
        assert!(level >= 3, "signed dot should be >= level 3, got {}", level);
    }

    #[test]
    fn test_full_dot_level_is_6() {
        init();
        let (_, sk) = generate_keypair();
        let prev = observe(Some(b"prev"), None);
        let dot = sign_dot(chain_dot(observe(Some(b"full"), None), Some(&prev)), &sk);
        let level = compute_level(&dot);
        // Has: observer, sig, chain, time, fhe, payload = 6
        assert_eq!(level, 6, "full dot should be level 6, got {}", level);
    }

    #[test]
    fn test_trust_increases_with_level() {
        let dot0 = DOT::default();
        let dot1 = observe(Some(b"hello"), None);
        assert!(compute_trust(&dot1) >= compute_trust(&dot0));
    }

    #[test]
    fn test_trust_bonus_for_verify() {
        let mut dot = DOT::default();
        dot.sign = Some(crate::types::SignData {
            observer: vec![0u8; 32],
            sig: vec![0u8; 64],
        });
        dot.verify = Some(VerifyData {
            valid: true,
            reason: None,
            checked: vec![],
        });
        let trust_with_verify = compute_trust(&dot);
        dot.verify = None;
        let trust_without = compute_trust(&dot);
        assert!(trust_with_verify > trust_without, "verify bonus not applied");
    }

    #[test]
    fn test_trust_bonus_for_deep_chain() {
        let mut dot = DOT::default();
        dot.chain = Some(ChainData {
            prev: vec![0u8; 32],
            depth: 10, // > 5
        });
        let trust_deep = compute_trust(&dot);
        dot.chain = Some(ChainData {
            prev: vec![0u8; 32],
            depth: 2, // <= 5
        });
        let trust_shallow = compute_trust(&dot);
        assert!(trust_deep > trust_shallow);
    }

    #[test]
    fn test_trust_max_is_reasonable() {
        init();
        let (_, sk) = generate_keypair();
        let prev = observe(Some(b"prev"), None);
        let mut dot = sign_dot(chain_dot(observe(Some(b"max trust"), None), Some(&prev)), &sk);
        // Add all bonus fields
        dot.verify = Some(VerifyData { valid: true, reason: None, checked: vec![] });
        if let Some(ref mut c) = dot.chain { c.depth = 10; }
        if let Some(ref mut t) = dot.time { t.seq = Some(1); }
        dot.meta = Some(crate::types::MetaData { entries: Default::default() });
        let trust = compute_trust(&dot);
        // Max: base=1.0 + 5*0.1 bonus = 1.5
        assert!(trust <= 1.5 + 1e-9, "trust {:.3} exceeds max 1.5", trust);
        assert!(trust > 0.8, "full dot trust should be high, got {:.3}", trust);
    }

    #[test]
    fn test_trust_without_bonuses() {
        init();
        let (_, sk) = generate_keypair();
        let dot = sign_dot(observe(Some(b"no bonus"), None), &sk);
        let trust = compute_trust(&dot);
        // Level 5 ÷ 6 = 0.833...
        assert!(trust > 0.0 && trust <= 1.0, "trust {:.3} out of range [0,1]", trust);
    }
}
