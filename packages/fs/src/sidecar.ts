/**
 * sidecar.ts — DOT sidecar file management.
 *
 * Each managed file has a companion "sidecar" file that stores its DOT chain.
 * The sidecar is named ".{basename}.dot" and lives in the same directory.
 * DOTs are appended to the sidecar in TLV format with a 4-byte length prefix
 * so multiple DOTs can be concatenated and split apart at read time.
 *
 * Sidecar wire format (repeated for each DOT):
 *   [4 bytes: big-endian uint32 length of encoded DOT][encoded DOT bytes]
 */

import { toBytes, fromBytes } from '../../core/src/index.js';
import type { DOT } from '../../core/src/index.js';
import type { FSBackend } from './backends/interface.js';
import * as path from 'node:path';

/**
 * Computes the sidecar path for a given file path.
 *
 * Example: /data/file.txt → /data/.file.txt.dot
 */
export function sidecarPath(filePath: string): string {
  const dir = posixDirname(filePath);
  const base = posixBasename(filePath);
  const sidecarName = '.' + base + '.dot';
  if (dir === '/') return '/' + sidecarName;
  return dir + '/' + sidecarName;
}

/**
 * Returns true if the sidecar file exists for the given file path.
 */
export function sidecarExists(backend: FSBackend, filePath: string): boolean {
  return backend.exists(sidecarPath(filePath));
}

/**
 * Encodes a single DOT with a 4-byte length prefix.
 */
function encodeDOTRecord(dot: DOT): Uint8Array {
  const encoded = toBytes(dot);
  const len = encoded.length;
  const out = new Uint8Array(4 + len);
  out[0] = (len >>> 24) & 0xff;
  out[1] = (len >>> 16) & 0xff;
  out[2] = (len >>> 8) & 0xff;
  out[3] = len & 0xff;
  out.set(encoded, 4);
  return out;
}

/**
 * Appends a DOT to the sidecar file for the given file path.
 * Creates the sidecar if it does not exist, otherwise concatenates.
 */
export function writeSidecar(backend: FSBackend, filePath: string, dot: DOT): void {
  const sp = sidecarPath(filePath);
  const record = encodeDOTRecord(dot);

  if (backend.exists(sp)) {
    // Append to existing sidecar
    const existing = backend.readFile(sp);
    const combined = new Uint8Array(existing.length + record.length);
    combined.set(existing, 0);
    combined.set(record, existing.length);
    backend.writeFile(sp, combined);
  } else {
    // Ensure parent dir exists and create sidecar
    const dir = posixDirname(filePath);
    backend.mkdir(dir);
    backend.writeFile(sp, record);
  }
}

/**
 * Reads all DOTs from the sidecar file for the given file path.
 * Returns an empty array if the sidecar does not exist or is empty.
 * Malformed records are skipped gracefully.
 */
export function readSidecar(backend: FSBackend, filePath: string): DOT[] {
  const sp = sidecarPath(filePath);
  if (!backend.exists(sp)) return [];

  const data = backend.readFile(sp);
  if (data.length === 0) return [];

  const dots: DOT[] = [];
  let pos = 0;

  while (pos < data.length) {
    // Need at least 4 bytes for length prefix
    if (pos + 4 > data.length) break;

    const b0 = data[pos];
    const b1 = data[pos + 1];
    const b2 = data[pos + 2];
    const b3 = data[pos + 3];
    if (b0 === undefined || b1 === undefined || b2 === undefined || b3 === undefined) break;

    const len = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
    pos += 4;

    if (pos + len > data.length) break;

    const encoded = data.slice(pos, pos + len);
    pos += len;

    try {
      const dot = fromBytes(encoded);
      dots.push(dot);
    } catch {
      // Malformed record — skip
    }
  }

  return dots;
}

// ─── Portable path helpers ────────────────────────────────────────────────────
// Using posix-style helpers that work for both memory (virtual paths) and node

function posixDirname(p: string): string {
  // Handle paths that use node path (absolute system paths) vs virtual paths
  const lastSlash = p.lastIndexOf('/');
  if (lastSlash <= 0) return '/';
  return p.slice(0, lastSlash);
}

function posixBasename(p: string): string {
  const lastSlash = p.lastIndexOf('/');
  return p.slice(lastSlash + 1);
}
