import { TreeItem, SortBy, SortDirection } from './types'

let nextId = 1
export function genId(): string {
  return `item-${Date.now()}-${nextId++}`
}

export function findNote(items: TreeItem[], id: string): TreeItem | null {
  for (const item of items) {
    if (item.id === id && item.type === 'note') return item
    if (item.children) {
      const found = findNote(item.children, id)
      if (found) return found
    }
  }
  return null
}

export function findItem(items: TreeItem[], id: string): TreeItem | null {
  for (const item of items) {
    if (item.id === id) return item
    if (item.children) {
      const found = findItem(item.children, id)
      if (found) return found
    }
  }
  return null
}

export function mapTree(items: TreeItem[], fn: (item: TreeItem) => TreeItem): TreeItem[] {
  return items.map((item) => {
    const mapped = fn(item)
    if (mapped.children) {
      return { ...mapped, children: mapTree(mapped.children, fn) }
    }
    return mapped
  })
}

export function addToTree(items: TreeItem[], parentId: string | null, newItem: TreeItem): TreeItem[] {
  if (parentId === null) {
    return [...items, newItem]
  }
  return items.map((item) => {
    if (item.id === parentId && item.type === 'folder') {
      return { ...item, children: [...(item.children || []), newItem], expanded: true }
    }
    if (item.children) {
      return { ...item, children: addToTree(item.children, parentId, newItem) }
    }
    return item
  })
}

export function removeFromTree(items: TreeItem[], id: string): TreeItem[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => {
      if (item.children) {
        return { ...item, children: removeFromTree(item.children, id) }
      }
      return item
    })
}

export function collectNoteIds(items: TreeItem[]): string[] {
  const ids: string[] = []
  for (const item of items) {
    if (item.type === 'note') ids.push(item.id)
    if (item.children) ids.push(...collectNoteIds(item.children))
  }
  return ids
}

export function hasChildren(items: TreeItem[], id: string): boolean {
  for (const item of items) {
    if (item.id === id) return (item.children?.length ?? 0) > 0
    if (item.children) {
      const found = hasChildren(item.children, id)
      if (found) return true
    }
  }
  return false
}

export function findItemName(items: TreeItem[], id: string): string {
  for (const item of items) {
    if (item.id === id) return item.name
    if (item.children) {
      const found = findItemName(item.children, id)
      if (found) return found
    }
  }
  return ''
}

export function findParentPath(items: TreeItem[], targetId: string, path: TreeItem[] = []): TreeItem[] | null {
  for (const item of items) {
    if (item.id === targetId) return path
    if (item.children) {
      const found = findParentPath(item.children, targetId, [...path, item])
      if (found) return found
    }
  }
  return null
}

export function flattenNotes(items: TreeItem[]): TreeItem[] {
  const notes: TreeItem[] = []
  for (const item of items) {
    if (item.type === 'note') notes.push(item)
    if (item.children) notes.push(...flattenNotes(item.children))
  }
  return notes
}

export function moveItem(items: TreeItem[], itemId: string, targetId: string, position: 'before' | 'after' | 'inside'): TreeItem[] {
  const item = findItem(items, itemId)
  if (!item) return items

  // Prevent moving an item into its own descendant (would corrupt the tree)
  if (isDescendant(items, itemId, targetId)) return items

  // Remove from current position
  let result = removeFromTree(items, itemId)

  if (position === 'inside') {
    // Add as child of target folder
    result = mapTree(result, (node) => {
      if (node.id === targetId && node.type === 'folder') {
        return { ...node, children: [...(node.children || []), item], expanded: true }
      }
      return node
    })
  } else {
    // Insert before/after target at same level
    result = insertAtPosition(result, item, targetId, position)
  }

  return result
}

function insertAtPosition(items: TreeItem[], newItem: TreeItem, targetId: string, position: 'before' | 'after'): TreeItem[] {
  const result: TreeItem[] = []
  let found = false

  for (const item of items) {
    if (item.id === targetId) {
      found = true
      if (position === 'before') {
        result.push(newItem)
        result.push(item)
      } else {
        result.push(item)
        result.push(newItem)
      }
    } else if (item.children) {
      const newChildren = insertAtPosition(item.children, newItem, targetId, position)
      if (newChildren !== item.children) {
        // Target was found deeper — keep the modified subtree
        found = true
        result.push({ ...item, children: newChildren })
      } else {
        result.push(item)
      }
    } else {
      result.push(item)
    }
  }

  return found ? result : items
}

export type SearchIndex = Map<string, string>

export function buildSearchIndex(items: TreeItem[]): SearchIndex {
  const index: SearchIndex = new Map()
  function walk(nodes: TreeItem[]) {
    for (const item of nodes) {
      const text = (item.name + '\n' + (item.content || '')).toLowerCase()
      index.set(item.id, text)
      if (item.children) walk(item.children)
    }
  }
  walk(items)
  return index
}

export function filterTree(items: TreeItem[], query: string, index?: SearchIndex): TreeItem[] {
  if (!query.trim()) return items
  const q = query.toLowerCase()

  return items.reduce<TreeItem[]>((acc, item) => {
    if (item.type === 'note') {
      let match: boolean
      if (index) {
        const cached = index.get(item.id) || ''
        match = cached.includes(q)
      } else {
        const nameMatch = item.name.toLowerCase().includes(q)
        const contentMatch = (item.content || '').toLowerCase().includes(q)
        match = nameMatch || contentMatch
      }
      if (match) acc.push(item)
    } else if (item.type === 'folder') {
      let nameMatch: boolean
      if (index) {
        const cached = index.get(item.id) || ''
        nameMatch = cached.includes(q)
      } else {
        nameMatch = item.name.toLowerCase().includes(q)
      }
      const filteredChildren = item.children ? filterTree(item.children, query, index) : []
      if (nameMatch || filteredChildren.length > 0) {
        acc.push({ ...item, children: filteredChildren, expanded: true })
      }
    }
    return acc
  }, [])
}

export function sortTree(items: TreeItem[], sortBy: SortBy, direction: SortDirection): TreeItem[] {
  const sorted = [...items].sort((a, b) => {
    // Folders first
    if (a.type === 'folder' && b.type !== 'folder') return -1
    if (a.type !== 'folder' && b.type === 'folder') return 1

    // Pinned items first
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1

    let cmp = 0
    switch (sortBy) {
      case 'name':
        cmp = a.name.localeCompare(b.name)
        break
      case 'modified':
        cmp = (a.updatedAt || 0) - (b.updatedAt || 0)
        break
      case 'created':
        cmp = (a.createdAt || 0) - (b.createdAt || 0)
        break
    }
    return direction === 'asc' ? cmp : -cmp
  })

  return sorted.map((item) => {
    if (item.children) {
      return { ...item, children: sortTree(item.children, sortBy, direction) }
    }
    return item
  })
}

export function isDescendant(items: TreeItem[], parentId: string, childId: string): boolean {
  const parent = findItem(items, parentId)
  if (!parent || !parent.children) return false
  for (const child of parent.children) {
    if (child.id === childId) return true
    if (child.children && isDescendant([child], child.id, childId)) return true
  }
  return false
}

export function collectAllTags(items: TreeItem[]): string[] {
  const tagSet = new Set<string>()
  for (const item of items) {
    if (item.tags) item.tags.forEach((t) => tagSet.add(t))
    if (item.children) collectAllTags(item.children).forEach((t) => tagSet.add(t))
  }
  return Array.from(tagSet).sort()
}

export function backfillTimestamps(items: TreeItem[]): TreeItem[] {
  const now = Date.now()
  return items.map((item) => ({
    ...item,
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
    children: item.children ? backfillTimestamps(item.children) : item.children,
  }))
}

export function findNoteByName(items: TreeItem[], name: string): TreeItem | null {
  const lower = name.toLowerCase()
  for (const item of items) {
    if (item.type === 'note' && item.name.toLowerCase() === lower) return item
    if (item.children) {
      const found = findNoteByName(item.children, name)
      if (found) return found
    }
  }
  return null
}

export function findBacklinks(items: TreeItem[], noteName: string): TreeItem[] {
  const pattern = `[[${noteName}]]`.toLowerCase()
  const results: TreeItem[] = []
  function walk(nodes: TreeItem[]) {
    for (const item of nodes) {
      if (item.type === 'note' && item.content) {
        if (item.content.toLowerCase().includes(pattern)) {
          results.push(item)
        }
      }
      if (item.children) walk(item.children)
    }
  }
  walk(items)
  return results
}

export function getContentSnippet(content: string, query: string, maxLen: number = 80): string | null {
  if (!content || !query) return null
  const lower = content.toLowerCase()
  const q = query.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx === -1) return null
  const start = Math.max(0, idx - 20)
  const end = Math.min(content.length, idx + q.length + maxLen - 20)
  let snippet = content.slice(start, end).replace(/\n/g, ' ').trim()
  if (start > 0) snippet = '...' + snippet
  if (end < content.length) snippet = snippet + '...'
  return snippet
}
