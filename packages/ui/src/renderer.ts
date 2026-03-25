/**
 * renderer.ts — Render a RoomLayout to self-contained HTML.
 *
 * Server-side HTML generation for DOT room interfaces.
 * Each pattern has a corresponding HTML template.
 * Output is self-contained (no external deps), dark theme by default, under 20KB.
 */

import type { UIComponent } from './patterns.js';
import type { RoomLayout } from './composer.js';

// ─── CSS ─────────────────────────────────────────────────────────────────────

const DARK_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',monospace;background:#09090b;color:#e4e4e7;line-height:1.5;padding:16px}
.room-layout{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.component{border-radius:8px;padding:16px;background:#18181b;border:1px solid #27272a}
.threshold{text-align:center;padding:32px 16px}
.threshold h2{font-size:1.25rem;font-weight:600;color:#f4f4f5;margin-bottom:12px}
.threshold input{width:100%;background:#27272a;border:1px solid #3f3f46;color:#e4e4e7;padding:10px 14px;border-radius:6px;font-size:0.9rem;outline:none}
.threshold input:focus{border-color:#6366f1}
.revelation{}
.revelation .summary{font-weight:500;color:#f4f4f5;cursor:pointer}
.revelation .detail{color:#a1a1aa;margin-top:8px;font-size:0.9rem}
.revelation .expand-hint{font-size:0.75rem;color:#52525b;margin-top:4px}
.mind-presence{}
.mind-presence .minds-label{font-size:0.75rem;text-transform:uppercase;letter-spacing:.05em;color:#52525b;margin-bottom:8px}
.mind-presence .minds-list{display:flex;flex-wrap:wrap;gap:8px}
.mind-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:9999px;font-size:0.8rem;border:1px solid #3f3f46;background:#27272a}
.mind-chip.active{border-color:#4f46e5;background:#1e1b4b;color:#818cf8}
.mind-chip .dot-indicator{width:6px;height:6px;border-radius:50%;background:#52525b}
.mind-chip.active .dot-indicator{background:#6366f1}
.chain-beneath{}
.chain-beneath .chain-label{font-size:0.75rem;text-transform:uppercase;letter-spacing:.05em;color:#52525b;margin-bottom:8px}
.chain-beneath .dot-list{display:flex;flex-direction:column;gap:4px}
.dot-entry{display:flex;align-items:baseline;gap:8px;font-size:0.8rem;font-family:monospace}
.dot-hash{color:#4ade80;flex-shrink:0;font-size:0.7rem}
.dot-content{color:#a1a1aa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px}
.dot-trust{color:#52525b;flex-shrink:0;font-size:0.7rem}
.sovereign-stop{border-color:#ef4444;background:#1c0a0a}
.sovereign-stop .stop-icon{font-size:1.25rem;margin-bottom:8px}
.sovereign-stop .stop-reason{color:#fca5a5;font-weight:500;margin-bottom:12px}
.sovereign-stop .resume-btn{background:#27272a;border:1px solid #3f3f46;color:#e4e4e7;padding:6px 14px;border-radius:6px;font-size:0.85rem;cursor:pointer}
.observation-first{}
.observation-first textarea{width:100%;background:#27272a;border:1px solid #3f3f46;color:#e4e4e7;padding:10px 14px;border-radius:6px;font-size:0.9rem;resize:vertical;min-height:72px;outline:none}
.observation-first textarea:focus{border-color:#6366f1}
.observation-first .room-label{font-size:0.75rem;color:#52525b;margin-bottom:6px}
.citation-trail{}
.citation-trail .claim{margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #27272a}
.citation-trail .claim:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0}
.claim-text{color:#f4f4f5;margin-bottom:4px}
.claim-source{font-size:0.75rem;color:#6366f1}
.claim-confidence{font-size:0.7rem;color:#52525b;margin-left:8px}
.doorway{cursor:pointer;border-color:#3f3f46}
.doorway:hover{border-color:#6366f1;background:#1e1b4b}
.doorway .door-room{font-weight:600;color:#818cf8;margin-bottom:4px}
.doorway .door-relevance{font-size:0.85rem;color:#a1a1aa}
.doorway .door-preview{font-size:0.8rem;color:#52525b;margin-top:4px;font-style:italic}
.ephemeral-surface{border-color:#a855f7;background:#180a27}
.ephemeral-surface .content{color:#d8b4fe;margin-bottom:8px}
.ephemeral-surface .ttl-label{font-size:0.75rem;color:#7e22ce}
.generative-face{}
.generative-face .face-label{font-size:0.75rem;color:#52525b;margin-bottom:8px}
.generative-face .children{display:flex;flex-direction:column;gap:8px}
`;

const LIGHT_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',monospace;background:#fafafa;color:#18181b;line-height:1.5;padding:16px}
.room-layout{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.component{border-radius:8px;padding:16px;background:#ffffff;border:1px solid #e4e4e7}
.threshold{text-align:center;padding:32px 16px}
.threshold h2{font-size:1.25rem;font-weight:600;color:#18181b;margin-bottom:12px}
.threshold input{width:100%;background:#f4f4f5;border:1px solid #d4d4d8;color:#18181b;padding:10px 14px;border-radius:6px;font-size:0.9rem;outline:none}
.observation-first textarea{width:100%;background:#f4f4f5;border:1px solid #d4d4d8;color:#18181b;padding:10px 14px;border-radius:6px;font-size:0.9rem;resize:vertical;min-height:72px;outline:none}
`;

// ─── Component Renderers ──────────────────────────────────────────────────────

function renderThreshold(component: UIComponent): string {
  const { question, placeholder } = component.props as {
    question: string;
    placeholder: string;
  };
  return `<div class="component threshold" data-id="${component.id}" data-pattern="threshold">
  <h2>${escapeHtml(question)}</h2>
  <input type="text" placeholder="${escapeHtml(placeholder)}" aria-label="${escapeHtml(question)}">
</div>`;
}

function renderRevelation(component: UIComponent): string {
  const { summary, detail } = component.props as {
    summary: string;
    detail: string;
    full: string;
  };
  return `<div class="component revelation" data-id="${component.id}" data-pattern="revelation">
  <div class="summary">${escapeHtml(summary)}</div>
  <div class="detail">${escapeHtml(detail)}</div>
  <div class="expand-hint">tap to expand</div>
</div>`;
}

function renderMindPresence(component: UIComponent): string {
  const { minds } = component.props as {
    minds: { name: string; domain: string; active: boolean }[];
    activeCount: number;
    totalCount: number;
  };
  const chips = minds
    .map(
      (m) =>
        `<span class="mind-chip${m.active ? ' active' : ''}">
      <span class="dot-indicator"></span>${escapeHtml(m.name)}<span style="opacity:.5;font-size:.7rem">${escapeHtml(m.domain)}</span>
    </span>`,
    )
    .join('');
  return `<div class="component mind-presence" data-id="${component.id}" data-pattern="mind-presence">
  <div class="minds-label">Minds Present</div>
  <div class="minds-list">${chips}</div>
</div>`;
}

function renderChainBeneath(component: UIComponent): string {
  const { dots } = component.props as {
    dots: { hash: string; content: string; depth: number; trust: number }[];
    tipHash: string | null;
    chainDepth: number;
  };
  const entries = dots
    .slice(-5) // Show last 5 for brevity
    .map(
      (d) =>
        `<div class="dot-entry">
      <span class="dot-hash">${escapeHtml(d.hash.slice(0, 8))}…</span>
      <span class="dot-content">${escapeHtml(d.content.slice(0, 60))}</span>
      <span class="dot-trust">trust:${(d.trust * 100).toFixed(0)}%</span>
    </div>`,
    )
    .join('');
  return `<div class="component chain-beneath" data-id="${component.id}" data-pattern="chain-beneath">
  <div class="chain-label">DOT Chain (depth ${(component.props as { chainDepth: number }).chainDepth})</div>
  <div class="dot-list">${entries}</div>
</div>`;
}

function renderSovereignStop(component: UIComponent): string {
  const { reason, resumeAction } = component.props as {
    reason: string;
    resumeAction: string | null;
  };
  const btn = resumeAction
    ? `<button class="resume-btn">${escapeHtml(resumeAction)}</button>`
    : '';
  return `<div class="component sovereign-stop" data-id="${component.id}" data-pattern="sovereign-stop">
  <div class="stop-icon">&#9632;</div>
  <div class="stop-reason">${escapeHtml(reason)}</div>
  ${btn}
</div>`;
}

function renderObservationFirst(component: UIComponent): string {
  const { placeholder, room } = component.props as {
    placeholder: string;
    room: string | null;
  };
  const label = room ? `<div class="room-label">Observing in ${escapeHtml(room)}</div>` : '';
  return `<div class="component observation-first" data-id="${component.id}" data-pattern="observation-first">
  ${label}<textarea placeholder="${escapeHtml(placeholder)}" aria-label="Observation input"></textarea>
</div>`;
}

function renderCitationTrail(component: UIComponent): string {
  const { claims } = component.props as {
    claims: { text: string; source: string; confidence: number }[];
  };
  const claimHtml = claims
    .map(
      (c) =>
        `<div class="claim">
      <div class="claim-text">${escapeHtml(c.text)}</div>
      <span class="claim-source">${escapeHtml(c.source)}</span>
      <span class="claim-confidence">${(c.confidence * 100).toFixed(0)}% confidence</span>
    </div>`,
    )
    .join('');
  return `<div class="component citation-trail" data-id="${component.id}" data-pattern="citation-trail">
  ${claimHtml}
</div>`;
}

function renderDoorway(component: UIComponent): string {
  const { targetRoom, relevance, preview } = component.props as {
    targetRoom: string;
    relevance: string;
    preview: string | null;
  };
  const previewHtml = preview
    ? `<div class="door-preview">${escapeHtml(preview)}</div>`
    : '';
  return `<div class="component doorway" data-id="${component.id}" data-pattern="doorway" role="link" tabindex="0">
  <div class="door-room">${escapeHtml(targetRoom)}</div>
  <div class="door-relevance">${escapeHtml(relevance)}</div>
  ${previewHtml}
</div>`;
}

function renderEphemeralSurface(component: UIComponent): string {
  const { content, ttlSeconds } = component.props as {
    content: string;
    ttlSeconds: number;
  };
  return `<div class="component ephemeral-surface" data-id="${component.id}" data-pattern="ephemeral-surface" data-ttl="${ttlSeconds}">
  <div class="content">${escapeHtml(content)}</div>
  <div class="ttl-label">Fades in ${ttlSeconds}s — chain is permanent</div>
</div>`;
}

function renderGenerativeFace(component: UIComponent): string {
  const { humanContext } = component.props as {
    humanContext: { language: string; expertise: string };
  };
  const childrenHtml = (component.children ?? []).map(renderComponent).join('');
  return `<div class="component generative-face" data-id="${component.id}" data-pattern="generative-face" data-lang="${escapeHtml(humanContext.language)}" data-expertise="${escapeHtml(humanContext.expertise)}">
  <div class="face-label">Interface for ${escapeHtml(humanContext.expertise)} / ${escapeHtml(humanContext.language)}</div>
  <div class="children">${childrenHtml}</div>
</div>`;
}

// ─── Component Dispatch ───────────────────────────────────────────────────────

function renderComponent(component: UIComponent): string {
  switch (component.pattern) {
    case 'threshold':
      return renderThreshold(component);
    case 'revelation':
      return renderRevelation(component);
    case 'mind-presence':
      return renderMindPresence(component);
    case 'chain-beneath':
      return renderChainBeneath(component);
    case 'sovereign-stop':
      return renderSovereignStop(component);
    case 'observation-first':
      return renderObservationFirst(component);
    case 'citation-trail':
      return renderCitationTrail(component);
    case 'doorway':
      return renderDoorway(component);
    case 'ephemeral-surface':
      return renderEphemeralSurface(component);
    case 'generative-face':
      return renderGenerativeFace(component);
    default:
      return `<div class="component" data-pattern="${(component as UIComponent).pattern}">Unknown pattern</div>`;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Render a RoomLayout to self-contained HTML.
 *
 * @param layout - The layout to render
 * @returns A complete HTML document string under 20KB
 */
export function renderToHTML(layout: RoomLayout): string {
  const css = layout.theme === 'dark' ? DARK_CSS : LIGHT_CSS;
  const componentsHtml = layout.components.map(renderComponent).join('\n');

  return `<!DOCTYPE html>
<html lang="en" data-theme="${layout.theme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(layout.roomName)}</title>
<style>${css}</style>
</head>
<body>
<main class="room-layout" data-room="${escapeHtml(layout.roomName)}" data-layout-id="${escapeHtml(layout.id)}">
${componentsHtml}
</main>
</body>
</html>`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
