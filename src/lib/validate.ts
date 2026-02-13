import type { TreeItem } from './types'

function isValidTreeItem(item: unknown): item is TreeItem {
  if (!item || typeof item !== 'object') return false
  const obj = item as Record<string, unknown>
  if (typeof obj.id !== 'string' || !obj.id) return false
  if (typeof obj.name !== 'string') return false
  if (obj.type !== 'note' && obj.type !== 'folder') return false
  if (typeof obj.createdAt !== 'number' && obj.createdAt !== undefined) return false
  if (typeof obj.updatedAt !== 'number' && obj.updatedAt !== undefined) return false
  if (obj.type === 'note' && obj.content !== undefined && typeof obj.content !== 'string') return false
  if (obj.type === 'folder' && obj.children !== undefined && !Array.isArray(obj.children)) return false
  if (obj.tags !== undefined && !Array.isArray(obj.tags)) return false
  if (obj.type === 'folder' && Array.isArray(obj.children)) {
    for (const child of obj.children) {
      if (!isValidTreeItem(child)) return false
    }
  }
  return true
}

function isValidTree(data: unknown): data is TreeItem[] {
  if (!Array.isArray(data)) return false
  for (const item of data) {
    if (!isValidTreeItem(item)) return false
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
