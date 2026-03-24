/**
 * FSBackend — abstract filesystem interface for DotFS.
 *
 * All DotFS operations are expressed through this interface, enabling
 * drop-in swapping between in-memory (tests), Node.js, and future backends.
 */

export interface StatResult {
  /** File size in bytes. */
  size: number;
  /** Modification time as milliseconds since Unix epoch. */
  mtime: number;
}

export interface FSBackend {
  /**
   * Write bytes to a file, creating parent directories as needed.
   * Overwrites any existing content.
   */
  writeFile(path: string, data: Uint8Array): void;

  /**
   * Read a file's bytes.
   * @throws Error if the file does not exist
   */
  readFile(path: string): Uint8Array;

  /**
   * Returns true if the path exists (file or directory).
   */
  exists(path: string): boolean;

  /**
   * Delete a file.
   * @throws Error if the file does not exist
   */
  unlink(path: string): void;

  /**
   * List the names of direct children in a directory (non-recursive).
   * Returns basenames only, not full paths.
   * Returns an empty array for empty directories.
   */
  list(dir: string): string[];

  /**
   * Create a directory (and all parent directories) if it does not exist.
   * Idempotent — does not throw if the directory already exists.
   */
  mkdir(dir: string): void;

  /**
   * Return stat information for a path.
   * @throws Error if the path does not exist
   */
  stat(path: string): StatResult;
}
