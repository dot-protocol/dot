/**
 * presence.ts — Member presence for @dot-protocol/chat.
 *
 * Presence is implemented as ephemeral DOTs:
 * - typing: short-lived (5s TTL), emitted while composing
 * - online/offline: state transitions, longer-lived
 *
 * Presence DOTs use observe type 'state' and are stored in the room chain.
 * They are filtered out of message lists but indexed into ChatMember state.
 */

import { observe, sign } from '@dot-protocol/core';
import { bufToHex } from '@dot-protocol/chain';
import { ChatRoom, ChatMember, PresencePayload } from './types.js';

/** Typing TTL in milliseconds. */
const TYPING_TTL_MS = 5000;

/**
 * Emit a typing presence DOT.
 *
 * The DOT is ephemeral (TTL = 5s). The member's typing state is updated immediately.
 *
 * @param chat - The chat room
 * @param identity - The typing member's keypair
 * @param isTyping - Whether the member is currently typing
 */
export async function setTyping(
  chat: ChatRoom,
  identity: { publicKey: Uint8Array; secretKey: Uint8Array },
  isTyping: boolean,
): Promise<void> {
  const { append } = await import('@dot-protocol/chain');

  const presencePayload: PresencePayload = {
    presenceType: 'typing',
    ephemeral: true,
    ttl: TYPING_TTL_MS,
  };

  const unsigned = observe(
    { ...presencePayload, isTyping },
    { type: 'state', plaintext: true },
  );
  const signed = await sign(unsigned, identity.secretKey);
  chat.room.chain = append(chat.room.chain, signed);

  // Update in-memory member state immediately
  const shortcode = bufToHex(identity.publicKey).slice(0, 8);
  const member = findMember(chat, identity.publicKey);
  if (member !== undefined) {
    member.typing = isTyping;
    member.lastSeen = Date.now();
  } else {
    // Auto-create a minimal member entry for anonymous participants
    const newMember: ChatMember = {
      publicKey: identity.publicKey,
      name: shortcode,
      shortcode,
      online: true,
      typing: isTyping,
      lastSeen: Date.now(),
      trust: 0,
      role: 'observer',
    };
    chat.members.set(shortcode, newMember);
  }
}

/**
 * Emit a presence state DOT (online/offline).
 *
 * @param chat - The chat room
 * @param identity - The member's keypair
 * @param online - Whether the member is going online (true) or offline (false)
 */
export async function updatePresence(
  chat: ChatRoom,
  identity: { publicKey: Uint8Array; secretKey: Uint8Array },
  online: boolean,
): Promise<void> {
  const { append } = await import('@dot-protocol/chain');

  const presencePayload: PresencePayload = {
    presenceType: online ? 'online' : 'offline',
  };

  const unsigned = observe(
    { ...presencePayload },
    { type: 'state', plaintext: true },
  );
  const signed = await sign(unsigned, identity.secretKey);
  chat.room.chain = append(chat.room.chain, signed);

  // Update in-memory member state
  const shortcode = bufToHex(identity.publicKey).slice(0, 8);
  const member = findMember(chat, identity.publicKey);
  if (member !== undefined) {
    member.online = online;
    member.typing = false; // going offline clears typing
    member.lastSeen = Date.now();
  } else {
    const newMember: ChatMember = {
      publicKey: identity.publicKey,
      name: shortcode,
      shortcode,
      online,
      typing: false,
      lastSeen: Date.now(),
      trust: 0,
      role: 'observer',
    };
    chat.members.set(shortcode, newMember);
  }
}

/**
 * Get all members currently marked as online.
 *
 * @param chat - The chat room
 * @returns Array of online ChatMembers
 */
export function getOnlineMembers(chat: ChatRoom): ChatMember[] {
  return Array.from(chat.members.values()).filter((m) => m.online);
}

/**
 * Get all members currently marked as typing.
 *
 * @param chat - The chat room
 * @returns Array of ChatMembers currently typing
 */
export function getTypingMembers(chat: ChatRoom): ChatMember[] {
  return Array.from(chat.members.values()).filter((m) => m.typing);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/** Find a member by public key (tries shortcode index first, then full scan). */
function findMember(
  chat: ChatRoom,
  publicKey: Uint8Array,
): ChatMember | undefined {
  const shortcode = bufToHex(publicKey).slice(0, 8);
  const byShortcode = chat.members.get(shortcode);
  if (byShortcode !== undefined) return byShortcode;

  // Full scan for exact public key match
  const fullHex = bufToHex(publicKey);
  return chat.members.get(fullHex);
}
