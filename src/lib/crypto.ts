'use client'

// Encryption layer using Web Crypto API (PBKDF2 + AES-256-GCM).
// Available in Tauri's webview without any native crypto dependencies.

const PBKDF2_ITERATIONS = 600_000
const SALT_LENGTH = 16
const IV_LENGTH = 12

// ── Key derivation ──

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

// ── Helpers ──

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// ── Encrypt ──

export async function encryptVault(plaintext: string, passphrase: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveKey(passphrase, salt)

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext)
  )

  // Concatenate salt + iv + ciphertext, then base64 encode
  const combined = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertext.byteLength)
  combined.set(salt, 0)
  combined.set(iv, SALT_LENGTH)
  combined.set(new Uint8Array(ciphertext), SALT_LENGTH + IV_LENGTH)

  return JSON.stringify({
    encrypted: true,
    data: toBase64(combined.buffer),
  })
}

// ── Decrypt ──

export async function decryptVault(encryptedJson: string, passphrase: string): Promise<string> {
  const envelope = JSON.parse(encryptedJson)
  if (!envelope.encrypted) {
    // Unencrypted vault — return data as-is
    return typeof envelope.data === 'string' ? envelope.data : JSON.stringify(envelope)
  }

  const combined = fromBase64(envelope.data)
  if (combined.length < SALT_LENGTH + IV_LENGTH + 1) {
    throw new Error('Vault data is corrupted or truncated — too short to contain valid encrypted content.')
  }
  const salt = combined.slice(0, SALT_LENGTH)
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH)

  const key = await deriveKey(passphrase, salt)

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )

  return new TextDecoder().decode(plainBuffer)
}

// ── Verify passphrase ──

export async function verifyPassphrase(encryptedJson: string, passphrase: string): Promise<boolean> {
  try {
    await decryptVault(encryptedJson, passphrase)
    return true
  } catch {
    return false
  }
}

// ── Check if vault data is encrypted ──

export function isEncryptedVault(data: string): boolean {
  try {
    const parsed = JSON.parse(data)
    return parsed.encrypted === true
  } catch {
    return false
  }
}

// ── Passphrase strength assessment ──

export function getPassphraseStrength(passphrase: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (passphrase.length === 0) return { level: 0, label: '', color: 'transparent' }

  let score = 0
  if (passphrase.length >= 8) score++
  if (passphrase.length >= 12) score++
  if (passphrase.length >= 16) score++
  if (/[a-z]/.test(passphrase) && /[A-Z]/.test(passphrase)) score++
  if (/\d/.test(passphrase)) score++
  if (/[^a-zA-Z0-9]/.test(passphrase)) score++

  if (score <= 2) return { level: 1, label: 'Weak', color: 'var(--danger)' }
  if (score <= 4) return { level: 2, label: 'Fair', color: '#e6a817' }
  return { level: 3, label: 'Strong', color: 'var(--accent)' }
}

// ── Re-encrypt vault with new passphrase ──

export async function reEncryptVault(
  encryptedVaultJson: string,
  oldPassphrase: string,
  newPassphrase: string
): Promise<string> {
  const plaintext = await decryptVault(encryptedVaultJson, oldPassphrase)
  return encryptVault(plaintext, newPassphrase)
}
