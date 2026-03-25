/**
 * formatter.ts — Message rendering for @dot-protocol/chat.
 *
 * Converts ChatMessages to human-readable text.
 * Groups consecutive messages from the same author within 5 minutes (Discord/Slack pattern).
 */

import type { ChatMessage, ChatMember, MessageGroup } from './types.js';

/** Max gap in milliseconds to consider messages in the same group (5 minutes). */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Format a single message as a single text line.
 *
 * Output format:
 *   [HH:MM] Name (shortcode): content
 *   [HH:MM] Name (mind): content [citation1, citation2]
 *
 * @param msg - The message to format
 * @returns Formatted string
 */
export function formatMessage(msg: ChatMessage): string {
  const time = formatTime(msg.timestamp);
  const name = msg.author.name ?? msg.author.shortcode;
  const role = msg.type === 'mind-response' ? 'mind' : msg.author.shortcode;
  let line = `[${time}] ${name} (${role}): ${msg.content}`;

  if (msg.citations !== undefined && msg.citations.length > 0) {
    line += ` [${msg.citations.join(', ')}]`;
  }

  return line;
}

/**
 * Format a thread (parent + replies) with indentation.
 *
 * The first message is the thread root. Subsequent messages are indented with "  > ".
 *
 * @param msgs - Array of messages: first is the root, rest are replies
 * @returns Multi-line string with the thread rendered
 */
export function formatThread(msgs: ChatMessage[]): string {
  if (msgs.length === 0) return '';

  const root = msgs[0];
  if (root === undefined) return '';
  const lines: string[] = [formatMessage(root)];

  for (let i = 1; i < msgs.length; i++) {
    const reply = msgs[i];
    if (reply !== undefined) {
      lines.push(`  > ${formatMessage(reply)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Group consecutive messages from the same author within a 5-minute window.
 *
 * This mirrors Discord/Slack compact mode: the header (avatar + name) is shown
 * only for the first message in a group, subsequent ones are "continuation" messages.
 *
 * @param msgs - Messages to group (should be in chronological order)
 * @returns Array of MessageGroups
 */
export function groupMessages(msgs: ChatMessage[]): MessageGroup[] {
  if (msgs.length === 0) return [];

  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (const msg of msgs) {
    // Skip reaction DOTs — they don't appear inline
    if (msg.type === 'reaction') continue;

    const shouldStartNewGroup =
      currentGroup === null ||
      msg.author.shortcode !== currentGroup.author.shortcode ||
      msg.timestamp - (currentGroup.messages[currentGroup.messages.length - 1]?.timestamp ?? 0) >
        GROUP_WINDOW_MS;

    if (shouldStartNewGroup) {
      // Build a minimal ChatMember from the message's author info
      const author: ChatMember = {
        publicKey: msg.author.publicKey,
        name: msg.author.name ?? msg.author.shortcode,
        shortcode: msg.author.shortcode,
        online: false,
        typing: false,
        lastSeen: msg.timestamp,
        trust: msg.trust,
        role: msg.type === 'mind-response' ? 'mind' : 'contributor',
      };

      currentGroup = {
        author,
        messages: [msg],
        timestamp: msg.timestamp,
      };
      groups.push(currentGroup);
    } else {
      currentGroup!.messages.push(msg);
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Format a Unix timestamp (ms) as HH:MM (24-hour).
 */
function formatTime(timestampMs: number): string {
  const d = new Date(timestampMs);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
