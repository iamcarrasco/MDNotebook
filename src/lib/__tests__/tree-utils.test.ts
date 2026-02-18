import { describe, test, expect } from 'vitest'
import {
  genId, findNote, findItem, mapTree, addToTree, removeFromTree,
  collectNoteIds, hasChildren, filterTree, sortTree, buildSearchIndex,
  collectAllTags, backfillTimestamps, findNoteByName, flattenNotes,
} from '../tree-utils'
import type { TreeItem } from '../types'

const makeNote = (id: string, name: string, content = ''): TreeItem => ({
  id, name, type: 'note', content, createdAt: 1000, updatedAt: 1000,
})

const makeFolder = (id: string, name: string, children: TreeItem[] = []): TreeItem => ({
  id, name, type: 'folder', children, createdAt: 1000, updatedAt: 1000,
})

describe('genId', () => {
  test('generates unique ids', () => {
    const a = genId()
    const b = genId()
    expect(a).not.toBe(b)
  })

  test('id has expected prefix', () => {
    const id = genId()
    expect(id).toMatch(/^item-/)
  })
})

describe('findNote', () => {
  const tree = [makeFolder('f1', 'Folder', [makeNote('n1', 'Note 1')])]

  test('finds a note by id', () => {
    expect(findNote(tree, 'n1')?.name).toBe('Note 1')
  })

  test('returns null for non-existent id', () => {
    expect(findNote(tree, 'n99')).toBeNull()
  })

  test('does not find folders', () => {
    expect(findNote(tree, 'f1')).toBeNull()
  })
})

describe('findItem', () => {
  const tree = [makeFolder('f1', 'Folder', [makeNote('n1', 'Note')])]

  test('finds notes', () => {
    expect(findItem(tree, 'n1')?.name).toBe('Note')
  })

  test('finds folders', () => {
    expect(findItem(tree, 'f1')?.name).toBe('Folder')
  })

  test('returns null for missing items', () => {
    expect(findItem(tree, 'missing')).toBeNull()
  })
})

describe('mapTree', () => {
  const tree = [makeNote('n1', 'Note 1'), makeNote('n2', 'Note 2')]

  test('maps over all items', () => {
    const result = mapTree(tree, (item) => ({ ...item, name: item.name.toUpperCase() }))
    expect(result[0].name).toBe('NOTE 1')
    expect(result[1].name).toBe('NOTE 2')
  })

  test('maps recursively into folders', () => {
    const nested = [makeFolder('f1', 'Folder', [makeNote('n1', 'Note')])]
    const result = mapTree(nested, (item) => ({ ...item, name: item.name + '!' }))
    expect(result[0].name).toBe('Folder!')
    expect(result[0].children![0].name).toBe('Note!')
  })
})

describe('addToTree / removeFromTree', () => {
  const tree = [makeFolder('f1', 'Folder', [])]
  const note = makeNote('n1', 'New Note')

  test('adds item to root', () => {
    const result = addToTree(tree, null, note)
    expect(result).toHaveLength(2)
    expect(result[1].id).toBe('n1')
  })

  test('adds item to folder', () => {
    const result = addToTree(tree, 'f1', note)
    expect(result[0].children).toHaveLength(1)
    expect(result[0].children![0].id).toBe('n1')
  })

  test('removes item from root', () => {
    const withNote = [...tree, note]
    const result = removeFromTree(withNote, 'n1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('f1')
  })

  test('removes item from folder', () => {
    const withNote = addToTree(tree, 'f1', note)
    const result = removeFromTree(withNote, 'n1')
    expect(result[0].children).toHaveLength(0)
  })
})

describe('collectNoteIds', () => {
  const tree = [
    makeFolder('f1', 'Folder', [makeNote('n1', 'Note 1')]),
    makeNote('n2', 'Note 2'),
  ]

  test('collects all note ids', () => {
    const ids = collectNoteIds(tree)
    expect(ids).toEqual(['n1', 'n2'])
  })

  test('returns empty for empty tree', () => {
    expect(collectNoteIds([])).toEqual([])
  })
})

describe('hasChildren', () => {
  const tree = [
    makeFolder('f1', 'Folder', [makeNote('n1', 'Note')]),
    makeFolder('f2', 'Empty', []),
  ]

  test('returns true for folder with children', () => {
    expect(hasChildren(tree, 'f1')).toBe(true)
  })

  test('returns false for empty folder', () => {
    expect(hasChildren(tree, 'f2')).toBe(false)
  })
})

describe('filterTree', () => {
  const tree = [
    makeNote('n1', 'Hello World', 'content about hello'),
    makeNote('n2', 'Goodbye', 'content about goodbye'),
    makeFolder('f1', 'Notes', [makeNote('n3', 'Nested Hello', 'hello nested')]),
  ]

  test('filters by name', () => {
    const result = filterTree(tree, 'hello')
    const ids = flattenNotes(result).map(n => n.id)
    expect(ids).toContain('n1')
    expect(ids).toContain('n3')
  })

  test('filters by content', () => {
    const result = filterTree(tree, 'goodbye')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('n2')
  })

  test('returns empty for no match', () => {
    const result = filterTree(tree, 'zzzzz')
    expect(result).toHaveLength(0)
  })

  test('uses search index when provided', () => {
    const index = buildSearchIndex(tree)
    const result = filterTree(tree, 'goodbye', index)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('n2')
  })

  test('returns all for empty query', () => {
    const result = filterTree(tree, '')
    expect(result).toHaveLength(3)
  })
})

describe('sortTree', () => {
  const tree = [
    makeNote('n1', 'Banana'),
    makeNote('n2', 'Apple'),
    makeNote('n3', 'Cherry'),
  ]

  test('sorts by name ascending', () => {
    const result = sortTree(tree, 'name', 'asc')
    expect(result.map(i => i.name)).toEqual(['Apple', 'Banana', 'Cherry'])
  })

  test('sorts by name descending', () => {
    const result = sortTree(tree, 'name', 'desc')
    expect(result.map(i => i.name)).toEqual(['Cherry', 'Banana', 'Apple'])
  })

  test('puts folders first', () => {
    const mixed = [makeNote('n1', 'Note'), makeFolder('f1', 'Folder')]
    const result = sortTree(mixed, 'name', 'asc')
    expect(result[0].type).toBe('folder')
    expect(result[1].type).toBe('note')
  })

  test('puts pinned items first', () => {
    const items = [
      makeNote('n1', 'Unpinned'),
      { ...makeNote('n2', 'Pinned'), pinned: true },
    ]
    const result = sortTree(items, 'name', 'asc')
    expect(result[0].name).toBe('Pinned')
  })
})

describe('collectAllTags', () => {
  const tree = [
    { ...makeNote('n1', 'Note 1'), tags: ['a', 'b'] },
    { ...makeNote('n2', 'Note 2'), tags: ['b', 'c'] },
  ]

  test('collects unique tags sorted', () => {
    expect(collectAllTags(tree)).toEqual(['a', 'b', 'c'])
  })

  test('returns empty for no tags', () => {
    expect(collectAllTags([makeNote('n1', 'No Tags')])).toEqual([])
  })
})

describe('backfillTimestamps', () => {
  test('adds missing timestamps', () => {
    const items = [{ id: 'n1', name: 'Note', type: 'note' as const } as TreeItem]
    const result = backfillTimestamps(items)
    expect(result[0].createdAt).toBeGreaterThan(0)
    expect(result[0].updatedAt).toBeGreaterThan(0)
  })

  test('preserves existing timestamps', () => {
    const items = [makeNote('n1', 'Note')]
    const result = backfillTimestamps(items)
    expect(result[0].createdAt).toBe(1000)
    expect(result[0].updatedAt).toBe(1000)
  })
})

describe('findNoteByName', () => {
  const tree = [
    makeNote('n1', 'My Note'),
    makeFolder('f1', 'Folder', [makeNote('n2', 'Nested Note')]),
  ]

  test('finds by name case-insensitive', () => {
    expect(findNoteByName(tree, 'my note')?.id).toBe('n1')
  })

  test('finds nested notes', () => {
    expect(findNoteByName(tree, 'Nested Note')?.id).toBe('n2')
  })

  test('returns null for non-existent', () => {
    expect(findNoteByName(tree, 'does not exist')).toBeNull()
  })
})

describe('buildSearchIndex', () => {
  test('builds index with lowercased text', () => {
    const tree = [makeNote('n1', 'Hello', 'World')]
    const index = buildSearchIndex(tree)
    expect(index.get('n1')).toContain('hello')
    expect(index.get('n1')).toContain('world')
  })
})
