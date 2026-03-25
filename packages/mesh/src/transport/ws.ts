/**
 * ws.ts — WebSocket transport for MeshNode.
 *
 * Supports two modes:
 *   SERVER: creates a WebSocketServer and accepts inbound connections.
 *   CLIENT: connects to a remote ws://host:port server.
 *
 * Protocol:
 *   - Binary frames only (no text messages accepted)
 *   - First message after connect: 32-byte identity frame (public key)
 *   - Subsequent messages: raw MeshMessage bytes (encoded via protocol.ts)
 *   - Heartbeat: ping every 30s; disconnect peer after 3 consecutive missed pongs
 *
 * Reconnection (CLIENT only):
 *   - Exponential backoff: 1s, 2s, 4s, 8s, max 30s
 *   - On reconnect, re-sends identity frame to re-establish identity
 */

import { WebSocket, WebSocketServer } from 'ws';
import type { Transport } from './interface.js';

/** Configuration for WSTransport */
export interface WSTransportConfig {
  /** Port to listen on (SERVER mode). If omitted, operates as CLIENT only. */
  port?: number;
  /** Host to bind server to (default '0.0.0.0'). */
  host?: string;
  /** Own 32-byte public key, used as identity frame on connect. */
  publicKey?: Uint8Array;
  /** Heartbeat interval in ms (default 30000). */
  heartbeatIntervalMs?: number;
  /** Max missed pongs before disconnect (default 3). */
  maxMissedPongs?: number;
  /** Reconnection: initial backoff in ms (default 1000). */
  reconnectInitialMs?: number;
  /** Reconnection: max backoff in ms (default 30000). */
  reconnectMaxMs?: number;
}

interface PeerState {
  ws: WebSocket;
  peerId: string;
  missedPongs: number;
  /** Address for reconnection (client-initiated connections only) */
  reconnectAddress?: string;
  reconnectAttempts: number;
  reconnecting: boolean;
  reconnectTimer?: ReturnType<typeof setTimeout>;
}

/**
 * WebSocket-based Transport implementation.
 *
 * Create one per node. Use WSTransport.listen() to start a server (optional),
 * then use connect(address) to connect to peers.
 */
export class WSTransport implements Transport {
  private readonly config: Required<WSTransportConfig>;
  private server: WebSocketServer | null = null;
  private messageHandler: ((peerId: string, data: Uint8Array) => void) | null = null;
  private readonly peerMap = new Map<string, PeerState>(); // peerId -> state
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(config: WSTransportConfig = {}) {
    this.config = {
      port: config.port ?? 0,
      host: config.host ?? '0.0.0.0',
      publicKey: config.publicKey ?? new Uint8Array(32),
      heartbeatIntervalMs: config.heartbeatIntervalMs ?? 30000,
      maxMissedPongs: config.maxMissedPongs ?? 3,
      reconnectInitialMs: config.reconnectInitialMs ?? 1000,
      reconnectMaxMs: config.reconnectMaxMs ?? 30000,
    };
  }

  /**
   * Start the WebSocket server (if port configured).
   * Must be called before the transport is ready to accept inbound connections.
   * Returns the actual bound port (useful when port=0 for OS-assigned port).
   */
  async listen(): Promise<number> {
    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({
        port: this.config.port,
        host: this.config.host,
      });

      wss.once('error', reject);

      wss.once('listening', () => {
        this.server = wss;
        const addr = wss.address();
        const port = typeof addr === 'object' && addr !== null ? addr.port : this.config.port;
        this.startHeartbeat();
        resolve(port);
      });

      wss.on('connection', (ws: WebSocket) => {
        this.handleInboundConnection(ws);
      });
    });
  }

  /** Handle a new inbound WebSocket connection from a server. */
  private handleInboundConnection(ws: WebSocket): void {
    // Peer ID is determined by the first binary frame (identity frame)
    let peerId: string | null = null;
    let identityResolved = false;

    ws.binaryType = 'nodebuffer';

    ws.once('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      const buf = toBuffer(data);
      if (buf.length < 1) {
        ws.close();
        return;
      }

      // First message is the identity frame (32-byte public key OR hex-encoded peer id)
      // We accept both: a 32-byte raw key becomes hex, or a longer buffer is treated as hex string
      if (buf.length === 32) {
        peerId = Buffer.from(buf).toString('hex');
      } else {
        // Treat as hex string
        peerId = Buffer.from(buf).toString('utf8');
      }

      identityResolved = true;

      const state: PeerState = {
        ws,
        peerId,
        missedPongs: 0,
        reconnectAttempts: 0,
        reconnecting: false,
      };
      this.peerMap.set(peerId, state);

      // Send our own identity frame back
      this.sendIdentityFrame(ws);

      // Now handle subsequent messages
      ws.on('message', (msgData: Buffer | ArrayBuffer | Buffer[]) => {
        const msgBuf = toBuffer(msgData);
        if (peerId !== null && this.messageHandler !== null) {
          this.messageHandler(peerId, new Uint8Array(msgBuf));
        }
      });

      ws.on('pong', () => {
        const s = peerId !== null ? this.peerMap.get(peerId) : undefined;
        if (s !== undefined) {
          s.missedPongs = 0;
        }
      });

      ws.on('close', () => {
        if (peerId !== null) {
          this.peerMap.delete(peerId);
        }
      });

      ws.on('error', () => {
        if (peerId !== null) {
          this.peerMap.delete(peerId);
        }
      });
    });

    ws.on('error', () => {
      if (identityResolved && peerId !== null) {
        this.peerMap.delete(peerId);
      }
    });

    ws.on('close', () => {
      if (identityResolved && peerId !== null) {
        this.peerMap.delete(peerId);
      }
    });
  }

  /** Send our identity frame to a WebSocket connection. */
  private sendIdentityFrame(ws: WebSocket): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(Buffer.from(this.config.publicKey));
    }
  }

  /** Start the heartbeat interval for all peers. */
  private startHeartbeat(): void {
    if (this.heartbeatInterval !== null) return;
    this.heartbeatInterval = setInterval(() => {
      this.runHeartbeat();
    }, this.config.heartbeatIntervalMs);
  }

  /** Ping all peers; disconnect those that have missed too many pongs. */
  private runHeartbeat(): void {
    for (const [peerId, state] of this.peerMap) {
      if (state.missedPongs >= this.config.maxMissedPongs) {
        state.ws.terminate();
        this.peerMap.delete(peerId);
        // If client-initiated, attempt reconnect
        if (state.reconnectAddress !== undefined) {
          void this.scheduleReconnect(state);
        }
        continue;
      }
      state.missedPongs++;
      if (state.ws.readyState === WebSocket.OPEN) {
        state.ws.ping();
      }
    }
  }

  /** Schedule a reconnection attempt with exponential backoff. */
  private async scheduleReconnect(state: PeerState): Promise<void> {
    if (this.closed || state.reconnecting || state.reconnectAddress === undefined) return;
    state.reconnecting = true;

    const backoff = Math.min(
      this.config.reconnectInitialMs * Math.pow(2, state.reconnectAttempts),
      this.config.reconnectMaxMs,
    );

    state.reconnectTimer = setTimeout(async () => {
      if (this.closed) return;
      state.reconnectAttempts++;
      try {
        await this.connectToAddress(state.reconnectAddress!, state);
        state.reconnecting = false;
        state.reconnectAttempts = 0;
      } catch {
        state.reconnecting = false;
        void this.scheduleReconnect(state);
      }
    }, backoff);
  }

  /** Internal: open a WebSocket client connection to an address. */
  private connectToAddress(address: string, existingState?: PeerState): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = address.startsWith('ws://') || address.startsWith('wss://')
        ? address
        : `ws://${address}`;

      const ws = new WebSocket(url);
      ws.binaryType = 'nodebuffer';

      let peerId: string | null = null;
      let settled = false;

      const fail = (err: Error) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      };

      ws.once('open', () => {
        // Send our identity frame immediately
        this.sendIdentityFrame(ws);
      });

      ws.once('error', (err) => {
        fail(err);
      });

      // First message back = server's identity frame (its public key)
      ws.once('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
        const buf = toBuffer(data);

        if (buf.length === 32) {
          peerId = Buffer.from(buf).toString('hex');
        } else {
          peerId = Buffer.from(buf).toString('utf8');
        }

        const state: PeerState = existingState !== undefined
          ? { ...existingState, ws, peerId, missedPongs: 0 }
          : {
              ws,
              peerId,
              missedPongs: 0,
              reconnectAddress: address,
              reconnectAttempts: existingState?.reconnectAttempts ?? 0,
              reconnecting: false,
            };

        this.peerMap.set(peerId, state);

        // Subsequent messages
        ws.on('message', (msgData: Buffer | ArrayBuffer | Buffer[]) => {
          const msgBuf = toBuffer(msgData);
          if (peerId !== null && this.messageHandler !== null) {
            this.messageHandler(peerId, new Uint8Array(msgBuf));
          }
        });

        ws.on('pong', () => {
          const s = peerId !== null ? this.peerMap.get(peerId) : undefined;
          if (s !== undefined) {
            s.missedPongs = 0;
          }
        });

        ws.on('close', () => {
          if (peerId !== null) {
            const s = this.peerMap.get(peerId);
            this.peerMap.delete(peerId);
            // Auto-reconnect for client-initiated connections
            if (!this.closed && s?.reconnectAddress !== undefined) {
              void this.scheduleReconnect(s);
            }
          }
        });

        ws.on('error', () => {
          if (peerId !== null) {
            this.peerMap.delete(peerId);
          }
        });

        if (!settled) {
          settled = true;
          resolve(peerId);
        }
      });

      // Timeout if no identity frame received
      setTimeout(() => {
        if (!settled) {
          settled = true;
          ws.terminate();
          reject(new Error(`WSTransport: identity handshake timed out for ${address}`));
        }
      }, 5000);
    });
  }

  // --- Transport interface ---

  async send(peerId: string, data: Uint8Array): Promise<void> {
    const state = this.peerMap.get(peerId);
    if (state === undefined || state.ws.readyState !== WebSocket.OPEN) {
      return; // Best-effort: drop if peer not connected
    }
    state.ws.send(Buffer.from(data));
  }

  onMessage(handler: (peerId: string, data: Uint8Array) => void): void {
    this.messageHandler = handler;
  }

  async connect(address: string): Promise<string> {
    return this.connectToAddress(address);
  }

  disconnect(peerId: string): void {
    const state = this.peerMap.get(peerId);
    if (state !== undefined) {
      // Clear reconnect timer to prevent auto-reconnect
      if (state.reconnectTimer !== undefined) {
        clearTimeout(state.reconnectTimer);
      }
      state.reconnectAddress = undefined; // Disable auto-reconnect
      state.ws.terminate();
      this.peerMap.delete(peerId);
    }
  }

  peers(): string[] {
    return Array.from(this.peerMap.keys());
  }

  /** Shut down server and all connections. */
  async close(): Promise<void> {
    this.closed = true;

    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Clear all reconnect timers
    for (const state of this.peerMap.values()) {
      if (state.reconnectTimer !== undefined) {
        clearTimeout(state.reconnectTimer);
      }
      state.reconnectAddress = undefined;
      state.ws.terminate();
    }
    this.peerMap.clear();

    if (this.server !== null) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }
  }

  /** Return the bound server port, or null if not listening. */
  get boundPort(): number | null {
    if (this.server === null) return null;
    const addr = this.server.address();
    return typeof addr === 'object' && addr !== null ? addr.port : null;
  }
}

/** Convert ws message data to a Node.js Buffer. */
function toBuffer(data: Buffer | ArrayBuffer | Buffer[]): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data as ArrayBuffer);
}

/**
 * Create a MeshNode with a WSTransport.
 *
 * Convenience helper that creates the transport, optionally starts a server,
 * and wires up a MeshNode ready for real network communication.
 *
 * @param config - WSTransport configuration (port, publicKey, etc.)
 * @returns Object with the transport and bound port.
 */
export interface WSNodeConfig {
  port?: number;
  host?: string;
  publicKey?: Uint8Array;
  heartbeatIntervalMs?: number;
  maxMissedPongs?: number;
}

export interface WSNodeResult {
  transport: WSTransport;
  port: number;
}

/**
 * Create a WSTransport that listens on the given port (0 = OS-assigned).
 * Returns both the transport and the actual bound port.
 */
export async function createWSTransport(config: WSNodeConfig = {}): Promise<WSNodeResult> {
  const transport = new WSTransport(config);
  const port = await transport.listen();
  return { transport, port };
}
