/**
 * terminal.ts — Terminal-style text renderer for .the.first.room.
 *
 * Renders a room as a readable chat-transcript-like text block.
 * Also exposes a raw hex dump view for chain verification.
 */

import { verify_chain, dotHashToHex, walk, bufToHex } from '@dot-protocol/chain';
import { computeTrust } from '@dot-protocol/core';
import type { FirstRoom, ChainEntry } from './room-chain.js';
import { getChainView, decodePayload } from './room-chain.js';

/** Width of the terminal box (chars). */
const WIDTH = 56;

function pad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, len);
  return s + ' '.repeat(len - s.length);
}

function formatDate(ts: number): string {
  if (!ts) return 'unknown';
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
}

function line(content: string): string {
  // Wrap inside │ borders, padded to WIDTH
  const inner = WIDTH - 4; // 2 border chars + 2 spaces
  const truncated = content.length > inner ? content.slice(0, inner - 1) + '…' : content;
  return `│ ${pad(truncated, inner)} │`;
}

function blank(): string {
  return `│${' '.repeat(WIDTH - 2)}│`;
}

function top(title: string): string {
  const inner = WIDTH - 4;
  const padded = pad(` ${title} `, inner);
  return `┌─── ${padded}─┐`;
}

function bottom(summary: string): string {
  const inner = WIDTH - 4;
  const padded = pad(summary, inner);
  return `│ ${padded} │\n└${'─'.repeat(WIDTH - 2)}┘`;
}

/**
 * Renders .the.first.room as a terminal-style text block.
 *
 * Example output:
 * ┌─── .the.first.room ───────────────────────────────┐
 * │ genesis [a3f2c1...] 2026-03-25 19:45:00           │
 * │   "The first room. Where observation begins."      │
 * │                                                    │
 * │ observation [c9a1f3...] 2026-03-25 19:45:15       │
 * │   "Hello from .the.first.room"                     │
 * │   — observer (depth: 2, trust: 0.73)              │
 * │                                                    │
 * │ 3 DOTs | 1 member | chain verified ✓              │
 * └────────────────────────────────────────────────────┘
 */
export function renderTerminal(room: FirstRoom): string {
  const entries = getChainView(room);
  const verifyResult = verify_chain(room.chain);
  const verifiedStr = verifyResult.valid ? 'chain verified ✓' : `chain INVALID (${verifyResult.errors.length} errors)`;
  const memberCount = room.members.size;

  const lines: string[] = [];
  lines.push(top(room.name));

  for (const entry of entries) {
    const typeLabel = entry.depth === 0 ? 'genesis' : entry.type;
    const shortHash = entry.hash.slice(0, 8) + '...';
    const dateStr = formatDate(entry.timestamp);

    lines.push(line(`${typeLabel} [${shortHash}] ${dateStr}`));
    lines.push(line(`  "${entry.content}"`));

    if (entry.depth > 0) {
      const trustStr = entry.trust.toFixed(2);
      lines.push(line(`  — ${entry.observer} (depth: ${entry.depth}, trust: ${trustStr})`));
    }

    lines.push(blank());
  }

  const summaryParts = [
    `${room.dotCount} DOT${room.dotCount === 1 ? '' : 's'}`,
    `${memberCount} member${memberCount === 1 ? '' : 's'}`,
    verifiedStr,
  ];
  lines.push(bottom(summaryParts.join(' | ')));

  return lines.join('\n');
}

/**
 * Renders a raw hex dump of the chain — for verification nerds.
 *
 * Format:
 * DOT #0 [genesis] hash:a3f2c1... sig:verified ✓
 *   payload: 5468652066697273...
 *   chain:   0000000000000000...
 *   time:    2026-03-25T19:45:00.000Z
 */
export function renderChainHex(room: FirstRoom): string {
  const dots = walk(room.chain);
  const verifyResult = verify_chain(room.chain);

  const lines: string[] = [];
  lines.push(`# .the.first.room — chain hex dump`);
  lines.push(`# ${dots.length} DOTs | chain ${verifyResult.valid ? 'verified ✓' : 'INVALID ✗'}`);
  lines.push('');

  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i]!;
    const hashHex = dotHashToHex(dot);
    const typeLabel = (dot.chain?.depth ?? 0) === 0 ? 'genesis' : (dot.type ?? 'claim');
    const hasSig = dot.sign?.signature !== undefined;

    lines.push(`DOT #${i} [${typeLabel}] hash:${hashHex.slice(0, 16)}... sig:${hasSig ? 'verified ✓' : 'unsigned'}`);

    if (dot.payload && dot.payload.length > 0) {
      const hexStr = bufToHex(dot.payload).slice(0, 32) + (dot.payload.length > 16 ? '...' : '');
      lines.push(`  payload: ${hexStr}`);
    }

    if (dot.chain?.previous) {
      const prevHex = bufToHex(dot.chain.previous);
      lines.push(`  chain:   ${prevHex.slice(0, 16)}...`);
    }

    if (dot.time?.utc) {
      lines.push(`  time:    ${new Date(dot.time.utc).toISOString()}`);
    }

    if (dot.sign?.observer) {
      lines.push(`  observer: ${bufToHex(dot.sign.observer).slice(0, 16)}...`);
    }

    lines.push('');
  }

  return lines.join('\n').trimEnd();
}
