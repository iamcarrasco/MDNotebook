import { TreeItem } from './types'
import { genId, flattenNotes } from './tree-utils'
import { validateVaultData } from './validate'
import { invoke } from '@tauri-apps/api/core'
import { loadAssetAsObjectUrl, type AssetMeta } from './asset-manager'

// Replace vault:// image references with inline base64 data URLs for self-contained export
async function resolveVaultImages(
  content: string,
  assets: Record<string, AssetMeta>,
  vaultFolder: string,
  passphrase: string
): Promise<string> {
  const regex = /!\[([^\]]*)\]\(vault:\/\/([a-zA-Z0-9_-]+)\)/g
  const matches = [...content.matchAll(regex)]
  if (matches.length === 0) return content

  let result = content
  for (const match of matches) {
    const [fullMatch, alt, assetId] = match
    const meta = assets[assetId]
    if (!meta) continue
    try {
      const blobUrl = await loadAssetAsObjectUrl(vaultFolder, passphrase, assetId, meta.mimeType)
      const response = await fetch(blobUrl)
      const blob = await response.blob()
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
      result = result.replace(fullMatch, `![${alt}](${base64})`)
    } catch {
      // Keep original vault:// reference if decryption fails
    }
  }
  return result
}

export async function exportNoteAsMarkdown(
  note: TreeItem,
  assets?: Record<string, AssetMeta>,
  vaultFolder?: string,
  passphrase?: string
) {
  let content = note.content || ''
  if (assets && vaultFolder && passphrase) {
    content = await resolveVaultImages(content, assets, vaultFolder, passphrase)
  }
  const safeName = note.name.replace(/[^a-zA-Z0-9-_ ]/g, '')
  await invoke('save_file', {
    defaultName: `${safeName}.md`,
    content,
    filterName: 'Markdown',
    filterExtensions: ['md'],
  })
}

export async function exportAllAsJSON(tree: TreeItem[], trash: TreeItem[]) {
  const data = { version: 1, exportedAt: Date.now(), tree, trash }
  const content = JSON.stringify(data, null, 2)
  await invoke('save_file', {
    defaultName: `mdnotebook-backup-${new Date().toISOString().slice(0, 10)}.json`,
    content,
    filterName: 'JSON',
    filterExtensions: ['json'],
  })
}

export function importMarkdownFiles(files: FileList): Promise<TreeItem[]> {
  const promises = Array.from(files).map((file) => {
    return new Promise<TreeItem>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const now = Date.now()
        resolve({
          id: genId(),
          name: file.name.replace(/\.(md|txt)$/i, ''),
          type: 'note',
          content: reader.result as string,
          createdAt: now,
          updatedAt: now,
        })
      }
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
      reader.readAsText(file)
    })
  })
  return Promise.all(promises)
}

export async function exportAllAsMarkdownFolder(tree: TreeItem[], folder: string): Promise<number> {
  const notes = flattenNotes(tree)
  const payload = notes.map(n => ({
    name: n.name.replace(/[^a-zA-Z0-9\-_ ]/g, ''),
    content: n.content || '',
  }))
  await invoke('export_notes_to_folder', { folder, notes: payload })
  return notes.length
}

export function parseJSONBackup(text: string): { tree: TreeItem[]; trash: TreeItem[] } | null {
  try {
    const data = JSON.parse(text)
    if (data.tree && Array.isArray(data.tree)) {
      const validation = validateVaultData(data)
      if (!validation.valid) return null
      return { tree: validation.tree || data.tree, trash: validation.trash || data.trash || [] }
    }
    return null
  } catch {
    return null
  }
}
