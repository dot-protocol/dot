/**
 * types.ts — Chat-specific types for @dot-protocol/chat.
 *
 * Chat is built on the DOT Protocol: every message is a DOT,
 * every thread is a causal sub-chain, every reaction is a bond DOT.
 */

import type { DOT } from '@dot-protocol/core';
import type { Room } from '@dot-protocol/room';

export type {
  DOT,
  Room,
};

/**
 * A chat message — a DOT with chat-layer semantics applied.
 *
 * The DOT is the canonical form. ChatMessage is a view over it.
 */
export interface ChatMessage {
  /** The underlying DOT */
  dot: DOT;
  /** BLAKE3 hash of the DOT (hex, 64 chars) */
  hash: string;
  /** Decoded message content */
  content: string;
  /** Author information derived from the DOT's sign base */
  author: {
    publicKey: Uint8Array;
    name?: string;
    /** First 8 hex chars of the public key */
    shortcode: string;
  };
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Chain depth of this DOT */
  depth: number;
  /** Semantic message type */
  type: 'text' | 'thread-reply' | 'reaction' | 'file' | 'system' | 'mind-response';
  /** Hash of parent message — set for thread replies */
  threadParent?: string;
  /** Hash of the message being reacted to */
  reactionTo?: string;
  /** The emoji used in a reaction */
  reactionEmoji?: string;
  /** BLAKE3 hash of an attached file */
  fileHash?: string;
  /** Filename for file attachments */
  fileName?: string;
  /** Source citations — used by mind responses */
  citations?: string[];
  /** If true, this message should expire (TTL-based) */
  ephemeral?: boolean;
  /** Computed trust score from the DOT */
  trust: number;
}

/**
 * A chat room — extends Room with chat-layer state.
 */
export interface ChatRoom {
  /** Underlying DOT Protocol room */
  room: Room;
  /** All chat messages in chronological order */
  messages: ChatMessage[];
  /** Thread map: parentHash → reply messages */
  threads: Map<string, ChatMessage[]>;
  /** Reaction map: messageHash → emoji → list of reactor shortcodes */
  reactions: Map<string, Map<string, string[]>>;
  /** Active members (joined and not left) */
  members: Map<string, ChatMember>;
  /** Count of messages after lastReadHash */
  unreadCount: number;
  /** Hash of the last message the local user has seen */
  lastReadHash?: string;
}

/**
 * A member of a chat room with presence information.
 */
export interface ChatMember {
  publicKey: Uint8Array;
  name: string;
  /** First 8 hex chars of the public key */
  shortcode: string;
  online: boolean;
  typing: boolean;
  lastSeen: number;
  /** Computed trust from their signed DOTs */
  trust: number;
  role: 'observer' | 'contributor' | 'mind' | 'governor';
}

/**
 * A group of consecutive messages from the same author within a time window.
 * Used for compact rendering (Discord/Slack style).
 */
export interface MessageGroup {
  author: ChatMember;
  messages: ChatMessage[];
  /** Timestamp of the first message in this group */
  timestamp: number;
}

/**
 * The payload structure stored inside a chat DOT.
 * JSON-serialized and stored as the DOT's payload bytes.
 */
export interface ChatPayload {
  content: string;
  chatType: ChatMessage['type'];
  threadParent?: string;
  reactionTo?: string;
  reactionEmoji?: string;
  fileHash?: string;
  fileName?: string;
  citations?: string[];
  ephemeral?: boolean;
  authorName?: string;
}

/**
 * The payload for a presence DOT (typing / online state).
 */
export interface PresencePayload {
  presenceType: 'typing' | 'online' | 'offline';
  ephemeral?: boolean;
  ttl?: number;
}
