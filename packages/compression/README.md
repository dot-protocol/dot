# @dotprotocol/compression

DOT Protocol stream compression: batch v2, varint deltas, RLE, dictionary compression, prediction, rANS, and benchmark scoring.

[![npm](https://img.shields.io/npm/v/@dotprotocol/compression)](https://www.npmjs.com/package/@dotprotocol/compression)

## Install

```bash
npm install @dotprotocol/compression
```

## Quick start

```js
import { createBLSKeypair } from '@dot-protocol/core';
import { serializeBatchV2, deserializeBatchV2 } from '@dotprotocol/compression';

const blsKeypair = createBLSKeypair();

// Pack a chain of 153-byte DOT buffers into a column-oriented frame.
const frame = await serializeBatchV2(dotBytes, blsKeypair, {
  timestampDelta: true,
  payloadTypeRLE: true,
});

// Recover DOT buffers and verify the BLS aggregate signature.
const recovered = await deserializeBatchV2(frame, blsKeypair.publicKey);
```

## When to use

- Storing large numbers of DOTs in a database
- Transmitting batches over bandwidth-constrained channels
- Archiving worldlines
- Feed snapshots

## API

### `serializeBatchV2(dots, blsKeypair, options?)`

Serialize same-signer DOT buffers into a batch v2 frame. The frame uses a BLS aggregate signature and can encode timestamps as varint deltas, payload types with RLE, payloads with prediction+rANS, or the body with a zstd dictionary.

```js
const frame = await serializeBatchV2(dotBytes, blsKeypair, {
  timestampDelta: true,
  payloadTypeRLE: true,
  predictor: 'auto',
});
```

### `deserializeBatchV2(frame, blsPublicKey, options?)`

Deserialize a batch v2 frame back into DOT buffers and verify the BLS aggregate signature. Dictionary-compressed frames require a registry containing the matching dictionary id.

```js
const dots = await deserializeBatchV2(frame, blsPublicKey, {
  dictionaryRegistry,
});
```

### `DictionaryRegistry`

Register and persist zstd dictionaries by deterministic SHA-256 id.

```js
import { DictionaryRegistry } from '@dotprotocol/compression';

const registry = new DictionaryRegistry();
const dictionaryId = await registry.register(dictionaryBytes, 'sensor-v1');
const saved = registry.export();
const restored = DictionaryRegistry.import(saved);
```

### Lower-level modules

The package also exports the building blocks used by batch v2:

- `encodeVarint` / `decodeVarint`
- `encodeTimestampDeltas` / `decodeTimestampDeltas`
- `encodePayloadTypes` / `decodePayloadTypes`
- `NullPredictor`, `LastValuePredictor`, `LinearPredictor`
- `buildFrequencyTable`, `ransEncode`, `ransDecode`
- `trainDictionary`, `compressWithDictionary`, `decompressWithDictionary`
- `generateSensorStream`
- `weissmanScore`

## Utilities

Generate realistic DOT streams for benchmarks and tests:

```js
import { generateSensorStream } from '@dotprotocol/compression';

const dots = await generateSensorStream({
  count: 1000,
  profile: 'kulhadVoltage',
});
```

## Compression ratios

Actual ratios depend on payload entropy, timestamp regularity, type repetition, dictionary quality, and predictor fit. The checked-in benchmark tests compare raw DOT bytes, plain batch v2, dictionary batch v2, predictor+rANS, and gzip baselines.

Use `weissmanScore` and the benchmark suites under `src/tests/` for reproducible measurements against the current implementation.

## Scripts

```bash
pnpm --filter @dotprotocol/compression test
pnpm --filter @dotprotocol/compression typecheck
```

## License

MIT
