/**
 * MemoryFSBackend — in-memory FSBackend for testing and ephemeral use.
 *
 * Stores files in a Map keyed by absolute path. Directories are tracked
 * in a Set. All operations are synchronous.
 *
 * Works with both absolute paths (/foo/bar) and relative paths (foo/bar)
 * to support test setups that use path.join('', 'rel') => 'rel'.
 */

import type { FSBackend, StatResult } from './interface.js';

interface FileEntry {
  data: Uint8Array;
  mtime: number;
}

export class MemoryFSBackend implements FSBackend {
  private files = new Map<string, FileEntry>();
  private dirs = new Set<string>();

  constructor() {
    // Root always exists — covers both '/' and '' cases
    this.dirs.add('/');
    this.dirs.add('');
    this.dirs.add('.');
  }

  writeFile(p: string, data: Uint8Array): void {
    const parent = dirPart(p);
    this._ensureDirs(parent);
    this.files.set(p, {
      data: new Uint8Array(data),
      mtime: Date.now(),
    });
  }

  readFile(p: string): Uint8Array {
    const entry = this.files.get(p);
    if (entry === undefined) {
      throw new Error(`ENOENT: no such file: ${p}`);
    }
    return new Uint8Array(entry.data);
  }

  exists(p: string): boolean {
    return this.files.has(p) || this.dirs.has(p);
  }

  unlink(p: string): void {
    if (!this.files.has(p)) {
      throw new Error(`ENOENT: no such file: ${p}`);
    }
    this.files.delete(p);
  }

  list(dir: string): string[] {
    // Normalize: strip trailing slash
    const normDir = normalizeDirPath(dir);

    const result = new Set<string>();

    // Add direct child files
    for (const filePath of this.files.keys()) {
      const parent = dirPart(filePath);
      if (normalizeDirPath(parent) === normDir) {
        result.add(basePart(filePath));
      }
    }

    // Add direct child directories (one level deep)
    for (const dirPath of this.dirs) {
      if (normalizeDirPath(dirPath) === normDir) continue; // same dir
      const parent = dirPart(dirPath);
      if (normalizeDirPath(parent) === normDir) {
        const base = basePart(dirPath);
        if (base !== '' && base !== '.') result.add(base);
      }
    }

    return Array.from(result);
  }

  mkdir(dir: string): void {
    this._ensureDirs(dir);
  }

  stat(p: string): StatResult {
    const entry = this.files.get(p);
    if (entry !== undefined) {
      return { size: entry.data.length, mtime: entry.mtime };
    }
    if (this.dirs.has(p)) {
      return { size: 0, mtime: Date.now() };
    }
    throw new Error(`ENOENT: no such file or directory: ${p}`);
  }

  // ─── Extras for test ergonomics ──────────────────────────────────────────────

  /** Returns all tracked file paths. */
  allFiles(): string[] {
    return Array.from(this.files.keys());
  }

  /** Returns all tracked directory paths. */
  allDirs(): string[] {
    return Array.from(this.dirs);
  }

  /** Resets all internal state — useful in beforeEach. */
  clear(): void {
    this.files.clear();
    this.dirs.clear();
    this.dirs.add('/');
    this.dirs.add('');
    this.dirs.add('.');
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private _ensureDirs(dir: string): void {
    if (dir === '' || dir === '/' || dir === '.') {
      this.dirs.add(dir);
      return;
    }

    // Walk from root, creating each intermediate directory
    const isAbsolute = dir.startsWith('/');
    const parts = dir.split('/').filter(p => p.length > 0);

    let current = isAbsolute ? '' : '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (isAbsolute) {
        current = '/' + parts.slice(0, i + 1).join('/');
      } else {
        current = parts.slice(0, i + 1).join('/');
      }
      this.dirs.add(current);
    }
  }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Returns the directory portion of a path. */
function dirPart(p: string): string {
  const slash = p.lastIndexOf('/');
  if (slash < 0) return '';          // 'file.txt' → ''
  if (slash === 0) return '/';        // '/file.txt' → '/'
  return p.slice(0, slash);           // '/a/b/c.txt' → '/a/b'
}

/** Returns the basename of a path. */
function basePart(p: string): string {
  const slash = p.lastIndexOf('/');
  if (slash < 0) return p;
  return p.slice(slash + 1);
}

/** Normalize directory path for comparison (strip trailing slash, keep leading). */
function normalizeDirPath(dir: string): string {
  if (dir === '' || dir === '/' || dir === '.') return dir;
  return dir.replace(/\/$/, '');
}
