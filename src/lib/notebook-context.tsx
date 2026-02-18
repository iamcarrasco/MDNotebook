'use client'

import { createContext, useContext, useReducer, useEffect, useRef, useMemo, type ReactNode, type Dispatch } from 'react'
import { TreeItem, ContextMenuState, SortBy, SortDirection, Theme } from './types'
import type { NoteTemplate } from './templates'
import {
  findNote, findItem, mapTree, addToTree, removeFromTree, collectNoteIds,
  genId, backfillTimestamps, moveItem, flattenNotes,
} from './tree-utils'
import { readVaultFile, writeVaultFile } from './local-vault'
import { encryptVault, decryptVault, isEncryptedVault } from './crypto'
import { notify } from './notifications'
import { validateVaultData } from './validate'
import { revokeAllCachedUrls, type AssetMeta } from './asset-manager'

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
  selectedFolderId: string | null
  vaultLoading: boolean
  lastSavedAt: number | null
  autosaveDelay: number
  customTemplates: NoteTemplate[]
  noteVersions: Record<string, Array<{ ts: number; content: string }>>
  treeContentVersion: number
  assets: Record<string, AssetMeta>
}

// ── Actions (grouped by domain) ──

export type TreeAction =
  | { type: 'SET_TREE'; tree: TreeItem[] }
  | { type: 'ADD_ITEM'; parentId: string | null; itemType: 'note' | 'folder' }
  | { type: 'DELETE_ITEM'; id: string }
  | { type: 'RENAME_ITEM'; id: string; name: string }
  | { type: 'UPDATE_NOTE_CONTENT'; id: string; content: string }
  | { type: 'TOGGLE_FOLDER'; id: string }
  | { type: 'MOVE_ITEM'; itemId: string; targetId: string; position: 'before' | 'after' | 'inside' }
  | { type: 'MOVE_TO_ROOT'; id: string }
  | { type: 'TOGGLE_PIN'; id: string }
  | { type: 'ADD_TAG'; noteId: string; tag: string }
  | { type: 'REMOVE_TAG'; noteId: string; tag: string }
  | { type: 'DUPLICATE_NOTE'; id: string }
  | { type: 'IMPORT_ITEMS'; items: TreeItem[] }

export type TrashAction =
  | { type: 'MOVE_TO_TRASH'; id: string }
  | { type: 'RESTORE_FROM_TRASH'; id: string }
  | { type: 'DELETE_PERMANENTLY'; id: string }
  | { type: 'EMPTY_TRASH' }

export type UIAction =
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
  | { type: 'SET_TAG_FILTER'; tag: string | null }
  | { type: 'SET_TAG_FILTER_MODE'; mode: 'and' | 'or' }
  | { type: 'SELECT_FOLDER'; id: string }

export type TabAction =
  | { type: 'CLOSE_TAB'; id: string }
  | { type: 'REORDER_TABS'; fromIndex: number; toIndex: number }

export type VaultAction =
  | { type: 'LOAD_STATE'; state: Partial<NotebookState> }
  | { type: 'SET_SAVE_STATUS'; status: 'idle' | 'saving' | 'saved' | 'error' }
  | { type: 'SET_VAULT_LOADING'; loading: boolean }
  | { type: 'SET_AUTOSAVE_DELAY'; delay: number }
  | { type: 'ADD_CUSTOM_TEMPLATE'; template: NoteTemplate }
  | { type: 'REMOVE_CUSTOM_TEMPLATE'; name: string }
  | { type: 'SAVE_SNAPSHOT'; noteId: string }
  | { type: 'RESTORE_VERSION'; noteId: string; ts: number }
  | { type: 'ADD_ASSET'; meta: AssetMeta }
  | { type: 'REMOVE_ASSET'; assetId: string }

export type NotebookAction = TreeAction | TrashAction | UIAction | TabAction | VaultAction

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
    autosaveDelay: state.autosaveDelay,
    customTemplates: state.customTemplates,
    noteVersions: state.noteVersions,
    assets: state.assets,
  }
}

// ── Reducer ──

export function reducer(state: NotebookState, action: NotebookAction): NotebookState {
  const newState = reducerInner(state, action)
  // Bump content version when tree structure/content changed (not just expanded toggle)
  if (newState.tree !== state.tree && action.type !== 'TOGGLE_FOLDER') {
    return { ...newState, treeContentVersion: state.treeContentVersion + 1 }
  }
  return newState
}

function reducerInner(state: NotebookState, action: NotebookAction): NotebookState {
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

    case 'DUPLICATE_NOTE': {
      const source = findNote(state.tree, action.id)
      if (!source) return state
      const ts = Date.now()
      const dup: TreeItem = {
        id: genId(),
        name: source.name + ' (copy)',
        type: 'note',
        content: source.content ?? '',
        tags: source.tags ? [...source.tags] : undefined,
        createdAt: ts,
        updatedAt: ts,
      }
      // Insert after the original in its parent
      function insertAfter(items: TreeItem[], afterId: string, newItem: TreeItem): TreeItem[] {
        const result: TreeItem[] = []
        for (const item of items) {
          result.push(item)
          if (item.id === afterId) result.push(newItem)
          if (item.children) {
            const last = result[result.length - 1]
            if (last.id === item.id) {
              result[result.length - 1] = { ...item, children: insertAfter(item.children, afterId, newItem) }
            }
          }
        }
        return result
      }
      return {
        ...state,
        tree: insertAfter(state.tree, action.id, dup),
        activeId: dup.id,
        openTabs: [...state.openTabs, dup.id],
        contextMenu: null,
      }
    }

    case 'DELETE_ITEM': {
      const updated = removeFromTree(state.tree, action.id)
      const newTabs = state.openTabs.filter(t => t !== action.id)
      let newActiveId = state.activeId
      if (action.id === state.activeId || !findNote(updated, state.activeId)) {
        // Pick adjacent tab, or fall back to first remaining tab, or first note in tree
        const idx = state.openTabs.indexOf(action.id)
        if (idx >= 0 && newTabs.length > 0) {
          newActiveId = newTabs[Math.min(idx, newTabs.length - 1)]
        } else if (newTabs.length > 0) {
          newActiveId = newTabs[0]
        } else {
          const notes = flattenNotes(updated)
          newActiveId = notes.length > 0 ? notes[0].id : ''
        }
      }
      return { ...state, tree: updated, activeId: newActiveId, openTabs: newTabs, contextMenu: null }
    }

    case 'MOVE_TO_TRASH': {
      const item = findItemInTree(state.tree, action.id)
      if (!item) return state
      const trashItem = markDeleted(item)
      const updated = removeFromTree(state.tree, action.id)
      const newTabs = state.openTabs.filter(t => t !== action.id)
      let newActiveId = state.activeId
      if (action.id === state.activeId || !findNote(updated, state.activeId)) {
        // Pick adjacent tab, or fall back to first remaining tab, or first note in tree
        const idx = state.openTabs.indexOf(action.id)
        if (idx >= 0 && newTabs.length > 0) {
          newActiveId = newTabs[Math.min(idx, newTabs.length - 1)]
        } else if (newTabs.length > 0) {
          newActiveId = newTabs[0]
        } else {
          const notes = flattenNotes(updated)
          newActiveId = notes.length > 0 ? notes[0].id : ''
        }
      }
      return {
        ...state,
        tree: updated,
        trash: [...state.trash, trashItem],
        activeId: newActiveId,
        openTabs: newTabs,
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
      const existing = findNote(state.tree, action.id)
      if (existing && existing.content === action.content) return state
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
      // Auto-snapshot the note being navigated away from
      let noteVersions = state.noteVersions
      if (state.activeId && state.activeId !== action.id) {
        const currentNote = findNote(state.tree, state.activeId)
        if (currentNote?.content) {
          const versions = noteVersions[state.activeId] || []
          const lastVersion = versions[versions.length - 1]
          if (!lastVersion || lastVersion.content !== currentNote.content) {
            const newVersions = [...versions, { ts: Date.now(), content: currentNote.content }].slice(-10)
            noteVersions = { ...noteVersions, [state.activeId]: newVersions }
          }
        }
      }
      return { ...state, activeId: action.id, openTabs: tabs, selectedFolderId: null, noteVersions }
    }

    case 'SELECT_FOLDER':
      return { ...state, selectedFolderId: action.id }

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

    case 'MOVE_TO_ROOT': {
      const item = findItem(state.tree, action.id)
      if (!item) return state
      const cleaned = removeFromTree(state.tree, action.id)
      return { ...state, tree: [...cleaned, item] }
    }

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

    case 'LOAD_STATE': {
      const merged = { ...state, ...action.state }
      // Validate activeId still exists in the new tree
      const loadedTree = merged.tree || []
      const loadedNoteIds = collectNoteIds(loadedTree)
      const noteIdSet = new Set(loadedNoteIds)
      if (merged.activeId && !noteIdSet.has(merged.activeId)) {
        merged.activeId = loadedNoteIds.length > 0 ? loadedNoteIds[0] : ''
      }
      // Filter out zombie tabs
      merged.openTabs = merged.openTabs.filter((id: string) => noteIdSet.has(id))
      if (merged.openTabs.length === 0 && merged.activeId) {
        merged.openTabs = [merged.activeId]
      }
      return merged
    }

    case 'SET_SAVE_STATUS':
      return {
        ...state,
        saveStatus: action.status,
        ...(action.status === 'saved' ? { lastSavedAt: Date.now() } : {}),
      }

    case 'SET_VAULT_LOADING':
      return { ...state, vaultLoading: action.loading }

    case 'REORDER_TABS': {
      const tabs = [...state.openTabs]
      const [moved] = tabs.splice(action.fromIndex, 1)
      tabs.splice(action.toIndex, 0, moved)
      return { ...state, openTabs: tabs }
    }

    case 'ADD_CUSTOM_TEMPLATE':
      return { ...state, customTemplates: [...state.customTemplates, action.template] }

    case 'REMOVE_CUSTOM_TEMPLATE':
      return { ...state, customTemplates: state.customTemplates.filter(t => t.name !== action.name) }

    case 'SET_AUTOSAVE_DELAY':
      return { ...state, autosaveDelay: action.delay }

    case 'SAVE_SNAPSHOT': {
      const snapNote = findNote(state.tree, action.noteId)
      if (!snapNote?.content) return state
      const snapVersions = state.noteVersions[action.noteId] || []
      const lastSnap = snapVersions[snapVersions.length - 1]
      if (lastSnap && lastSnap.content === snapNote.content) return state
      const updatedVersions = [...snapVersions, { ts: Date.now(), content: snapNote.content }].slice(-10)
      return { ...state, noteVersions: { ...state.noteVersions, [action.noteId]: updatedVersions } }
    }

    case 'RESTORE_VERSION': {
      const rvVersions = state.noteVersions[action.noteId] || []
      const rvVersion = rvVersions.find(v => v.ts === action.ts)
      if (!rvVersion) return state
      const rvTs = Date.now()
      return {
        ...state,
        tree: mapTree(state.tree, (item) =>
          item.id === action.noteId && item.type === 'note'
            ? { ...item, content: rvVersion.content, updatedAt: rvTs }
            : item
        ),
      }
    }

    case 'ADD_ASSET':
      return { ...state, assets: { ...state.assets, [action.meta.id]: action.meta } }

    case 'REMOVE_ASSET': {
      const { [action.assetId]: _, ...rest } = state.assets
      return { ...state, assets: rest }
    }

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
  const rest: TreeItem = { ...item }
  delete rest.deleted
  delete rest.deletedAt
  return {
    ...rest,
    children: item.children ? item.children.map(unmarkDeleted) : item.children,
  }
}

// ── Context ──

const NotebookContext = createContext<NotebookState | null>(null)
const NotebookDispatchContext = createContext<Dispatch<NotebookAction> | null>(null)
const VaultCredentialsContext = createContext<{ vaultFolder: string; passphrase: string } | null>(null)

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

export function useVaultCredentials() {
  const ctx = useContext(VaultCredentialsContext)
  if (!ctx) throw new Error('useVaultCredentials must be used within NotebookProvider')
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
  sortBy: 'manual',
  sortDirection: 'asc',
  renamingId: null,
  renameValue: '',
  contextMenu: null,
  tagFilter: [],
  tagFilterMode: 'or',
  openTabs: ['welcome'],
  selectedFolderId: null,
  vaultLoading: true,
  lastSavedAt: null,
  autosaveDelay: 500,
  customTemplates: [],
  noteVersions: {},
  treeContentVersion: 0,
  assets: {},
}

function sanitizeCustomTemplates(value: unknown): NoteTemplate[] | null {
  if (!Array.isArray(value)) return null
  const templates: NoteTemplate[] = []

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') return null
    const obj = entry as Record<string, unknown>
    if (typeof obj.name !== 'string' || obj.name.trim().length === 0) return null
    if (typeof obj.description !== 'string') return null
    if (typeof obj.content !== 'string') return null

    let tags: string[] | undefined
    if (obj.tags !== undefined) {
      if (!Array.isArray(obj.tags)) return null
      if ((obj.tags as unknown[]).some((tag) => typeof tag !== 'string')) return null
      tags = obj.tags as string[]
    }

    templates.push({
      name: obj.name,
      description: obj.description,
      content: obj.content,
      ...(tags ? { tags } : {}),
    })
  }

  return templates
}

function sanitizeNoteVersions(
  value: unknown
): Record<string, Array<{ ts: number; content: string }>> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const result: Record<string, Array<{ ts: number; content: string }>> = {}
  for (const [noteId, rawVersions] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(rawVersions)) return null

    const safeVersions: Array<{ ts: number; content: string }> = []
    for (const rawVersion of rawVersions) {
      if (!rawVersion || typeof rawVersion !== 'object') return null
      const version = rawVersion as Record<string, unknown>
      if (typeof version.ts !== 'number' || !Number.isFinite(version.ts)) return null
      if (typeof version.content !== 'string') return null
      safeVersions.push({ ts: version.ts, content: version.content })
    }

    result[noteId] = safeVersions.slice(-10)
  }

  return result
}

function applyVaultData(data: Partial<NotebookState>): Partial<NotebookState> {
  const obj = data as Record<string, unknown>
  const result: Record<string, unknown> = {}

  // Use Array.isArray checks so empty arrays [] are accepted (not falsy-skipped)
  if (Array.isArray(obj.tree)) result.tree = obj.tree
  if (Array.isArray(obj.trash)) result.trash = obj.trash
  if (obj.theme) result.theme = obj.theme
  if (obj.sidebarWidth) result.sidebarWidth = obj.sidebarWidth
  if (obj.sortBy) result.sortBy = obj.sortBy
  if (obj.sortDirection) result.sortDirection = obj.sortDirection
  if (Array.isArray(obj.tagFilter)) result.tagFilter = obj.tagFilter
  if (obj.tagFilterMode === 'and' || obj.tagFilterMode === 'or') result.tagFilterMode = obj.tagFilterMode

  // Validate activeId and openTabs against the resolved tree
  const tree = (result.tree || []) as TreeItem[]
  const validNoteIds = new Set(collectNoteIds(tree))

  if (typeof obj.activeId === 'string' && validNoteIds.has(obj.activeId)) {
    result.activeId = obj.activeId
  } else if (validNoteIds.size > 0) {
    // Fall back to the first available note
    result.activeId = validNoteIds.values().next().value
  } else {
    result.activeId = ''
  }

  if (Array.isArray(obj.openTabs)) {
    // Only keep tabs that reference notes still in the tree
    const validTabs = (obj.openTabs as string[]).filter(id => validNoteIds.has(id))
    result.openTabs = validTabs.length > 0 ? validTabs : (result.activeId ? [result.activeId as string] : [])
  }

  if (typeof obj.autosaveDelay === 'number' && obj.autosaveDelay >= 200 && obj.autosaveDelay <= 5000) {
    result.autosaveDelay = obj.autosaveDelay
  }

  const templates = sanitizeCustomTemplates(obj.customTemplates)
  if (templates) result.customTemplates = templates

  const noteVersions = sanitizeNoteVersions(obj.noteVersions)
  if (noteVersions) result.noteVersions = noteVersions

  // Assets manifest
  if (obj.assets && typeof obj.assets === 'object' && !Array.isArray(obj.assets)) {
    const assets: Record<string, AssetMeta> = {}
    for (const [id, raw] of Object.entries(obj.assets as Record<string, unknown>)) {
      if (raw && typeof raw === 'object') {
        const a = raw as Record<string, unknown>
        if (typeof a.id === 'string' && typeof a.originalName === 'string' &&
            typeof a.mimeType === 'string' && typeof a.size === 'number' &&
            typeof a.createdAt === 'number') {
          assets[id] = { id: a.id as string, originalName: a.originalName as string,
            mimeType: a.mimeType as string, size: a.size as number, createdAt: a.createdAt as number }
        }
      }
    }
    result.assets = assets
  }

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
  const stateRef = useRef(state)
  stateRef.current = state
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
  }, [dispatch])

  // Track unsaved changes for beforeunload warning
  const dirtyRef = useRef(false)

  // Keep a ref to the latest state so save always writes current values
  const latestStateRef = useRef(state)
  latestStateRef.current = state

  // Mark dirty when non-save-triggering state changes (so flush-on-quit still saves them)
  // Includes state.tree so folder expand/collapse gets persisted on next real save or quit
  useEffect(() => {
    if (hydratedRef.current && !state.vaultLoading) dirtyRef.current = true
  }, [state.tree, state.noteVersions, state.activeId, state.openTabs, state.theme, state.sidebarWidth, state.vaultLoading])

  // Persist with debounce — only trigger on content/data changes, not UI navigation
  useEffect(() => {
    if (!hydratedRef.current || state.vaultLoading) return
    dirtyRef.current = true
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      const s = latestStateRef.current
      dispatch({ type: 'SET_SAVE_STATUS', status: 'saving' })
      try {
        const json = JSON.stringify(getVaultFields(s), null, 2)
        const encrypted = await encryptVault(json, passphraseRef.current)
        await writeVaultFile(folderRef.current, encrypted)
        dirtyRef.current = false
        dispatch({ type: 'SET_SAVE_STATUS', status: 'saved' })
      } catch {
        dispatch({ type: 'SET_SAVE_STATUS', status: 'error' })
        notify('Save Failed', 'MDNotebook could not save your vault. Please check disk space and permissions.')
      }
    }, state.autosaveDelay)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
    // Only trigger save on actual content/data changes.
    // Excluded from deps (saved with next real change or on quit):
    //   activeId, openTabs, theme, sidebarWidth — UI navigation
    //   noteVersions — auto-snapshots created during note switch
    //   tree (directly) — folder expand/collapse marked dirty but doesn't trigger save
  }, [state.treeContentVersion, state.trash, state.vaultLoading, state.autosaveDelay, state.customTemplates, state.sortBy, state.sortDirection, state.assets])

  // Flush pending saves on quit (Tauri emits flush-save before exit)
  useEffect(() => {
    let unlisten: (() => void) | null = null
    let disposed = false

    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('flush-save', () => {
        const latestState = stateRef.current
        if (dirtyRef.current && hydratedRef.current && !latestState.vaultLoading) {
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
          const fields = getVaultFields(latestState)
          const json = JSON.stringify(fields, null, 2)
          encryptVault(json, passphraseRef.current)
            .then(encrypted => writeVaultFile(folderRef.current, encrypted))
            .then(() => { dirtyRef.current = false })
            .catch((err) => { console.error('Flush-save failed:', err) })
        }
      }).then(fn => {
        if (disposed) {
          fn()
        } else {
          unlisten = fn
        }
      })
    }).catch(() => {})

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

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

  // Apply theme to document and window title bar
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme)
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('set_window_theme', { dark: state.theme === 'dark' }).catch(() => {})
    })
  }, [state.theme])

  // Revoke cached blob URLs on unmount
  useEffect(() => {
    return () => revokeAllCachedUrls()
  }, [])

  const vaultCredentials = useMemo(() => ({ vaultFolder, passphrase }), [vaultFolder, passphrase])

  return (
    <VaultCredentialsContext.Provider value={vaultCredentials}>
      <NotebookContext.Provider value={state}>
        <NotebookDispatchContext.Provider value={dispatch}>
          {children}
        </NotebookDispatchContext.Provider>
      </NotebookContext.Provider>
    </VaultCredentialsContext.Provider>
  )
}
