import { describe, test, expect } from 'vitest'
import { encryptVault, decryptVault, verifyPassphrase, isEncryptedVault } from '../crypto'

describe('isEncryptedVault', () => {
  test('detects encrypted vault data', () => {
    expect(isEncryptedVault('{"encrypted":true,"data":"abc"}')).toBe(true)
  })

  test('detects plain JSON as not encrypted', () => {
    expect(isEncryptedVault('{"tree":[]}')).toBe(false)
  })

  test('handles empty string', () => {
    expect(isEncryptedVault('')).toBe(false)
  })

  test('handles non-JSON', () => {
    expect(isEncryptedVault('not json at all')).toBe(false)
  })

  test('handles null encrypted field', () => {
    expect(isEncryptedVault('{"encrypted":null}')).toBe(false)
  })
})

describe('encrypt / decrypt round-trip', () => {
  test('encrypts and decrypts data', async () => {
    const data = JSON.stringify({ tree: [], trash: [] })
    const passphrase = 'test-password-123'

    const encrypted = await encryptVault(data, passphrase)
    expect(isEncryptedVault(encrypted)).toBe(true)

    const decrypted = await decryptVault(encrypted, passphrase)
    expect(decrypted).toBe(data)
  })

  test('handles unicode content', async () => {
    const data = 'Hello 世界 🌍 émoji'
    const passphrase = 'pass'

    const encrypted = await encryptVault(data, passphrase)
    const decrypted = await decryptVault(encrypted, passphrase)
    expect(decrypted).toBe(data)
  })

  test('wrong passphrase fails to decrypt', async () => {
    const data = 'secret data'
    const encrypted = await encryptVault(data, 'correct-pass')

    await expect(decryptVault(encrypted, 'wrong-pass')).rejects.toThrow()
  })

  test('different encryptions produce different ciphertexts', async () => {
    const data = 'same data'
    const pass = 'same-pass'

    const enc1 = await encryptVault(data, pass)
    const enc2 = await encryptVault(data, pass)

    // Due to random salt/IV, ciphertexts should differ
    expect(enc1).not.toBe(enc2)

    // But both should decrypt to same plaintext
    expect(await decryptVault(enc1, pass)).toBe(data)
    expect(await decryptVault(enc2, pass)).toBe(data)
  })
})

describe('verifyPassphrase', () => {
  test('returns true for correct passphrase', async () => {
    const encrypted = await encryptVault('test', 'mypass')
    const result = await verifyPassphrase(encrypted, 'mypass')
    expect(result).toBe(true)
  })

  test('returns false for wrong passphrase', async () => {
    const encrypted = await encryptVault('test', 'mypass')
    const result = await verifyPassphrase(encrypted, 'wrongpass')
    expect(result).toBe(false)
  })
})
