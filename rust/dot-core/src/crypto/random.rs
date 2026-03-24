// Cryptographic random bytes via sodiumoxide for DOT Protocol R854.

/// Generate `n` cryptographically secure random bytes.
pub fn random_bytes(n: usize) -> Vec<u8> {
    sodiumoxide::randombytes::randombytes(n)
}

/// Generate a random 32-byte seed suitable for key generation.
pub fn random_seed() -> [u8; 32] {
    let bytes = random_bytes(32);
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    arr
}

/// Generate a random nonce of `n` bytes.
pub fn random_nonce(n: usize) -> Vec<u8> {
    random_bytes(n)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn init() {
        let _ = sodiumoxide::init();
    }

    #[test]
    fn test_random_bytes_length() {
        init();
        let bytes = random_bytes(32);
        assert_eq!(bytes.len(), 32);
    }

    #[test]
    fn test_random_bytes_zero_length() {
        init();
        let bytes = random_bytes(0);
        assert_eq!(bytes.len(), 0);
    }

    #[test]
    fn test_random_bytes_large() {
        init();
        let bytes = random_bytes(4096);
        assert_eq!(bytes.len(), 4096);
    }

    #[test]
    fn test_random_bytes_unique() {
        init();
        let b1 = random_bytes(32);
        let b2 = random_bytes(32);
        // Astronomically unlikely to collide
        assert_ne!(b1, b2);
    }

    #[test]
    fn test_random_seed_length() {
        init();
        let seed = random_seed();
        assert_eq!(seed.len(), 32);
    }

    #[test]
    fn test_random_seed_unique() {
        init();
        let s1 = random_seed();
        let s2 = random_seed();
        assert_ne!(s1, s2);
    }

    #[test]
    fn test_random_nonce_length() {
        init();
        let nonce = random_nonce(12);
        assert_eq!(nonce.len(), 12);
    }

    #[test]
    fn test_random_bytes_not_all_zero() {
        init();
        let bytes = random_bytes(64);
        // Should not be all zeros (astronomically unlikely)
        assert!(bytes.iter().any(|&b| b != 0));
    }
}
