/**
 * formatter.test.ts — Message formatting tests for @dot-protocol/chat.
 * Target: 15+ tests.
 */

import { describe, it, expect } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import { bufToHex } from '@dot-protocol/chain';
import { createChatRoom, sendMessage, replyToThread } from '../src/chat.js';
import { formatMessage, formatThread, groupMessages } from '../src/formatter.js';
import type { ChatMessage, ChatMember } from '../src/types.js';

// ---------------------------------------------------------------------------
// formatMessage
// ---------------------------------------------------------------------------

describe('formatMessage', () => {
  it('includes author name in output', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Hello world', alice);
    const formatted = formatMessage(msg);
    expect(formatted).toContain('Alice');
  });

  it('includes message content in output', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Hello world', alice);
    const formatted = formatMessage(msg);
    expect(formatted).toContain('Hello world');
  });

  it('includes shortcode in parens', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Hello', alice);
    const formatted = formatMessage(msg);
    expect(formatted).toContain(msg.author.shortcode);
  });

  it('includes time in [HH:MM] format', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Hello', alice);
    const formatted = formatMessage(msg);
    // Should match [HH:MM] pattern
    expect(formatted).toMatch(/\[\d{2}:\d{2}\]/);
  });

  it('mind-response shows "mind" as role in parens', async () => {
    const alice = { ...(await createIdentity()), name: 'Feynman' };
    const chat = await createChatRoom('.lab', alice);
    const msg = await sendMessage(chat, 'According to quantum mechanics...', alice);
    // Manually override type to test mind-response formatting
    const mindMsg: ChatMessage = { ...msg, type: 'mind-response', author: { ...msg.author } };
    const formatted = formatMessage(mindMsg);
    expect(formatted).toContain('(mind)');
  });

  it('citations are appended in brackets', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Based on research', alice);
    const msgWithCitations: ChatMessage = { ...msg, citations: ['src1', 'src2'] };
    const formatted = formatMessage(msgWithCitations);
    expect(formatted).toContain('[src1, src2]');
  });

  it('no citation brackets appended when citations are absent', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Simple message', alice);
    const formatted = formatMessage(msg);
    // The output should not end with a citation block like "[src1, src2]"
    // (time brackets like [HH:MM] are expected at the start)
    expect(formatted).not.toMatch(/\[[\w,\s]+\]$/);
  });

  it('format uses shortcode as name when no name set', async () => {
    const anon = await createIdentity();
    const chat = await createChatRoom('.lobby', anon);
    const msg = await sendMessage(chat, 'Anonymous', anon);
    const formatted = formatMessage(msg);
    // shortcode should be used as name
    expect(formatted).toContain(msg.author.shortcode);
  });
});

// ---------------------------------------------------------------------------
// formatThread
// ---------------------------------------------------------------------------

describe('formatThread', () => {
  it('returns empty string for empty array', () => {
    expect(formatThread([])).toBe('');
  });

  it('returns single formatted message for single-item array', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Root message', alice);
    const formatted = formatThread([msg]);
    expect(formatted).toContain('Root message');
  });

  it('replies are indented with "  > "', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const parent = await sendMessage(chat, 'Root', alice);
    const reply = await replyToThread(chat, parent.hash, 'Reply', alice);
    const formatted = formatThread([parent, reply]);
    const lines = formatted.split('\n');
    expect(lines[1]).toMatch(/^\s+>/);
  });

  it('thread contains content of all messages', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const parent = await sendMessage(chat, 'Root message', alice);
    const r1 = await replyToThread(chat, parent.hash, 'Reply one', alice);
    const r2 = await replyToThread(chat, parent.hash, 'Reply two', alice);
    const formatted = formatThread([parent, r1, r2]);
    expect(formatted).toContain('Root message');
    expect(formatted).toContain('Reply one');
    expect(formatted).toContain('Reply two');
  });

  it('root message is not indented', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const parent = await sendMessage(chat, 'Root', alice);
    const reply = await replyToThread(chat, parent.hash, 'Reply', alice);
    const formatted = formatThread([parent, reply]);
    const lines = formatted.split('\n');
    expect(lines[0]).not.toMatch(/^\s+>/);
  });
});

// ---------------------------------------------------------------------------
// groupMessages
// ---------------------------------------------------------------------------

describe('groupMessages', () => {
  it('returns empty array for empty input', () => {
    expect(groupMessages([])).toHaveLength(0);
  });

  it('single message produces one group', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Solo', alice);
    const groups = groupMessages([msg]);
    expect(groups).toHaveLength(1);
  });

  it('consecutive messages from same author are in one group', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const m1 = await sendMessage(chat, 'First', alice);
    const m2 = await sendMessage(chat, 'Second', alice);
    // Same timestamp window → should group
    const groups = groupMessages([m1, m2]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.messages).toHaveLength(2);
  });

  it('messages from different authors produce separate groups', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const bob = { ...(await createIdentity()), name: 'Bob' };
    const chat = await createChatRoom('.lobby', alice);
    const m1 = await sendMessage(chat, 'Alice speaks', alice);
    const m2 = await sendMessage(chat, 'Bob speaks', bob);
    const groups = groupMessages([m1, m2]);
    expect(groups).toHaveLength(2);
  });

  it('messages more than 5 minutes apart from same author form separate groups', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const m1 = await sendMessage(chat, 'Early', alice);
    const m2 = await sendMessage(chat, 'Late', alice);
    // Manually set timestamps far apart
    const earlyMsg: ChatMessage = { ...m1, timestamp: 0 };
    const lateMsg: ChatMessage = { ...m2, timestamp: 6 * 60 * 1000 }; // 6 min later
    const groups = groupMessages([earlyMsg, lateMsg]);
    expect(groups).toHaveLength(2);
  });

  it('group author matches message author', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Hello', alice);
    const groups = groupMessages([msg]);
    expect(groups[0]?.author.shortcode).toBe(msg.author.shortcode);
  });

  it('group timestamp matches first message timestamp', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const m1 = await sendMessage(chat, 'First', alice);
    const m2 = await sendMessage(chat, 'Second', alice);
    const groups = groupMessages([m1, m2]);
    expect(groups[0]?.timestamp).toBe(m1.timestamp);
  });

  it('reaction messages are skipped in grouping', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const m1 = await sendMessage(chat, 'Hello', alice);
    // Create a fake reaction message
    const reactionMsg: ChatMessage = { ...m1, type: 'reaction', hash: 'fake-reaction-hash' };
    const groups = groupMessages([m1, reactionMsg]);
    // reaction should be skipped
    expect(groups).toHaveLength(1);
    expect(groups[0]?.messages).toHaveLength(1);
  });

  it('A-B-A pattern produces three groups', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const bob = { ...(await createIdentity()), name: 'Bob' };
    const chat = await createChatRoom('.lobby', alice);
    const m1 = await sendMessage(chat, 'Alice 1', alice);
    const m2 = await sendMessage(chat, 'Bob 1', bob);
    const m3 = await sendMessage(chat, 'Alice 2', alice);
    const groups = groupMessages([m1, m2, m3]);
    expect(groups).toHaveLength(3);
  });
});
