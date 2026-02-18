import { describe, test, expect } from 'vitest'
import { reducer, type NotebookState, type NotebookAction } from '../notebook-context'
import type { TreeItem } from '../types'

// ── Helpers ──

const makeNote = (id: string, name: string, content = ''): TreeItem => ({
  id, name, type: 'note', content, createdAt: 1000, updatedAt: 1000,
})

const makeFolder = (id: string, name: string, children: TreeItem[] = []): TreeItem => ({
  id, name, type: 'folder', children, expanded: false, createdAt: 1000, updatedAt: 1000,
})

function makeState(overrides: Partial<NotebookState> = {}): NotebookState {
  return {
    tree: [makeNote('n1', 'Note 1', 'content'), makeNote('n2', 'Note 2')],
    trash: [],
    activeId: 'n1',
    saveStatus: 'idle',
    searchQuery: '',
    theme: 'light',
    sidebarWidth: 260,
    sidebarVisible: true,
    zenMode: false,
    sortBy: 'name',
    sortDirection: 'asc',
    renamingId: null,
    renameValue: '',
    contextMenu: null,
    tagFilter: [],
    tagFilterMode: 'or',
    openTabs: ['n1'],
    vaultLoading: false,
    lastSavedAt: null,
    selectedFolderId: null,
    autosaveDelay: 500,
    customTemplates: [],
    noteVersions: {},
    treeContentVersion: 0,
    ...overrides,
  }
}

function dispatch(state: NotebookState, action: NotebookAction): NotebookState {
  return reducer(state, action)
}

// ── Tests ──

describe('SET_TREE', () => {
  test('replaces tree', () => {
    const s = makeState()
    const newTree = [makeNote('x', 'New')]
    const result = dispatch(s, { type: 'SET_TREE', tree: newTree })
    expect(result.tree).toEqual(newTree)
  })
})

describe('ADD_ITEM', () => {
  test('adds note to root', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'ADD_ITEM', parentId: null, itemType: 'note' })
    expect(result.tree).toHaveLength(3)
    const added = result.tree[2]
    expect(added.type).toBe('note')
    expect(added.name).toBe('Untitled Note')
    expect(result.activeId).toBe(added.id)
    expect(result.renamingId).toBe(added.id)
  })

  test('adds folder to root', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'ADD_ITEM', parentId: null, itemType: 'folder' })
    expect(result.tree).toHaveLength(3)
    const added = result.tree[2]
    expect(added.type).toBe('folder')
    expect(added.name).toBe('New Folder')
    expect(result.activeId).toBe('n1') // activeId unchanged for folders
  })

  test('adds note inside folder', () => {
    const s = makeState({ tree: [makeFolder('f1', 'Folder')] })
    const result = dispatch(s, { type: 'ADD_ITEM', parentId: 'f1', itemType: 'note' })
    expect(result.tree[0].children).toHaveLength(1)
  })

  test('opens tab for new note', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'ADD_ITEM', parentId: null, itemType: 'note' })
    const addedId = result.tree[2].id
    expect(result.openTabs).toContain(addedId)
  })

  test('clears context menu', () => {
    const s = makeState({ contextMenu: { x: 0, y: 0, itemId: 'n1', itemType: 'note' } })
    const result = dispatch(s, { type: 'ADD_ITEM', parentId: null, itemType: 'note' })
    expect(result.contextMenu).toBeNull()
  })
})

describe('DELETE_ITEM', () => {
  test('removes item from tree', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'DELETE_ITEM', id: 'n2' })
    expect(result.tree).toHaveLength(1)
    expect(result.tree[0].id).toBe('n1')
  })

  test('selects another note when active is deleted', () => {
    const s = makeState({ activeId: 'n2' })
    const result = dispatch(s, { type: 'DELETE_ITEM', id: 'n2' })
    expect(result.activeId).toBe('n1')
  })

  test('removes from open tabs', () => {
    const s = makeState({ openTabs: ['n1', 'n2'] })
    const result = dispatch(s, { type: 'DELETE_ITEM', id: 'n2' })
    expect(result.openTabs).toEqual(['n1'])
  })
})

describe('MOVE_TO_TRASH / RESTORE_FROM_TRASH', () => {
  test('moves item to trash', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'MOVE_TO_TRASH', id: 'n2' })
    expect(result.tree).toHaveLength(1)
    expect(result.trash).toHaveLength(1)
    expect(result.trash[0].id).toBe('n2')
    expect(result.trash[0].deleted).toBe(true)
  })

  test('restores item from trash', () => {
    const trashItem = { ...makeNote('n3', 'Trashed'), deleted: true, deletedAt: 1000 }
    const s = makeState({ trash: [trashItem] })
    const result = dispatch(s, { type: 'RESTORE_FROM_TRASH', id: 'n3' })
    expect(result.trash).toHaveLength(0)
    expect(result.tree).toHaveLength(3) // original 2 + restored
    const restored = result.tree[2]
    expect(restored.id).toBe('n3')
    expect(restored.deleted).toBeUndefined()
  })
})

describe('DELETE_PERMANENTLY', () => {
  test('removes from trash', () => {
    const trashItem = { ...makeNote('n3', 'Trashed'), deleted: true }
    const s = makeState({ trash: [trashItem] })
    const result = dispatch(s, { type: 'DELETE_PERMANENTLY', id: 'n3' })
    expect(result.trash).toHaveLength(0)
  })
})

describe('EMPTY_TRASH', () => {
  test('clears all trash', () => {
    const s = makeState({ trash: [makeNote('t1', 'T1'), makeNote('t2', 'T2')] })
    const result = dispatch(s, { type: 'EMPTY_TRASH' })
    expect(result.trash).toHaveLength(0)
  })
})

describe('RENAME_ITEM', () => {
  test('renames an item', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'RENAME_ITEM', id: 'n1', name: 'Renamed' })
    expect(result.tree[0].name).toBe('Renamed')
  })

  test('trims whitespace', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'RENAME_ITEM', id: 'n1', name: '  Trimmed  ' })
    expect(result.tree[0].name).toBe('Trimmed')
  })

  test('ignores empty name', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'RENAME_ITEM', id: 'n1', name: '   ' })
    expect(result.tree[0].name).toBe('Note 1')
  })
})

describe('UPDATE_NOTE_CONTENT', () => {
  test('updates note content', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'UPDATE_NOTE_CONTENT', id: 'n1', content: 'new content' })
    expect(result.tree[0].content).toBe('new content')
  })

  test('updates timestamp', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'UPDATE_NOTE_CONTENT', id: 'n1', content: 'updated' })
    expect(result.tree[0].updatedAt).toBeGreaterThan(1000)
  })
})

describe('TOGGLE_FOLDER', () => {
  test('toggles folder expanded state', () => {
    const s = makeState({ tree: [makeFolder('f1', 'Folder')] })
    const r1 = dispatch(s, { type: 'TOGGLE_FOLDER', id: 'f1' })
    expect(r1.tree[0].expanded).toBe(true)
    const r2 = dispatch(r1, { type: 'TOGGLE_FOLDER', id: 'f1' })
    expect(r2.tree[0].expanded).toBe(false)
  })
})

describe('SET_ACTIVE', () => {
  test('sets active id', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'SET_ACTIVE', id: 'n2' })
    expect(result.activeId).toBe('n2')
  })

  test('adds to open tabs if not present', () => {
    const s = makeState({ openTabs: ['n1'] })
    const result = dispatch(s, { type: 'SET_ACTIVE', id: 'n2' })
    expect(result.openTabs).toEqual(['n1', 'n2'])
  })

  test('does not duplicate in open tabs', () => {
    const s = makeState({ openTabs: ['n1', 'n2'] })
    const result = dispatch(s, { type: 'SET_ACTIVE', id: 'n2' })
    expect(result.openTabs).toEqual(['n1', 'n2'])
  })
})

describe('START_RENAME / SET_RENAME_VALUE / CONFIRM_RENAME / CANCEL_RENAME', () => {
  test('starts rename', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'START_RENAME', id: 'n1', name: 'Note 1' })
    expect(result.renamingId).toBe('n1')
    expect(result.renameValue).toBe('Note 1')
    expect(result.contextMenu).toBeNull()
  })

  test('sets rename value', () => {
    const s = makeState({ renamingId: 'n1', renameValue: 'Note 1' })
    const result = dispatch(s, { type: 'SET_RENAME_VALUE', value: 'New Name' })
    expect(result.renameValue).toBe('New Name')
  })

  test('confirms rename', () => {
    const s = makeState({ renamingId: 'n1', renameValue: 'Renamed' })
    const result = dispatch(s, { type: 'CONFIRM_RENAME' })
    expect(result.renamingId).toBeNull()
    expect(result.tree[0].name).toBe('Renamed')
  })

  test('confirm rename deduplicates sibling names', () => {
    const s = makeState({ renamingId: 'n1', renameValue: 'Note 2' })
    const result = dispatch(s, { type: 'CONFIRM_RENAME' })
    expect(result.tree[0].name).toBe('Note 2 (2)')
  })

  test('confirm rename with empty value clears rename state', () => {
    const s = makeState({ renamingId: 'n1', renameValue: '' })
    const result = dispatch(s, { type: 'CONFIRM_RENAME' })
    expect(result.renamingId).toBeNull()
    expect(result.tree[0].name).toBe('Note 1') // unchanged
  })

  test('cancels rename', () => {
    const s = makeState({ renamingId: 'n1', renameValue: 'Whatever' })
    const result = dispatch(s, { type: 'CANCEL_RENAME' })
    expect(result.renamingId).toBeNull()
    expect(result.tree[0].name).toBe('Note 1') // unchanged
  })
})

describe('SET_CONTEXT_MENU', () => {
  test('sets and clears context menu', () => {
    const s = makeState()
    const menu = { x: 100, y: 200, itemId: 'n1', itemType: 'note' as const }
    const r1 = dispatch(s, { type: 'SET_CONTEXT_MENU', menu })
    expect(r1.contextMenu).toEqual(menu)
    const r2 = dispatch(r1, { type: 'SET_CONTEXT_MENU', menu: null })
    expect(r2.contextMenu).toBeNull()
  })
})

describe('Theme', () => {
  test('SET_THEME sets theme', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'SET_THEME', theme: 'dark' })
    expect(result.theme).toBe('dark')
  })

  test('TOGGLE_THEME toggles', () => {
    const s = makeState({ theme: 'light' })
    const r1 = dispatch(s, { type: 'TOGGLE_THEME' })
    expect(r1.theme).toBe('dark')
    const r2 = dispatch(r1, { type: 'TOGGLE_THEME' })
    expect(r2.theme).toBe('light')
  })
})

describe('Sidebar', () => {
  test('SET_SIDEBAR_WIDTH', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'SET_SIDEBAR_WIDTH', width: 300 })
    expect(result.sidebarWidth).toBe(300)
  })

  test('TOGGLE_SIDEBAR', () => {
    const s = makeState({ sidebarVisible: true })
    const r1 = dispatch(s, { type: 'TOGGLE_SIDEBAR' })
    expect(r1.sidebarVisible).toBe(false)
    const r2 = dispatch(r1, { type: 'TOGGLE_SIDEBAR' })
    expect(r2.sidebarVisible).toBe(true)
  })
})

describe('TOGGLE_ZEN_MODE', () => {
  test('toggles zen mode', () => {
    const s = makeState()
    const r1 = dispatch(s, { type: 'TOGGLE_ZEN_MODE' })
    expect(r1.zenMode).toBe(true)
    const r2 = dispatch(r1, { type: 'TOGGLE_ZEN_MODE' })
    expect(r2.zenMode).toBe(false)
  })
})

describe('SET_SEARCH_QUERY', () => {
  test('sets search query', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'SET_SEARCH_QUERY', query: 'hello' })
    expect(result.searchQuery).toBe('hello')
  })
})

describe('SET_SORT', () => {
  test('sets sort options', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'SET_SORT', sortBy: 'modified', direction: 'desc' })
    expect(result.sortBy).toBe('modified')
    expect(result.sortDirection).toBe('desc')
  })
})

describe('Tags', () => {
  test('ADD_TAG adds a tag', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'ADD_TAG', noteId: 'n1', tag: 'test' })
    expect(result.tree[0].tags).toEqual(['test'])
  })

  test('ADD_TAG does not duplicate', () => {
    const s = makeState({ tree: [{ ...makeNote('n1', 'Note'), tags: ['test'] }] })
    const result = dispatch(s, { type: 'ADD_TAG', noteId: 'n1', tag: 'test' })
    expect(result.tree[0].tags).toEqual(['test'])
  })

  test('REMOVE_TAG removes a tag', () => {
    const s = makeState({ tree: [{ ...makeNote('n1', 'Note'), tags: ['a', 'b'] }] })
    const result = dispatch(s, { type: 'REMOVE_TAG', noteId: 'n1', tag: 'a' })
    expect(result.tree[0].tags).toEqual(['b'])
  })

  test('SET_TAG_FILTER toggles tag filter', () => {
    const s = makeState()
    const r1 = dispatch(s, { type: 'SET_TAG_FILTER', tag: 'test' })
    expect(r1.tagFilter).toEqual(['test'])
    const r2 = dispatch(r1, { type: 'SET_TAG_FILTER', tag: 'test' })
    expect(r2.tagFilter).toEqual([])
  })

  test('SET_TAG_FILTER with null clears all', () => {
    const s = makeState({ tagFilter: ['a', 'b'] })
    const result = dispatch(s, { type: 'SET_TAG_FILTER', tag: null })
    expect(result.tagFilter).toEqual([])
  })

  test('SET_TAG_FILTER_MODE sets mode', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'SET_TAG_FILTER_MODE', mode: 'and' })
    expect(result.tagFilterMode).toBe('and')
  })
})

describe('TOGGLE_PIN', () => {
  test('toggles pin state', () => {
    const s = makeState()
    const r1 = dispatch(s, { type: 'TOGGLE_PIN', id: 'n1' })
    expect(r1.tree[0].pinned).toBe(true)
    expect(r1.contextMenu).toBeNull()
    const r2 = dispatch(r1, { type: 'TOGGLE_PIN', id: 'n1' })
    expect(r2.tree[0].pinned).toBe(false)
  })
})

describe('CLOSE_TAB', () => {
  test('removes tab', () => {
    const s = makeState({ openTabs: ['n1', 'n2'] })
    const result = dispatch(s, { type: 'CLOSE_TAB', id: 'n2' })
    expect(result.openTabs).toEqual(['n1'])
  })

  test('selects adjacent tab when active tab is closed', () => {
    const s = makeState({ openTabs: ['n1', 'n2'], activeId: 'n2' })
    const result = dispatch(s, { type: 'CLOSE_TAB', id: 'n2' })
    expect(result.activeId).toBe('n1')
  })

  test('clears activeId when last tab is closed', () => {
    const s = makeState({ openTabs: ['n1'], activeId: 'n1' })
    const result = dispatch(s, { type: 'CLOSE_TAB', id: 'n1' })
    expect(result.activeId).toBe('')
    expect(result.openTabs).toEqual([])
  })
})

describe('IMPORT_ITEMS', () => {
  test('appends items to tree', () => {
    const s = makeState()
    const items = [makeNote('n3', 'Imported')]
    const result = dispatch(s, { type: 'IMPORT_ITEMS', items })
    expect(result.tree).toHaveLength(3)
    expect(result.tree[2].name).toBe('Imported')
  })
})

describe('LOAD_STATE', () => {
  test('merges partial state', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'LOAD_STATE', state: { theme: 'dark', sidebarWidth: 400 } })
    expect(result.theme).toBe('dark')
    expect(result.sidebarWidth).toBe(400)
    expect(result.tree).toEqual(s.tree) // unchanged
  })
})

describe('SET_SAVE_STATUS', () => {
  test('sets save status', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'SET_SAVE_STATUS', status: 'saving' })
    expect(result.saveStatus).toBe('saving')
  })

  test('sets lastSavedAt when saved', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'SET_SAVE_STATUS', status: 'saved' })
    expect(result.saveStatus).toBe('saved')
    expect(result.lastSavedAt).toBeGreaterThan(0)
  })

  test('does not update lastSavedAt for other statuses', () => {
    const s = makeState({ lastSavedAt: 5000 })
    const result = dispatch(s, { type: 'SET_SAVE_STATUS', status: 'error' })
    expect(result.lastSavedAt).toBe(5000)
  })
})

describe('SET_VAULT_LOADING', () => {
  test('sets vault loading', () => {
    const s = makeState()
    const result = dispatch(s, { type: 'SET_VAULT_LOADING', loading: true })
    expect(result.vaultLoading).toBe(true)
  })
})

describe('MOVE_ITEM', () => {
  test('moves item to different position', () => {
    const s = makeState()
    // moveItem is tested via tree-utils, but verify reducer passes through
    const result = dispatch(s, { type: 'MOVE_ITEM', itemId: 'n1', targetId: 'n2', position: 'after' })
    expect(result.tree).toBeDefined()
  })
})

describe('default case', () => {
  test('returns state unchanged for unknown action', () => {
    const s = makeState()
    const result = reducer(s, { type: 'UNKNOWN' } as unknown as NotebookAction)
    expect(result).toBe(s)
  })
})
