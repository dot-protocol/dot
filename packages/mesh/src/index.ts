/**
 * @dot-protocol/mesh — Content-addressed peer-to-peer DOT routing.
 *
 * R854: Nodes discover each other, broadcast DOTs, and request DOTs by hash.
 * All networking is pluggable via Transport. MemoryTransport enables fast unit tests.
 */

// Transport
export type { Transport } from './transport/interface.js';
export { MemoryHub, MemoryTransport } from './transport/memory.js';
export { WSTransport, createWSTransport } from './transport/ws.js';
export type { WSTransportConfig, WSNodeConfig, WSNodeResult } from './transport/ws.js';

// Node
export { createNode } from './node.js';
export type { MeshNode, MeshNodeConfig, PeerEntry } from './node.js';

// Protocol
export { encodeMeshMessage, decodeMeshMessage } from './protocol.js';
export type { MeshMessage, MeshMessageType } from './protocol.js';

// Broadcast
export { broadcast } from './broadcast.js';

// Routing
export { request, resolve, clearResolveCache } from './routing.js';

// Gossip
export {
  startGossip,
  stopGossip,
  startGossipWithContext,
  runGossipRoundWithContext,
} from './gossip.js';
export type { GossipHandle, GossipContext } from './gossip.js';

// Health
export {
  health,
  detectPartition,
  startMonitor,
  stopMonitor,
  clearPartitionHistory,
} from './health.js';
export type { MeshHealthReport, MonitorHandle } from './health.js';
