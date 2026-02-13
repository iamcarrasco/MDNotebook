export interface TreeItem {
  id: string
  name: string
  type: 'note' | 'folder'
  content?: string
  children?: TreeItem[]
  expanded?: boolean
  createdAt: number
  updatedAt: number
  deleted?: boolean
  deletedAt?: number
  tags?: string[]
  pinned?: boolean
}

export interface ContextMenuState {
  x: number
  y: number
  itemId: string
  itemType: 'note' | 'folder'
}

export type SortBy = 'name' | 'modified' | 'created'
export type SortDirection = 'asc' | 'desc'
export type Theme = 'light' | 'dark'
export type SearchScope = 'all' | 'folder'
