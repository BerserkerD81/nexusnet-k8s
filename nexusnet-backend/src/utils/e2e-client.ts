/**
 * e2e-client.ts — Client-side E2E Encryption Helper for NexusNet
 *
 * This file ships with your FRONTEND (React / React Native / Next.js).
 * It uses the Web Crypto API (available in all modern browsers and React Native
 * via react-native-quick-crypto).
 *
 * ── Protocol summary ────────────────────────────────────────────────────────
 *   Key exchange : X25519 ECDH   (SubtleCrypto / generateKey)
 *   Symmetric key: AES-256-GCM   (derived via HKDF-SHA-256)
 *   Storage      : Private keys stay in memory (or IndexedDB for persistence)
 *                  Public keys are uploaded to the server per conversation
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Usage:
 *   const e2e = new E2EClient();
 *
 *   // When opening a conversation
 *   const { publicKeyB64 } = await e2e.initConversation(conversationId);
 *   await api.uploadPublicKey(conversationId, publicKeyB64);
 *
 *   // When the server returns peer public keys
 *   const keys = await api.getConversationKeys(conversationId);
 *   for (const k of keys) {
 *     await e2e.addPeerKey(conversationId, k.userId, k.publicKey);
 *   }
 *
 *   // Encrypting a message before sending
 *   const payload = await e2e.encrypt(conversationId, recipientId, 'Hello!');
 *   await api.sendEncryptedMessage(conversationId, payload);
 *
 *   // Decrypting a received message
 *   const plaintext = await e2e.decrypt(conversationId, senderId, message.encryptedPayload);
 */

export interface EncryptedPayload {
  iv: string;         // base64
  ciphertext: string; // base64
  authTag?: string;   // base64 — not needed separately in WebCrypto (appended to ciphertext)
}

// ── Key storage ──────────────────────────────────────────────────────────────

interface ConversationKeyBundle {
  /** Our own ECDH key-pair for this conversation */
  ownKeyPair: CryptoKeyPair;
  /** Derived AES-GCM keys keyed by peer userId */
  sharedKeys: Map<string, CryptoKey>;
}

// ── E2EClient ────────────────────────────────────────────────────────────────

export class E2EClient {
  private conversations = new Map<string, ConversationKeyBundle>();

  // ─── Key generation ────────────────────────────────────────────────────────

  /**
   * Generates a new X25519 key-pair for the conversation.
   * Returns the base64-encoded public key to upload to the server.
   */
  async initConversation(conversationId: string): Promise<{ publicKeyB64: string }> {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'X25519' } as EcKeyGenParams,
      true,
      ['deriveKey', 'deriveBits']
    );

    this.conversations.set(conversationId, {
      ownKeyPair: keyPair,
      sharedKeys: new Map()
    });

    const exported = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    return { publicKeyB64: arrayBufferToBase64(exported) };
  }

  /**
   * Imports a peer's public key and derives a shared AES-256-GCM key for them.
   * Call this for every participant returned by GET /messages/:id/keys.
   */
  async addPeerKey(conversationId: string, peerUserId: string, peerPublicKeyB64: string): Promise<void> {
    const bundle = this.getBundle(conversationId);

    const peerKeyBuffer = base64ToArrayBuffer(peerPublicKeyB64);
    const peerPublicKey = await crypto.subtle.importKey(
      'raw',
      peerKeyBuffer,
      { name: 'ECDH', namedCurve: 'X25519' } as EcKeyImportParams,
      false,
      []
    );

    // Derive shared bits via ECDH
    const sharedBits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: peerPublicKey },
      bundle.ownKeyPair.privateKey,
      256
    );

    // Derive AES key via HKDF, scoped to this conversationId
    const hkdfKey = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(32), // zero salt; use conversationId as info
        info: new TextEncoder().encode(`nexusnet:msg:${conversationId}`)
      },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    bundle.sharedKeys.set(peerUserId, aesKey);
  }

  // ─── Encrypt / Decrypt ─────────────────────────────────────────────────────

  /**
   * Encrypts a plaintext message for a specific recipient.
   * Returns the payload to POST to /messages/:id/encrypted.
   */
  async encrypt(conversationId: string, recipientUserId: string, plaintext: string): Promise<EncryptedPayload> {
    const key = this.getSharedKey(conversationId, recipientUserId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertextBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

    return {
      iv: arrayBufferToBase64(iv.buffer),
      ciphertext: arrayBufferToBase64(ciphertextBuffer)
      // WebCrypto appends the auth tag to ciphertext automatically
    };
  }

  /**
   * Decrypts a received message.
   * @param payload  The `encryptedPayload` field from the API response
   * @param senderUserId  The sender's userId (to look up the shared key)
   */
  async decrypt(conversationId: string, senderUserId: string, payload: EncryptedPayload): Promise<string> {
    const key = this.getSharedKey(conversationId, senderUserId);
    const iv = base64ToArrayBuffer(payload.iv);
    const ciphertext = base64ToArrayBuffer(payload.ciphertext);

    const plaintextBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(plaintextBuffer);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private getBundle(conversationId: string): ConversationKeyBundle {
    const bundle = this.conversations.get(conversationId);
    if (!bundle) throw new Error(`No key bundle for conversation ${conversationId}. Call initConversation() first.`);
    return bundle;
  }

  private getSharedKey(conversationId: string, userId: string): CryptoKey {
    const bundle = this.getBundle(conversationId);
    const key = bundle.sharedKeys.get(userId);
    if (!key) throw new Error(`No shared key with user ${userId} in conversation ${conversationId}. Call addPeerKey() first.`);
    return key;
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
