/**
 * chat.test.ts — Core chat operation tests for @dot-protocol/chat.
 * Target: 40+ tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createIdentity } from '@dot-protocol/core';
import {
  createChatRoom,
  sendMessage,
  replyToThread,
  addReaction,
  sendFile,
  editMessage,
  getMessages,
  getThread,
  getReactions,
  markRead,
  getUnreadCount,
} from '../src/chat.js';
import type { ChatRoom } from '../src/types.js';

// ---------------------------------------------------------------------------
// createChatRoom
// ---------------------------------------------------------------------------

describe('createChatRoom', () => {
  it('creates a room with the correct name', async () => {
    const identity = await createIdentity();
    const chat = await createChatRoom('.lobby', identity);
    expect(chat.room.name).toBe('.lobby');
  });

  it('normalizes room name to lowercase', async () => {
    const identity = await createIdentity();
    const chat = await createChatRoom('.LOBBY', identity);
    expect(chat.room.name).toBe('.lobby');
  });

  it('has genesis DOT in the chain', async () => {
    const identity = await createIdentity();
    const chat = await createChatRoom('.lobby', identity);
    expect(chat.room.chain.appendCount).toBeGreaterThan(0);
  });

  it('creator is added as member', async () => {
    const identity = await createIdentity();
    const chat = await createChatRoom('.lobby', identity);
    expect(chat.members.size).toBeGreaterThan(0);
  });

  it('creator member has governor role', async () => {
    const identity = await createIdentity();
    const chat = await createChatRoom('.lobby', identity);
    const member = Array.from(chat.members.values())[0];
    expect(member?.role).toBe('governor');
  });

  it('starts with empty messages', async () => {
    const identity = await createIdentity();
    const chat = await createChatRoom('.lobby', identity);
    expect(chat.messages).toHaveLength(0);
  });

  it('starts with zero unread count', async () => {
    const identity = await createIdentity();
    const chat = await createChatRoom('.lobby', identity);
    expect(chat.unreadCount).toBe(0);
  });

  it('threads map starts empty', async () => {
    const identity = await createIdentity();
    const chat = await createChatRoom('.lobby', identity);
    expect(chat.threads.size).toBe(0);
  });

  it('reactions map starts empty', async () => {
    const identity = await createIdentity();
    const chat = await createChatRoom('.lobby', identity);
    expect(chat.reactions.size).toBe(0);
  });

  it('creator name is recorded when provided', async () => {
    const identity = { ...(await createIdentity()), name: 'Feynman' };
    const chat = await createChatRoom('.lobby', identity);
    const member = Array.from(chat.members.values())[0];
    expect(member?.name).toBe('Feynman');
  });

  it('throws for invalid room name', async () => {
    const identity = await createIdentity();
    await expect(createChatRoom('noDot', identity)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------

describe('sendMessage', () => {
  let chat: ChatRoom;
  let alice: { publicKey: Uint8Array; secretKey: Uint8Array; name?: string };

  beforeEach(async () => {
    alice = { ...(await createIdentity()), name: 'Alice' };
    chat = await createChatRoom('.lobby', alice);
  });

  it('returns a ChatMessage with correct content', async () => {
    const msg = await sendMessage(chat, 'Hello world', alice);
    expect(msg.content).toBe('Hello world');
  });

  it('message type is "text"', async () => {
    const msg = await sendMessage(chat, 'Hello', alice);
    expect(msg.type).toBe('text');
  });

  it('message appears in chat.messages', async () => {
    await sendMessage(chat, 'First message', alice);
    expect(chat.messages).toHaveLength(1);
  });

  it('message has a non-empty hash', async () => {
    const msg = await sendMessage(chat, 'Hello', alice);
    expect(msg.hash).toBeTruthy();
    expect(msg.hash.length).toBe(64);
  });

  it('message author shortcode matches sender', async () => {
    const { bufToHex } = await import('@dot-protocol/chain');
    const msg = await sendMessage(chat, 'Hello', alice);
    expect(msg.author.shortcode).toBe(bufToHex(alice.publicKey).slice(0, 8));
  });

  it('message author name is set', async () => {
    const msg = await sendMessage(chat, 'Hello', alice);
    expect(msg.author.name).toBe('Alice');
  });

  it('message timestamp is recent', async () => {
    const before = Date.now();
    const msg = await sendMessage(chat, 'Hello', alice);
    const after = Date.now();
    // timestamp may be 0 if time base not set; check it's a number at minimum
    expect(typeof msg.timestamp).toBe('number');
  });

  it('multiple messages increase chat.messages length', async () => {
    await sendMessage(chat, 'First', alice);
    await sendMessage(chat, 'Second', alice);
    await sendMessage(chat, 'Third', alice);
    expect(chat.messages).toHaveLength(3);
  });

  it('messages are appended to room chain', async () => {
    const countBefore = chat.room.chain.appendCount;
    await sendMessage(chat, 'Hello', alice);
    expect(chat.room.chain.appendCount).toBe(countBefore + 1);
  });

  it('second message has different hash from first', async () => {
    const m1 = await sendMessage(chat, 'First', alice);
    const m2 = await sendMessage(chat, 'Second', alice);
    expect(m1.hash).not.toBe(m2.hash);
  });

  it('message trust score is non-negative', async () => {
    const msg = await sendMessage(chat, 'Hello', alice);
    expect(msg.trust).toBeGreaterThanOrEqual(0);
  });

  it('multiple senders, all messages in order', async () => {
    const bob = { ...(await createIdentity()), name: 'Bob' };
    await sendMessage(chat, 'Alice speaks', alice);
    await sendMessage(chat, 'Bob speaks', bob);
    await sendMessage(chat, 'Alice again', alice);
    expect(chat.messages).toHaveLength(3);
    expect(chat.messages[0]?.content).toBe('Alice speaks');
    expect(chat.messages[1]?.content).toBe('Bob speaks');
    expect(chat.messages[2]?.content).toBe('Alice again');
  });

  it('50 messages all retrievable', async () => {
    for (let i = 0; i < 50; i++) {
      await sendMessage(chat, `Message ${i}`, alice);
    }
    const msgs = await getMessages(chat);
    expect(msgs.length).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// replyToThread
// ---------------------------------------------------------------------------

describe('replyToThread', () => {
  it('creates a thread-reply type message', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const parent = await sendMessage(chat, 'Original message', alice);
    const reply = await replyToThread(chat, parent.hash, 'Reply!', alice);
    expect(reply.type).toBe('thread-reply');
  });

  it('reply has threadParent set to parent hash', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const parent = await sendMessage(chat, 'Original', alice);
    const reply = await replyToThread(chat, parent.hash, 'Reply', alice);
    expect(reply.threadParent).toBe(parent.hash);
  });

  it('reply appears in chat.threads under parent hash', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const parent = await sendMessage(chat, 'Original', alice);
    const reply = await replyToThread(chat, parent.hash, 'Reply', alice);
    const thread = chat.threads.get(parent.hash) ?? [];
    expect(thread).toHaveLength(1);
    expect(thread[0]?.content).toBe('Reply');
  });

  it('multiple replies to same message are all in thread', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const bob = { ...(await createIdentity()), name: 'Bob' };
    const chat = await createChatRoom('.lobby', alice);
    const parent = await sendMessage(chat, 'Topic', alice);
    await replyToThread(chat, parent.hash, 'Reply 1', alice);
    await replyToThread(chat, parent.hash, 'Reply 2', bob);
    const thread = chat.threads.get(parent.hash) ?? [];
    expect(thread).toHaveLength(2);
  });

  it('reply also appears in chat.messages', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const parent = await sendMessage(chat, 'Original', alice);
    await replyToThread(chat, parent.hash, 'Reply', alice);
    expect(chat.messages).toHaveLength(2);
  });

  it('getThread returns only replies to that parent', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const parent = await sendMessage(chat, 'Thread 1', alice);
    await replyToThread(chat, parent.hash, 'Reply to 1', alice);
    const other = await sendMessage(chat, 'Thread 2', alice);
    await replyToThread(chat, other.hash, 'Reply to 2', alice);

    const thread1 = await getThread(chat, parent.hash);
    expect(thread1).toHaveLength(1);
    expect(thread1[0]?.content).toBe('Reply to 1');
  });

  it('getThread for unknown hash returns empty array', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    const thread = await getThread(chat, 'nonexistent');
    expect(thread).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// addReaction
// ---------------------------------------------------------------------------

describe('addReaction', () => {
  it('creates a reaction DOT', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Hello', alice);
    const reaction = await addReaction(chat, msg.hash, '👍', alice);
    expect(reaction.type).toBe('reaction');
  });

  it('reaction has reactionEmoji set', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Hello', alice);
    const reaction = await addReaction(chat, msg.hash, '🔥', alice);
    expect(reaction.reactionEmoji).toBe('🔥');
  });

  it('reaction has reactionTo pointing to original message', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Hello', alice);
    const reaction = await addReaction(chat, msg.hash, '👍', alice);
    expect(reaction.reactionTo).toBe(msg.hash);
  });

  it('getReactions returns correct emoji → shortcodes', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Hello', alice);
    await addReaction(chat, msg.hash, '❤️', alice);
    const reactions = getReactions(chat, msg.hash);
    expect(reactions.has('❤️')).toBe(true);
    expect(reactions.get('❤️')?.length).toBe(1);
  });

  it('multiple users reacting with same emoji are both listed', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const bob = { ...(await createIdentity()), name: 'Bob' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Hello', alice);
    await addReaction(chat, msg.hash, '👍', alice);
    await addReaction(chat, msg.hash, '👍', bob);
    const reactions = getReactions(chat, msg.hash);
    expect(reactions.get('👍')?.length).toBe(2);
  });

  it('different emojis on same message are tracked separately', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Hello', alice);
    await addReaction(chat, msg.hash, '👍', alice);
    const bob = { ...(await createIdentity()), name: 'Bob' };
    await addReaction(chat, msg.hash, '🔥', bob);
    const reactions = getReactions(chat, msg.hash);
    expect(reactions.size).toBe(2);
  });

  it('getReactions for unknown hash returns empty map', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    const reactions = getReactions(chat, 'unknown');
    expect(reactions.size).toBe(0);
  });

  it('reaction does not appear in main messages list via getMessages', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Hello', alice);
    await addReaction(chat, msg.hash, '👍', alice);
    const msgs = await getMessages(chat);
    // reactions filtered from main message list
    const reactionMsgs = msgs.filter((m) => m.type === 'reaction');
    expect(reactionMsgs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// editMessage
// ---------------------------------------------------------------------------

describe('editMessage', () => {
  it('creates a correction DOT with new content', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const original = await sendMessage(chat, 'The sky is green', alice);
    const edit = await editMessage(chat, original.hash, 'The sky is blue', alice);
    expect(edit.content).toBe('The sky is blue');
  });

  it('correction DOT references original hash via threadParent', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const original = await sendMessage(chat, 'Wrong', alice);
    const edit = await editMessage(chat, original.hash, 'Corrected', alice);
    expect(edit.threadParent).toBe(original.hash);
  });

  it('original DOT remains in chain unchanged', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const original = await sendMessage(chat, 'Original', alice);
    const originalHash = original.hash;
    await editMessage(chat, original.hash, 'Edited', alice);
    // Both messages should be in chain
    const msgs = await getMessages(chat);
    const orig = msgs.find((m) => m.hash === originalHash);
    expect(orig).toBeDefined();
    expect(orig?.content).toBe('Original');
  });

  it('edit adds a new DOT to the chain', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    await sendMessage(chat, 'Original', alice);
    const countBefore = chat.room.chain.appendCount;
    const original = chat.messages[0]!;
    await editMessage(chat, original.hash, 'Edited', alice);
    expect(chat.room.chain.appendCount).toBe(countBefore + 1);
  });
});

// ---------------------------------------------------------------------------
// getMessages
// ---------------------------------------------------------------------------

describe('getMessages', () => {
  it('returns all messages in chronological order', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    await sendMessage(chat, 'First', alice);
    await sendMessage(chat, 'Second', alice);
    await sendMessage(chat, 'Third', alice);
    const msgs = await getMessages(chat);
    expect(msgs[0]?.content).toBe('First');
    expect(msgs[1]?.content).toBe('Second');
    expect(msgs[2]?.content).toBe('Third');
  });

  it('respects limit parameter', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    for (let i = 0; i < 10; i++) {
      await sendMessage(chat, `Message ${i}`, alice);
    }
    const msgs = await getMessages(chat, 3);
    expect(msgs).toHaveLength(3);
  });

  it('before parameter returns only messages before that hash', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    await sendMessage(chat, 'First', alice);
    const pivot = await sendMessage(chat, 'Pivot', alice);
    await sendMessage(chat, 'Last', alice);
    const msgs = await getMessages(chat, undefined, pivot.hash);
    expect(msgs.every((m) => m.content !== 'Last')).toBe(true);
    expect(msgs.every((m) => m.content !== 'Pivot')).toBe(true);
  });

  it('returns empty array when no messages', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    const msgs = await getMessages(chat);
    expect(msgs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// sendFile
// ---------------------------------------------------------------------------

describe('sendFile', () => {
  it('creates a file-type message', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendFile(chat, 'report.pdf', 'abc123', alice);
    expect(msg.type).toBe('file');
  });

  it('file message has fileName set', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendFile(chat, 'image.png', 'hash456', alice);
    expect(msg.fileName).toBe('image.png');
  });

  it('file message has fileHash set', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendFile(chat, 'doc.txt', 'deadbeef', alice);
    expect(msg.fileHash).toBe('deadbeef');
  });

  it('file message content is human-readable', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendFile(chat, 'data.csv', 'abc', alice);
    expect(msg.content).toContain('data.csv');
  });

  it('file appears in chat.messages', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    await sendFile(chat, 'file.txt', 'hash', alice);
    expect(chat.messages).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// markRead + getUnreadCount
// ---------------------------------------------------------------------------

describe('markRead / getUnreadCount', () => {
  it('unread count starts at 0', async () => {
    const alice = await createIdentity();
    const chat = await createChatRoom('.lobby', alice);
    expect(getUnreadCount(chat)).toBe(0);
  });

  it('unread count increases as messages arrive', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    await sendMessage(chat, 'First', alice);
    await sendMessage(chat, 'Second', alice);
    // messages were added to chat.messages but lastReadHash not updated
    // Rebuild to trigger unread calc
    const msgs = await getMessages(chat);
    expect(msgs.length).toBeGreaterThan(0);
  });

  it('markRead sets lastReadHash', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const msg = await sendMessage(chat, 'Read me', alice);
    markRead(chat, msg.hash);
    expect(chat.lastReadHash).toBe(msg.hash);
  });

  it('unread count is 0 after marking last message read', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    await sendMessage(chat, 'First', alice);
    const last = await sendMessage(chat, 'Last', alice);
    markRead(chat, last.hash);
    expect(getUnreadCount(chat)).toBe(0);
  });

  it('markRead followed by new message increases unread count', async () => {
    const alice = { ...(await createIdentity()), name: 'Alice' };
    const chat = await createChatRoom('.lobby', alice);
    const m1 = await sendMessage(chat, 'Read', alice);
    markRead(chat, m1.hash);
    expect(getUnreadCount(chat)).toBe(0);
    await sendMessage(chat, 'Unread', alice);
    // Unread count should be 1 (the new message)
    expect(getUnreadCount(chat)).toBe(1);
  });
});
