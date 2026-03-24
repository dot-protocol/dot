/**
 * NodeFSBackend — Node.js filesystem backend using synchronous fs APIs.
 *
 * Wraps the standard `node:fs` sync methods. Suitable for CLI tools,
 * scripts, and server-side usage where sync I/O is acceptable.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FSBackend, StatResult } from './interface.js';

export class NodeFSBackend implements FSBackend {
  writeFile(filePath: string, data: Uint8Array): void {
    // Ensure parent directory exists
    const parent = path.dirname(filePath);
    fs.mkdirSync(parent, { recursive: true });
    fs.writeFileSync(filePath, data);
  }

  readFile(filePath: string): Uint8Array {
    const buf = fs.readFileSync(filePath);
    return new Uint8Array(buf);
  }

  exists(filePath: string): boolean {
    try {
      fs.accessSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  unlink(filePath: string): void {
    fs.unlinkSync(filePath);
  }

  list(dir: string): string[] {
    const entries = fs.readdirSync(dir);
    return entries;
  }

  mkdir(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
  }

  stat(filePath: string): StatResult {
    const s = fs.statSync(filePath);
    return {
      size: s.size,
      mtime: s.mtimeMs,
    };
  }
}
