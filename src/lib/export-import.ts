import { TreeItem } from './types'
import { genId, flattenNotes } from './tree-utils'
import { validateVaultData } from './validate'
import { invoke } from '@tauri-apps/api/core'

export function exportNoteAsMarkdown(note: TreeItem) {
  const blob = new Blob([note.content || ''], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${note.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportAllAsJSON(tree: TreeItem[], trash: TreeItem[]) {
  const data = { version: 1, exportedAt: Date.now(), tree, trash }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mdnotebook-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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
