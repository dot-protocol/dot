// DOT Protocol R854 — Core benchmarks using Criterion.
// Targets: sign < 1ms, verify < 0.5ms, hash(1KB) < 0.01ms.

use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId};
use dot_core::{
    observe, sign_dot, verify_dot, chain_dot, to_bytes, from_bytes,
    generate_keypair, hash, ObserveOptions, init,
};

fn setup() {
    init().unwrap();
}

fn bench_sign(c: &mut Criterion) {
    setup();
    let (_, sk) = generate_keypair();
    let dot = observe(Some(b"benchmark payload"), Some(ObserveOptions { plaintext: true, ..Default::default() }));
    c.bench_function("sign_dot", |b| {
        b.iter(|| {
            sign_dot(dot.clone(), &sk)
        });
    });
}

fn bench_verify(c: &mut Criterion) {
    setup();
    let (_, sk) = generate_keypair();
    let dot = sign_dot(observe(Some(b"bench verify"), None), &sk);
    c.bench_function("verify_dot", |b| {
        b.iter(|| {
            verify_dot(&dot)
        });
    });
}

fn bench_hash_sizes(c: &mut Criterion) {
    setup();
    let sizes = [64, 256, 1024, 4096, 65536];
    let mut group = c.benchmark_group("blake3_hash");
    for size in sizes {
        let data = vec![0x42u8; size];
        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}B", size)),
            &data,
            |b, data| {
                b.iter(|| hash(data));
            },
        );
    }
    group.finish();
}

fn bench_encode_decode(c: &mut Criterion) {
    setup();
    let (_, sk) = generate_keypair();
    let dot = sign_dot(observe(Some(b"encode decode bench"), None), &sk);
    let bytes = to_bytes(&dot);

    c.bench_function("encode_to_bytes", |b| {
        b.iter(|| to_bytes(&dot));
    });

    c.bench_function("decode_from_bytes", |b| {
        b.iter(|| from_bytes(&bytes).unwrap());
    });
}

fn bench_observe(c: &mut Criterion) {
    c.bench_function("observe_no_payload", |b| {
        b.iter(|| observe(None, None));
    });

    c.bench_function("observe_with_payload_fhe", |b| {
        b.iter(|| observe(Some(b"benchmark data 32 bytes exactly!!"), None));
    });
}

fn bench_chain(c: &mut Criterion) {
    setup();
    let (_, sk) = generate_keypair();
    let prev = sign_dot(observe(Some(b"prev"), None), &sk);

    c.bench_function("chain_dot", |b| {
        b.iter(|| {
            let next = observe(Some(b"next"), None);
            chain_dot(next, Some(&prev))
        });
    });
}

fn bench_full_pipeline(c: &mut Criterion) {
    setup();
    let (_, sk) = generate_keypair();
    let genesis = sign_dot(observe(Some(b"genesis"), None), &sk);

    c.bench_function("observe_sign_chain_verify", |b| {
        b.iter(|| {
            let dot = observe(Some(b"pipeline bench"), None);
            let signed = sign_dot(dot, &sk);
            let chained = chain_dot(signed, Some(&genesis));
            let result = verify_dot(&chained);
            assert!(result.valid);
        });
    });
}

fn bench_keygen(c: &mut Criterion) {
    setup();
    c.bench_function("generate_keypair", |b| {
        b.iter(|| generate_keypair());
    });
}

criterion_group!(
    benches,
    bench_sign,
    bench_verify,
    bench_hash_sizes,
    bench_encode_decode,
    bench_observe,
    bench_chain,
    bench_full_pipeline,
    bench_keygen,
);
criterion_main!(benches);
