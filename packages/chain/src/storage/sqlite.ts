/**
 * SQLiteStorage — file-backed StorageBackend using better-sqlite3.
 *
 * Table: dots (hash TEXT PK, bytes BLOB, depth INT, timestamp INT, type TEXT, observer TEXT)
 * Uses prepared statements and WAL mode for performance.
 */

import Database from 'better-sqlite3';
import type { Statement } from 'better-sqlite3';
import { toBytes, fromBytes } from '@dot-protocol/core';
import type { DOT } from '@dot-protocol/core';
import type { StorageBackend, ListOptions } from './interface.js';

export class SQLiteStorage implements StorageBackend {
  readonly name = 'sqlite';
  private readonly db: InstanceType<typeof Database>;

  private readonly stmtGet: Statement;
  private readonly stmtPut: Statement;
  private readonly stmtHas: Statement;
  private readonly stmtCount: Statement;
  private readonly stmtClear: Statement;

  constructor(path: string) {
    this.db = new Database(path);

    // WAL mode for concurrent reads and fast writes
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dots (
        hash      TEXT PRIMARY KEY,
        bytes     BLOB NOT NULL,
        depth     INTEGER NOT NULL DEFAULT 0,
        timestamp INTEGER NOT NULL DEFAULT 0,
        type      TEXT,
        observer  TEXT
      )
    `);

    this.stmtGet = this.db.prepare('SELECT bytes FROM dots WHERE hash = ?');
    this.stmtPut = this.db.prepare(
      'INSERT OR REPLACE INTO dots (hash, bytes, depth, timestamp, type, observer) VALUES (?, ?, ?, ?, ?, ?)'
    );
    this.stmtHas = this.db.prepare('SELECT 1 FROM dots WHERE hash = ?');
    this.stmtCount = this.db.prepare('SELECT COUNT(*) as n FROM dots');
    this.stmtClear = this.db.prepare('DELETE FROM dots');
  }

  get(hash: string): DOT | null {
    const row = this.stmtGet.get(hash) as { bytes: Buffer } | undefined;
    if (row === undefined) return null;
    return fromBytes(new Uint8Array(row.bytes));
  }

  put(dot: DOT, hash: string, meta?: { depth?: number; timestamp?: number }): void {
    const bytes = toBytes(dot);
    const depth = meta?.depth ?? dot.chain?.depth ?? 0;
    const timestamp = meta?.timestamp ?? dot.time?.utc ?? 0;
    const type = dot.type ?? null;
    const observer =
      dot.sign?.observer !== undefined
        ? Buffer.from(dot.sign.observer).toString('hex')
        : null;

    this.stmtPut.run(hash, Buffer.from(bytes), depth, timestamp, type, observer);
  }

  has(hash: string): boolean {
    const row = this.stmtHas.get(hash);
    return row !== undefined;
  }

  list(opts?: ListOptions): DOT[] {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (opts?.type !== undefined) {
      conditions.push('type = ?');
      params.push(opts.type);
    }

    if (opts?.minDepth !== undefined) {
      conditions.push('depth >= ?');
      params.push(opts.minDepth);
    }

    if (opts?.maxDepth !== undefined) {
      conditions.push('depth <= ?');
      params.push(opts.maxDepth);
    }

    if (opts?.since !== undefined) {
      conditions.push('timestamp >= ?');
      params.push(opts.since);
    }

    if (opts?.until !== undefined) {
      conditions.push('timestamp <= ?');
      params.push(opts.until);
    }

    if (opts?.observer !== undefined) {
      conditions.push('observer = ?');
      params.push(opts.observer);
    }

    let sql = 'SELECT bytes FROM dots';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    if (opts?.limit !== undefined && opts.limit > 0) {
      sql += ' LIMIT ?';
      params.push(opts.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as { bytes: Buffer }[];
    return rows.map((r) => fromBytes(new Uint8Array(r.bytes)));
  }

  count(): number {
    const row = this.stmtCount.get() as { n: number };
    return row.n;
  }

  clear(): void {
    this.stmtClear.run();
  }

  /** Close the underlying database connection. */
  close(): void {
    this.db.close();
  }
}
