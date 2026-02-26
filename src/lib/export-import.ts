import { TreeItem } from './types'
import { genId, flattenNotes } from './tree-utils'
import { validateVaultData } from './validate'
import { invoke } from '@tauri-apps/api/core'
import { loadAssetAsObjectUrl, type AssetMeta } from './asset-manager'

// ── Frontmatter helpers ──

function generateFrontmatter(
  note: TreeItem,
  customFields?: Record<string, string>
): string {
  const lines: string[] = ['---']
  lines.push(`title: "${note.name.replace(/"/g, '\\"')}"`)
  lines.push(`date: ${new Date(note.createdAt).toISOString()}`)
  lines.push(`lastmod: ${new Date(note.updatedAt).toISOString()}`)
  if (note.tags && note.tags.length > 0) {
    lines.push(`tags:`)
    for (const tag of note.tags) {
      lines.push(`  - "${tag.replace(/"/g, '\\"')}"`)
    }
  }
  if (customFields) {
    for (const [key, value] of Object.entries(customFields)) {
      if (['title', 'date', 'lastmod', 'tags'].includes(key)) continue
      lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`)
    }
  }
  lines.push('---')
  lines.push('')
  return lines.join('\n')
}

function parseFrontmatter(markdown: string): {
  frontmatter: Record<string, string>
  content: string
} {
  const trimmed = markdown.trimStart()
  if (!trimmed.startsWith('---')) {
    return { frontmatter: {}, content: markdown }
  }
  const endIndex = trimmed.indexOf('\n---', 3)
  if (endIndex === -1) {
    return { frontmatter: {}, content: markdown }
  }
  const yamlBlock = trimmed.slice(4, endIndex)
  const content = trimmed.slice(endIndex + 4).replace(/^\n/, '')
  const fields: Record<string, string> = {}
  for (const line of yamlBlock.split('\n')) {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('-') || !trimmedLine.includes(':')) continue
    const colonIndex = trimmedLine.indexOf(':')
    const key = trimmedLine.slice(0, colonIndex).trim()
    let value = trimmedLine.slice(colonIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key) fields[key] = value
  }
  return { frontmatter: fields, content }
}

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
  passphrase?: string,
  includeFrontmatter?: boolean
) {
  let content = note.content || ''
  if (assets && vaultFolder && passphrase) {
    content = await resolveVaultImages(content, assets, vaultFolder, passphrase)
  }
  if (includeFrontmatter !== false) {
    content = generateFrontmatter(note, note.frontmatter) + content
  }
  const safeName = note.name.replace(/[^a-zA-Z0-9-_ ]/g, '')
  await invoke('save_file', {
    defaultName: `${safeName}.md`,
    content,
    filterName: 'Markdown',
    filterExtensions: ['md'],
  })
}

export async function exportNoteAsHTML(
  note: TreeItem,
  assets?: Record<string, AssetMeta>,
  vaultFolder?: string,
  passphrase?: string
) {
  let content = note.content || ''
  if (assets && vaultFolder && passphrase) {
    content = await resolveVaultImages(content, assets, vaultFolder, passphrase)
  }

  // Simple markdown to HTML conversion
  let html = content
    // Code blocks (must come before inline code)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) =>
      `<pre><code class="language-${lang}">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
    // Headings
    .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Task lists
    .replace(/^- \[x\]\s+(.+)$/gm, '<li class="task done"><input type="checkbox" checked disabled> $1</li>')
    .replace(/^- \[ \]\s+(.+)$/gm, '<li class="task"><input type="checkbox" disabled> $1</li>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Blockquotes
    .replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')
    // Paragraphs (wrap remaining lines)
    .replace(/^(?!<[a-z])((?!^\s*$).+)$/gm, '<p>$1</p>')
    // Clean up empty lines
    .replace(/\n{2,}/g, '\n')

  // Wrap lists
  html = html.replace(/(<li.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n')

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${note.name}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 48em; margin: 2em auto; padding: 0 1em; color: #1a1a1a; line-height: 1.6; }
    h1, h2, h3, h4, h5, h6 { margin-top: 1.5em; margin-bottom: 0.5em; }
    code { background: #f4f4f4; padding: 0.15em 0.3em; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 1em; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #ddd; padding-left: 1em; color: #555; margin: 1em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f9f9f9; font-weight: 600; }
    img { max-width: 100%; height: auto; }
    hr { border: none; border-top: 1px solid #ddd; margin: 2em 0; }
    a { color: #42B0D5; }
    .task { list-style: none; }
    .task input { margin-right: 0.5em; }
    ul { padding-left: 1.5em; }
  </style>
</head>
<body>
${html}
</body>
</html>`

  const safeName = note.name.replace(/[^a-zA-Z0-9-_ ]/g, '')
  await invoke('save_file', {
    defaultName: `${safeName}.html`,
    content: fullHtml,
    filterName: 'HTML',
    filterExtensions: ['html', 'htm'],
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
        const raw = reader.result as string
        const { frontmatter, content } = parseFrontmatter(raw)
        const now = Date.now()

        // Extract known fields from frontmatter
        const customFm = { ...frontmatter }
        const title = customFm.title
        delete customFm.title
        delete customFm.date
        delete customFm.lastmod
        delete customFm.tags

        resolve({
          id: genId(),
          name: title || file.name.replace(/\.(md|txt)$/i, ''),
          type: 'note',
          content,
          createdAt: frontmatter.date ? new Date(frontmatter.date).getTime() || now : now,
          updatedAt: frontmatter.lastmod ? new Date(frontmatter.lastmod).getTime() || now : now,
          ...(Object.keys(customFm).length > 0 ? { frontmatter: customFm } : {}),
        })
      }
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
      reader.readAsText(file)
    })
  })
  return Promise.all(promises)
}

export async function exportAllAsMarkdownFolder(tree: TreeItem[], includeFrontmatter?: boolean): Promise<number> {
  const folder = await invoke<string>('pick_folder')
  const notes = flattenNotes(tree)
  const payload = notes.map(n => {
    let content = n.content || ''
    if (includeFrontmatter !== false) {
      content = generateFrontmatter(n, n.frontmatter) + content
    }
    return {
      name: n.name.replace(/[^a-zA-Z0-9\-_ ]/g, ''),
      content,
    }
  })
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
