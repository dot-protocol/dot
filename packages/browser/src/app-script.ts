/**
 * app-script.ts — Application JavaScript for the single-file HTML distribution.
 *
 * Returns the <script> block that wires up the interactive tree viewer:
 * - On load: restore or create identity from localStorage
 * - On load: restore tree from localStorage or create seed tree
 * - Input box: type text + Enter or click "Observe"
 * - Creates a DOT (signed, hashed, chained)
 * - Adds as a leaf to the "observe" branch
 * - Re-renders the tree in the DOM
 * - Shows the DOT hash as confirmation toast
 * - Export button: download tree as JSON
 * - Verify button: verify all chain hashes
 */

/**
 * Returns the inline application script block (without <script> tags).
 * Call appScript() to get the full <script>...</script> string.
 */
export function appScript(): string {
  return `<script type="module">
// ── App Bootstrap ─────────────────────────────────────────────────────────
(async function() {
  'use strict';

  const TREE_KEY = 'dot-tree-v1';

  // ── State ────────────────────────────────────────────────────────────────

  let identity = null;
  let tree = { nodes: {}, roots: [], chainHead: null, dotCount: 0 };

  // ── DOM refs ─────────────────────────────────────────────────────────────

  const input = document.getElementById('dot-input');
  const submitBtn = document.getElementById('dot-submit');
  const treeContainer = document.getElementById('tree-container');
  const hashDisplay = document.getElementById('dot-hash-display');
  const exportBtn = document.getElementById('dot-export');
  const verifyBtn = document.getElementById('dot-verify');
  const identityDisplay = document.getElementById('dot-identity');

  // ── Init ─────────────────────────────────────────────────────────────────

  async function init() {
    // Load or create identity
    identity = await DotCrypto.loadOrCreateIdentity();
    if (identityDisplay) {
      identityDisplay.textContent = DotCrypto.shortId(identity.publicKey);
      identityDisplay.title = identity.publicKey;
    }

    // Load or seed tree
    loadTree();
    if (Object.keys(tree.nodes).length === 0) {
      await seedTree();
    }

    renderTreeDOM();
  }

  // ── Tree operations ───────────────────────────────────────────────────────

  function seedTree() {
    const now = Date.now();
    const branches = [
      { id: 'observe', label: 'All knowledge begins with observation', type: 'claim' },
      { id: 'flow',    label: 'All action begins with flow',           type: 'claim' },
      { id: 'connect', label: 'All meaning begins with connection',    type: 'claim' },
    ];

    for (const b of branches) {
      const hash = simpleHash(b.label + now);
      const node = {
        hash,
        content: b.label,
        label: b.label,
        branch: b.id,
        type: b.type,
        observer: identity ? identity.publicKey : 'anonymous',
        chainDepth: 0,
        timestamp: now,
        parent: null,
        children: [],
        trust: 1.5,
        signed: false,
      };
      tree.nodes[hash] = node;
      tree.roots.push(hash);
    }
    tree.chainHead = tree.roots[0] || null;
    saveTree();
  }

  async function addObservation(text) {
    if (!text.trim()) return null;

    const now = Date.now();
    const hash = await DotCrypto.hashPayload(text + now + (identity ? identity.publicKey : ''));
    const sig = identity ? await DotCrypto.signPayload(text, identity) : null;

    // Find observe branch root as parent
    const observeRoot = tree.roots.find(h => {
      const n = tree.nodes[h];
      return n && n.branch === 'observe';
    });

    const chainDepth = observeRoot ? (tree.nodes[observeRoot]?.chainDepth ?? 0) + 1 : 1;

    const node = {
      hash,
      content: text,
      label: text.length > 80 ? text.slice(0, 77) + '...' : text,
      branch: 'observe',
      type: 'claim',
      observer: identity ? identity.publicKey : 'anonymous',
      chainDepth,
      timestamp: now,
      parent: observeRoot || null,
      children: [],
      trust: sig ? 1.5 : 0.5,
      signed: !!sig,
      signature: sig ? sig.slice(0, 16) + '...' : null,
    };

    tree.nodes[hash] = node;
    tree.dotCount = (tree.dotCount || 0) + 1;
    tree.chainHead = hash;

    // Attach to parent
    if (observeRoot && tree.nodes[observeRoot]) {
      tree.nodes[observeRoot].children.push(hash);
    }

    saveTree();
    return hash;
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  function saveTree() {
    try {
      localStorage.setItem(TREE_KEY, JSON.stringify(tree));
    } catch (_e) {
      // Storage full or unavailable — silently skip
    }
  }

  function loadTree() {
    try {
      const stored = localStorage.getItem(TREE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.nodes && parsed.roots) {
          tree = parsed;
        }
      }
    } catch (_e) {
      // Corrupted — start fresh
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  function trustClass(trust) {
    if (trust < 0.3) return 'vw-trust-red';
    if (trust < 0.7) return 'vw-trust-yellow';
    if (trust < 1.5) return 'vw-trust-green';
    return 'vw-trust-gold';
  }

  function trustLabel(trust) {
    if (trust < 0.3) return 'low';
    if (trust < 0.7) return 'med';
    if (trust < 1.5) return 'ok';
    return 'high';
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderNode(node, depth) {
    const tc = trustClass(node.trust);
    const preview = node.content.length > 100 ? node.content.slice(0, 97) + '...' : node.content;
    const indent = depth * 16;
    const ts = node.timestamp ? new Date(node.timestamp).toISOString().slice(0, 16).replace('T', ' ') : '';
    const signedBadge = node.signed ? '<span class="vw-type-chip" title="Signed">✓ signed</span>' : '';
    const childNodes = (node.children || []).map(h => {
      const child = tree.nodes[h];
      return child ? renderNode(child, depth + 1) : '';
    }).join('');

    return \`<details class="vw-node vw-node-\${escHtml(node.branch)}" style="margin-left:\${indent}px"
        data-label="\${escHtml(node.label || '')}"
        data-content="\${escHtml(node.content || '')}">
      <summary class="vw-node-summary vw-node-summary-\${escHtml(node.branch)}">
        <span class="vw-trust-badge \${tc}">\${escHtml(trustLabel(node.trust))} \${node.trust.toFixed(1)}</span>
        <span class="vw-type-chip">\${escHtml(node.type || 'claim')}</span>
        \${signedBadge}
        <span class="vw-node-preview">\${escHtml(preview)}</span>
        <span class="vw-node-meta">\${ts}</span>
      </summary>
      <div class="vw-node-detail">
        <div class="vw-detail-content">\${escHtml(node.content)}</div>
        <div class="vw-detail-meta">
          <div class="vw-detail-meta-item">
            <span class="vw-detail-meta-key">Hash</span>
            <span class="vw-detail-meta-val">\${escHtml(node.hash)}</span>
          </div>
          <div class="vw-detail-meta-item">
            <span class="vw-detail-meta-key">Observer</span>
            <span class="vw-detail-meta-val" title="\${escHtml(node.observer)}">\${escHtml(node.observer.slice(0,8))}…</span>
          </div>
          <div class="vw-detail-meta-item">
            <span class="vw-detail-meta-key">Chain depth</span>
            <span class="vw-detail-meta-val">\${node.chainDepth}</span>
          </div>
          \${node.signature ? \`<div class="vw-detail-meta-item">
            <span class="vw-detail-meta-key">Sig</span>
            <span class="vw-detail-meta-val">\${escHtml(node.signature)}</span>
          </div>\` : ''}
        </div>
      </div>
      \${childNodes}
    </details>\`;
  }

  const BRANCH_META = {
    observe: { icon: '\\u{1F441}', accent: '#818cf8' },
    flow:    { icon: '\\u{1F30A}', accent: '#34d399' },
    connect: { icon: '\\u{1F517}', accent: '#fbbf24' },
  };

  function renderTreeDOM() {
    if (!treeContainer) return;

    const dotCount = Object.keys(tree.nodes).length;
    const docTitle = document.querySelector('.vw-title');
    if (docTitle) docTitle.textContent = 'DOT Protocol — Live Tree';
    const docMeta = document.querySelector('.vw-meta');
    if (docMeta) docMeta.textContent = dotCount + ' observations · ' + (identity ? DotCrypto.shortId(identity.publicKey) : 'anon');

    // Group roots by branch
    const branchRoots = {};
    for (const h of (tree.roots || [])) {
      const n = tree.nodes[h];
      if (n && !branchRoots[n.branch]) branchRoots[n.branch] = n;
    }

    const branchOrder = ['observe', 'flow', 'connect'];
    let html = '';

    for (const branch of branchOrder) {
      const root = branchRoots[branch];
      if (!root) continue;
      const meta = BRANCH_META[branch] || { icon: '\\u25C6', accent: '#818cf8' };
      const count = countDescendants(root.hash);

      html += \`<details class="vw-branch" open>
        <summary class="vw-branch-summary" style="border-left-color:\${meta.accent}">
          <span class="vw-branch-icon">\${meta.icon}</span>
          <span class="vw-branch-name">\${branch}</span>
          <span class="vw-branch-count">\${count}</span>
        </summary>
        <div class="vw-branch-body">
          \${renderNode(root, 0)}
        </div>
      </details>\`;
    }

    treeContainer.innerHTML = html || '<div style="color:#71717a;padding:24px">Empty tree.</div>';

    // Re-attach search if present
    if (typeof window.dotSearch === 'function') window.dotSearch();
  }

  function countDescendants(hash, visited) {
    visited = visited || new Set();
    if (visited.has(hash)) return 0;
    visited.add(hash);
    const n = tree.nodes[hash];
    if (!n) return 0;
    return 1 + (n.children || []).reduce((s, c) => s + countDescendants(c, visited), 0);
  }

  // ── Simple hash (for seeding only, no crypto) ─────────────────────────────

  function simpleHash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0') + Math.random().toString(16).slice(2, 18);
  }

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg, isError) {
    if (!hashDisplay) return;
    hashDisplay.textContent = msg;
    hashDisplay.style.display = 'block';
    hashDisplay.style.color = isError ? '#f87171' : '#34d399';
    clearTimeout(hashDisplay._timer);
    hashDisplay._timer = setTimeout(() => { hashDisplay.style.display = 'none'; }, 3000);
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  async function handleObserve() {
    const text = input ? input.value.trim() : '';
    if (!text) {
      showToast('Type something to observe first', true);
      return;
    }

    submitBtn && (submitBtn.disabled = true);
    submitBtn && (submitBtn.textContent = 'Observing…');

    try {
      const hash = await addObservation(text);
      if (hash) {
        if (input) input.value = '';
        renderTreeDOM();
        showToast('DOT: ' + hash.slice(0, 20) + '…', false);
      }
    } catch (e) {
      showToast('Error: ' + e.message, true);
    } finally {
      submitBtn && (submitBtn.disabled = false);
      submitBtn && (submitBtn.textContent = 'Observe');
    }
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', handleObserve);
  }

  if (input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleObserve();
      }
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      const json = JSON.stringify(tree, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dot-tree-' + Date.now() + '.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Tree exported as JSON', false);
    });
  }

  if (verifyBtn) {
    verifyBtn.addEventListener('click', async function() {
      const nodes = Object.values(tree.nodes);
      const signed = nodes.filter(n => n.signed).length;
      const total = nodes.length;
      showToast(\`Verified: \${signed}/\${total} nodes signed\`, false);
    });
  }

  // ── Search wiring ─────────────────────────────────────────────────────────

  window.dotSearch = function() {
    const searchInput = document.getElementById('vw-search');
    if (!searchInput) return;
    searchInput.addEventListener('input', function() {
      const q = searchInput.value.trim().toLowerCase();
      const nodes = document.querySelectorAll('.vw-node');
      const branches = document.querySelectorAll('.vw-branch');
      const noRes = document.getElementById('vw-no-results');

      if (!q) {
        nodes.forEach(n => n.style.display = '');
        branches.forEach(b => b.style.display = '');
        if (noRes) noRes.style.display = 'none';
        return;
      }

      let matched = 0;
      nodes.forEach(n => n.style.display = 'none');
      branches.forEach(b => b.style.display = 'none');

      nodes.forEach(function(n) {
        const label = (n.getAttribute('data-label') || '').toLowerCase();
        const content = (n.getAttribute('data-content') || '').toLowerCase();
        if (label.includes(q) || content.includes(q)) {
          n.style.display = '';
          let cur = n.parentElement;
          while (cur) {
            if (cur.tagName === 'DETAILS') cur.open = true;
            if (cur.style) cur.style.display = '';
            cur = cur.parentElement;
          }
          matched++;
        }
      });

      if (noRes) noRes.style.display = matched === 0 ? 'block' : 'none';
    });
  };

  // ── Start ─────────────────────────────────────────────────────────────────
  await init();

})();
</script>`;
}
