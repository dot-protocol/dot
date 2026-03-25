/**
 * @dot-protocol/transport — iroh adapter layer.
 *
 * Bridges DOT chain semantics to iroh's P2P transport (and MemoryTransport
 * for testing without a Rust runtime).
 *
 * Architecture:
 *   DotTransport (interface)
 *     ├── MemoryDotTransport (in-memory, for tests)
 *     └── IrohDotTransport   (production P2P via iroh runtime)
 *
 *   TransportRoom — high-level room API (observe + receive + history)
 *   RoomDiscovery — room discovery registry
 *
 * iroh resources:
 *   - https://github.com/n0-computer/iroh
 *   - https://docs.iroh.computer/
 *   - ALPN: "dot-protocol/1" (register when wiring real iroh)
 */

// Core interface + types
export type { DotTransport, RoomHandle, SyncStatus, Unsubscribe } from './interface.js';

// MemoryDotTransport — in-memory implementation for testing
export { MemoryDotTransport, MemoryTransportHub } from './memory-transport.js';

// IrohDotTransport — production P2P stub
export {
  IrohDotTransport,
  IrohTransportNotConnectedError,
} from './iroh-transport.js';
export type { IrohTransportConfig } from './iroh-transport.js';

// TransportRoom — high-level room operations
export { TransportRoom } from './room-transport.js';
export type { TransportRoomConfig, TransportSyncResult } from './room-transport.js';

// RoomDiscovery
export { RoomDiscovery } from './discovery.js';
export type { DiscoveredRoom } from './discovery.js';
