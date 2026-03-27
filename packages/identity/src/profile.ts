/**
 * @dotprotocol/identity — Profile DOTs.
 *
 * A profile is a Pref DOT (type: 'pref') that stores human-readable
 * identity data. Profiles are append-only — the latest profile DOT
 * per signer IS the current profile.
 *
 * This is the DOT equivalent of a DID Document's metadata.
 * Any app building on DOT can use this to give users portable identity.
 */

/** Profile stored as DOT content. */
export interface Profile {
  kind: 'profile';
  /** Unique username (3-20 chars, alphanumeric + underscore) */
  username: string;
  /** Human-readable display name (max 50 chars) */
  displayName: string;
  /** Single emoji used as avatar — no image hosting needed */
  avatarEmoji: string;
  /** Short bio (max 200 chars) */
  bio: string;
  /** Hex color for profile accent (e.g., '#F59E0B') */
  color: string;
}

/** Resolved profile with signer metadata. */
export interface ResolvedProfile extends Profile {
  /** Hex-encoded ed25519 public key of the signer */
  signer: string;
  /** Timestamp of the profile DOT (Unix microseconds as string) */
  updatedAt: string;
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const MAX_DISPLAY_NAME = 50;
const MAX_BIO = 200;

/** Validate profile fields. Returns error message or null if valid. */
export function validateProfile(profile: Partial<Profile>): string | null {
  if (!profile.username || !USERNAME_REGEX.test(profile.username)) {
    return 'Username must be 3-20 characters (letters, numbers, underscore)';
  }
  if (profile.displayName && profile.displayName.length > MAX_DISPLAY_NAME) {
    return `Display name must be ${MAX_DISPLAY_NAME} characters or less`;
  }
  if (profile.bio && profile.bio.length > MAX_BIO) {
    return `Bio must be ${MAX_BIO} characters or less`;
  }
  if (profile.color && !/^#[0-9a-fA-F]{6}$/.test(profile.color)) {
    return 'Color must be a hex color (e.g., #F59E0B)';
  }
  return null;
}

/** Create a profile content object ready for a Pref DOT payload. */
export function createProfileContent(fields: {
  username: string;
  displayName?: string;
  avatarEmoji?: string;
  bio?: string;
  color?: string;
}): Profile {
  const error = validateProfile(fields);
  if (error) throw new Error(error);

  return {
    kind: 'profile',
    username: fields.username,
    displayName: fields.displayName || fields.username,
    avatarEmoji: fields.avatarEmoji || '🐉',
    bio: fields.bio || '',
    color: fields.color || '#F59E0B',
  };
}

/** Default emoji options for profile avatars. */
export const AVATAR_EMOJIS = [
  '🐉', '🦁', '🐺', '🦊', '🐻', '🦅', '🐋', '🦈', '🐙',
  '🔥', '⚡', '💎', '🌙', '⭐', '🎯', '🛡️', '🗡️', '🎮',
  '🧠', '👁️', '🌊', '🏔️', '🚀', '💀', '🤖', '🎭', '🔮',
  '🌸', '❤️', '🖤',
] as const;

/** Default color palette for profile accents. */
export const PROFILE_COLORS = [
  '#F59E0B', // amber
  '#34D399', // emerald
  '#F87171', // red
  '#A78BFA', // purple
  '#60A5FA', // blue
  '#FB923C', // orange
  '#F472B6', // pink
  '#71717A', // zinc
] as const;
