import type { E2EEEnvelope } from '../types/models';

const subtle = globalThis.crypto.subtle;

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function generateRandomBase64(byteLength: number = 16): string {
  const buf = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(buf);
  return bytesToBase64(buf);
}

/**
 * Derive an AES-256-GCM Key-Encryption Key (KEK) from a user's passphrase/credential using PBKDF2-SHA256.
 */
export async function deriveUserKek(passphrase: string, saltBase64: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await subtle.importKey('raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']);
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(base64ToBytes(saltBase64)),
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/**
 * Generate a fresh 256-bit AES-GCM Practice Vault Data-Encryption Key (DEK).
 */
export async function generateVaultKey(): Promise<{ key: CryptoKey; rawBase64: string; fingerprint: string }> {
  const key = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const rawBuf = await subtle.exportKey('raw', key);
  const rawBytes = new Uint8Array(rawBuf);
  const fingerprint = await computeKeyFingerprint(rawBytes);
  return { key, rawBase64: bytesToBase64(rawBytes), fingerprint };
}

export async function importVaultKey(rawBase64: string): Promise<{ key: CryptoKey; fingerprint: string }> {
  const rawBytes = base64ToBytes(rawBase64);
  const key = await subtle.importKey('raw', toArrayBuffer(rawBytes), { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const fingerprint = await computeKeyFingerprint(rawBytes);
  return { key, fingerprint };
}

export async function computeKeyFingerprint(rawKeyBytes: Uint8Array): Promise<string> {
  const hash = await subtle.digest('SHA-256', toArrayBuffer(rawKeyBytes));
  const hex = Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase();
  return hex;
}

/**
 * Wrap the Practice Master Vault Key specifically for an individual user account using their KEK.
 */
export async function wrapVaultKeyForAccount(vaultKey: CryptoKey, userKek: CryptoKey): Promise<string> {
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const wrapped = await subtle.wrapKey('raw', vaultKey, userKek, { name: 'AES-GCM', iv: toArrayBuffer(iv) });
  return JSON.stringify({
    iv: bytesToBase64(iv),
    wrapped: bytesToBase64(new Uint8Array(wrapped))
  });
}

/**
 * Unwrap the Practice Master Vault Key for a user account after deriving their KEK.
 */
export async function unwrapVaultKeyForAccount(
  wrappedPayload: string,
  userKek: CryptoKey
): Promise<{ key: CryptoKey; fingerprint: string }> {
  const parsed = JSON.parse(wrappedPayload) as { iv: string; wrapped: string };
  const iv = base64ToBytes(parsed.iv);
  const wrappedBytes = base64ToBytes(parsed.wrapped);
  const key = await subtle.unwrapKey(
    'raw',
    toArrayBuffer(wrappedBytes),
    userKek,
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const rawBuf = await subtle.exportKey('raw', key);
  const fingerprint = await computeKeyFingerprint(new Uint8Array(rawBuf));
  return { key, fingerprint };
}

export function isE2EEEnvelope(value: unknown): value is E2EEEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__e2ee' in value &&
    (value as Record<string, unknown>).__e2ee === true &&
    typeof (value as Record<string, unknown>).iv === 'string' &&
    typeof (value as Record<string, unknown>).ct === 'string'
  );
}

/**
 * Encrypt any UTF-8 string value with AES-256-GCM and a fresh random 96-bit IV.
 */
export async function encryptTextE2EE(
  plaintext: string,
  vaultKey: CryptoKey,
  keyId: string
): Promise<E2EEEnvelope> {
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, vaultKey, encoded);
  return {
    __e2ee: true,
    alg: 'AES-GCM-256',
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ciphertext)),
    keyId
  };
}

/**
 * Decrypt an AES-256-GCM E2EEEnvelope back into plaintext.
 */
export async function decryptTextE2EE(envelope: E2EEEnvelope, vaultKey: CryptoKey): Promise<string> {
  const iv = base64ToBytes(envelope.iv);
  const ct = base64ToBytes(envelope.ct);
  const plainBuf = await subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    vaultKey,
    toArrayBuffer(ct)
  );
  return new TextDecoder().decode(plainBuf);
}

/**
 * Encrypt specified sensitive string fields of a record into its `e2ee` map while masking plaintext storage.
 */
export async function encryptRecordFields<T extends Record<string, unknown>>(
  record: T,
  sensitiveFields: string[],
  vaultKey: CryptoKey,
  keyId: string
): Promise<T & { e2ee: Record<string, E2EEEnvelope> }> {
  const clone: Record<string, unknown> = { ...record };
  const e2eeMap: Record<string, E2EEEnvelope> = {};
  for (const field of sensitiveFields) {
    const val = clone[field];
    if (typeof val === 'string' && val.length > 0 && !val.startsWith('E2EE::')) {
      e2eeMap[field] = await encryptTextE2EE(val, vaultKey, keyId);
      clone[field] = `E2EE::${keyId.slice(0, 8)}`;
    }
  }
  return { ...(clone as T), e2ee: e2eeMap };
}

/**
 * Transparently decrypt `e2ee` field envelopes back into runtime display fields in memory.
 */
export async function decryptRecordFields<T extends Record<string, unknown>>(
  record: T,
  vaultKey: CryptoKey | null
): Promise<T> {
  const e2eeMap = record.e2ee as Record<string, E2EEEnvelope> | undefined;
  if (!e2eeMap || !vaultKey) return record;
  const clone: Record<string, unknown> = { ...record };
  for (const [field, envelope] of Object.entries(e2eeMap)) {
    if (isE2EEEnvelope(envelope)) {
      try {
        clone[field] = await decryptTextE2EE(envelope, vaultKey);
      } catch {
        const currentVal = clone[field];
        if (typeof currentVal !== 'string' || currentVal.startsWith('E2EE::')) {
          clone[field] = '[Terenkripsi — Kunci Tidak Cocok]';
        }
      }
    }
  }
  return clone as T;
}

/**
 * Generate a cryptographic SHA-256 signature digest for RME doctor sign-off.
 */
export async function computeElectronicSignatureHash(payload: {
  recordId: string;
  patientId: string;
  doctorId: string;
  signedAt: string;
  summary: string;
}): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
    .toUpperCase();
}
