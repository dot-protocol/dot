/**
 * bridge.test.ts — Tests for the Bridge DOT (generation-linking bond DOT).
 * 15+ tests covering creation, structure, signing, and R854 verifiability.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { verify, createIdentity } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { createBridgeDOT, type BridgePayload } from '../src/bridge-dot.js';
import { genKeyPair } from './helpers.js';

describe('createBridgeDOT — structure', () => {
  let bridgeDot: DOT;
  let legacyRoot: Uint8Array;
  let r854Root: Uint8Array;

  beforeAll(async () => {
    legacyRoot = crypto.getRandomValues(new Uint8Array(32));
    r854Root = crypto.getRandomValues(new Uint8Array(32));
    const { secretKey } = await createIdentity();
    bridgeDot = await createBridgeDOT(legacyRoot, 10, r854Root, secretKey);
  });

  it('type is bond', () => {
    expect(bridgeDot.type).toBe('bond');
  });

  it('payload is present', () => {
    expect(bridgeDot.payload).toBeDefined();
    expect(bridgeDot.payload!.length).toBeGreaterThan(0);
  });

  it('payload_mode is plain', () => {
    expect(bridgeDot.payload_mode).toBe('plain');
  });

  it('payload is valid JSON', () => {
    const text = new TextDecoder().decode(bridgeDot.payload);
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it('payload contains ancestor descriptor', () => {
    const text = new TextDecoder().decode(bridgeDot.payload);
    const parsed = JSON.parse(text) as BridgePayload;
    expect(parsed.ancestor).toBeDefined();
    expect(parsed.ancestor.hash_algo).toBe('sha256');
    expect(parsed.ancestor.format).toBe('v030-153byte');
  });

  it('payload contains descendant descriptor', () => {
    const text = new TextDecoder().decode(bridgeDot.payload);
    const parsed = JSON.parse(text) as BridgePayload;
    expect(parsed.descendant).toBeDefined();
    expect(parsed.descendant.hash_algo).toBe('blake3');
    expect(parsed.descendant.format).toBe('r854-tlv');
  });

  it('ancestor root matches input (hex)', () => {
    const text = new TextDecoder().decode(bridgeDot.payload);
    const parsed = JSON.parse(text) as BridgePayload;
    const expectedHex = Array.from(legacyRoot)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(parsed.ancestor.root).toBe(expectedHex);
  });

  it('descendant root matches input (hex)', () => {
    const text = new TextDecoder().decode(bridgeDot.payload);
    const parsed = JSON.parse(text) as BridgePayload;
    const expectedHex = Array.from(r854Root)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(parsed.descendant.root).toBe(expectedHex);
  });

  it('legacy depth is embedded', () => {
    const text = new TextDecoder().decode(bridgeDot.payload);
    const parsed = JSON.parse(text) as BridgePayload;
    expect(parsed.ancestor.depth).toBe(10);
  });

  it('descendant depth is 0', () => {
    const text = new TextDecoder().decode(bridgeDot.payload);
    const parsed = JSON.parse(text) as BridgePayload;
    expect(parsed.descendant.depth).toBe(0);
  });

  it('attestation field is present', () => {
    const text = new TextDecoder().decode(bridgeDot.payload);
    const parsed = JSON.parse(text) as BridgePayload;
    expect(parsed.attestation).toBeTruthy();
    expect(typeof parsed.attestation).toBe('string');
  });
});

describe('createBridgeDOT — signing', () => {
  it('is signed (sign.signature present)', async () => {
    const { secretKey } = await createIdentity();
    const dot = await createBridgeDOT(
      new Uint8Array(32),
      0,
      new Uint8Array(32),
      secretKey,
    );
    expect(dot.sign?.signature).toBeDefined();
    expect(dot.sign?.signature).toHaveLength(64);
  });

  it('sign.observer is present (32 bytes)', async () => {
    const { secretKey } = await createIdentity();
    const dot = await createBridgeDOT(
      new Uint8Array(32),
      0,
      new Uint8Array(32),
      secretKey,
    );
    expect(dot.sign?.observer).toHaveLength(32);
  });

  it('is verifiable in R854', async () => {
    const { secretKey } = await createIdentity();
    const dot = await createBridgeDOT(
      crypto.getRandomValues(new Uint8Array(32)),
      5,
      crypto.getRandomValues(new Uint8Array(32)),
      secretKey,
    );
    const result = await verify(dot);
    expect(result.valid).toBe(true);
    expect(result.checked).toContain('signature');
  });

  it('different keys produce different bridge DOTs', async () => {
    const { secretKey: sk1 } = await createIdentity();
    const { secretKey: sk2 } = await createIdentity();
    const root = crypto.getRandomValues(new Uint8Array(32));
    const d1 = await createBridgeDOT(root, 3, root, sk1);
    const d2 = await createBridgeDOT(root, 3, root, sk2);
    expect(d1.sign?.observer).not.toEqual(d2.sign?.observer);
    expect(d1.sign?.signature).not.toEqual(d2.sign?.signature);
  });
});

describe('createBridgeDOT — chain base', () => {
  it('has a chain base (genesis)', async () => {
    const { secretKey } = await createIdentity();
    const dot = await createBridgeDOT(
      new Uint8Array(32),
      0,
      new Uint8Array(32),
      secretKey,
    );
    expect(dot.chain).toBeDefined();
    expect(dot.chain?.previous).toBeDefined();
  });
});
