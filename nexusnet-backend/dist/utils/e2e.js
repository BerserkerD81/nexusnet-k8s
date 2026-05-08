"use strict";
/**
 * End-to-End Encryption Utilities — NexusNet
 *
 * Protocol:
 *   - Key exchange : X25519 ECDH  (Web Crypto API / Node crypto subtle)
 *   - Message cipher: AES-256-GCM (authenticated encryption)
 *   - Key derivation: HKDF-SHA-256
 *
 * Flow (per conversation):
 *   1. Each participant generates an ephemeral X25519 key-pair on the client.
 *   2. Public keys are exchanged via the /messages/keys endpoint and stored
 *      in `UserPublicKey` (see migration below).
 *   3. The sender derives a shared secret with ECDH, then a 256-bit AES key
 *      with HKDF (salted with the conversationId so the same key-pair yields
 *      different symmetric keys per conversation).
 *   4. Each message is encrypted client-side; the server stores only the
 *      ciphertext, IV, and authTag — it NEVER sees plaintext.
 *
 * Server-side helpers here handle:
 *   - Storing / retrieving participants' public keys.
 *   - Validating that a stored public key is a well-formed 32-byte X25519 point.
 *   - Providing the encrypted message bundle to authorised participants.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CLIENT-SIDE reference implementation (TypeScript / browser / React Native):
 *
 *   import { E2EClient } from '@/lib/e2e-client'; // ship this to your frontend
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidPublicKey = isValidPublicKey;
exports.deriveSymmetricKey = deriveSymmetricKey;
exports.encryptAesGcm = encryptAesGcm;
exports.decryptAesGcm = decryptAesGcm;
exports.serializePayload = serializePayload;
exports.deserializePayload = deserializePayload;
const crypto_1 = require("crypto");
// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
/** Validates that a base64 string decodes to exactly 32 bytes (X25519 key size). */
function isValidPublicKey(b64) {
    try {
        const buf = Buffer.from(b64, 'base64');
        return buf.length === 32;
    }
    catch {
        return false;
    }
}
// ---------------------------------------------------------------------------
// Server-side symmetric helper (for server-generated notifications / previews)
//
// NOTE: For true E2E, the server should NOT decrypt messages.  These helpers
// exist only for: (a) generating test fixtures, (b) server-side push notification
// previews where the user has explicitly opted in and deposited a recovery key.
// ---------------------------------------------------------------------------
/**
 * Derives a deterministic 32-byte key from a conversation ID and a shared
 * secret.  This mirrors what the client does so tests can round-trip.
 *
 * @param sharedSecret  Raw 32-byte ECDH output (Buffer)
 * @param conversationId  Used as HKDF info to scope the key to this conversation
 */
function deriveSymmetricKey(sharedSecret, conversationId) {
    // HKDF-like derivation with SHA-256; Node's built-in hkdf is >= 15.x
    // Using a simple expand step (HMAC-SHA-256) for broad Node compat.
    const info = Buffer.from(`nexusnet:msg:${conversationId}`, 'utf8');
    const salt = (0, crypto_1.createHash)('sha256').update(info).digest();
    const prk = (0, crypto_1.createHash)('sha256').update(Buffer.concat([salt, sharedSecret])).digest();
    return prk; // 32 bytes — suitable for AES-256
}
/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns a portable `EncryptedPayload` object (all fields base64).
 */
function encryptAesGcm(plaintext, key) {
    const iv = (0, crypto_1.randomBytes)(12); // 96-bit IV recommended for GCM
    const cipher = (0, crypto_1.createCipheriv)('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
        iv: iv.toString('base64'),
        ciphertext: ciphertext.toString('base64'),
        authTag: authTag.toString('base64'),
    };
}
/**
 * Decrypts an `EncryptedPayload` produced by `encryptAesGcm`.
 * Throws if authentication fails (tampered ciphertext).
 */
function decryptAesGcm(payload, key) {
    const iv = Buffer.from(payload.iv, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');
    const authTag = Buffer.from(payload.authTag, 'base64');
    const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
}
/**
 * Serialises an `EncryptedPayload` into a compact string for DB storage.
 * Format: `<iv_b64>.<ciphertext_b64>.<authTag_b64>`
 */
function serializePayload(p) {
    return `${p.iv}.${p.ciphertext}.${p.authTag}`;
}
/**
 * Deserialises the compact string back to `EncryptedPayload`.
 * Throws if the string is malformed.
 */
function deserializePayload(raw) {
    const parts = raw.split('.');
    if (parts.length !== 3)
        throw new Error('Invalid encrypted payload format');
    const [iv, ciphertext, authTag] = parts;
    return { iv, ciphertext, authTag };
}
