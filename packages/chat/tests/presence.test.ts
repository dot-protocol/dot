/**
 * presence.test.ts — Member presence tests for @dot-protocol/chat.
 * Target: 15+ tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import {
  createChatRoom,
} from '../src/chat.js';
import {
  setTyping,
  updatePresence,
  getOnlineMembers,
  getTypingMembers,
} from '../src/presence.js';
import type { ChatRoom } from '../src/types.js';

describe('setTyping', () => {
  it('creates a DOT in the room chain', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    const countBefore = chat.room.chain.appendCount;
    await setTyping(chat, alice, true);
    expect(chat.room.chain.appendCount).toBe(countBefore + 1);
  });

  it('member typing state is set to true', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    await setTyping(chat, alice, true);
    const typingMembers = getTypingMembers(chat);
    expect(typingMembers.length).toBeGreaterThan(0);
  });

  it('member typing state is cleared when isTyping = false', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    await setTyping(chat, alice, true);
    await setTyping(chat, alice, false);
    const typingMembers = getTypingMembers(chat);
    expect(typingMembers.length).toBe(0);
  });

  it('unknown identity auto-creates a member entry', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    const stranger = await createIdentity();
    await setTyping(chat, stranger, true);
    const typingMembers = getTypingMembers(chat);
    expect(typingMembers.some(m => m.typing)).toBe(true);
  });

  it('multiple members can type simultaneously', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    const bob = await createIdentity();
    await setTyping(chat, alice, true);
    await setTyping(chat, bob, true);
    const typingMembers = getTypingMembers(chat);
    expect(typingMembers.length).toBeGreaterThanOrEqual(2);
  });

  it('creates a typing DOT in chain (multiple calls)', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    const countBefore = chat.room.chain.appendCount;
    await setTyping(chat, alice, true);
    await setTyping(chat, alice, false);
    expect(chat.room.chain.appendCount).toBe(countBefore + 2);
  });
});

describe('updatePresence', () => {
  it('creates a DOT in the room chain', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    const countBefore = chat.room.chain.appendCount;
    await updatePresence(chat, alice, true);
    expect(chat.room.chain.appendCount).toBe(countBefore + 1);
  });

  it('going online sets member.online to true', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    await updatePresence(chat, alice, true);
    const onlineMembers = getOnlineMembers(chat);
    expect(onlineMembers.length).toBeGreaterThan(0);
  });

  it('going offline sets member.online to false', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    await updatePresence(chat, alice, true);
    await updatePresence(chat, alice, false);
    const onlineMembers = getOnlineMembers(chat);
    // alice was the only member, should now be offline
    const allMembers = Array.from(chat.members.values());
    const aliceMember = allMembers[0];
    expect(aliceMember?.online).toBe(false);
  });

  it('going offline clears typing state', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    await setTyping(chat, alice, true);
    await updatePresence(chat, alice, false);
    const typing = getTypingMembers(chat);
    expect(typing.length).toBe(0);
  });

  it('unknown identity auto-creates a member entry', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    const stranger = await createIdentity();
    await updatePresence(chat, stranger, true);
    expect(chat.members.size).toBeGreaterThanOrEqual(2);
  });
});

describe('getOnlineMembers', () => {
  it('returns empty array when no members are online', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    // Mark creator offline
    await updatePresence(chat, alice, false);
    const online = getOnlineMembers(chat);
    expect(online.length).toBe(0);
  });

  it('returns only online members', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    const bob = await createIdentity();
    await updatePresence(chat, alice, true);
    await updatePresence(chat, bob, false);
    const online = getOnlineMembers(chat);
    // alice online, bob offline
    expect(online.every(m => m.online)).toBe(true);
  });

  it('all online members are present when multiple go online', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    const bob = await createIdentity();
    const carol = await createIdentity();
    await updatePresence(chat, alice, true);
    await updatePresence(chat, bob, true);
    await updatePresence(chat, carol, true);
    const online = getOnlineMembers(chat);
    expect(online.length).toBeGreaterThanOrEqual(3);
  });
});

describe('getTypingMembers', () => {
  it('returns empty array when nobody is typing', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    expect(getTypingMembers(chat).length).toBe(0);
  });

  it('returns only typing members', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    const bob = await createIdentity();
    await setTyping(chat, alice, true);
    await setTyping(chat, bob, false);
    const typing = getTypingMembers(chat);
    expect(typing.every(m => m.typing)).toBe(true);
  });
});
