'use client'

import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode, type Dispatch } from 'react'
import { TreeItem, ContextMenuState, SortBy, SortDirection, Theme } from './types'
import {
  findNote, mapTree, addToTree, removeFromTree, collectNoteIds,
  genId, backfillTimestamps, moveItem,
} from './tree-utils'
import { readVaultFile, writeVaultFile } from './local-vault'
import { encryptVault, decryptVault, isEncryptedVault } from './crypto'
import { notify } from './notifications'
import { validateVaultData } from './validate'

// ── Initial sample data ──

const now = Date.now()

const defaultTree: TreeItem[] = [
  {
    id: 'folder-notes',
    name: 'Notes',
    type: 'folder',
    expanded: true,
    createdAt: now,
    updatedAt: now,
    children: [
      {
        id: 'welcome',
        name: 'Welcome',
        type: 'note',
        createdAt: now,
        updatedAt: now,
        content: `# Welcome to MDNotebook

A rich-text markdown notebook with encryption and offline storage.

## Write in Markdown

- Supports **bold**, *italic*, and ~~strikethrough~~
- Headings, lists, tables, and code blocks
- Use the toolbar buttons or type Markdown directly

## Features

- AES-256-GCM encrypted vault
- WYSIWYG rich-text editing stored as Markdown
- Dark mode with Ctrl+Shift+D
- Wiki links: [[Getting Started]]
- Mermaid diagram preview

\`\`\`js
console.log("Hello, MDNotebook!");
\`\`\`
`,
      },
      {
        id: 'getting-started',
        name: 'Getting Started',
        type: 'note',
        createdAt: now,
        updatedAt: now,
        content: `# Getting Started

## Writing

The editor is WYSIWYG — bold is bold, headings are headings. Use the toolbar buttons or keyboard shortcuts to format text. Notes are stored as Markdown:

- **Bold**: Ctrl+B or toolbar B button
- *Italic*: Ctrl+I or toolbar I button
- Headings: select from the toolbar dropdown
- Links: toolbar link button
- Code: toolbar code block button

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| F1 | Help panel |
| Ctrl+N | New note |
| Ctrl+Shift+T | Daily note |
| Ctrl+Shift+D | Toggle dark mode |
| Ctrl+Shift+Z | Zen mode |
| Ctrl+\\\\ | Toggle sidebar |

## Tips

- Press **F1** anytime to open the full help panel
- Use **[[Note Name]]** to link between notes
- Add tags to organize and filter your notes
- Right-click items in the sidebar for more options

> MDNotebook is an offline-first, encrypted markdown notebook.
`,
      },
    ],
  },
  {
    id: 'folder-projects',
    name: 'Projects',
    type: 'folder',
    expanded: false,
    createdAt: now,
    updatedAt: now,
    children: [
      {
        id: 'ideas',
        name: 'Ideas & Brainstorm',
        type: 'note',
        createdAt: now,
        updatedAt: now,
        content: `# Ideas & Brainstorm

## Project Ideas

- [ ] Build a CLI tool for note management
- [ ] Create a plugin system for custom blocks
- [ ] Add tag-based organization

## Notes

These are just placeholder notes. Replace them with your own content!
`,
      },
    ],
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    type: 'note',
    createdAt: now,
    updatedAt: now,
    content: `# Meeting Notes

**Date**: 2025-01-15

## Attendees

| Name | Role |
|------|------|
| Alice | Engineering |
| Bob | Design |

## Action Items

- [ ] Review PR #42
- [ ] Update documentation
- [x] Set up dev environment
`,
  },
]

// ── State shape ──

export interface NotebookState {
  tree: TreeItem[]
  trash: TreeItem[]
  activeId: string
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  searchQuery: string
  theme: Theme
  sidebarWidth: number
  sidebarVisible: boolean
  zenMode: boolean
  sortBy: SortBy
  sortDirection: SortDirection
  renamingId: string | null
  renameValue: string
  contextMenu: ContextMenuState | null
  tagFilter: string[]
  tagFilterMode: 'and' | 'or'
  openTabs: string[]
  vaultLoading: boolean
  showMigration: boolean
  lastSavedAt: number | null
}

// ── Actions ──

export type NotebookAction =
  | { type: 'SET_TREE'; tree: TreeItem[] }
  | { type: 'ADD_ITEM'; parentId: string | null; itemType: 'note' | 'folder' }
  | { type: 'DELETE_ITEM'; id: string }
  | { type: 'RENAME_ITEM'; id: string; name: string }
  | { type: 'UPDATE_NOTE_CONTENT'; id: string; content: string }
  | { type: 'TOGGLE_FOLDER'; id: string }
  | { type: 'SET_ACTIVE'; id: string }
  | { type: 'SET_CONTEXT_MENU'; menu: ContextMenuState | null }
  | { type: 'START_RENAME'; id: string; name: string }
  | { type: 'SET_RENAME_VALUE'; value: string }
  | { type: 'CONFIRM_RENAME' }
  | { type: 'CANCEL_RENAME' }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_THEME'; theme: Theme }
  | { type: 'TOGGLE_THEME' }
  | { type: 'SET_SIDEBAR_WIDTH'; width: number }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_ZEN_MODE' }
  | { type: 'SET_SORT'; sortBy: SortBy; direction: SortDirection }
  | { type: 'MOVE_ITEM'; itemId: string; targetId: string; position: 'before' | 'after' | 'inside' }
  | { type: 'MOVE_TO_TRASH'; id: string }
  | { type: 'RESTORE_FROM_TRASH'; id: string }
  | { type: 'DELETE_PERMANENTLY'; id: string }
  | { type: 'EMPTY_TRASH' }
  | { type: 'ADD_TAG'; noteId: string; tag: string }
  | { type: 'REMOVE_TAG'; noteId: string; tag: string }
  | { type: 'SET_TAG_FILTER'; tag: string | null }
  | { type: 'SET_TAG_FILTER_MODE'; mode: 'and' | 'or' }
  | { type: 'TOGGLE_PIN'; id: string }
  | { type: 'CLOSE_TAB'; id: string }
  | { type: 'IMPORT_ITEMS'; items: TreeItem[] }
  | { type: 'LOAD_STATE'; state: Partial<NotebookState> }
  | { type: 'SET_SAVE_STATUS'; status: 'idle' | 'saving' | 'saved' | 'error' }
  | { type: 'SET_VAULT_LOADING'; loading: boolean }
  | { type: 'SET_SHOW_MIGRATION'; show: boolean }

// ── Serialization ──

function getVaultFields(state: NotebookState) {
  return {
    tree: state.tree,
    trash: state.trash,
    activeId: state.activeId,
    theme: state.theme,
    sidebarWidth: state.sidebarWidth,
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
    openTabs: state.openTabs,
  }
}

// ── Reducer ──

export function reducer(state: NotebookState, action: NotebookAction): NotebookState {
  switch (action.type) {
    case 'SET_TREE':
      return { ...state, tree: action.tree }

    case 'ADD_ITEM': {
      const ts = Date.now()
      const newItem: TreeItem = {
        id: genId(),
        name: action.itemType === 'note' ? 'Untitled Note' : 'New Folder',
        type: action.itemType,
        createdAt: ts,
        updatedAt: ts,
        ...(action.itemType === 'note' ? { content: '' } : { children: [], expanded: true }),
      }
      const newTabs = action.itemType === 'note'
        ? [...state.openTabs, newItem.id]
        : state.openTabs
      return {
        ...state,
        tree: addToTree(state.tree, action.parentId, newItem),
        activeId: action.itemType === 'note' ? newItem.id : state.activeId,
        openTabs: newTabs,
        renamingId: newItem.id,
        renameValue: newItem.name,
        contextMenu: null,
      }
    }

    case 'DELETE_ITEM': {
      const updated = removeFromTree(state.tree, action.id)
      let newActiveId = state.activeId
      if (action.id === state.activeId || !findNote(updated, state.activeId)) {
        const noteIds = collectNoteIds(updated)
        newActiveId = noteIds.length > 0 ? noteIds[0] : ''
      }
      return { ...state, tree: updated, activeId: newActiveId, openTabs: state.openTabs.filter(t => t !== action.id), contextMenu: null }
    }

    case 'MOVE_TO_TRASH': {
      const item = findItemInTree(state.tree, action.id)
      if (!item) return state
      const trashItem = markDeleted(item)
      const updated = removeFromTree(state.tree, action.id)
      let newActiveId = state.activeId
      if (action.id === state.activeId || !findNote(updated, state.activeId)) {
        const noteIds = collectNoteIds(updated)
        newActiveId = noteIds.length > 0 ? noteIds[0] : ''
      }
      return {
        ...state,
        tree: updated,
        trash: [...state.trash, trashItem],
        activeId: newActiveId,
        openTabs: state.openTabs.filter(t => t !== action.id),
        contextMenu: null,
      }
    }

    case 'RESTORE_FROM_TRASH': {
      const item = state.trash.find((t) => t.id === action.id)
      if (!item) return state
      const restored = unmarkDeleted(item)
      return {
        ...state,
        trash: state.trash.filter((t) => t.id !== action.id),
        tree: [...state.tree, restored],
      }
    }

    case 'DELETE_PERMANENTLY':
      return {
        ...state,
        trash: state.trash.filter((t) => t.id !== action.id),
      }

    case 'EMPTY_TRASH':
      return { ...state, trash: [] }

    case 'RENAME_ITEM': {
      if (!action.name.trim()) return state
      const ts = Date.now()
      return {
        ...state,
        tree: mapTree(state.tree, (item) =>
          item.id === action.id ? { ...item, name: action.name.trim(), updatedAt: ts } : item
        ),
      }
    }

    case 'UPDATE_NOTE_CONTENT': {
      const ts = Date.now()
      return {
        ...state,
        tree: mapTree(state.tree, (item) =>
          item.id === action.id && item.type === 'note'
            ? { ...item, content: action.content, updatedAt: ts }
            : item
        ),
      }
    }

    case 'TOGGLE_FOLDER':
      return {
        ...state,
        tree: mapTree(state.tree, (item) =>
          item.id === action.id && item.type === 'folder'
            ? { ...item, expanded: !item.expanded }
            : item
        ),
      }

    case 'SET_ACTIVE': {
      const tabs = state.openTabs.includes(action.id)
        ? state.openTabs
        : [...state.openTabs, action.id]
      return { ...state, activeId: action.id, openTabs: tabs }
    }

    case 'SET_CONTEXT_MENU':
      return { ...state, contextMenu: action.menu }

    case 'START_RENAME':
      return { ...state, renamingId: action.id, renameValue: action.name, contextMenu: null }

    case 'SET_RENAME_VALUE':
      return { ...state, renameValue: action.value }

    case 'CONFIRM_RENAME': {
      if (!state.renamingId || !state.renameValue.trim()) {
        return { ...state, renamingId: null }
      }
      const ts = Date.now()
      const siblings = findSiblings(state.tree, state.renamingId)
      const safeName = deduplicateName(state.renameValue.trim(), siblings, state.renamingId)
      return {
        ...state,
        tree: mapTree(state.tree, (item) =>
          item.id === state.renamingId ? { ...item, name: safeName, updatedAt: ts } : item
        ),
        renamingId: null,
      }
    }

    case 'CANCEL_RENAME':
      return { ...state, renamingId: null }

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query }

    case 'SET_THEME':
      return { ...state, theme: action.theme }

    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'light' ? 'dark' : 'light' }

    case 'SET_SIDEBAR_WIDTH':
      return { ...state, sidebarWidth: action.width }

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarVisible: !state.sidebarVisible }

    case 'TOGGLE_ZEN_MODE':
      return { ...state, zenMode: !state.zenMode }

    case 'SET_SORT':
      return { ...state, sortBy: action.sortBy, sortDirection: action.direction }

    case 'MOVE_ITEM':
      return { ...state, tree: moveItem(state.tree, action.itemId, action.targetId, action.position) }

    case 'ADD_TAG': {
      const ts = Date.now()
      return {
        ...state,
        tree: mapTree(state.tree, (item) => {
          if (item.id === action.noteId) {
            const tags = item.tags || []
            if (tags.includes(action.tag)) return item
            return { ...item, tags: [...tags, action.tag], updatedAt: ts }
          }
          return item
        }),
      }
    }

    case 'REMOVE_TAG': {
      const ts = Date.now()
      return {
        ...state,
        tree: mapTree(state.tree, (item) => {
          if (item.id === action.noteId) {
            return { ...item, tags: (item.tags || []).filter((t) => t !== action.tag), updatedAt: ts }
          }
          return item
        }),
      }
    }

    case 'SET_TAG_FILTER': {
      if (action.tag === null) return { ...state, tagFilter: [] }
      const current = state.tagFilter
      const has = current.includes(action.tag)
      return { ...state, tagFilter: has ? current.filter(t => t !== action.tag) : [...current, action.tag] }
    }

    case 'TOGGLE_PIN':
      return {
        ...state,
        tree: mapTree(state.tree, (item) =>
          item.id === action.id ? { ...item, pinned: !item.pinned } : item
        ),
        contextMenu: null,
      }

    case 'SET_TAG_FILTER_MODE':
      return { ...state, tagFilterMode: action.mode }

    case 'CLOSE_TAB': {
      const tabs = state.openTabs.filter(t => t !== action.id)
      let newActive = state.activeId
      if (state.activeId === action.id) {
        const idx = state.openTabs.indexOf(action.id)
        newActive = tabs[Math.min(idx, tabs.length - 1)] || ''
      }
      return { ...state, openTabs: tabs, activeId: newActive }
    }

    case 'IMPORT_ITEMS':
      return { ...state, tree: [...state.tree, ...action.items] }

    case 'LOAD_STATE':
      return { ...state, ...action.state }

    case 'SET_SAVE_STATUS':
      return {
        ...state,
        saveStatus: action.status,
        ...(action.status === 'saved' ? { lastSavedAt: Date.now() } : {}),
      }

    case 'SET_VAULT_LOADING':
      return { ...state, vaultLoading: action.loading }

    case 'SET_SHOW_MIGRATION':
      return { ...state, showMigration: action.show }

    default:
      return state
  }
}

// ── Helpers ──

function findItemInTree(items: TreeItem[], id: string): TreeItem | null {
  for (const item of items) {
    if (item.id === id) return item
    if (item.children) {
      const found = findItemInTree(item.children, id)
      if (found) return found
    }
  }
  return null
}

function findSiblings(items: TreeItem[], id: string): TreeItem[] {
  for (const item of items) {
    if (item.id === id) return items
    if (item.children) {
      const found = findSiblings(item.children, id)
      if (found.length > 0) return found
    }
  }
  return []
}

function deduplicateName(name: string, siblings: TreeItem[], selfId: string): string {
  const siblingNames = new Set(siblings.filter(s => s.id !== selfId).map(s => s.name))
  if (!siblingNames.has(name)) return name
  let n = 2
  while (siblingNames.has(`${name} (${n})`)) n++
  return `${name} (${n})`
}

function markDeleted(item: TreeItem): TreeItem {
  const ts = Date.now()
  return {
    ...item,
    deleted: true,
    deletedAt: ts,
    children: item.children ? item.children.map(markDeleted) : item.children,
  }
}

function unmarkDeleted(item: TreeItem): TreeItem {
  const { deleted, deletedAt, ...rest } = item
  return {
    ...rest,
    children: item.children ? item.children.map(unmarkDeleted) : item.children,
  }
}

// ── Context ──

const NotebookContext = createContext<NotebookState | null>(null)
const NotebookDispatchContext = createContext<Dispatch<NotebookAction> | null>(null)

export function useNotebook() {
  const ctx = useContext(NotebookContext)
  if (!ctx) throw new Error('useNotebook must be used within NotebookProvider')
  return ctx
}

export function useNotebookDispatch() {
  const ctx = useContext(NotebookDispatchContext)
  if (!ctx) throw new Error('useNotebookDispatch must be used within NotebookProvider')
  return ctx
}

// ── Provider ──

const defaultState: NotebookState = {
  tree: defaultTree,
  trash: [],
  activeId: 'welcome',
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
  openTabs: ['welcome'],
  vaultLoading: true,
  showMigration: false,
  lastSavedAt: null,
}

function applyVaultData(data: Partial<NotebookState>): Partial<NotebookState> {
  const obj = data as Record<string, unknown>
  const result: Record<string, unknown> = {}
  if (obj.tree) result.tree = obj.tree
  if (obj.trash) result.trash = obj.trash
  if (obj.activeId) result.activeId = obj.activeId
  if (obj.theme) result.theme = obj.theme
  if (obj.sidebarWidth) result.sidebarWidth = obj.sidebarWidth
  if (obj.sortBy) result.sortBy = obj.sortBy
  if (obj.sortDirection) result.sortDirection = obj.sortDirection
  if (Array.isArray(obj.openTabs)) result.openTabs = obj.openTabs
  if (Array.isArray(obj.tagFilter)) result.tagFilter = obj.tagFilter
  if (obj.tagFilterMode === 'and' || obj.tagFilterMode === 'or') result.tagFilterMode = obj.tagFilterMode
  return result as Partial<NotebookState>
}

export function NotebookProvider({
  children,
  vaultFolder,
  passphrase,
}: {
  children: ReactNode
  vaultFolder: string
  passphrase: string
}) {
  const [state, dispatch] = useReducer(reducer, defaultState)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydratedRef = useRef(false)
  const folderRef = useRef(vaultFolder)
  folderRef.current = vaultFolder
  const passphraseRef = useRef(passphrase)
  passphraseRef.current = passphrase

  // Hydrate from encrypted vault file
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true

    async function hydrate() {
      try {
        const raw = await readVaultFile(folderRef.current)
        if (raw) {
          let jsonStr: string
          if (isEncryptedVault(raw)) {
            jsonStr = await decryptVault(raw, passphraseRef.current)
          } else {
            jsonStr = raw
          }
          const data = JSON.parse(jsonStr)
          const validation = validateVaultData(data)
          if (!validation.valid) {
            console.warn('Vault data validation issue:', validation.error)
          }
          if (data.tree) data.tree = backfillTimestamps(data.tree)
          if (data.trash) data.trash = backfillTimestamps(data.trash)
          dispatch({ type: 'LOAD_STATE', state: applyVaultData(data) })
        }
      } catch (err) {
        console.error('Vault load error:', err)
        notify('Vault Load Error', 'Your vault file could not be read. It may be corrupted or the passphrase may be wrong. Starting with an empty vault.')
      }
      dispatch({ type: 'SET_VAULT_LOADING', loading: false })
    }

    hydrate()
  }, [])

  // Track unsaved changes for beforeunload warning
  const dirtyRef = useRef(false)

  // Persist with debounce — encrypt and write to vault file
  useEffect(() => {
    if (!hydratedRef.current || state.vaultLoading) return
    dirtyRef.current = true
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      dispatch({ type: 'SET_SAVE_STATUS', status: 'saving' })
      try {
        const fields = getVaultFields(state)
        const json = JSON.stringify(fields, null, 2)
        const encrypted = await encryptVault(json, passphraseRef.current)
        await writeVaultFile(folderRef.current, encrypted)
        dirtyRef.current = false
        dispatch({ type: 'SET_SAVE_STATUS', status: 'saved' })
      } catch {
        dispatch({ type: 'SET_SAVE_STATUS', status: 'error' })
        notify('Save Failed', 'MDNotebook could not save your vault. Please check disk space and permissions.')
      }
    }, 500)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [state.tree, state.trash, state.theme, state.sidebarWidth, state.sortBy, state.sortDirection, state.vaultLoading])

  // Flush pending saves on quit (Tauri emits flush-save before exit)
  useEffect(() => {
    let unlisten: (() => void) | null = null
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('flush-save', () => {
        if (dirtyRef.current && hydratedRef.current && !state.vaultLoading) {
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
          const fields = getVaultFields(state)
          const json = JSON.stringify(fields, null, 2)
          encryptVault(json, passphraseRef.current)
            .then(encrypted => writeVaultFile(folderRef.current, encrypted))
            .then(() => { dirtyRef.current = false })
            .catch(() => {})
        }
      }).then(fn => { unlisten = fn })
    }).catch(() => {})
    return () => { unlisten?.() }
  }, [state])

  // Warn before closing if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // Auto-clear save status after 3 seconds
  useEffect(() => {
    if (state.saveStatus === 'saved' || state.saveStatus === 'error') {
      const timer = setTimeout(() => {
        dispatch({ type: 'SET_SAVE_STATUS', status: 'idle' })
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [state.saveStatus])

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme)
  }, [state.theme])

  return (
    <NotebookContext.Provider value={state}>
      <NotebookDispatchContext.Provider value={dispatch}>
        {children}
      </NotebookDispatchContext.Provider>
    </NotebookContext.Provider>
  )
}
