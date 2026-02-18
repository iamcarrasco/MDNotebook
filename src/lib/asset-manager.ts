import { invoke } from '@tauri-apps/api/core'
import { encryptAsset, decryptAsset } from './asset-crypto'

export interface AssetMeta {
  id: string
  originalName: string
  mimeType: string
  size: number
  createdAt: number
}

// In-memory cache of decrypted blob URLs (per session, avoids re-decrypting)
const objectUrlCache = new Map<string, string>()

export function generateAssetId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}

export async function saveAsset(
  vaultFolder: string,
  passphrase: string,
  file: File
): Promise<AssetMeta> {
  const assetId = generateAssetId()
  const buffer = await file.arrayBuffer()
  const encrypted = await encryptAsset(buffer, passphrase)
  await invoke('write_vault_asset', { folder: vaultFolder, assetId, data: encrypted })
  return {
    id: assetId,
    originalName: file.name || 'image',
    mimeType: file.type || 'application/octet-stream',
    size: buffer.byteLength,
    createdAt: Date.now(),
  }
}

export async function loadAssetAsObjectUrl(
  vaultFolder: string,
  passphrase: string,
  assetId: string,
  mimeType: string
): Promise<string> {
  const cached = objectUrlCache.get(assetId)
  if (cached) return cached

  const encrypted = await invoke<string>('read_vault_asset', { folder: vaultFolder, assetId })
  const buffer = await decryptAsset(encrypted, passphrase)
  const blob = new Blob([buffer], { type: mimeType })
  const url = URL.createObjectURL(blob)
  objectUrlCache.set(assetId, url)
  return url
}

export async function deleteAsset(
  vaultFolder: string,
  assetId: string
): Promise<void> {
  await invoke('delete_vault_asset', { folder: vaultFolder, assetId })
  const cached = objectUrlCache.get(assetId)
  if (cached) {
    URL.revokeObjectURL(cached)
    objectUrlCache.delete(assetId)
  }
}

export function revokeAllCachedUrls(): void {
  for (const url of objectUrlCache.values()) {
    URL.revokeObjectURL(url)
  }
  objectUrlCache.clear()
}
