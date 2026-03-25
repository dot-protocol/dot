/**
 * chat.ts — Core chat operations for @dot-protocol/chat.
 *
 * All messages are DOTs. Threads are sub-chains. Reactions are bond DOTs.
 * The room chain IS the message history — replayable, verifiable, owned by no server.
 */

import { observe, sign, computeTrust } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import { dotHashToHex, bufToHex, walk } from '@dot-protocol/chain';
import { createRoom, joinRoom, observe_in_room, getRoomDots } from '@dot-protocol/room';
import type { ChatRoom, ChatMessage, ChatMember, ChatPayload } from './types.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Decode a DOT's payload as JSON, returning null on failure. */
function decodePayload(dot: DOT): Record<string, unknown> | null {
  if (dot.payload === undefined || dot.payload.length === 0) return null;
  try {
    const text = new TextDecoder().decode(dot.payload);
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Convert a DOT + its hex hash into a ChatMessage. */
function dotToChatMessage(dot: DOT, hexHash: string, memberName?: string): ChatMessage | null {
  const raw = decodePayload(dot);
  if (raw === null) return null;

  // Must have content field
  const content = raw['content'];
  if (typeof content !== 'string') return null;

  // Must have a chatType marker (not a room join/leave system DOT)
  const chatType = raw['chatType'] as ChatMessage['type'] | undefined;
  if (chatType === undefined) return null;

  const observer = dot.sign?.observer;
  if (observer === undefined) return null;

  const shortcode = bufToHex(observer).slice(0, 8);
  const authorName = typeof raw['authorName'] === 'string' ? raw['authorName'] : memberName;

  const timestamp = dot.time?.utc ?? Date.now();
  const depth = dot.chain?.depth ?? 0;
  const trust = computeTrust(dot);

  const msg: ChatMessage = {
    dot,
    hash: hexHash,
    content,
    author: {
      publicKey: observer,
      name: authorName,
      shortcode,
    },
    timestamp,
    depth,
    type: chatType,
    trust,
  };

  // Optional thread/reaction fields
  if (typeof raw['threadParent'] === 'string') msg.threadParent = raw['threadParent'];
  if (typeof raw['reactionTo'] === 'string') msg.reactionTo = raw['reactionTo'];
  if (typeof raw['reactionEmoji'] === 'string') msg.reactionEmoji = raw['reactionEmoji'];
  if (typeof raw['fileHash'] === 'string') msg.fileHash = raw['fileHash'];
  if (typeof raw['fileName'] === 'string') msg.fileName = raw['fileName'];
  if (Array.isArray(raw['citations'])) msg.citations = raw['citations'] as string[];
  if (raw['ephemeral'] === true) msg.ephemeral = true;

  return msg;
}

/**
 * Append a ChatPayload to the room chain and return the resulting ChatMessage.
 *
 * The hash stored in ChatMessage is the tipHash AFTER append — this is the
 * canonical hash of the DOT as stored (with chain linkage applied).
 */
async function appendChatDot(
  chat: ChatRoom,
  payload: ChatPayload,
  identity: { publicKey: Uint8Array; secretKey: Uint8Array },
): Promise<ChatMessage> {
  const { append } = await import('@dot-protocol/chain');

  // Build signed DOT and append to chain
  const unsigned = observe(payload, { type: 'claim', plaintext: true });
  const signed = await sign(unsigned, identity.secretKey);
  chat.room.chain = append(chat.room.chain, signed);

  // The canonical hash is the tipHash set by append (hash of the chain-linked DOT)
  const hexHash = chat.room.chain.tipHash!;

  // Retrieve the stored DOT (with chain linkage applied) from storage
  const storedDot = chat.room.chain.storage.get(hexHash);
  if (storedDot === null) {
    throw new Error('Chain integrity error: just-appended DOT not found in storage');
  }

  const shortcode = bufToHex(identity.publicKey).slice(0, 8);
  const memberInfo = chat.members.get(shortcode) ?? chat.members.get(
    bufToHex(identity.publicKey),
  );
  const memberName = memberInfo?.name;

  const msg = dotToChatMessage(storedDot, hexHash, memberName);
  if (msg === null) {
    throw new Error('Failed to construct ChatMessage from DOT — payload encoding error');
  }

  return msg;
}

/** Rebuild chat state (messages, threads, reactions) from the room chain. */
function rebuildChatState(chat: ChatRoom): void {
  const dots = walk(chat.room.chain);

  chat.messages = [];
  chat.threads = new Map();
  chat.reactions = new Map();

  for (const dot of dots) {
    const raw = decodePayload(dot);
    if (raw === null) continue;
    if (typeof raw['chatType'] !== 'string') continue;
    if (dot.sign?.observer === undefined) continue;

    const hexHash = dotHashToHex(dot);
    const observer = dot.sign.observer;
    const shortcode = bufToHex(observer).slice(0, 8);
    const memberInfo = chat.members.get(shortcode) ??
      chat.members.get(bufToHex(observer));
    const msg = dotToChatMessage(dot, hexHash, memberInfo?.name);
    if (msg === null) continue;

    // Reactions: store separately, don't push to main messages
    if (msg.type === 'reaction' && msg.reactionTo !== undefined && msg.reactionEmoji !== undefined) {
      let emojiMap = chat.reactions.get(msg.reactionTo);
      if (emojiMap === undefined) {
        emojiMap = new Map();
        chat.reactions.set(msg.reactionTo, emojiMap);
      }
      const reactors = emojiMap.get(msg.reactionEmoji) ?? [];
      if (!reactors.includes(msg.author.shortcode)) {
        reactors.push(msg.author.shortcode);
      }
      emojiMap.set(msg.reactionEmoji, reactors);
      continue;
    }

    chat.messages.push(msg);

    // Thread indexing
    if (msg.type === 'thread-reply' && msg.threadParent !== undefined) {
      const replies = chat.threads.get(msg.threadParent) ?? [];
      replies.push(msg);
      chat.threads.set(msg.threadParent, replies);
    }
  }

  // Recalculate unread count
  chat.unreadCount = computeUnreadCount(chat);
}

/** Compute how many messages are after lastReadHash. */
function computeUnreadCount(chat: ChatRoom): number {
  if (chat.lastReadHash === undefined) return chat.messages.length;
  const idx = chat.messages.findIndex((m) => m.hash === chat.lastReadHash);
  if (idx === -1) return 0;
  return chat.messages.length - idx - 1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new chat room backed by a DOT Protocol room.
 *
 * @param name - Room name, must start with "."
 * @param identity - Creator's keypair
 * @returns A fully initialized ChatRoom
 */
export async function createChatRoom(
  name: string,
  identity: { publicKey: Uint8Array; secretKey: Uint8Array; name?: string },
): Promise<ChatRoom> {
  const room = await createRoom(name, identity);

  const shortcode = bufToHex(identity.publicKey).slice(0, 8);
  const displayName = identity.name ?? shortcode;

  const creatorMember: ChatMember = {
    publicKey: identity.publicKey,
    name: displayName,
    shortcode,
    online: true,
    typing: false,
    lastSeen: Date.now(),
    trust: 0,
    role: 'governor',
  };

  const members = new Map<string, ChatMember>();
  members.set(shortcode, creatorMember);

  const chat: ChatRoom = {
    room,
    messages: [],
    threads: new Map(),
    reactions: new Map(),
    members,
    unreadCount: 0,
  };

  return chat;
}

/**
 * Send a text message to a chat room.
 *
 * The message is signed, appended to the room chain, and indexed in chat state.
 *
 * @param chat - The target chat room
 * @param content - Message text
 * @param identity - Sender's keypair (with optional name)
 * @returns The created ChatMessage
 */
export async function sendMessage(
  chat: ChatRoom,
  content: string,
  identity: { publicKey: Uint8Array; secretKey: Uint8Array; name?: string },
): Promise<ChatMessage> {
  const shortcode = bufToHex(identity.publicKey).slice(0, 8);
  const authorName = identity.name ?? chat.members.get(shortcode)?.name ?? shortcode;

  const payload: ChatPayload = {
    content,
    chatType: 'text',
    authorName,
  };

  const msg = await appendChatDot(chat, payload, identity);
  chat.messages.push(msg);
  chat.unreadCount = computeUnreadCount(chat);
  return msg;
}

/**
 * Reply to a message thread.
 *
 * Creates a thread-reply DOT referencing the parent message hash.
 *
 * @param chat - The chat room
 * @param parentHash - Hash of the message being replied to
 * @param content - Reply content
 * @param identity - Sender's keypair
 * @returns The thread reply ChatMessage
 */
export async function replyToThread(
  chat: ChatRoom,
  parentHash: string,
  content: string,
  identity: { publicKey: Uint8Array; secretKey: Uint8Array; name?: string },
): Promise<ChatMessage> {
  const shortcode = bufToHex(identity.publicKey).slice(0, 8);
  const authorName = identity.name ?? chat.members.get(shortcode)?.name ?? shortcode;

  const payload: ChatPayload = {
    content,
    chatType: 'thread-reply',
    threadParent: parentHash,
    authorName,
  };

  const msg = await appendChatDot(chat, payload, identity);
  chat.messages.push(msg);

  // Index in thread map
  const replies = chat.threads.get(parentHash) ?? [];
  replies.push(msg);
  chat.threads.set(parentHash, replies);

  chat.unreadCount = computeUnreadCount(chat);
  return msg;
}

/**
 * Add a reaction (emoji) to a message.
 *
 * Stores a bond DOT linking the reactor to the target message.
 *
 * @param chat - The chat room
 * @param messageHash - Hash of the message being reacted to
 * @param emoji - The emoji (e.g. "👍")
 * @param identity - Reactor's keypair
 * @returns The reaction DOT as a ChatMessage
 */
export async function addReaction(
  chat: ChatRoom,
  messageHash: string,
  emoji: string,
  identity: { publicKey: Uint8Array; secretKey: Uint8Array; name?: string },
): Promise<ChatMessage> {
  const shortcode = bufToHex(identity.publicKey).slice(0, 8);
  const authorName = identity.name ?? chat.members.get(shortcode)?.name ?? shortcode;

  const payload: ChatPayload = {
    content: `${emoji} reacted to ${messageHash}`,
    chatType: 'reaction',
    reactionTo: messageHash,
    reactionEmoji: emoji,
    authorName,
  };

  const msg = await appendChatDot(chat, payload, identity);

  // Update reaction index
  let emojiMap = chat.reactions.get(messageHash);
  if (emojiMap === undefined) {
    emojiMap = new Map();
    chat.reactions.set(messageHash, emojiMap);
  }
  const reactors = emojiMap.get(emoji) ?? [];
  if (!reactors.includes(shortcode)) {
    reactors.push(shortcode);
  }
  emojiMap.set(emoji, reactors);

  return msg;
}

/**
 * Send a file attachment message.
 *
 * The file itself is not stored in the DOT — only its BLAKE3 hash and name.
 * Content is a human-readable description.
 *
 * @param chat - The chat room
 * @param fileName - Name of the file
 * @param fileHash - BLAKE3 hash of the file bytes (hex)
 * @param identity - Sender's keypair
 * @returns The file ChatMessage
 */
export async function sendFile(
  chat: ChatRoom,
  fileName: string,
  fileHash: string,
  identity: { publicKey: Uint8Array; secretKey: Uint8Array; name?: string },
): Promise<ChatMessage> {
  const shortcode = bufToHex(identity.publicKey).slice(0, 8);
  const authorName = identity.name ?? chat.members.get(shortcode)?.name ?? shortcode;

  const payload: ChatPayload = {
    content: `shared ${fileName}`,
    chatType: 'file',
    fileHash,
    fileName,
    authorName,
  };

  const msg = await appendChatDot(chat, payload, identity);
  chat.messages.push(msg);
  chat.unreadCount = computeUnreadCount(chat);
  return msg;
}

/**
 * Edit a message by creating a correction DOT.
 *
 * The original DOT is immutable — the correction references it.
 * Callers should display the latest correction for a given original hash.
 *
 * @param chat - The chat room
 * @param originalHash - Hash of the DOT being corrected
 * @param newContent - The corrected content
 * @param identity - Editor's keypair (must be original author)
 * @returns The correction ChatMessage
 */
export async function editMessage(
  chat: ChatRoom,
  originalHash: string,
  newContent: string,
  identity: { publicKey: Uint8Array; secretKey: Uint8Array; name?: string },
): Promise<ChatMessage> {
  const shortcode = bufToHex(identity.publicKey).slice(0, 8);
  const authorName = identity.name ?? chat.members.get(shortcode)?.name ?? shortcode;

  const payload: ChatPayload = {
    content: newContent,
    chatType: 'text',
    threadParent: originalHash, // correction references original
    authorName,
  };

  const msg = await appendChatDot(chat, payload, identity);
  // Mark as edit — override type after construction
  (msg as { type: string }).type = 'text';
  msg.threadParent = originalHash;

  chat.messages.push(msg);
  chat.unreadCount = computeUnreadCount(chat);
  return msg;
}

/**
 * Get messages from the chat room.
 *
 * @param chat - The chat room
 * @param limit - Maximum number of messages to return (most recent first if before is set)
 * @param before - Hash of a message; return only messages before it
 * @returns Array of ChatMessages in chronological order
 */
export async function getMessages(
  chat: ChatRoom,
  limit?: number,
  before?: string,
): Promise<ChatMessage[]> {
  // Always rebuild from chain for consistency
  rebuildChatState(chat);

  let msgs = chat.messages.filter((m) => m.type !== 'reaction');

  if (before !== undefined) {
    const idx = msgs.findIndex((m) => m.hash === before);
    if (idx !== -1) {
      msgs = msgs.slice(0, idx);
    }
  }

  if (limit !== undefined && limit > 0) {
    msgs = msgs.slice(-limit);
  }

  return msgs;
}

/**
 * Get all replies in a thread.
 *
 * @param chat - The chat room
 * @param parentHash - Hash of the parent message
 * @returns Array of reply ChatMessages in chronological order
 */
export async function getThread(
  chat: ChatRoom,
  parentHash: string,
): Promise<ChatMessage[]> {
  return chat.threads.get(parentHash) ?? [];
}

/**
 * Get reactions for a message.
 *
 * @param chat - The chat room
 * @param messageHash - Hash of the target message
 * @returns Map of emoji → list of reactor shortcodes
 */
export function getReactions(
  chat: ChatRoom,
  messageHash: string,
): Map<string, string[]> {
  return chat.reactions.get(messageHash) ?? new Map();
}

/**
 * Mark messages as read up to and including the given message hash.
 *
 * @param chat - The chat room
 * @param hash - Hash of the most recently read message
 */
export function markRead(chat: ChatRoom, hash: string): void {
  chat.lastReadHash = hash;
  chat.unreadCount = computeUnreadCount(chat);
}

/**
 * Get the count of unread messages.
 *
 * @param chat - The chat room
 * @returns Number of messages after lastReadHash
 */
export function getUnreadCount(chat: ChatRoom): number {
  return chat.unreadCount;
}
