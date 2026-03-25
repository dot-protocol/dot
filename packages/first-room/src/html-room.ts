/**
 * html-room.ts — Self-contained HTML viewer for .the.first.room.
 *
 * Generates a dark-themed, single-file HTML document showing:
 * - Room header (name, member count, DOT count)
 * - Scrollable chain of DOTs with content, observer, timestamp, hash, trust
 * - Observe input form (+ Observe button)
 * - Verify Chain button
 * - localStorage persistence for observations
 *
 * No external URLs. Under 50KB. Dark theme matching DOT viewer.
 */

import { verify_chain } from '@dot-protocol/chain';
import { computeTrust } from '@dot-protocol/core';
import type { FirstRoom, ChainEntry } from './room-chain.js';
import { getChainView } from './room-chain.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
}

function trustClass(trust: number): string {
  if (trust < 0.3) return 'trust-low';
  if (trust < 0.7) return 'trust-med';
  if (trust < 1.5) return 'trust-ok';
  return 'trust-high';
}

function trustLabel(trust: number): string {
  if (trust < 0.3) return 'low';
  if (trust < 0.7) return 'med';
  if (trust < 1.5) return 'ok';
  return 'high';
}

function typeIcon(type: string, depth: number): string {
  if (depth === 0) return '⬡';
  switch (type) {
    case 'event': return '◉';
    case 'claim': return '◈';
    case 'bond': return '⬟';
    case 'measure': return '◇';
    case 'state': return '▣';
    default: return '◆';
  }
}

function renderDotCard(entry: ChainEntry, index: number): string {
  const typeLabel = entry.depth === 0 ? 'genesis' : entry.type;
  const icon = typeIcon(entry.type, entry.depth);
  const tClass = trustClass(entry.trust);
  const tLabel = trustLabel(entry.trust);
  const dateStr = formatDate(entry.timestamp);
  const shortHash = entry.hash.slice(0, 12) + '…';

  return `
<div class="dot-card ${tClass}" data-hash="${escapeHtml(entry.hash)}" data-depth="${entry.depth}">
  <div class="dot-header">
    <span class="dot-icon">${icon}</span>
    <span class="dot-type">${escapeHtml(typeLabel)}</span>
    <span class="dot-hash" title="${escapeHtml(entry.hash)}">${escapeHtml(shortHash)}</span>
    <span class="dot-depth">depth:${entry.depth}</span>
    <span class="dot-trust trust-badge ${tClass}" title="trust: ${entry.trust.toFixed(3)}">${tLabel}</span>
    <span class="dot-time">${escapeHtml(dateStr)}</span>
  </div>
  <div class="dot-content">${escapeHtml(entry.content)}</div>
  <div class="dot-footer">
    <span class="dot-observer">observer: ${escapeHtml(entry.observer)}</span>
    <span class="dot-verified">${entry.verified ? '✓ linked' : '⚠ unlinked'}</span>
  </div>
</div>`.trim();
}

function roomCSS(): string {
  return `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:14px}
body{
  background:#0a0a0b;
  color:#e4e4e7;
  font-family:ui-monospace,'Cascadia Code','Fira Mono','Menlo',monospace;
  line-height:1.6;
  min-height:100vh;
  padding:0;
}
a{color:#818cf8}
.wrap{max-width:820px;margin:0 auto;padding:24px 16px 64px}

/* Header */
.room-header{
  border-bottom:1px solid #27272a;
  padding-bottom:16px;
  margin-bottom:20px;
}
.room-name{
  font-size:22px;
  font-weight:700;
  color:#a5b4fc;
  letter-spacing:0.5px;
}
.room-meta{
  font-size:12px;
  color:#71717a;
  margin-top:4px;
  display:flex;
  gap:16px;
  flex-wrap:wrap;
}
.room-meta span{display:flex;align-items:center;gap:4px}

/* Controls */
.controls{
  display:flex;
  gap:8px;
  margin-bottom:20px;
  flex-wrap:wrap;
  align-items:center;
}
.observe-input{
  flex:1;
  min-width:200px;
  background:#18181b;
  border:1px solid #3f3f46;
  color:#e4e4e7;
  padding:8px 12px;
  border-radius:6px;
  font-family:inherit;
  font-size:13px;
}
.observe-input:focus{outline:none;border-color:#818cf8}
.btn{
  padding:8px 14px;
  border-radius:6px;
  border:none;
  cursor:pointer;
  font-family:inherit;
  font-size:13px;
  font-weight:500;
  transition:opacity .15s;
}
.btn:hover{opacity:.85}
.btn-observe{background:#4f46e5;color:#fff}
.btn-verify{background:#27272a;color:#e4e4e7;border:1px solid #3f3f46}
.btn-clear{background:#27272a;color:#71717a;border:1px solid #3f3f46}

/* Chain list */
.chain-list{
  display:flex;
  flex-direction:column;
  gap:10px;
}
.dot-card{
  background:#111113;
  border-radius:8px;
  padding:12px 14px;
  border-left:3px solid #3f3f46;
  transition:border-color .15s;
}
.dot-card.trust-low{border-left-color:#ef4444}
.dot-card.trust-med{border-left-color:#f59e0b}
.dot-card.trust-ok{border-left-color:#22c55e}
.dot-card.trust-high{border-left-color:#818cf8}

.dot-header{
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
  margin-bottom:6px;
  font-size:11px;
  color:#71717a;
}
.dot-icon{font-size:14px;color:#a5b4fc}
.dot-type{color:#a5b4fc;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:.5px}
.dot-hash{font-family:inherit;color:#52525b;cursor:default}
.dot-depth{color:#52525b}
.dot-time{margin-left:auto;color:#52525b}

.trust-badge{
  padding:1px 6px;
  border-radius:3px;
  font-size:10px;
  font-weight:600;
  text-transform:uppercase;
  letter-spacing:.5px;
}
.trust-badge.trust-low{background:#7f1d1d;color:#fca5a5}
.trust-badge.trust-med{background:#78350f;color:#fcd34d}
.trust-badge.trust-ok{background:#14532d;color:#86efac}
.trust-badge.trust-high{background:#312e81;color:#c7d2fe}

.dot-content{
  color:#e4e4e7;
  font-size:13px;
  line-height:1.5;
  padding:4px 0;
  word-break:break-word;
  white-space:pre-wrap;
}
.dot-footer{
  display:flex;
  gap:12px;
  font-size:11px;
  color:#52525b;
  margin-top:6px;
  flex-wrap:wrap;
}
.dot-verified{color:#22c55e}

/* Verify output */
.verify-output{
  background:#111113;
  border:1px solid #27272a;
  border-radius:6px;
  padding:12px 14px;
  font-size:12px;
  color:#a1a1aa;
  margin-top:12px;
  white-space:pre-wrap;
  display:none;
}
.verify-output.show{display:block}
.verify-ok{color:#22c55e}
.verify-fail{color:#ef4444}

/* Empty state */
.empty-state{
  text-align:center;
  color:#52525b;
  padding:40px 0;
  font-size:13px;
}

/* Footer */
.page-footer{
  margin-top:40px;
  padding-top:16px;
  border-top:1px solid #1c1c1f;
  font-size:11px;
  color:#3f3f46;
  text-align:center;
}
`.trim();
}

function roomScript(initialDots: ChainEntry[]): string {
  const dotsJson = JSON.stringify(
    initialDots.map((e) => ({
      hash: e.hash,
      content: e.content,
      observer: e.observer,
      timestamp: e.timestamp,
      depth: e.depth,
      type: e.type,
      verified: e.verified,
      trust: e.trust,
    })),
  );

  return `
(function() {
  const STORAGE_KEY = 'first-room-observations';
  const initialDots = ${dotsJson};

  // Trust helpers
  function trustClass(t) {
    if (t < 0.3) return 'trust-low';
    if (t < 0.7) return 'trust-med';
    if (t < 1.5) return 'trust-ok';
    return 'trust-high';
  }
  function trustLabel(t) {
    if (t < 0.3) return 'low';
    if (t < 0.7) return 'med';
    if (t < 1.5) return 'ok';
    return 'high';
  }
  function typeIcon(type, depth) {
    if (depth === 0) return '⬡';
    const icons = {event:'◉',claim:'◈',bond:'⬟',measure:'◇',state:'▣'};
    return icons[type] || '◆';
  }
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function formatDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toISOString().replace('T',' ').slice(0,19);
  }
  function shortHash(h) { return h.slice(0,12) + '…'; }

  function makeCard(entry) {
    const typeLabel = entry.depth === 0 ? 'genesis' : entry.type;
    const icon = typeIcon(entry.type, entry.depth);
    const tc = trustClass(entry.trust);
    const tl = trustLabel(entry.trust);
    return '<div class="dot-card ' + tc + '" data-hash="' + escHtml(entry.hash) + '">'
      + '<div class="dot-header">'
      + '<span class="dot-icon">' + icon + '</span>'
      + '<span class="dot-type">' + escHtml(typeLabel) + '</span>'
      + '<span class="dot-hash" title="' + escHtml(entry.hash) + '">' + escHtml(shortHash(entry.hash)) + '</span>'
      + '<span class="dot-depth">depth:' + entry.depth + '</span>'
      + '<span class="dot-trust trust-badge ' + tc + '">' + tl + '</span>'
      + '<span class="dot-time">' + escHtml(formatDate(entry.timestamp)) + '</span>'
      + '</div>'
      + '<div class="dot-content">' + escHtml(entry.content) + '</div>'
      + '<div class="dot-footer">'
      + '<span class="dot-observer">observer: ' + escHtml(entry.observer) + '</span>'
      + '<span class="dot-verified">' + (entry.verified ? '✓ linked' : '⚠ unlinked') + '</span>'
      + '</div>'
      + '</div>';
  }

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function saveStored(dots) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dots));
    } catch(e) {}
  }

  function render(allDots) {
    const list = document.getElementById('chain-list');
    if (!list) return;
    if (allDots.length === 0) {
      list.innerHTML = '<div class="empty-state">No observations yet.</div>';
      return;
    }
    list.innerHTML = allDots.map(makeCard).join('');
    // Update counters
    const countEl = document.getElementById('dot-count');
    if (countEl) countEl.textContent = allDots.length + ' DOT' + (allDots.length === 1 ? '' : 's');
  }

  document.addEventListener('DOMContentLoaded', function() {
    const stored = loadStored();
    // Merge: initial from server + stored extras
    const storedHashes = new Set(stored.map(function(d) { return d.hash; }));
    const initHashes = new Set(initialDots.map(function(d) { return d.hash; }));
    const extras = stored.filter(function(d) { return !initHashes.has(d.hash); });
    let allDots = initialDots.concat(extras);

    render(allDots);

    // Observe button
    const input = document.getElementById('observe-input');
    const btn = document.getElementById('observe-btn');
    if (btn && input) {
      btn.addEventListener('click', function() {
        const val = input.value.trim();
        if (!val) return;
        const newDot = {
          hash: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
          content: val,
          observer: 'local000',
          timestamp: Date.now(),
          depth: allDots.length,
          type: 'claim',
          verified: false,
          trust: 0.1
        };
        allDots = allDots.concat([newDot]);
        const extras2 = allDots.filter(function(d) { return !initHashes.has(d.hash); });
        saveStored(extras2);
        render(allDots);
        input.value = '';
      });
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); btn.click(); }
      });
    }

    // Verify button
    const verifyBtn = document.getElementById('verify-btn');
    const verifyOut = document.getElementById('verify-output');
    if (verifyBtn && verifyOut) {
      verifyBtn.addEventListener('click', function() {
        const ok = allDots.every(function(d) { return d.verified || d.depth === 0; });
        verifyOut.classList.add('show');
        if (ok) {
          verifyOut.innerHTML = '<span class="verify-ok">✓ Chain valid — ' + allDots.length + ' DOTs verified</span>';
        } else {
          const unverified = allDots.filter(function(d) { return !d.verified && d.depth > 0; });
          verifyOut.innerHTML = '<span class="verify-fail">⚠ ' + unverified.length + ' DOT(s) unlinked (locally added)</span>';
        }
      });
    }

    // Clear stored
    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        localStorage.removeItem(STORAGE_KEY);
        allDots = initialDots.slice();
        render(allDots);
        if (verifyOut) verifyOut.classList.remove('show');
      });
    }
  });
})();
`.trim();
}

/**
 * Generates a self-contained HTML document for .the.first.room.
 *
 * - Header: room name, member count, DOT count
 * - Chain: scrollable list of DOTs with content, observer shortcode, depth, timestamp, hash (truncated), trust
 * - Observe input: text box + "Observe" button
 * - Verify Chain button
 * - Uses localStorage for persistence
 * - Dark theme
 * - Under 50KB
 */
export async function generateRoomHTML(room: FirstRoom): Promise<string> {
  const entries = getChainView(room);
  const verifyResult = verify_chain(room.chain);
  const isValid = verifyResult.valid;
  const memberCount = room.members.size;
  const dotCount = room.dotCount;
  const createdStr = new Date(room.createdAt).toISOString().slice(0, 10);

  const dotsHtml = entries.map((e, i) => renderDotCard(e, i)).join('\n');

  const chainStatusBadge = isValid
    ? `<span style="color:#22c55e">✓ verified</span>`
    : `<span style="color:#ef4444">✗ invalid</span>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(room.name)}</title>
  <style>${roomCSS()}</style>
</head>
<body>
  <div class="wrap">
    <div class="room-header">
      <div class="room-name">${escapeHtml(room.name)}</div>
      <div class="room-meta">
        <span>🔗 <span id="dot-count">${dotCount} DOT${dotCount === 1 ? '' : 's'}</span></span>
        <span>👤 ${memberCount} member${memberCount === 1 ? '' : 's'}</span>
        <span>📅 created ${escapeHtml(createdStr)}</span>
        <span>${chainStatusBadge}</span>
      </div>
    </div>

    <div class="controls">
      <input
        id="observe-input"
        class="observe-input"
        type="text"
        placeholder="Enter your observation…"
        autocomplete="off"
        aria-label="Observation text"
      />
      <button id="observe-btn" class="btn btn-observe">Observe</button>
      <button id="verify-btn" class="btn btn-verify">Verify Chain</button>
      <button id="clear-btn" class="btn btn-clear">Clear Local</button>
    </div>

    <div id="verify-output" class="verify-output"></div>

    <div id="chain-list" class="chain-list">
      ${dotsHtml || '<div class="empty-state">No observations yet.</div>'}
    </div>

    <div class="page-footer">
      DOT Protocol R854 · .the.first.room · ${escapeHtml(createdStr)}
    </div>
  </div>
  <script>${roomScript(entries)}</script>
</body>
</html>`;
}
