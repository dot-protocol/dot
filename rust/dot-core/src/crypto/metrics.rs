// Crypto operation metrics for DOT Protocol R854.
// Uses atomics for lock-free counting — safe for multi-threaded environments.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

static HASH_COUNT: AtomicU64 = AtomicU64::new(0);
static HASH_BYTES: AtomicU64 = AtomicU64::new(0);
static SIGN_COUNT: AtomicU64 = AtomicU64::new(0);
static SIGN_BYTES: AtomicU64 = AtomicU64::new(0);
static VERIFY_COUNT: AtomicU64 = AtomicU64::new(0);
static VERIFY_BYTES: AtomicU64 = AtomicU64::new(0);
static KEYGEN_COUNT: AtomicU64 = AtomicU64::new(0);

/// Snapshot of all crypto operation metrics.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CryptoMetrics {
    pub hash_count: u64,
    pub hash_bytes: u64,
    pub sign_count: u64,
    pub sign_bytes: u64,
    pub verify_count: u64,
    pub verify_bytes: u64,
    pub keygen_count: u64,
}

/// Record a hash operation.
pub fn record_hash(bytes: usize) {
    HASH_COUNT.fetch_add(1, Ordering::Relaxed);
    HASH_BYTES.fetch_add(bytes as u64, Ordering::Relaxed);
}

/// Record a sign operation.
pub fn record_sign(bytes: usize) {
    SIGN_COUNT.fetch_add(1, Ordering::Relaxed);
    SIGN_BYTES.fetch_add(bytes as u64, Ordering::Relaxed);
}

/// Record a verify operation.
pub fn record_verify(bytes: usize) {
    VERIFY_COUNT.fetch_add(1, Ordering::Relaxed);
    VERIFY_BYTES.fetch_add(bytes as u64, Ordering::Relaxed);
}

/// Record a keygen operation.
pub fn record_keygen() {
    KEYGEN_COUNT.fetch_add(1, Ordering::Relaxed);
}

/// Get a snapshot of all metrics.
pub fn get_crypto_metrics() -> CryptoMetrics {
    CryptoMetrics {
        hash_count: HASH_COUNT.load(Ordering::Relaxed),
        hash_bytes: HASH_BYTES.load(Ordering::Relaxed),
        sign_count: SIGN_COUNT.load(Ordering::Relaxed),
        sign_bytes: SIGN_BYTES.load(Ordering::Relaxed),
        verify_count: VERIFY_COUNT.load(Ordering::Relaxed),
        verify_bytes: VERIFY_BYTES.load(Ordering::Relaxed),
        keygen_count: KEYGEN_COUNT.load(Ordering::Relaxed),
    }
}

/// Reset all metrics to zero.
pub fn reset_metrics() {
    HASH_COUNT.store(0, Ordering::Relaxed);
    HASH_BYTES.store(0, Ordering::Relaxed);
    SIGN_COUNT.store(0, Ordering::Relaxed);
    SIGN_BYTES.store(0, Ordering::Relaxed);
    VERIFY_COUNT.store(0, Ordering::Relaxed);
    VERIFY_BYTES.store(0, Ordering::Relaxed);
    KEYGEN_COUNT.store(0, Ordering::Relaxed);
}

/// Time a closure and return (result, duration).
pub fn time_op<T, F: FnOnce() -> T>(f: F) -> (T, Duration) {
    let start = Instant::now();
    let result = f();
    let elapsed = start.elapsed();
    (result, elapsed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_start_at_zero_after_reset() {
        reset_metrics();
        let m = get_crypto_metrics();
        assert_eq!(m.hash_count, 0);
        assert_eq!(m.sign_count, 0);
        assert_eq!(m.verify_count, 0);
        assert_eq!(m.keygen_count, 0);
    }

    #[test]
    fn test_record_hash() {
        reset_metrics();
        record_hash(100);
        record_hash(200);
        let m = get_crypto_metrics();
        assert_eq!(m.hash_count, 2);
        assert_eq!(m.hash_bytes, 300);
    }

    #[test]
    fn test_record_sign() {
        reset_metrics();
        record_sign(50);
        let m = get_crypto_metrics();
        assert_eq!(m.sign_count, 1);
        assert_eq!(m.sign_bytes, 50);
    }

    #[test]
    fn test_record_verify() {
        reset_metrics();
        record_verify(75);
        let m = get_crypto_metrics();
        assert_eq!(m.verify_count, 1);
        assert_eq!(m.verify_bytes, 75);
    }

    #[test]
    fn test_record_keygen() {
        reset_metrics();
        record_keygen();
        record_keygen();
        let m = get_crypto_metrics();
        assert_eq!(m.keygen_count, 2);
    }

    #[test]
    fn test_reset_clears_all() {
        record_hash(10);
        record_sign(10);
        record_verify(10);
        record_keygen();
        reset_metrics();
        let m = get_crypto_metrics();
        assert_eq!(m.hash_count, 0);
        assert_eq!(m.sign_count, 0);
        assert_eq!(m.verify_count, 0);
        assert_eq!(m.keygen_count, 0);
    }

    #[test]
    fn test_time_op() {
        let (result, duration) = time_op(|| {
            let sum: u64 = (0..1000u64).sum();
            sum
        });
        assert_eq!(result, 499500);
        assert!(duration.as_nanos() > 0);
    }

    #[test]
    fn test_metrics_accumulate() {
        reset_metrics();
        for i in 0..10 {
            record_hash(i * 10);
        }
        let m = get_crypto_metrics();
        assert_eq!(m.hash_count, 10);
        assert_eq!(m.hash_bytes, (0..10u64).map(|i| i * 10).sum::<u64>());
    }
}
