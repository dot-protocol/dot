# Contributing to DOT Protocol

Every contribution is a DOT. Every commit is an observation.

## Quick Start

git clone https://github.com/dot-protocol/dot
cd dot
pnpm install
pnpm test        # 3,000+ tests
cargo test       # 275 Rust tests

## Commit Messages

Every commit message follows the DOT observation format:

observe event: "what you did" .chain(previous: "why it matters")

Examples:
- observe event: "add CRDT merge for chain forks" .chain(previous: "multi-device sync needed this")
- observe event: "fix TLV decoder on truncated input" .chain(previous: "fuzz testing found the crash")
- observe event: "add Hypatia mind with primary sources" .chain(previous: "10 core minds needed for .the.first.room")

## Package Structure

Each package follows the same layout:
packages/{name}/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts      # Public API exports only
│   ├── types.ts      # Types and interfaces
│   └── *.ts          # Implementation
└── tests/
    └── *.test.ts     # Tests (vitest)

## Adding a Package

1. Create directory under packages/
2. Add package.json with workspace deps
3. Add tsconfig.json extending root
4. Write source in src/
5. Write tests in tests/
6. Export from src/index.ts
7. Run pnpm test from root to verify

## Adding a Mind

1. Create packages/minds/src/{name}.ts
2. Follow the pattern in feynman.ts
3. Include REAL primary source quotes (not summaries)
4. Create test file packages/minds/tests/{name}.test.ts
5. Export from packages/minds/src/index.ts

## Code Standards

- TypeScript: strict mode, no `any`
- Every public function has JSDoc
- Every package exports health(): DOT (self-awareness)
- Result types for functions that can fail (see core/src/result.ts)
- BLAKE3 for all hashing. Ed25519 for all signing.
- Apache-2.0 license on everything

## Tests

- Every package has tests in tests/ or src/__tests__/
- Minimum: 3 tests per public function (happy, edge, error)
- Property-based tests for crypto (see core/tests/property.test.ts)
- Fuzz tests for encoders/decoders (see core/tests/fuzz.test.ts)
- Run: pnpm test (all TS) or cargo test (Rust)

## The DOT Language

.dot files are programs. See packages/selfhost/programs/ for examples.
The lang package parses them. The compiler compiles them.

## Pull Requests

1. Fork the repo
2. Create a branch (observe-event-description)
3. Write code + tests
4. Run pnpm test (must pass)
5. Submit PR with DOT observation as title

## Code of Conduct

Be curious. Be honest. Cite your sources. The wound is the place where the light enters you.
