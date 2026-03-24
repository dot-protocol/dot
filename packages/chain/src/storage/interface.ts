/**
 * StorageBackend — pluggable persistence interface for DOT chains.
 *
 * Implementations: MemoryStorage (in-process), SQLiteStorage (file-backed).
 */

import type { DOT, ObservationType } from '@dot-protocol/core';

/** Options for listing DOTs from storage. */
export interface ListOptions {
  /** Maximum number of results to return. */
  limit?: number;
  /** Filter by observation type. */
  type?: ObservationType;
  /** Filter by minimum depth (inclusive). */
  minDepth?: number;
  /** Filter by maximum depth (inclusive). */
  maxDepth?: number;
  /** Filter by minimum utc timestamp (inclusive). */
  since?: number;
  /** Filter by maximum utc timestamp (inclusive). */
  until?: number;
  /** Filter by observer public key (hex string). */
  observer?: string;
}

/**
 * Pluggable storage backend for DOT chains.
 *
 * All methods are synchronous to keep the chain operations purely functional.
 */
export interface StorageBackend {
  /** Human-readable name of this backend (e.g. "memory", "sqlite"). */
  readonly name: string;

  /**
   * Retrieve a DOT by its hex hash.
   * @returns The DOT, or null if not found.
   */
  get(hash: string): DOT | null;

  /**
   * Store a DOT under the given hex hash.
   * Overwrites if the hash already exists.
   */
  put(dot: DOT, hash: string, meta?: { depth?: number; timestamp?: number }): void;

  /**
   * Check whether a DOT exists for the given hex hash.
   */
  has(hash: string): boolean;

  /**
   * List stored DOTs with optional filtering.
   */
  list(opts?: ListOptions): DOT[];

  /**
   * Count total stored DOTs.
   */
  count(): number;

  /**
   * Remove all stored DOTs.
   */
  clear(): void;
}
