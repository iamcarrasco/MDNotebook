// Asset encryption using the same AES-256-GCM + PBKDF2 scheme as vault encryption.
// Operates on ArrayBuffer (binary) instead of strings.
// Caches the derived CryptoKey to avoid re-running PBKDF2 for every image.

const PBKDF2_ITERATIONS = 600_000
const SALT_LENGTH = 16
const IV_LENGTH = 12

// ── Key cache (passphrase doesn't change during a session) ──

let cachedPassphrase: string | null = null
let cachedSalt: Uint8Array | null = null
let cachedKey: CryptoKey | null = null

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  // Return cached key if same passphrase and salt
  if (
    cachedKey &&
    cachedPassphrase === passphrase &&
    cachedSalt &&
    cachedSalt.length === salt.length &&
    cachedSalt.every((b, i) => b === salt[i])
  ) {
    return cachedKey
  }

  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  const key = await crypto.subtle.deriveKey(
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

  cachedPassphrase = passphrase
  cachedSalt = new Uint8Array(salt)
  cachedKey = key
  return key
}

// For decryption we can't cache by salt (each file has different salt),
// but we can cache the key material import to skip that step.
let cachedKeyMaterial: CryptoKey | null = null
let cachedKeyMaterialPassphrase: string | null = null

async function deriveKeyForDecrypt(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!cachedKeyMaterial || cachedKeyMaterialPassphrase !== passphrase) {
    const encoder = new TextEncoder()
    cachedKeyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    )
    cachedKeyMaterialPassphrase = passphrase
  }

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    cachedKeyMaterial,
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

export async function encryptAsset(data: ArrayBuffer, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveKey(passphrase, salt)

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )

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

export async function decryptAsset(encrypted: string, passphrase: string): Promise<ArrayBuffer> {
  const envelope = JSON.parse(encrypted)
  if (!envelope.encrypted) {
    throw new Error('Asset data is not encrypted')
  }

  const combined = fromBase64(envelope.data)
  if (combined.length < SALT_LENGTH + IV_LENGTH + 1) {
    throw new Error('Asset data is corrupted or truncated')
  }

  const salt = combined.slice(0, SALT_LENGTH)
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH)

  const key = await deriveKeyForDecrypt(passphrase, salt)

  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
}
