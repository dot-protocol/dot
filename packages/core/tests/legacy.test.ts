import { describe, expect, it } from 'vitest';
import {
  DotType,
  aggregateSignatures,
  batchPackBLS,
  checkChain,
  createBLSKeypair,
  createDOT,
  createKeypair,
  fromBytes,
  signBLS,
  toBytes,
  verifyAggregateSameSigner,
  verifyDOT,
} from '../src/index.js';

describe('legacy fixed-width DOT compatibility', () => {
  it('creates, encodes, decodes, and verifies a 153-byte DOT', async () => {
    const keypair = await createKeypair(new Uint8Array(32).fill(7));
    const dot = await createDOT({
      keypair,
      payload: new Uint8Array([1, 2, 3]),
      type: DotType.PUBLIC,
      ts: 1_700_000_000_000,
    });

    const bytes = toBytes(dot);
    expect(bytes).toHaveLength(153);
    expect(await verifyDOT(dot)).toBe(true);

    const decoded = fromBytes(bytes) as unknown as typeof dot;
    expect(decoded.pubkey).toEqual(dot.pubkey);
    expect(decoded.sig).toEqual(dot.sig);
    expect(await verifyDOT(decoded)).toBe(true);
  });

  it('chains legacy DOTs from previous fixed-width bytes', async () => {
    const keypair = await createKeypair(new Uint8Array(32).fill(9));
    const first = await createDOT({ keypair, ts: 1n });
    const second = await createDOT({ keypair, previous: toBytes(first), ts: 2n });

    expect(await checkChain([first, second])).toEqual({ valid: true });
  });

  it('verifies pseudo-BLS aggregates for one signer', () => {
    const keypair = createBLSKeypair();
    const messages = [new Uint8Array([1]), new Uint8Array([2])];
    const signatures = messages.map((message) => signBLS(message, keypair.privateKey));
    const aggregate = aggregateSignatures(signatures);

    expect(aggregate).toHaveLength(48);
    expect(verifyAggregateSameSigner(aggregate, messages, keypair.publicKey)).toBe(true);
  });

  it('packs a legacy v1 BLS frame with documented sizing', async () => {
    const keypair = await createKeypair(new Uint8Array(32).fill(11));
    const blsKeypair = createBLSKeypair();
    const dot = await createDOT({ keypair, ts: 1n });
    const frame = await batchPackBLS([toBytes(dot)], blsKeypair);

    expect(frame).toHaveLength(44 + 18 + 48);
  });
});
