/**
 * @dot-protocol/chat — Group chat on the DOT Protocol.
 *
 * Every message is a DOT. Every thread is a causal sub-chain.
 * Every reaction is a bond DOT. No server owns the history.
 *
 * The room chain IS the chat. Wherever the chain is replicated, the chat exists.
 */

// Types
export type {
  ChatMessage,
  ChatRoom,
  ChatMember,
  MessageGroup,
  ChatPayload,
  PresencePayload,
} from './types.js';

// Core chat operations
export {
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
} from './chat.js';

// Presence
export {
  setTyping,
  updatePresence,
  getOnlineMembers,
  getTypingMembers,
} from './presence.js';

// Formatting
export {
  formatMessage,
  formatThread,
  groupMessages,
} from './formatter.js';
