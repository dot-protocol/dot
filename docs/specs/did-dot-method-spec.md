# did:dot Method Specification

**Version:** 0.1.0
**Status:** Draft
**Date:** 2026-03-27
**Author:** MEVICI / DOT Protocol

---

## Abstract

`did:dot` is a W3C DID Core 1.1 compliant method built on top of the DOT protocol's native ed25519 identity system. A DOT identity is a 32-byte ed25519 public key that anchors an append-only chain of cryptographically signed observations (DOTs). Because this chain already carries all DID-relevant data — key material, service endpoints, cross-chain links, and reputation — `did:dot` is a thin formal mapping rather than a new system. The method requires no blockchain, no token, and no central registry. Resolution is relay-based.

---

## 1. DID Method Name

The method name string is: `dot`

A DID that uses this method MUST begin with the prefix `did:dot:`.

---

## 2. DID Format

```
did-dot           = "did:dot:" dot-specific-id
dot-specific-id   = multibase-encoded-ed25519-pubkey
```

The `dot-specific-id` is the signer's 32-byte ed25519 public key encoded in multibase using the base58btc alphabet (prefix character `z`), identical to the encoding used by `did:key` for ed25519 keys.

**Example:**

```
did:dot:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
```

The encoded value is always 48 characters after the `z` prefix (32 bytes → base58btc).

**Deriving the DID from a DOT keypair:**

```typescript
import { base58btc } from 'multiformats/bases/base58'

function pubkeyToDID(publicKey: Uint8Array): string {
  // Prepend ed25519 multicodec prefix (0xed01)
  const multicodec = new Uint8Array([0xed, 0x01, ...publicKey])
  return `did:dot:${base58btc.encode(multicodec)}`
}
```

---

## 3. CRUD Operations

### 3.1 Create

1. Generate an ed25519 keypair. The public key (32 bytes) is the persistent identifier.
2. The first signed DOT from the keypair is the **genesis DOT**. The genesis DOT has `chain_hash = 0x00...00` (32 zero bytes) and uniquely anchors the identity on its worldline.
3. **Recommended:** publish a Pref DOT immediately after genesis to declare the DID Document contents (services, display name, rotation key hash).
4. **Optional:** include `identity/rotation_key` in the genesis Pref DOT to enable key rotation (see §6).

**Genesis DOT wire format (153 bytes):**

```
[0..31]   public key       — 32 bytes, ed25519
[32..95]  signature        — 64 bytes, ed25519 (signs bytes [96..152])
[96..127] chain_hash       — 32 bytes, all zeros for genesis
[128..135] timestamp       — 8 bytes, Unix ms, big-endian
[136]     type             — 1 byte: 0x00=public, 0x01=circle, 0x02=private, 0x03=ephemeral
[137..152] payload         — 16 bytes, zero-padded
```

No registration step. The genesis DOT is the identity. It can be broadcast to a CHORUS relay or kept local.

### 3.2 Read (Resolution)

To resolve `did:dot:<id>` into a DID Document:

1. Decode `<id>` from multibase to obtain the raw 32-byte ed25519 public key.
2. Query a CHORUS relay (or local DOT store) for the most recent Pref DOTs signed by that public key.
3. Construct the DID Document from the returned Pref DOTs (see §4).

**Resolution input:** `did:dot:z6Mk...`

**Resolution output:** A conformant DID Document (JSON-LD or plain JSON).

**Relay query (WebSocket):**

```json
{
  "type": "query",
  "signer": "<hex-encoded-pubkey>",
  "dotType": "pref",
  "limit": 20
}
```

If no Pref DOTs exist, the resolver constructs a minimal DID Document using only the public key as the verification method. Resolution MUST NOT fail for an identity with no Pref DOTs — the key alone is sufficient.

### 3.3 Update

DID Document updates are expressed as new Pref DOTs. The **latest Pref DOT for a given key** wins (by timestamp). The worldline is append-only; no DOT is ever deleted.

To update a service endpoint, publish a new Pref DOT with `identity/services` payload pointing to the updated service definition. The old Pref DOT remains in the chain but is superseded for resolution purposes.

### 3.4 Deactivate

A **deactivation DOT** is a Pref DOT with payload `identity/status = deactivated`, signed by the rotation key (see §6). Resolvers that receive a valid deactivation DOT MUST set `deactivated: true` in the DID Document metadata and MUST NOT return verification methods.

Deactivation without a rotation key is not possible — the signing key alone cannot deactivate its own identity. This is a deliberate design choice to protect against key theft triggering deactivation.

---

## 4. DID Document

A `did:dot` DID Document is constructed from the signer's Pref DOTs. The following table maps DOT primitives to DID Document fields:

| DID Document Field | DOT Source |
|---|---|
| `id` | `did:dot:<multibase-pubkey>` |
| `verificationMethod` | ed25519 public key (32 bytes, always present) |
| `authentication` | same public key (by reference) |
| `assertionMethod` | same public key (by reference) |
| `capabilityInvocation` | same public key (by reference) |
| `service` | Pref DOTs with key `identity/services` |
| `alsoKnownAs` | Auth DOTs linking to external DIDs / wallet addresses |
| `controller` | defaults to `id`; overridable by rotation key Pref DOT |

**Example DID Document:**

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1"
  ],
  "id": "did:dot:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "verificationMethod": [
    {
      "id": "did:dot:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK#key-1",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:dot:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      "publicKeyMultibase": "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"
    }
  ],
  "authentication": [
    "did:dot:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK#key-1"
  ],
  "assertionMethod": [
    "did:dot:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK#key-1"
  ],
  "service": [
    {
      "id": "did:dot:z6Mk...#chorus",
      "type": "DOTRelay",
      "serviceEndpoint": "wss://dotdotdot.rocks"
    },
    {
      "id": "did:dot:z6Mk...#profile",
      "type": "LinkedDomains",
      "serviceEndpoint": "https://mevici.app/u/z6Mk..."
    }
  ],
  "alsoKnownAs": [
    "did:pkh:eip155:1:0xAbCd...",
    "did:plc:ewvi7nx8giahwark8qgzsyyh"
  ]
}
```

**Pref DOT payload encoding:**

Pref DOT payloads (16 bytes) carry a 4-byte key tag + 12-byte value. Extended data is referenced by content hash. Defined tags for DID resolution:

| Tag (4 bytes) | Meaning | Value (12 bytes) |
|---|---|---|
| `0x69647376` (`idsv`) | Identity services pointer | SHA-256 truncated to 12 bytes, pointing to full JSON |
| `0x726b6579` (`rkey`) | Rotation key hash | SHA-256(rotation_pubkey)[0..11] |
| `0x64737461` (`dsta`) | DID status | `0x00` = active, `0x01` = deactivated, zero-padded |
| `0x61736b61` (`aska`) | alsoKnownAs pointer | Content hash of JSON array of URIs |

---

## 5. Pref DOT — Profile and Credential Data

Pref DOTs are ordinary DOTs with `type = 0x00` (public) whose payload references structured profile data. They are not a special DOT type — they are a convention for carrying identity-relevant information on the worldline.

A resolver SHOULD prefer the most recent Pref DOT for each tag when constructing the DID Document. Older Pref DOTs for the same tag remain in the chain but are ignored during resolution.

---

## 6. Key Rotation

`did:dot` adopts the did:plc rotation key pattern:

1. **At genesis (optional but recommended):** include an `rkey` Pref DOT. The value is `SHA-256(rotation_pubkey)[0..11]` — a commitment to the rotation key without revealing it.

2. **To rotate:** publish a new Pref DOT **signed by the rotation keypair** (not the active signing key). This Pref DOT contains:
   - The new signing key's `did:dot` identifier in the service field
   - A new `rkey` commitment for the next rotation key
   - Timestamp strictly greater than all previous DOTs

3. **After rotation:** the new signing key is authoritative. All DOTs signed by the old key remain valid and verifiable. Score DOTs and Auth DOTs are not invalidated.

4. **Rotation key security:** the rotation key should be stored offline (hardware key, paper backup). It is never used for day-to-day signing.

**Key rotation is not possible** without the rotation key. An identity without a committed rotation key cannot rotate — loss of the signing key means loss of the identity. This is intentional for high-assurance use cases.

---

## 7. Auth DOTs — Cross-Chain Identity Linking

Auth DOTs link a `did:dot` identity to external identifiers (wallet addresses, other DIDs, social handles). They populate the `alsoKnownAs` field of the DID Document.

An Auth DOT is an ordinary DOT where:
- The payload (16 bytes) contains a truncated hash of the external identifier
- The DOT is signed by the DOT identity
- The external identifier system provides a corresponding signature or attestation

Auth DOTs are **opt-in**. Publishing an Auth DOT is a voluntary disclosure. Resolvers include Auth DOT targets in `alsoKnownAs` only when they appear in publicly-typed DOTs.

---

## 8. Score DOTs — Reputation

Score DOTs from other signers accumulate on a worldline as a reputation signal. They map to the ERC-8004 Reputation Registry interface for interoperability.

Score DOTs are not part of the DID Document itself but are returned as metadata during resolution:

```json
{
  "didDocumentMetadata": {
    "scoreCount": 147,
    "weightedScore": 0.82,
    "chainLength": 3204,
    "genesisTimestamp": "2025-11-14T09:23:01Z"
  }
}
```

---

## 9. Security Considerations

**Cryptographic strength.** Ed25519 provides approximately 128 bits of security. Signatures are non-malleable. The 32-byte public key uniquely determines the DID.

**Chain integrity.** Each DOT includes `SHA-256(previous_dot_bytes)` as its chain hash. Any tampering with a DOT in the worldline breaks all subsequent chain hashes, making forgery detectable.

**Key compromise.** If the active signing key is compromised and no rotation key was committed, the identity cannot be recovered. Implementors MUST encourage rotation key setup at identity creation.

**Relay trust.** Relays are stateless forwarders. They cannot forge DOTs (signatures prevent this) but can withhold or delay them. Resolution SHOULD query multiple relays when high availability is required.

**Timestamp manipulation.** DOT timestamps are claimed by the signer, not attested by a trusted clock. Resolvers SHOULD treat timestamps as approximate and use chain ordering as the authoritative sequence.

**No key derivation from DID.** The DID encodes the public key directly. There is no way to derive a private key from a `did:dot` identifier.

---

## 10. Privacy Considerations

**Pseudonymity.** A `did:dot` identifier is a public key. It is pseudonymous — not inherently linked to a real-world identity unless the holder publishes Auth DOTs or Pref DOTs disclosing that link.

**Selective disclosure.** Pref DOTs (services, display name, `alsoKnownAs`) are published voluntarily. An identity can be fully functional with no Pref DOTs — resolution returns only the verification method.

**Auth DOT opt-in.** Linking a wallet address or social identity to a `did:dot` is never automatic. The holder must sign and publish an Auth DOT explicitly.

**Correlation.** All public DOTs (type `0x00`) on a worldline are linkable by the signer's public key. If correlation resistance is required, use private DOTs (type `0x02`) or maintain separate keypairs for separate contexts.

---

## 11. AI Agent Identity

Agents use `did:dot` identically to humans. There is no agent-specific identity type.

An agent identity is a keypair. The agent signs DOTs as it operates. Its worldline accumulates:
- Interaction records (public DOTs)
- Reputation from other agents and humans (Score DOTs)
- Capability declarations (Pref DOTs with `identity/services` pointing to an Agent Card or MCP server URL)

**Agent discovery** via `did:dot` service endpoint:

```json
{
  "id": "did:dot:z6Mk...#agent-card",
  "type": "AgentCard",
  "serviceEndpoint": "https://agent.example/.well-known/agent.json"
}
```

Score DOTs from other agents constitute a verifiable reputation graph with no central authority. The `did:dot` worldline IS the agent's provenance.

---

## 12. Interoperability

**did:key compatibility.** `did:dot` uses the same multibase encoding as `did:key` for ed25519 keys. A `did:dot` identifier and a `did:key` identifier for the same keypair share the same `dot-specific-id` string. They are distinguishable only by the method prefix.

**Cross-method linking.** Auth DOTs enable bidirectional linking:
- `did:dot` ↔ `did:plc` (AT Protocol / Bluesky)
- `did:dot` ↔ `did:key`
- `did:dot` ↔ `did:pkh` (wallet addresses via CAIP-10)
- `did:dot` ↔ `did:web`

**ERC-8004.** Score DOTs map to the ERC-8004 Reputation Registry interface. A bridge contract can read Score DOT data from a relay and write it on-chain, enabling `did:dot` reputation to be consumed by EVM smart contracts.

**DID Universal Resolver.** A `did:dot` driver for the Universal Resolver requires:
1. A CHORUS relay endpoint (configurable)
2. The resolution algorithm described in §3.2

Driver registration: `https://dev.uniresolver.io/` (pending submission).

---

## 13. Reference Implementation

| Component | Location | Status |
|---|---|---|
| Keypair generation | `projects/dot-protocol/packages/identity/src/identity.ts` | Stable |
| Wire format (153B) | `projects/dot-protocol/packages/core/src/create.ts` | Stable |
| CHORUS relay client | `projects/dot-protocol/packages/relay/` | Stable |
| DID Document builder | `@dot-protocol/substrates` (digital/identity.ts) | Planned v1.0 |
| Universal Resolver driver | — | Planned |

CHORUS relay: `wss://dotdotdot.rocks`

---

## 14. Conformance

This specification is consistent with:
- [W3C DID Core 1.1](https://www.w3.org/TR/did-core/)
- [W3C DID Specification Registries](https://www.w3.org/TR/did-spec-registries/)
- [Multibase](https://datatracker.ietf.org/doc/html/draft-multiformats-multibase)
- [Multicodec](https://github.com/multiformats/multicodec) (ed25519-pub = `0xed`)
- [Ed25519VerificationKey2020](https://w3c-ccg.github.io/di-eddsa-cryptosuite/)

---

*The act of contact leaves its dot.*
