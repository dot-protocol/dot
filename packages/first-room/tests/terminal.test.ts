/**
 * terminal.test.ts — Tests for the terminal-style text renderer.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import { createFirstRoom, addObservation, addMember } from '../src/room-chain.js';
import { renderTerminal, renderChainHex } from '../src/terminal.js';
import type { FirstRoom } from '../src/room-chain.js';

describe('renderTerminal', () => {
  let room: FirstRoom;

  beforeEach(async () => {
    room = await createFirstRoom();
  });

  it('output contains the room name', async () => {
    const out = renderTerminal(room);
    expect(out).toContain('.the.first.room');
  });

  it('output starts with a box-drawing top border', async () => {
    const out = renderTerminal(room);
    expect(out).toMatch(/^┌/);
  });

  it('output ends with a box-drawing bottom border', async () => {
    const out = renderTerminal(room);
    expect(out.trim()).toMatch(/└─+┘$/);
  });

  it('output contains genesis DOT content', async () => {
    const out = renderTerminal(room);
    expect(out).toContain('The first room. Where observation begins.');
  });

  it('output contains "genesis" type label', async () => {
    const out = renderTerminal(room);
    expect(out).toContain('genesis');
  });

  it('output contains DOT count', async () => {
    const out = renderTerminal(room);
    expect(out).toMatch(/1 DOTs?/);
  });

  it('output contains member count', async () => {
    const out = renderTerminal(room);
    expect(out).toMatch(/0 members?/);
  });

  it('output contains chain verified status', async () => {
    const out = renderTerminal(room);
    expect(out).toContain('chain verified ✓');
  });

  it('shows added observation content', async () => {
    const id = await createIdentity();
    await addObservation(room, 'Hello from the room', id);
    const out = renderTerminal(room);
    expect(out).toContain('Hello from the room');
  });

  it('shows observer shortcode for observations', async () => {
    const id = await createIdentity();
    await addObservation(room, 'obs', id);
    const out = renderTerminal(room);
    // Observer shortcode pattern: 8 hex chars
    expect(out).toMatch(/[0-9a-f]{8}/);
  });

  it('shows depth in observation lines', async () => {
    const id = await createIdentity();
    await addObservation(room, 'depth test', id);
    const out = renderTerminal(room);
    expect(out).toContain('depth:');
  });

  it('shows trust score for observations', async () => {
    const id = await createIdentity();
    await addObservation(room, 'trust test', id);
    const out = renderTerminal(room);
    expect(out).toContain('trust:');
  });

  it('shows member name after addMember', async () => {
    const id = await createIdentity();
    await addMember(room, 'Blaze', id);
    const out = renderTerminal(room);
    expect(out).toContain('Blaze');
  });

  it('dot count increases after adding observations', async () => {
    const id = await createIdentity();
    await addObservation(room, 'one', id);
    await addObservation(room, 'two', id);
    const out = renderTerminal(room);
    expect(out).toContain('3 DOTs');
  });

  it('contains hash fragment for each DOT', async () => {
    const out = renderTerminal(room);
    // Should have at least one truncated hash like [abc12345...]
    expect(out).toMatch(/\[[0-9a-f]+\.\.\.\]/);
  });
});

describe('renderChainHex', () => {
  let room: FirstRoom;

  beforeEach(async () => {
    room = await createFirstRoom();
  });

  it('output contains the room name comment', async () => {
    const out = renderChainHex(room);
    expect(out).toContain('.the.first.room');
  });

  it('output contains "genesis" label', async () => {
    const out = renderChainHex(room);
    expect(out).toContain('genesis');
  });

  it('output contains hex hash fragment', async () => {
    const out = renderChainHex(room);
    expect(out).toMatch(/[0-9a-f]{16}/);
  });

  it('output contains "DOT #0"', async () => {
    const out = renderChainHex(room);
    expect(out).toContain('DOT #0');
  });

  it('output contains verified status', async () => {
    const out = renderChainHex(room);
    expect(out).toContain('verified ✓');
  });

  it('output contains payload hex', async () => {
    const out = renderChainHex(room);
    expect(out).toContain('payload:');
  });

  it('output contains chain reference', async () => {
    const out = renderChainHex(room);
    expect(out).toContain('chain:');
  });

  it('output contains time reference', async () => {
    const out = renderChainHex(room);
    expect(out).toContain('time:');
  });

  it('shows multiple DOT entries after adding observations', async () => {
    const id = await createIdentity();
    await addObservation(room, 'a', id);
    await addObservation(room, 'b', id);
    const out = renderChainHex(room);
    expect(out).toContain('DOT #0');
    expect(out).toContain('DOT #1');
    expect(out).toContain('DOT #2');
  });

  it('is a valid string (no exceptions thrown)', async () => {
    const id = await createIdentity();
    await addObservation(room, 'hex test', id);
    expect(() => renderChainHex(room)).not.toThrow();
  });
});
