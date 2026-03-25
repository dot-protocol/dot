/**
 * namespace.ts — Room naming conventions.
 *
 * Room names follow the pattern: "." followed by alphanumeric segments joined by "." or "-".
 * Examples: ".physics", ".the.first.room", ".my-bakery"
 */

/**
 * Validate a room name.
 *
 * Rules:
 * - Must start with "."
 * - All characters: alphanumeric, ".", "-" only (no spaces or other special chars)
 * - No empty segments (no ".." consecutive dots)
 * - Max 255 characters
 * - Non-empty after the leading dot
 */
export function isValidRoomName(name: string): boolean {
  if (typeof name !== 'string') return false;
  if (name.length === 0) return false;
  if (name.length > 255) return false;
  if (!name.startsWith('.')) return false;

  // Must have at least one char after the leading dot
  const rest = name.slice(1);
  if (rest.length === 0) return false;

  // Only alphanumeric, dots, and hyphens
  if (!/^[a-zA-Z0-9.\-]+$/.test(rest)) return false;

  // No consecutive dots (check the full name, not just rest)
  if (name.includes('..')) return false;

  // No trailing dot
  if (rest.endsWith('.')) return false;

  return true;
}

/**
 * Normalize a room name: lowercase and trim.
 * Ensures the result starts with ".".
 *
 * @param name - The raw room name
 * @returns Normalized room name
 * @throws If the normalized name is invalid
 */
export function normalizeRoomName(name: string): string {
  const normalized = name.trim().toLowerCase();

  if (!isValidRoomName(normalized)) {
    throw new Error(
      `Invalid room name: "${name}". Room names must start with ".", contain only alphanumeric characters, dots, and hyphens.`,
    );
  }

  return normalized;
}

export interface ParsedRoomName {
  parts: string[];
  depth: number;
}

/**
 * Parse a room name into its path components.
 *
 * @example
 * parseRoomName(".physics.quantum.entanglement")
 * // → { parts: ["physics", "quantum", "entanglement"], depth: 3 }
 *
 * @param name - A valid room name
 * @returns Parsed parts and depth
 */
export function parseRoomName(name: string): ParsedRoomName {
  // Remove leading dot, then split on dots
  const rest = name.startsWith('.') ? name.slice(1) : name;
  const parts = rest.split('.').filter((p) => p.length > 0);
  return { parts, depth: parts.length };
}
