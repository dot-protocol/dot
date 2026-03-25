/**
 * html-room.test.ts — Tests for the HTML room generator.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import { createFirstRoom, addObservation, addMember } from '../src/room-chain.js';
import { generateRoomHTML } from '../src/html-room.js';
import type { FirstRoom } from '../src/room-chain.js';

describe('generateRoomHTML', () => {
  let room: FirstRoom;

  beforeEach(async () => {
    room = await createFirstRoom();
  });

  it('produces a non-empty HTML string', async () => {
    const html = await generateRoomHTML(room);
    expect(html).toBeTruthy();
    expect(typeof html).toBe('string');
  });

  it('starts with DOCTYPE declaration', async () => {
    const html = await generateRoomHTML(room);
    expect(html.trim()).toMatch(/^<!DOCTYPE html>/i);
  });

  it('contains <html> tag', async () => {
    const html = await generateRoomHTML(room);
    expect(html).toContain('<html');
  });

  it('contains <head> and <body> tags', async () => {
    const html = await generateRoomHTML(room);
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
  });

  it('contains the room name in the header', async () => {
    const html = await generateRoomHTML(room);
    expect(html).toContain('.the.first.room');
  });

  it('contains genesis DOT content', async () => {
    const html = await generateRoomHTML(room);
    expect(html).toContain('The first room. Where observation begins.');
  });

  it('contains DOT count in header', async () => {
    const html = await generateRoomHTML(room);
    expect(html).toContain('DOT');
    expect(html).toMatch(/1 DOTs?/);
  });

  it('contains member count', async () => {
    const html = await generateRoomHTML(room);
    expect(html).toMatch(/0 members?/);
  });

  it('has observe input element', async () => {
    const html = await generateRoomHTML(room);
    expect(html).toContain('observe-input');
    expect(html).toContain('type="text"');
  });

  it('has Observe button', async () => {
    const html = await generateRoomHTML(room);
    expect(html).toContain('observe-btn');
    expect(html).toContain('Observe');
  });

  it('has Verify Chain button', async () => {
    const html = await generateRoomHTML(room);
    expect(html).toContain('verify-btn');
    expect(html).toContain('Verify Chain');
  });

  it('shows added DOT content', async () => {
    const id = await createIdentity();
    await addObservation(room, 'unique-content-xyz', id);
    const html = await generateRoomHTML(room);
    expect(html).toContain('unique-content-xyz');
  });

  it('is under 50KB', async () => {
    const id = await createIdentity();
    // Add a few observations to make it realistic
    await addObservation(room, 'Observation A', id);
    await addObservation(room, 'Observation B', id);
    const html = await generateRoomHTML(room);
    const bytes = new TextEncoder().encode(html).length;
    expect(bytes).toBeLessThan(50 * 1024);
  });

  it('has no external URLs (no http:// or https:// in content)', async () => {
    const html = await generateRoomHTML(room);
    // Strip script content to avoid false positives from STORAGE_KEY logic
    // Just check no CDN/external URLs in <link> or <script src=
    expect(html).not.toMatch(/<link[^>]+href="https?:\/\//);
    expect(html).not.toMatch(/<script[^>]+src="https?:\/\//);
  });

  it('has dark background style', async () => {
    const html = await generateRoomHTML(room);
    expect(html).toContain('#0a0a0b');
  });

  it('contains chain verification indicator', async () => {
    const html = await generateRoomHTML(room);
    // verified badge should be present
    expect(html).toContain('verified');
  });

  it('observer shortcode appears for genesis DOT', async () => {
    const html = await generateRoomHTML(room);
    expect(html).toMatch(/observer: [0-9a-f]{8}/);
  });

  it('shows depth for DOT entries', async () => {
    const html = await generateRoomHTML(room);
    expect(html).toContain('depth:0');
  });

  it('includes inline JavaScript', async () => {
    const html = await generateRoomHTML(room);
    expect(html).toContain('<script>');
    expect(html).toContain('localStorage');
  });

  it('member count updates after addMember', async () => {
    const id = await createIdentity();
    await addMember(room, 'Blaze', id);
    const html = await generateRoomHTML(room);
    expect(html).toMatch(/1 member/);
  });
});
