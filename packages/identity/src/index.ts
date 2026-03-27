// DID (did:dot method)
export { pubkeyToDID, didToPubkey, isValidDID, hexToDID, buildDIDDocument } from './did.js';

// Profiles (Pref DOTs)
export { createProfileContent, validateProfile, AVATAR_EMOJIS, PROFILE_COLORS } from './profile.js';
export type { Profile, ResolvedProfile } from './profile.js';

// Auth (cross-chain identity linking)
export { createAuthContent, verifySolanaAuth, verifyEvmAuth } from './auth.js';
export type { AuthBinding, ResolvedAuthBinding, ChainType } from './auth.js';
