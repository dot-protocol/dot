/**
 * @dotprotocol/identity — Auth DOTs (cross-chain identity linking).
 *
 * An Auth DOT binds a DOT signer (ed25519 pubkey) to an external identity
 * on another chain (Solana wallet, EVM address, Cosmos account, etc.).
 *
 * The binding can optionally include a signature from the external wallet
 * proving ownership. Without the signature, the binding is "unverified" —
 * the application layer decides whether to accept unverified bindings.
 *
 * This is the DOT equivalent of a DID Document's `alsoKnownAs` field.
 */

/** Supported chain types for cross-chain linking. */
export type ChainType = 'solana' | 'ethereum' | 'cosmos' | 'bitcoin' | 'substrate';

/** Auth DOT content for wallet binding. */
export interface AuthBinding {
  kind: 'auth';
  /** Chain type */
  chain: ChainType;
  /** External wallet/account address */
  wallet: string;
  /** Hex-encoded DOT signer public key (must match the DOT's signer) */
  signerPubkey: string;
  /** Optional: hex-encoded signature from the external wallet proving ownership.
   *  The wallet signs the DOT signer pubkey bytes. */
  signature?: string;
}

/** Resolved auth binding with verification status. */
export interface ResolvedAuthBinding extends AuthBinding {
  /** Whether the wallet signature was cryptographically verified */
  verified: boolean;
  /** Timestamp of the auth DOT */
  timestamp: string;
}

/** Create an auth binding content object ready for an Auth DOT payload. */
export function createAuthContent(fields: {
  chain: ChainType;
  wallet: string;
  signerPubkey: string;
  signature?: string;
}): AuthBinding {
  if (!fields.wallet) throw new Error('Wallet address is required');
  if (!fields.signerPubkey) throw new Error('Signer pubkey is required');

  return {
    kind: 'auth',
    chain: fields.chain,
    wallet: fields.wallet,
    signerPubkey: fields.signerPubkey,
    signature: fields.signature,
  };
}

/**
 * Verify a Solana wallet signature.
 *
 * Solana uses ed25519, so we can verify with tweetnacl or any ed25519 lib.
 * The message being signed is the raw DOT signer public key bytes (32 bytes).
 *
 * @param walletAddress - Base58-encoded Solana wallet address (32 bytes)
 * @param signature - Hex-encoded 64-byte signature
 * @param signerPubkey - Hex-encoded 32-byte DOT signer pubkey (this is the signed message)
 * @param verifyFn - ed25519 verify function: (sig, msg, pubkey) => boolean
 * @param base58Decode - Base58 decode function: (str) => Uint8Array
 * @param fromHex - Hex decode function: (hex) => Uint8Array
 */
export function verifySolanaAuth(
  walletAddress: string,
  signature: string,
  signerPubkey: string,
  verifyFn: (sig: Uint8Array, msg: Uint8Array, pubkey: Uint8Array) => boolean,
  base58Decode: (s: string) => Uint8Array,
  fromHex: (s: string) => Uint8Array,
): boolean {
  const walletPubkey = base58Decode(walletAddress);
  if (walletPubkey.length !== 32) return false;

  const sigBytes = fromHex(signature);
  if (sigBytes.length !== 64) return false;

  const msgBytes = fromHex(signerPubkey);
  if (msgBytes.length !== 32) return false;

  return verifyFn(sigBytes, msgBytes, walletPubkey);
}

/**
 * Verify an EVM wallet signature.
 *
 * EVM uses secp256k1 + personal_sign. The message format is:
 * "\x19Ethereum Signed Message:\n" + len + message
 *
 * @param walletAddress - 0x-prefixed checksummed EVM address
 * @param signature - Hex-encoded 65-byte signature (r + s + v)
 * @param signerPubkey - Hex-encoded 32-byte DOT signer pubkey (this is the signed message)
 * @param recoverAddress - Function: (sig, msg) => recoveredAddress
 */
export function verifyEvmAuth(
  walletAddress: string,
  signature: string,
  signerPubkey: string,
  recoverAddress: (sig: string, msg: string) => string,
): boolean {
  const recovered = recoverAddress(signature, signerPubkey);
  return recovered.toLowerCase() === walletAddress.toLowerCase();
}
