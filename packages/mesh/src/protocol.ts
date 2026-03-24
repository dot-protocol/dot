/**
 * protocol.ts — Wire protocol for MeshNode messages.
 *
 * Simple TLV framing:
 *   [1 byte type] [4 bytes length BE] [payload bytes]
 *
 * Message types:
 *   0x01  dot       — carry a serialized DOT
 *   0x02  request   — ask for a DOT by hash
 *   0x03  response  — reply to a request (DOT bytes or empty = not found)
 *   0x04  gossip    — share a list of known hashes
 *   0x05  ping      — liveness probe
 *   0x06  pong      — liveness reply
 */

export type MeshMessageType = 'dot' | 'request' | 'response' | 'gossip' | 'ping' | 'pong';

const TYPE_MAP: Record<MeshMessageType, number> = {
  dot: 0x01,
  request: 0x02,
  response: 0x03,
  gossip: 0x04,
  ping: 0x05,
  pong: 0x06,
};

const BYTE_TO_TYPE: Map<number, MeshMessageType> = new Map(
  Object.entries(TYPE_MAP).map(([k, v]) => [v, k as MeshMessageType]),
);

/** A decoded mesh protocol message. */
export interface MeshMessage {
  /** Message type. */
  type: MeshMessageType;
  /** Raw payload bytes (interpretation depends on type). */
  payload: Uint8Array;
  /** NodeId of the originating sender. */
  from: string;
}

/**
 * Encode a MeshMessage to bytes for transmission.
 *
 * Wire format:
 *   [1 byte type] [4 bytes payload length, big-endian] [payload bytes] [from encoded as UTF-8, length-prefixed with 2 bytes]
 */
export function encodeMeshMessage(msg: MeshMessage): Uint8Array {
  const fromBytes = new TextEncoder().encode(msg.from);
  const fromLen = fromBytes.length;

  // Total: 1 (type) + 4 (payload len) + payload + 2 (from len) + from
  const total = 1 + 4 + msg.payload.length + 2 + fromLen;
  const buf = new Uint8Array(total);
  const view = new DataView(buf.buffer);

  let offset = 0;

  // Type byte
  buf[offset] = TYPE_MAP[msg.type] ?? 0x01;
  offset += 1;

  // Payload length (4 bytes, big-endian)
  view.setUint32(offset, msg.payload.length, false);
  offset += 4;

  // Payload
  buf.set(msg.payload, offset);
  offset += msg.payload.length;

  // From length (2 bytes, big-endian)
  view.setUint16(offset, fromLen, false);
  offset += 2;

  // From bytes
  buf.set(fromBytes, offset);

  return buf;
}

/**
 * Decode raw bytes back into a MeshMessage.
 *
 * @throws Error if the bytes are malformed (insufficient length, unknown type).
 */
export function decodeMeshMessage(bytes: Uint8Array): MeshMessage {
  if (bytes.length < 7) {
    throw new Error(`MeshMessage too short: ${bytes.length} bytes (minimum 7)`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  // Type byte
  const typeByte = bytes[offset];
  offset += 1;

  const type = BYTE_TO_TYPE.get(typeByte ?? 0);
  if (type === undefined) {
    throw new Error(`Unknown MeshMessage type byte: 0x${(typeByte ?? 0).toString(16)}`);
  }

  // Payload length
  const payloadLen = view.getUint32(offset, false);
  offset += 4;

  if (bytes.length < offset + payloadLen + 2) {
    throw new Error(`MeshMessage truncated: expected ${offset + payloadLen + 2} bytes, got ${bytes.length}`);
  }

  // Payload
  const payload = bytes.slice(offset, offset + payloadLen);
  offset += payloadLen;

  // From length
  const fromLen = view.getUint16(offset, false);
  offset += 2;

  if (bytes.length < offset + fromLen) {
    throw new Error(`MeshMessage from field truncated`);
  }

  // From string
  const from = new TextDecoder().decode(bytes.slice(offset, offset + fromLen));

  return { type, payload, from };
}
