/**
 * single-file.ts — Generate the single HTML file distribution for DOT Protocol.
 *
 * Produces a COMPLETE self-contained HTML file:
 * - ALL JavaScript inline (no external scripts)
 * - ALL CSS inline (no external stylesheets)
 * - Interactive Tree viewer UI
 * - "Observe" input box: type text -> creates signed DOT -> appears in tree
 * - localStorage persistence (no server needed)
 * - Export button: download tree as JSON
 * - Verify button: verify chain signatures
 * - Target: under 100KB total
 *
 * The HTML can be opened directly in any modern browser with no server.
 * A child can open it from their Downloads folder.
 */

import { viewerCSS } from '@dot-protocol/viewer';
import { inlineCryptoScript } from './inline-crypto.js';
import { appScript } from './app-script.js';
import type { Tree } from '@dot-protocol/tree';
import { getWasmBase64, getWasmGlue } from './wasm-loader.js';

// ---- Types ---------------------------------------------------------------

export interface SingleFileOptions {
  /** Document title shown in the viewer. Default: 'DOT Protocol'. */
  title?: string;
  /** Whether to include the tree viewer. Default: true. */
  includeTree?: boolean;
  /** Whether to include sample seed data. Default: true. */
  includeSample?: boolean;
  /**
   * Whether to inline the real DOT WASM binary as base64 for full cryptography.
   * When true: WASM embedded (~282KB base64), real Ed25519 + BLAKE3 used.
   * When false (default): Web Crypto API fallback, file under 100KB.
   */
  includeWasm?: boolean;
  /** @internal -- Pass a live Tree to render its current state. */
  _tree?: Tree;
}

// ---- Main export ---------------------------------------------------------

/**
 * Generates a complete, self-contained HTML file for DOT Protocol.
 *
 * @example
 * const html = await generateSingleFile({ title: 'My DOT Tree' });
 * fs.writeFileSync('dot-tree.html', html);
 * // Open dot-tree.html in any browser -- no server needed
 */
export async function generateSingleFile(options: SingleFileOptions = {}): Promise<string> {
  const title = options.title ?? 'DOT Protocol';
  const includeTree = options.includeTree !== false;
  const includeWasm = options.includeWasm === true;

  const css = viewerCSS();

  // WASM mode: real Ed25519 + BLAKE3 via WASM binary embedded as base64
  // Fallback mode: Web Crypto API (no WASM, smaller file)
  let cryptoModule: string;
  let wasmScript = '';
  if (includeWasm) {
    const wasmBase64 = getWasmBase64();
    const wasmGlue = getWasmGlue();
    wasmScript = buildWasmInitScript(wasmBase64, wasmGlue);
    cryptoModule = buildWasmCryptoScript();
  } else {
    cryptoModule = inlineCryptoScript();
  }

  const appModule = appScript();

  const headerHtml = buildHeader(title);
  const observeUI = includeTree ? buildObserveUI() : '';
  const treeSection = includeTree ? buildTreeSection() : '';
  const searchBar = includeTree ? buildSearchBar() : '';

  return buildDocument({
    title,
    css,
    wasmScript,
    cryptoModule,
    appModule,
    headerHtml,
    searchBar,
    observeUI,
    treeSection,
  });
}

// ---- Document builder ----------------------------------------------------

interface DocParts {
  title: string;
  css: string;
  wasmScript: string;
  cryptoModule: string;
  appModule: string;
  headerHtml: string;
  searchBar: string;
  observeUI: string;
  treeSection: string;
}

function buildDocument(parts: DocParts): string {
  const wasmBlock = parts.wasmScript ? `<script>\n${parts.wasmScript}\n  </script>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(parts.title)}</title>
  <style>
${parts.css}
${additionalCSS()}
  </style>
</head>
<body>
  <div class="vw-wrap">
    ${parts.headerHtml}
    ${parts.searchBar}
    ${parts.observeUI}
    ${parts.treeSection}
    <div id="vw-no-results" style="display:none;color:#71717a;padding:16px">No matching observations.</div>
  </div>
  ${wasmBlock}
  <script>
${parts.cryptoModule}
  </script>
  ${parts.appModule}
</body>
</html>`;
}

// ---- Section builders ----------------------------------------------------

function buildHeader(title: string): string {
  return `<div class="vw-header">
      <div class="vw-title">${escHtml(title)}</div>
      <div class="vw-meta">
        Observer: <span id="dot-identity" class="vw-chip" title="Your Ed25519 public key">generating\u2026</span>
        &nbsp;\u00b7&nbsp;
        <span id="dot-count">0</span> observations
      </div>
    </div>`;
}

function buildSearchBar(): string {
  return `<div class="vw-search-wrap">
      <input
        id="vw-search"
        class="vw-search"
        type="search"
        placeholder="Search observations\u2026"
        autocomplete="off"
        aria-label="Search tree"
      />
    </div>`;
}

function buildObserveUI(): string {
  return `<div class="dot-observe-panel">
      <div class="dot-observe-row">
        <input
          id="dot-input"
          class="dot-observe-input"
          type="text"
          placeholder="What do you observe? Press Enter to record as a DOT\u2026"
          autocomplete="off"
          maxlength="500"
        />
        <button id="dot-submit" class="dot-observe-btn">Observe</button>
      </div>
      <div class="dot-observe-actions">
        <button id="dot-export" class="dot-action-btn">Export JSON</button>
        <button id="dot-verify" class="dot-action-btn">Verify Chain</button>
        <span id="dot-hash-display" class="dot-hash-display" style="display:none"></span>
      </div>
    </div>`;
}

function buildTreeSection(): string {
  return `<div id="tree-container" class="vw-tree-container">
      <div style="color:#71717a;padding:24px;text-align:center">
        Loading tree\u2026
      </div>
    </div>`;
}

// ---- WASM integration ----------------------------------------------------

/**
 * Builds the WASM initialization script block.
 * The standard dot_wasm.js glue normally fetches the .wasm file. We strip that
 * and instead decode the base64 bytes inline, passing them directly to
 * WebAssembly.instantiate. The WASM exports are exposed on window.DotWasm.
 */
function buildWasmInitScript(wasmBase64: string, wasmGlue: string): string {
  // Strip ESM export keywords — we expose via window.DotWasm
  const glueAdapted = wasmGlue
    .replace(/^export \{ initSync, __wbg_init as default \};?\s*$/m, '')
    .replace(/^export function /gm, 'function ')
    .replace(/^export class /gm, 'class ')
    .replace(/^export const /gm, 'const ');

  return `(function(){
'use strict';
var WASM_B64=${JSON.stringify(wasmBase64)};
function b64ToBytes(s){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
var wasmBytes=b64ToBytes(WASM_B64);
${glueAdapted}
var _init=null;
function ensureInit(){if(_init)return _init;_init=(async function(){var imp=__wbg_get_imports();var r=await WebAssembly.instantiate(wasmBytes,imp);__wbg_finalize_init(r.instance,r.module);})();return _init;}
window.DotWasm={init:ensureInit,generate_keypair:generate_keypair,create_dot:create_dot,verify_dot:verify_dot,hash:hash,hash_hex:hash_hex,sign:sign,verify:verify,ObservationType:ObservationType};
})();`;
}

/**
 * Returns the WASM-powered DotCrypto module script.
 * Uses window.DotWasm for real Ed25519 keypair generation and BLAKE3 hashing.
 */
function buildWasmCryptoScript(): string {
  return `
// ---- DOT Crypto Module (WASM-powered) ------------------------------------
const DotCrypto=(function(){
'use strict';
function bytesToHex(b){return Array.from(b).map(function(x){return x.toString(16).padStart(2,'0')}).join('');}
function hexToBytes(h){var b=new Uint8Array(h.length/2);for(var i=0;i<h.length;i+=2)b[i/2]=parseInt(h.slice(i,i+2),16);return b;}
async function sha256(data){var buf=data instanceof Uint8Array?data:new TextEncoder().encode(String(data));var d=await crypto.subtle.digest('SHA-256',buf);return new Uint8Array(d);}
async function hashPayload(text){await window.DotWasm.init();var p=new TextEncoder().encode(text);return window.DotWasm.hash_hex(p);}
async function generateKeyPair(){await window.DotWasm.init();var kp=window.DotWasm.generate_keypair();var pub=bytesToHex(kp.public_key);var sec=bytesToHex(kp.secret_key);kp.free();return{publicKey:pub,secretKeyHex:sec,method:'wasm-ed25519'};}
async function signPayload(text,kp){await window.DotWasm.init();var p=new TextEncoder().encode(text);var sk=hexToBytes(kp.secretKeyHex);var sig=window.DotWasm.sign(p,sk);return bytesToHex(sig);}
var IDENTITY_KEY='dot-identity-v2-wasm';
async function loadOrCreateIdentity(){try{var s=localStorage.getItem(IDENTITY_KEY);if(s){var p=JSON.parse(s);if(p&&p.publicKey&&p.secretKeyHex)return p;}}catch(_){}var kp=await generateKeyPair();localStorage.setItem(IDENTITY_KEY,JSON.stringify({publicKey:kp.publicKey,secretKeyHex:kp.secretKeyHex,method:kp.method}));return kp;}
function shortId(pk){return pk.slice(0,8)+'\u2026'+pk.slice(-4);}
return{bytesToHex:bytesToHex,hexToBytes:hexToBytes,sha256:sha256,hashPayload:hashPayload,generateKeyPair:generateKeyPair,signPayload:signPayload,loadOrCreateIdentity:loadOrCreateIdentity,shortId:shortId};
})();`.trim();
}

// ---- CSS helpers ---------------------------------------------------------

function additionalCSS(): string {
  return `
/* -- Observe panel -------------------------------------------------------- */
.dot-observe-panel{margin-bottom:20px;padding:16px;background:#111113;border:1px solid #27272a;border-radius:10px}
.dot-observe-row{display:flex;gap:8px;align-items:center;margin-bottom:10px}
.dot-observe-input{flex:1;padding:10px 14px;background:#18181b;border:1px solid #3f3f46;border-radius:8px;color:#e4e4e7;font-size:14px;outline:none;transition:border-color .15s;font-family:inherit}
.dot-observe-input:focus{border-color:#818cf8}
.dot-observe-input::placeholder{color:#52525b}
.dot-observe-btn{padding:10px 20px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s,opacity .15s}
.dot-observe-btn:hover{background:#4338ca}
.dot-observe-btn:disabled{opacity:.5;cursor:not-allowed}
.dot-observe-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dot-action-btn{padding:6px 14px;background:#27272a;color:#a1a1aa;border:1px solid #3f3f46;border-radius:6px;font-size:12px;cursor:pointer;transition:background .15s,color .15s}
.dot-action-btn:hover{background:#3f3f46;color:#e4e4e7}
.dot-hash-display{font-size:12px;font-family:monospace;padding:4px 10px;background:#18181b;border-radius:6px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vw-chip{font-family:monospace;font-size:11px;background:#18181b;padding:2px 6px;border-radius:4px;cursor:help}
.vw-tree-container{margin-top:8px}
.vw-branch-body{padding:4px 0 4px 12px}
.vw-node-summary{display:flex;align-items:center;gap:6px;flex-wrap:wrap;cursor:pointer;padding:8px 12px;border-radius:6px;transition:background .1s;list-style:none}
.vw-node-summary:hover{background:#18181b}
.vw-node-preview{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#d4d4d8}
.vw-node-meta{font-size:11px;color:#52525b;white-space:nowrap}`.trim();
}

// ---- Utilities -----------------------------------------------------------

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
