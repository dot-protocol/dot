/**
 * Protocol tests — encode/decode roundtrip for all message types.
 * Target: 10+ tests.
 */

import { describe, it, expect } from 'vitest';
import { encodeMeshMessage, decodeMeshMessage } from '../src/protocol.js';
import type { MeshMessageType } from '../src/protocol.js';

const ALL_TYPES: MeshMessageType[] = ['dot', 'request', 'response', 'gossip', 'ping', 'pong'];

describe('encodeMeshMessage / decodeMeshMessage roundtrip', () => {
  it('roundtrip: dot message', () => {
    const msg = {
      type: 'dot' as MeshMessageType,
      payload: new TextEncoder().encode('hello-dot'),
      from: 'node-alpha',
    };
    const encoded = encodeMeshMessage(msg);
    const decoded = decodeMeshMessage(encoded);
    expect(decoded.type).toBe('dot');
    expect(new TextDecoder().decode(decoded.payload)).toBe('hello-dot');
    expect(decoded.from).toBe('node-alpha');
  });

  it('roundtrip: request message', () => {
    const hash = 'a'.repeat(64);
    const msg = {
      type: 'request' as MeshMessageType,
      payload: new TextEncoder().encode(hash),
      from: 'node-beta',
    };
    const decoded = decodeMeshMessage(encodeMeshMessage(msg));
    expect(decoded.type).toBe('request');
    expect(new TextDecoder().decode(decoded.payload)).toBe(hash);
    expect(decoded.from).toBe('node-beta');
  });

  it('roundtrip: response message', () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    const msg = { type: 'response' as MeshMessageType, payload, from: 'node-gamma' };
    const decoded = decodeMeshMessage(encodeMeshMessage(msg));
    expect(decoded.type).toBe('response');
    expect(decoded.payload).toEqual(payload);
  });

  it('roundtrip: gossip message', () => {
    const hashes = ['a'.repeat(64), 'b'.repeat(64)].join('\n');
    const msg = {
      type: 'gossip' as MeshMessageType,
      payload: new TextEncoder().encode(hashes),
      from: 'node-delta',
    };
    const decoded = decodeMeshMessage(encodeMeshMessage(msg));
    expect(decoded.type).toBe('gossip');
    expect(new TextDecoder().decode(decoded.payload)).toBe(hashes);
  });

  it('roundtrip: ping message (empty payload)', () => {
    const msg = { type: 'ping' as MeshMessageType, payload: new Uint8Array(0), from: 'node-echo' };
    const decoded = decodeMeshMessage(encodeMeshMessage(msg));
    expect(decoded.type).toBe('ping');
    expect(decoded.payload.length).toBe(0);
  });

  it('roundtrip: pong message (empty payload)', () => {
    const msg = { type: 'pong' as MeshMessageType, payload: new Uint8Array(0), from: 'node-foxtrot' };
    const decoded = decodeMeshMessage(encodeMeshMessage(msg));
    expect(decoded.type).toBe('pong');
    expect(decoded.from).toBe('node-foxtrot');
  });

  it('roundtrip: all message types preserve type byte', () => {
    for (const type of ALL_TYPES) {
      const msg = { type, payload: new Uint8Array(0), from: 'test-node' };
      const decoded = decodeMeshMessage(encodeMeshMessage(msg));
      expect(decoded.type).toBe(type);
    }
  });

  it('large payload roundtrip (64KB)', () => {
    const payload = new Uint8Array(65536).fill(0xab);
    const msg = { type: 'dot' as MeshMessageType, payload, from: 'big-node' };
    const decoded = decodeMeshMessage(encodeMeshMessage(msg));
    expect(decoded.payload.length).toBe(65536);
    expect(decoded.payload[0]).toBe(0xab);
  });

  it('from field with long node ID (64 hex chars)', () => {
    const from = 'f'.repeat(64);
    const msg = { type: 'request' as MeshMessageType, payload: new Uint8Array(0), from };
    const decoded = decodeMeshMessage(encodeMeshMessage(msg));
    expect(decoded.from).toBe(from);
  });

  it('throws on too-short input (less than 7 bytes)', () => {
    expect(() => decodeMeshMessage(new Uint8Array([0x01, 0x00]))).toThrow();
  });

  it('throws on unknown type byte', () => {
    const buf = new Uint8Array(7);
    buf[0] = 0xff; // unknown type
    // length = 0
    buf[1] = 0;
    buf[2] = 0;
    buf[3] = 0;
    buf[4] = 0;
    // from length = 0
    buf[5] = 0;
    buf[6] = 0;
    expect(() => decodeMeshMessage(buf)).toThrow();
  });

  it('encoded bytes start with correct type byte', () => {
    const msg = { type: 'dot' as MeshMessageType, payload: new Uint8Array(0), from: 'x' };
    const encoded = encodeMeshMessage(msg);
    expect(encoded[0]).toBe(0x01); // dot = 0x01
  });

  it('encoded bytes for ping start with 0x05', () => {
    const msg = { type: 'ping' as MeshMessageType, payload: new Uint8Array(0), from: 'x' };
    const encoded = encodeMeshMessage(msg);
    expect(encoded[0]).toBe(0x05);
  });
});
