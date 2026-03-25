/**
 * storage/indexeddb.ts — Browser-compatible chain storage.
 *
 * MemoryStorage: Map-based in-memory store that mirrors IndexedDB API shape.
 * Used in Node.js tests and anywhere real IndexedDB is unavailable.
 *
 * IndexedDBStorage: Real IndexedDB in browsers, auto-falls back to MemoryStorage
 * in Node.js / test runner environments.
 *
 * Tests marked .browser.test.ts cover real IndexedDB via Playwright.
 */

import type { DOT } from '@dot-protocol/core';

// ── Shared interface ──────────────────────────────────────────────────────

export interface DotStorage {
  open(): Promise<void>;
  get(hash: string): Promise<DOT | null>;
  put(hash: string, dot: DOT): Promise<void>;
  has(hash: string): Promise<boolean>;
  list(): Promise<DOT[]>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

// ── Memory store ──────────────────────────────────────────────────────────

/**
 * Map-based in-memory DOT store.
 * Implements the same async interface as IndexedDBStorage.
 * Used in Node.js tests and environments without real IndexedDB.
 */
export class MemoryStorage implements DotStorage {
  private store: Map<string, DOT> = new Map();
  private opened = false;

  async open(): Promise<void> {
    this.opened = true;
  }

  async get(hash: string): Promise<DOT | null> {
    this.assertOpen();
    return this.store.get(hash) ?? null;
  }

  async put(hash: string, dot: DOT): Promise<void> {
    this.assertOpen();
    this.store.set(hash, dot);
  }

  async has(hash: string): Promise<boolean> {
    this.assertOpen();
    return this.store.has(hash);
  }

  async list(): Promise<DOT[]> {
    this.assertOpen();
    return Array.from(this.store.values());
  }

  async count(): Promise<number> {
    this.assertOpen();
    return this.store.size;
  }

  async clear(): Promise<void> {
    this.assertOpen();
    this.store.clear();
  }

  private assertOpen(): void {
    if (!this.opened) throw new Error('MemoryStorage: call open() before use');
  }
}

// ── IndexedDB store ───────────────────────────────────────────────────────

/**
 * IndexedDB-backed DOT storage for browser environments.
 *
 * Falls back to MemoryStorage in Node.js / SSR where indexedDB is unavailable.
 *
 * @example
 * const storage = new IndexedDBStorage('dot-chain');
 * await storage.open();
 * await storage.put('abc123', dot);
 * const retrieved = await storage.get('abc123');
 */
export class IndexedDBStorage implements DotStorage {
  private readonly dbName: string;
  private readonly storeName: string;
  private db: IDBDatabase | null = null;
  private fallback: MemoryStorage | null = null;

  constructor(dbName = 'dot-protocol', storeName = 'dots') {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  async open(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      this.fallback = new MemoryStorage();
      await this.fallback.open();
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);

      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'hash' });
        }
      };

      req.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      req.onerror = () => reject(new Error(`IndexedDB open failed: ${req.error?.message}`));
    });
  }

  async get(hash: string): Promise<DOT | null> {
    if (this.fallback) return this.fallback.get(hash);
    this.assertDb();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).get(hash);
      req.onsuccess = () => {
        const result = req.result as ({ hash: string; dot: DOT } | undefined);
        resolve(result?.dot ?? null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async put(hash: string, dot: DOT): Promise<void> {
    if (this.fallback) return this.fallback.put(hash, dot);
    this.assertDb();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const req = tx.objectStore(this.storeName).put({ hash, dot });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async has(hash: string): Promise<boolean> {
    if (this.fallback) return this.fallback.has(hash);
    this.assertDb();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).count(hash);
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => reject(req.error);
    });
  }

  async list(): Promise<DOT[]> {
    if (this.fallback) return this.fallback.list();
    this.assertDb();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).getAll();
      req.onsuccess = () => {
        const rows = req.result as Array<{ hash: string; dot: DOT }>;
        resolve(rows.map((r) => r.dot));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async count(): Promise<number> {
    if (this.fallback) return this.fallback.count();
    this.assertDb();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const req = tx.objectStore(this.storeName).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async clear(): Promise<void> {
    if (this.fallback) return this.fallback.clear();
    this.assertDb();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.storeName, 'readwrite');
      const req = tx.objectStore(this.storeName).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private assertDb(): void {
    if (!this.db) throw new Error('IndexedDBStorage: call open() before use');
  }
}
