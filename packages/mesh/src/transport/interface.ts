/**
 * Transport — abstract interface for mesh network communication.
 *
 * Implementations: MemoryTransport (in-process, for tests), future: TCP, WebSocket, etc.
 */

/**
 * A pluggable network transport for MeshNode communication.
 *
 * All messages are raw bytes. Higher-level framing (MeshMessage) is applied on top.
 */
export interface Transport {
  /**
   * Send raw bytes to a peer identified by peerId.
   * Resolves when the send is handed off (delivery is best-effort).
   */
  send(peerId: string, data: Uint8Array): Promise<void>;

  /**
   * Register a handler to receive incoming messages.
   * Called once during node setup. The handler receives the sender's peerId and raw bytes.
   */
  onMessage(handler: (peerId: string, data: Uint8Array) => void): void;

  /**
   * Connect to a remote address and return the resolved peerId.
   *
   * For MemoryTransport, address IS the peerId (the registered nodeId).
   */
  connect(address: string): Promise<string>;

  /**
   * Disconnect from a peer and clean up the connection.
   */
  disconnect(peerId: string): void;

  /**
   * Return the list of currently connected peer IDs.
   */
  peers(): string[];
}
