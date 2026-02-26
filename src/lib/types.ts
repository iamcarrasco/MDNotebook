export interface TreeItem {
  id: string
  name: string
  type: 'note' | 'folder'
  content?: string
  sourcePath?: string
  children?: TreeItem[]
  expanded?: boolean
  createdAt: number
  updatedAt: number
  deleted?: boolean
  deletedAt?: number
  tags?: string[]
  pinned?: boolean
  frontmatter?: Record<string, string>
}

export interface ContextMenuState {
  x: number
  y: number
  itemId: string
  itemType: 'note' | 'folder'
}

export type SortBy = 'manual' | 'name' | 'modified' | 'created'
export type SortDirection = 'asc' | 'desc'
export type Theme = 'light' | 'dark' | 'system'
