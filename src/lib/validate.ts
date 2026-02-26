import type { TreeItem } from './types'

const MAX_DEPTH = 20

function isValidTreeItem(item: unknown, depth: number = 0): item is TreeItem {
  if (depth > MAX_DEPTH) return false
  if (!item || typeof item !== 'object') return false
  const obj = item as Record<string, unknown>

  // Required fields
  if (typeof obj.id !== 'string' || !obj.id) return false
  if (typeof obj.name !== 'string') return false
  if (obj.type !== 'note' && obj.type !== 'folder') return false

  // Optional timestamp fields
  if (obj.createdAt !== undefined && typeof obj.createdAt !== 'number') return false
  if (obj.updatedAt !== undefined && typeof obj.updatedAt !== 'number') return false

  // Optional boolean fields
  if (obj.expanded !== undefined && typeof obj.expanded !== 'boolean') return false
  if (obj.pinned !== undefined && typeof obj.pinned !== 'boolean') return false
  if (obj.deleted !== undefined && typeof obj.deleted !== 'boolean') return false
  if (obj.deletedAt !== undefined && typeof obj.deletedAt !== 'number') return false

  // Note content
  if (obj.type === 'note' && obj.content !== undefined && typeof obj.content !== 'string') return false
  if (obj.type === 'note' && obj.sourcePath !== undefined && typeof obj.sourcePath !== 'string') return false

  // Folder children (recursive with depth limit)
  if (obj.type === 'folder' && obj.children !== undefined) {
    if (!Array.isArray(obj.children)) return false
    for (const child of obj.children) {
      if (!isValidTreeItem(child, depth + 1)) return false
    }
  }

  // Tags — must be array of strings
  if (obj.tags !== undefined) {
    if (!Array.isArray(obj.tags)) return false
    for (const tag of obj.tags) {
      if (typeof tag !== 'string') return false
    }
  }

  // Frontmatter — must be Record<string, string>
  if (obj.frontmatter !== undefined) {
    if (!obj.frontmatter || typeof obj.frontmatter !== 'object' || Array.isArray(obj.frontmatter)) return false
    for (const v of Object.values(obj.frontmatter as Record<string, unknown>)) {
      if (typeof v !== 'string') return false
    }
  }

  return true
}

function isValidTree(data: unknown): data is TreeItem[] {
  if (!Array.isArray(data)) return false
  for (const item of data) {
    if (!isValidTreeItem(item, 0)) return false
  }
  return true
}

export interface ValidationResult {
  valid: boolean
  tree?: TreeItem[]
  trash?: TreeItem[]
  error?: string
}

export function validateVaultData(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Vault data is not an object' }
  }

  const obj = data as Record<string, unknown>

  if (obj.tree !== undefined && !isValidTree(obj.tree)) {
    return { valid: false, error: 'Invalid tree structure in vault data' }
  }

  if (obj.trash !== undefined && !isValidTree(obj.trash)) {
    return { valid: false, error: 'Invalid trash structure in vault data' }
  }

  return {
    valid: true,
    tree: (obj.tree as TreeItem[]) || [],
    trash: (obj.trash as TreeItem[]) || [],
  }
}
