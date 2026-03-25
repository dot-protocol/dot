/**
 * iroh-transport.test.ts — Tests for IrohDotTransport stub behavior.
 *
 * Verifies that:
 *   - All methods throw IrohTransportNotConnectedError
 *   - Error messages reference specific iroh API calls
 *   - Error class name is correct
 *   - Config options are accepted without throwing
 */

import { describe, it, expect } from 'vitest';
import { IrohDotTransport, IrohTransportNotConnectedError } from '../src/iroh-transport.js';

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

describe('IrohTransportNotConnectedError', () => {
  it('has name IrohTransportNotConnectedError', () => {
    const err = new IrohTransportNotConnectedError('test()', 'API call', 'Notes');
    expect(err.name).toBe('IrohTransportNotConnectedError');
  });

  it('message includes the method name', () => {
    const err = new IrohTransportNotConnectedError('nodeId()', 'API', 'Notes');
    expect(err.message).toContain('nodeId()');
  });

  it('irohApiCall field is accessible', () => {
    const err = new IrohTransportNotConnectedError('method', 'GET /node/id', 'Notes');
    expect(err.irohApiCall).toBe('GET /node/id');
  });

  it('integrationNotes field is accessible', () => {
    const err = new IrohTransportNotConnectedError('method', 'API', 'Start iroh first');
    expect(err.integrationNotes).toBe('Start iroh first');
  });

  it('is an instanceof Error', () => {
    const err = new IrohTransportNotConnectedError('m', 'a', 'n');
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// IrohDotTransport — stub behavior
// ---------------------------------------------------------------------------

describe('IrohDotTransport — all methods throw', () => {
  const transport = new IrohDotTransport();

  it('nodeId() throws IrohTransportNotConnectedError', () => {
    expect(() => transport.nodeId()).toThrow(IrohTransportNotConnectedError);
  });

  it('nodeId() error message references iroh node/id endpoint', () => {
    try {
      transport.nodeId();
    } catch (e) {
      expect((e as IrohTransportNotConnectedError).irohApiCall).toContain('/node/id');
    }
  });

  it('createRoom() throws IrohTransportNotConnectedError', async () => {
    await expect(transport.createRoom('test-room')).rejects.toThrow(IrohTransportNotConnectedError);
  });

  it('createRoom() error message references iroh docs/create endpoint', async () => {
    try {
      await transport.createRoom('room');
    } catch (e) {
      expect((e as IrohTransportNotConnectedError).irohApiCall).toContain('docs/create');
    }
  });

  it('joinRoom() throws IrohTransportNotConnectedError', async () => {
    await expect(transport.joinRoom('test-room')).rejects.toThrow(IrohTransportNotConnectedError);
  });

  it('listRooms() throws IrohTransportNotConnectedError', async () => {
    await expect(transport.listRooms()).rejects.toThrow(IrohTransportNotConnectedError);
  });

  it('publishDot() throws IrohTransportNotConnectedError', async () => {
    const fakeRoom = { name: 'r', id: 'abc', memberCount: 0, dotCount: 0 };
    const fakeDot = {};
    await expect(transport.publishDot(fakeRoom, fakeDot)).rejects.toThrow(IrohTransportNotConnectedError);
  });

  it('subscribeDots() throws IrohTransportNotConnectedError', () => {
    const fakeRoom = { name: 'r', id: 'abc', memberCount: 0, dotCount: 0 };
    expect(() => transport.subscribeDots(fakeRoom, () => {})).toThrow(IrohTransportNotConnectedError);
  });

  it('sync() throws IrohTransportNotConnectedError', async () => {
    const fakeRoom = { name: 'r', id: 'abc', memberCount: 0, dotCount: 0 };
    await expect(transport.sync(fakeRoom)).rejects.toThrow(IrohTransportNotConnectedError);
  });

  it('getSyncStatus() throws IrohTransportNotConnectedError', () => {
    const fakeRoom = { name: 'r', id: 'abc', memberCount: 0, dotCount: 0 };
    expect(() => transport.getSyncStatus(fakeRoom)).toThrow(IrohTransportNotConnectedError);
  });

  it('connectPeer() throws IrohTransportNotConnectedError', async () => {
    await expect(transport.connectPeer('node-id')).rejects.toThrow(IrohTransportNotConnectedError);
  });

  it('disconnectPeer() throws IrohTransportNotConnectedError', () => {
    expect(() => transport.disconnectPeer('node-id')).toThrow(IrohTransportNotConnectedError);
  });

  it('connectedPeers() throws IrohTransportNotConnectedError', () => {
    expect(() => transport.connectedPeers()).toThrow(IrohTransportNotConnectedError);
  });

  it('shutdown() throws IrohTransportNotConnectedError', async () => {
    await expect(transport.shutdown()).rejects.toThrow(IrohTransportNotConnectedError);
  });
});

// ---------------------------------------------------------------------------
// IrohDotTransport — config acceptance
// ---------------------------------------------------------------------------

describe('IrohDotTransport — config', () => {
  it('constructs with no config (default stub mode)', () => {
    expect(() => new IrohDotTransport()).not.toThrow();
  });

  it('constructs with http mode config', () => {
    expect(
      () => new IrohDotTransport({ mode: 'http', rpcUrl: 'http://127.0.0.1:11204' }),
    ).not.toThrow();
  });

  it('constructs with custom rpcUrl', () => {
    expect(
      () => new IrohDotTransport({ rpcUrl: 'http://192.168.1.1:11204' }),
    ).not.toThrow();
  });

  it('error message contains "iroh runtime"', () => {
    const t = new IrohDotTransport();
    try {
      t.nodeId();
    } catch (e) {
      expect((e as Error).message).toContain('iroh runtime');
    }
  });
});
