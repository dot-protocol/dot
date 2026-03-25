/**
 * sample.ts — Generate a realistic sample ViewerTree for testing and demos.
 *
 * Produces ~20 nodes across 3 root branches: observe, flow, connect.
 * Mix of trust levels, types, and chain depths.
 */

import type { ViewerTree, ViewerNode } from './types.js';

function makeHash(seed: string): string {
  // Deterministic pseudo-hash for testing
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0') + seed.slice(0, 8).replace(/[^a-f0-9]/gi, '0').padEnd(8, '0');
}

function obs(seed: string): string {
  return 'obs' + makeHash(seed).slice(0, 10);
}

/** Creates a sample ~20-node ViewerTree spanning 3 root branches. */
export function createSampleTree(): ViewerTree {
  const now = Date.now();

  // ── Observe branch ────────────────────────────────────────────
  const obsRoot: ViewerNode = {
    hash: obs('observe-root'),
    label: 'Temperature Anomaly 2041',
    content: 'Global mean surface temperature anomaly for 2041 relative to 1850-1900 baseline.',
    branch: 'observe',
    depth: 0,
    children: [obs('obs-child-1'), obs('obs-child-2'), obs('obs-child-3')],
    trust: 2.5,
    chainDepth: 512,
    observer: 'a1b2c3d4e5f6',
    timestamp: now - 86_400_000 * 30,
    type: 'measure',
  };

  const obsChild1: ViewerNode = {
    hash: obs('obs-child-1'),
    label: 'Station: Reykjavik +2.1°C',
    content: 'Reykjavik station recorded +2.1°C above baseline. Sensor ID: RKV-009. Calibration current.',
    branch: 'observe',
    depth: 1,
    children: [obs('obs-leaf-1')],
    parent: obs('observe-root'),
    trust: 1.8,
    chainDepth: 48,
    observer: 'f1e2d3c4b5a6',
    timestamp: now - 86_400_000 * 25,
    type: 'measure',
  };

  const obsChild2: ViewerNode = {
    hash: obs('obs-child-2'),
    label: 'Station: Singapore +2.4°C',
    content: 'Singapore station recorded +2.4°C above baseline. Sensor ID: SGP-017.',
    branch: 'observe',
    depth: 1,
    children: [obs('obs-leaf-2')],
    parent: obs('observe-root'),
    trust: 1.2,
    chainDepth: 22,
    observer: 'c9d8e7f6a5b4',
    timestamp: now - 86_400_000 * 20,
    type: 'measure',
  };

  const obsChild3: ViewerNode = {
    hash: obs('obs-child-3'),
    label: 'Unverified: Arctic ice loss claim',
    content: 'Claim: Arctic summer sea ice extent below 1M km² for first time. Source unverified.',
    branch: 'observe',
    depth: 1,
    children: [],
    parent: obs('observe-root'),
    trust: 0.2,
    chainDepth: 1,
    observer: 'deadbeef0001',
    timestamp: now - 86_400_000 * 5,
    type: 'claim',
  };

  const obsLeaf1: ViewerNode = {
    hash: obs('obs-leaf-1'),
    label: 'Cross-check: ECMWF confirms RKV',
    content: 'ECMWF reanalysis confirms Reykjavik anomaly. Delta: 0.03°C (within instrument error).',
    branch: 'observe',
    depth: 2,
    children: [],
    parent: obs('obs-child-1'),
    trust: 1.9,
    chainDepth: 49,
    observer: 'a1b2c3d4e5f6',
    timestamp: now - 86_400_000 * 24,
    type: 'event',
  };

  const obsLeaf2: ViewerNode = {
    hash: obs('obs-leaf-2'),
    label: 'Dispute: SGP sensor offset noted',
    content: 'SGP-017 has known +0.15°C offset from urban heat island. Correction pending.',
    branch: 'observe',
    depth: 2,
    children: [],
    parent: obs('obs-child-2'),
    trust: 0.5,
    chainDepth: 5,
    observer: '1234567890ab',
    timestamp: now - 86_400_000 * 18,
    type: 'claim',
  };

  // ── Flow branch ───────────────────────────────────────────────
  const flowRoot: ViewerNode = {
    hash: obs('flow-root'),
    label: 'Carbon Credit Issuance #CC-2041-447',
    content: 'Issuance of 10,000 tCO2e credits. Verification: Verra VCS. Vintage: 2040.',
    branch: 'flow',
    depth: 0,
    children: [obs('flow-child-1'), obs('flow-child-2')],
    trust: 1.4,
    chainDepth: 103,
    observer: 'b2a3c4d5e6f7',
    timestamp: now - 86_400_000 * 60,
    type: 'event',
  };

  const flowChild1: ViewerNode = {
    hash: obs('flow-child-1'),
    label: 'Purchase: GreenFund → EcoCorp',
    content: 'Transfer of 5,000 tCO2e from GreenFund registry to EcoCorp account. Tx: 0xabc…',
    branch: 'flow',
    depth: 1,
    children: [obs('flow-leaf-1'), obs('flow-leaf-2')],
    parent: obs('flow-root'),
    trust: 1.1,
    chainDepth: 12,
    observer: 'd5e6f7a8b9c0',
    timestamp: now - 86_400_000 * 45,
    type: 'event',
  };

  const flowChild2: ViewerNode = {
    hash: obs('flow-child-2'),
    label: 'Retirement: 2,500 tCO2e retired',
    content: '2,500 tCO2e retired by EcoCorp for 2041 compliance reporting.',
    branch: 'flow',
    depth: 1,
    children: [],
    parent: obs('flow-root'),
    trust: 1.6,
    chainDepth: 200,
    observer: 'b2a3c4d5e6f7',
    timestamp: now - 86_400_000 * 15,
    type: 'event',
  };

  const flowLeaf1: ViewerNode = {
    hash: obs('flow-leaf-1'),
    label: 'Audit trail hash mismatch',
    content: 'Internal audit found hash mismatch in Tx 0xabc…. Under investigation.',
    branch: 'flow',
    depth: 2,
    children: [],
    parent: obs('flow-child-1'),
    trust: 0.1,
    chainDepth: 0,
    observer: 'cafebabeface',
    timestamp: now - 86_400_000 * 10,
    type: 'claim',
  };

  const flowLeaf2: ViewerNode = {
    hash: obs('flow-leaf-2'),
    label: 'Third-party verification: OK',
    content: 'Verra independent verifier confirms credit issuance meets VCS standard.',
    branch: 'flow',
    depth: 2,
    children: [],
    parent: obs('flow-child-1'),
    trust: 1.3,
    chainDepth: 14,
    observer: 'd5e6f7a8b9c0',
    timestamp: now - 86_400_000 * 8,
    type: 'event',
  };

  // ── Connect branch ────────────────────────────────────────────
  const connectRoot: ViewerNode = {
    hash: obs('connect-root'),
    label: 'Climate ↔ Financial Risk Nexus',
    content: 'Correlation analysis linking temperature anomaly data to carbon credit pricing.',
    branch: 'connect',
    depth: 0,
    children: [obs('connect-child-1'), obs('connect-child-2'), obs('connect-child-3')],
    trust: 0.8,
    chainDepth: 7,
    observer: 'e6f7a8b9c0d1',
    timestamp: now - 86_400_000 * 12,
    type: 'measure',
  };

  const connectChild1: ViewerNode = {
    hash: obs('connect-child-1'),
    label: 'r=0.71 (temp anomaly → price)',
    content: 'Pearson correlation r=0.71 between monthly global anomaly and VCS spot price. N=24.',
    branch: 'connect',
    depth: 1,
    children: [],
    parent: obs('connect-root'),
    trust: 0.9,
    chainDepth: 8,
    observer: 'e6f7a8b9c0d1',
    timestamp: now - 86_400_000 * 11,
    type: 'measure',
  };

  const connectChild2: ViewerNode = {
    hash: obs('connect-child-2'),
    label: 'Causal claim: extreme weather drives demand',
    content: 'Assertion: each +0.1°C above 2.0°C threshold raises demand by ~3% quarterly.',
    branch: 'connect',
    depth: 1,
    children: [obs('connect-leaf-1')],
    parent: obs('connect-root'),
    trust: 0.4,
    chainDepth: 3,
    observer: '1111222233334',
    timestamp: now - 86_400_000 * 9,
    type: 'claim',
  };

  const connectChild3: ViewerNode = {
    hash: obs('connect-child-3'),
    label: 'Model: LSTM price forecast',
    content: 'LSTM model trained on 5Y of VCS price + anomaly data. RMSE: 0.42 USD/tCO2e.',
    branch: 'connect',
    depth: 1,
    children: [],
    parent: obs('connect-root'),
    trust: 1.0,
    chainDepth: 15,
    observer: 'f7a8b9c0d1e2',
    timestamp: now - 86_400_000 * 7,
    type: 'measure',
  };

  const connectLeaf1: ViewerNode = {
    hash: obs('connect-leaf-1'),
    label: 'Counter: no causal evidence found',
    content: 'Systematic review found no peer-reviewed evidence for the 3% quarterly demand claim.',
    branch: 'connect',
    depth: 2,
    children: [],
    parent: obs('connect-child-2'),
    trust: 0.6,
    chainDepth: 4,
    observer: 'aabbccddeeff',
    timestamp: now - 86_400_000 * 6,
    type: 'claim',
  };

  const nodes: ViewerNode[] = [
    obsRoot, obsChild1, obsChild2, obsChild3, obsLeaf1, obsLeaf2,
    flowRoot, flowChild1, flowChild2, flowLeaf1, flowLeaf2,
    connectRoot, connectChild1, connectChild2, connectChild3, connectLeaf1,
    connectChild3, connectLeaf1,
  ];

  // Deduplicate by hash
  const seen = new Set<string>();
  const dedupedNodes: ViewerNode[] = [];
  for (const n of nodes) {
    if (!seen.has(n.hash)) {
      seen.add(n.hash);
      dedupedNodes.push(n);
    }
  }

  return {
    nodes: dedupedNodes,
    roots: [obs('observe-root'), obs('flow-root'), obs('connect-root')],
    title: 'Climate Trust Registry — R855 Sample',
    created: now,
  };
}
