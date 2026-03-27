/**
 * @dotprotocol/identity — DID utilities.
 *
 * Maps DOT ed25519 keypairs to W3C DID Core 1.1 identifiers.
 * See docs/specs/did-dot-method-spec.md for the full specification.
 *
 * DID format: did:dot:<multibase-base58btc-ed25519-pubkey>
 * Uses the same multicodec prefix as did:key (0xed01 for ed25519).
 */

const MULTICODEC_ED25519 = new Uint8Array([0xed, 0x01]);
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes: Uint8Array): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  // Leading zeros
  for (const byte of bytes) {
    if (byte !== 0) break;
    digits.push(0);
  }
  return digits.reverse().map(d => BASE58_ALPHABET[d]).join('');
}

function base58Decode(encoded: string): Uint8Array {
  const bytes = [0];
  for (const char of encoded) {
    const value = BASE58_ALPHABET.indexOf(char);
    if (value < 0) throw new Error(`Invalid base58 character: ${char}`);
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of encoded) {
    if (char === '1') bytes.push(0);
    else break;
  }
  return new Uint8Array(bytes.reverse());
}

/** Convert a 32-byte ed25519 public key to a did:dot identifier. */
export function pubkeyToDID(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) throw new Error('Public key must be 32 bytes');
  const prefixed = new Uint8Array(MULTICODEC_ED25519.length + publicKey.length);
  prefixed.set(MULTICODEC_ED25519);
  prefixed.set(publicKey, MULTICODEC_ED25519.length);
  return `did:dot:z${base58Encode(prefixed)}`;
}

/** Extract the 32-byte ed25519 public key from a did:dot identifier. */
export function didToPubkey(did: string): Uint8Array {
  if (!did.startsWith('did:dot:z')) {
    throw new Error('Invalid did:dot identifier — must start with did:dot:z');
  }
  const decoded = base58Decode(did.slice(8)); // skip 'did:dot:z'
  if (decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error('Invalid multicodec prefix — expected ed25519 (0xed01)');
  }
  return decoded.slice(2);
}

/** Check if a string is a valid did:dot identifier. */
export function isValidDID(did: string): boolean {
  try {
    didToPubkey(did);
    return true;
  } catch {
    return false;
  }
}

/** Convert a hex-encoded public key to did:dot. */
export function hexToDID(hexPubkey: string): string {
  const bytes = new Uint8Array(hexPubkey.length / 2);
  for (let i = 0; i < hexPubkey.length; i += 2) {
    bytes[i / 2] = parseInt(hexPubkey.slice(i, i + 2), 16);
  }
  return pubkeyToDID(bytes);
}

/**
 * Build a minimal DID Document from DOT identity data.
 *
 * A full DID Document is constructed from Pref DOTs (profile, services)
 * and Auth DOTs (alsoKnownAs). This function builds the core structure
 * from just the public key.
 */
export function buildDIDDocument(publicKey: Uint8Array, options?: {
  services?: Array<{ id: string; type: string; serviceEndpoint: string }>;
  alsoKnownAs?: string[];
}) {
  const did = pubkeyToDID(publicKey);
  const hexPubkey = Array.from(publicKey).map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/multikey/v1'],
    id: did,
    verificationMethod: [{
      id: `${did}#key-0`,
      type: 'Multikey',
      controller: did,
      publicKeyMultibase: `z${base58Encode(new Uint8Array([...MULTICODEC_ED25519, ...publicKey]))}`,
    }],
    authentication: [`${did}#key-0`],
    assertionMethod: [`${did}#key-0`],
    ...(options?.alsoKnownAs?.length ? { alsoKnownAs: options.alsoKnownAs } : {}),
    ...(options?.services?.length ? {
      service: options.services.map(s => ({
        id: `${did}#${s.id}`,
        type: s.type,
        serviceEndpoint: s.serviceEndpoint,
      })),
    } : {}),
  };
}
