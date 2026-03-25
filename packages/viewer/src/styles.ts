/**
 * styles.ts — CSS for the Tree viewer.
 *
 * Dark theme. System fonts only. Zero external deps.
 * Trust visualized via left-border color on each node card.
 */

/** Returns the full viewer CSS as a string. */
export function viewerCSS(): string {
  return `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:14px;-webkit-text-size-adjust:100%}
body{
  background:#0a0a0b;
  color:#e4e4e7;
  font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  line-height:1.6;
  padding:0;
  min-height:100vh;
}
a{color:#818cf8;text-decoration:none}
a:hover{text-decoration:underline}

/* ── Layout ──────────────────────────────────────────────────── */
.vw-wrap{
  max-width:900px;
  margin:0 auto;
  padding:24px 16px 48px;
}
@media(min-width:640px){.vw-wrap{padding:32px 24px 64px}}

/* ── Header ──────────────────────────────────────────────────── */
.vw-header{
  margin-bottom:24px;
  padding-bottom:16px;
  border-bottom:1px solid #27272a;
}
.vw-title{
  font-size:20px;
  font-weight:600;
  color:#e4e4e7;
  line-height:1.3;
}
.vw-meta{
  font-size:12px;
  color:#71717a;
  margin-top:4px;
}

/* ── Search bar ───────────────────────────────────────────────── */
.vw-search-wrap{
  position:sticky;
  top:0;
  z-index:50;
  background:#0a0a0b;
  padding:12px 0;
  margin-bottom:8px;
}
.vw-search{
  width:100%;
  padding:8px 14px;
  background:#18181b;
  border:1px solid #27272a;
  border-radius:8px;
  color:#e4e4e7;
  font-size:14px;
  outline:none;
  transition:border-color .15s;
}
.vw-search:focus{border-color:#818cf8}
.vw-search::placeholder{color:#52525b}

/* ── Branch sections ─────────────────────────────────────────── */
.vw-branch{margin-bottom:8px}
.vw-branch-summary{
  display:flex;
  align-items:center;
  gap:8px;
  padding:10px 14px;
  background:#18181b;
  border:1px solid #27272a;
  border-radius:8px;
  cursor:pointer;
  user-select:none;
  list-style:none;
  font-weight:600;
  font-size:14px;
  color:#e4e4e7;
  transition:background .15s;
}
.vw-branch-summary:hover{background:#27272a}
details[open]>.vw-branch-summary{
  border-bottom-left-radius:0;
  border-bottom-right-radius:0;
  border-bottom-color:transparent;
}
.vw-branch-icon{font-size:16px;flex-shrink:0}
.vw-branch-label{flex:1}
.vw-branch-count{
  font-size:11px;
  color:#71717a;
  background:#27272a;
  padding:1px 7px;
  border-radius:999px;
  font-weight:400;
}
.vw-branch-chevron{
  color:#71717a;
  font-size:12px;
  transition:transform .2s;
}
details[open]>.vw-branch-summary .vw-branch-chevron{transform:rotate(90deg)}

.vw-branch-body{
  border:1px solid #27272a;
  border-top:none;
  border-bottom-left-radius:8px;
  border-bottom-right-radius:8px;
  padding:8px 8px 8px;
  background:#111113;
}

/* ── Node card ───────────────────────────────────────────────── */
.vw-node{
  margin-bottom:4px;
}
.vw-node-summary{
  display:flex;
  align-items:flex-start;
  gap:8px;
  padding:8px 12px;
  background:#18181b;
  border-radius:6px;
  border-left:3px solid transparent;
  cursor:pointer;
  user-select:none;
  list-style:none;
  transition:background .15s;
}
.vw-node-summary:hover{background:#1e1e21}
details[open]>.vw-node-summary{
  border-bottom-left-radius:0;
  border-bottom-right-radius:0;
}

/* Trust border colors */
.vw-trust-red   {border-left-color:#ef4444}
.vw-trust-yellow{border-left-color:#eab308}
.vw-trust-green {border-left-color:#22c55e}
.vw-trust-gold  {border-left-color:#f59e0b}

.vw-node-main{flex:1;min-width:0}
.vw-node-label{
  font-size:13px;
  font-weight:500;
  color:#e4e4e7;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.vw-node-preview{
  font-size:12px;
  color:#71717a;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  margin-top:1px;
}
.vw-node-badges{
  display:flex;
  align-items:center;
  gap:6px;
  flex-shrink:0;
}

/* Trust badge pill */
.vw-trust-badge{
  display:inline-flex;
  align-items:center;
  gap:3px;
  font-size:11px;
  font-weight:500;
  padding:1px 6px;
  border-radius:999px;
  border:1px solid currentColor;
  white-space:nowrap;
}
.vw-trust-badge.vw-trust-red   {color:#ef4444}
.vw-trust-badge.vw-trust-yellow{color:#eab308}
.vw-trust-badge.vw-trust-green {color:#22c55e}
.vw-trust-badge.vw-trust-gold  {color:#f59e0b}

.vw-type-chip{
  font-size:10px;
  font-weight:500;
  padding:1px 6px;
  border-radius:4px;
  background:#27272a;
  color:#a1a1aa;
  text-transform:uppercase;
  letter-spacing:.04em;
  white-space:nowrap;
}

/* Node detail panel */
.vw-node-detail{
  background:#111113;
  border:1px solid #27272a;
  border-top:none;
  border-bottom-left-radius:6px;
  border-bottom-right-radius:6px;
  padding:12px 14px;
  font-size:13px;
}
.vw-detail-content{
  color:#e4e4e7;
  line-height:1.7;
  margin-bottom:10px;
  white-space:pre-wrap;
  word-break:break-word;
}
.vw-detail-meta{
  display:flex;
  flex-wrap:wrap;
  gap:12px;
  padding-top:10px;
  border-top:1px solid #27272a;
  font-size:11px;
  color:#71717a;
}
.vw-detail-meta-item{display:flex;flex-direction:column;gap:2px}
.vw-detail-meta-key{
  font-size:10px;
  text-transform:uppercase;
  letter-spacing:.05em;
  color:#52525b;
}
.vw-detail-meta-val{color:#a1a1aa;font-family:monospace;font-size:11px}

/* Add-leaf inline form */
.vw-add-leaf-btn{
  font-size:11px;
  padding:3px 8px;
  background:transparent;
  border:1px solid #27272a;
  border-radius:4px;
  color:#71717a;
  cursor:pointer;
  transition:border-color .15s,color .15s;
}
.vw-add-leaf-btn:hover{border-color:#818cf8;color:#818cf8}
.vw-add-leaf-form{
  display:none;
  margin-top:8px;
  gap:6px;
  align-items:flex-start;
  flex-wrap:wrap;
}
.vw-add-leaf-form.vw-open{display:flex}
.vw-add-leaf-input{
  flex:1;
  min-width:180px;
  padding:5px 9px;
  background:#18181b;
  border:1px solid #27272a;
  border-radius:5px;
  color:#e4e4e7;
  font-size:12px;
  outline:none;
}
.vw-add-leaf-input:focus{border-color:#818cf8}
.vw-add-leaf-submit{
  padding:5px 12px;
  background:#818cf8;
  border:none;
  border-radius:5px;
  color:#0a0a0b;
  font-size:12px;
  font-weight:600;
  cursor:pointer;
}
.vw-add-leaf-submit:hover{background:#6366f1}
.vw-add-leaf-output{
  display:none;
  width:100%;
  padding:8px 10px;
  background:#0a0a0b;
  border:1px solid #27272a;
  border-radius:5px;
  font-family:monospace;
  font-size:11px;
  color:#22c55e;
  white-space:pre;
  overflow-x:auto;
}

/* ── Child indent ────────────────────────────────────────────── */
.vw-children{
  padding-left:14px;
  margin-top:4px;
  border-left:1px solid #27272a;
}

/* ── Empty state ─────────────────────────────────────────────── */
.vw-empty{
  text-align:center;
  padding:48px 24px;
  color:#52525b;
  font-size:14px;
}

/* ── No-match message ────────────────────────────────────────── */
#vw-no-results{
  display:none;
  text-align:center;
  padding:24px;
  color:#52525b;
  font-size:13px;
}

/* ── Responsive ──────────────────────────────────────────────── */
@media(max-width:480px){
  .vw-node-badges{display:none}
  .vw-title{font-size:17px}
}
`.trim();
}
