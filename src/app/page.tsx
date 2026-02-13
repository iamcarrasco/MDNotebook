'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { NotebookProvider, useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import {
  findNote, findItem, findItemName, hasChildren, filterTree, sortTree, flattenNotes, findNoteByName, genId, isDescendant, collectNoteIds, buildSearchIndex,
} from '@/lib/tree-utils'
import { exportNoteAsMarkdown, exportAllAsJSON, importMarkdownFiles, parseJSONBackup } from '@/lib/export-import'
import SidebarItem from '@/components/SidebarItem'
import SearchBar from '@/components/SearchBar'
import StatusBar from '@/components/StatusBar'
import Breadcrumbs from '@/components/Breadcrumbs'
import ResizeHandle from '@/components/ResizeHandle'
import TagInput from '@/components/TagInput'
import VaultSetup from '@/components/VaultSetup'
import PassphraseScreen from '@/components/PassphraseScreen'
import SettingsPanel from '@/components/SettingsPanel'
import TabBar from '@/components/TabBar'
import TemplateModal from '@/components/TemplateModal'
import HelpPanel from '@/components/HelpPanel'
import EditorErrorBoundary from '@/components/EditorErrorBoundary'
import AppErrorBoundary from '@/components/AppErrorBoundary'
import ConfirmModal from '@/components/ConfirmModal'
import type { NoteTemplate } from '@/lib/templates'
import {
  MoonIcon, SunIcon, ExportIcon, ImportIcon, SortIcon,
  TrashIcon, RestoreIcon, CloseIcon, ZenIcon, GearIcon, PinIcon, CalendarIcon,
  TemplateIcon, PDFIcon, HelpIcon,
} from '@/components/Icons'
import { checkVaultStatus, vaultFileExists, readVaultFile, writeVaultFile, type VaultStatus } from '@/lib/local-vault'
import { isEncryptedVault, verifyPassphrase, encryptVault } from '@/lib/crypto'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { register } from '@tauri-apps/plugin-global-shortcut'
import type { TreeItem } from '@/lib/types'

const Editor = dynamic(() => import('@/components/Editor'), { ssr: false })

function NotebookApp({ vaultName, onOpenSettings, onOpenHelp }: { vaultName: string; onOpenSettings?: () => void; onOpenHelp?: () => void }) {
  const state = useNotebook()
  const dispatch = useNotebookDispatch()
  const importRef = useRef<HTMLInputElement>(null)
  const importJsonRef = useRef<HTMLInputElement>(null)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [wikiLinkPrompt, setWikiLinkPrompt] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{
    title: string
    message: string
    confirmLabel: string
    cancelLabel?: string
    onConfirm: () => void
    onCancelAction?: () => void
    showCancel?: boolean
    danger?: boolean
  } | null>(null)

  useKeyboardShortcuts()

  // Wiki-link click handler
  useEffect(() => {
    const handler = (e: Event) => {
      const { name } = (e as CustomEvent).detail
      const note = findNoteByName(state.tree, name)
      if (note) {
        dispatch({ type: 'SET_ACTIVE', id: note.id })
      } else {
        setWikiLinkPrompt(name)
      }
    }
    window.addEventListener('wiki-link-click', handler)
    return () => window.removeEventListener('wiki-link-click', handler)
  }, [state.tree, dispatch])

  const handleCreateWikiLink = useCallback(() => {
    if (!wikiLinkPrompt) return
    const name = wikiLinkPrompt
    const ts = Date.now()
    const newItem = {
      id: genId(),
      name,
      type: 'note' as const,
      content: `# ${name}\n\n`,
      createdAt: ts,
      updatedAt: ts,
    }
    dispatch({ type: 'IMPORT_ITEMS', items: [newItem] })
    dispatch({ type: 'SET_ACTIVE', id: newItem.id })
    setWikiLinkPrompt(null)
  }, [wikiLinkPrompt, dispatch])

  // Close context menu on click/escape
  useEffect(() => {
    const handleClick = () => dispatch({ type: 'SET_CONTEXT_MENU', menu: null })
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'SET_CONTEXT_MENU', menu: null })
    }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [dispatch])

  // Auto-close sidebar on mobile when a note is selected
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768 && state.sidebarVisible && state.activeId) {
      dispatch({ type: 'TOGGLE_SIDEBAR' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeId])

  const {
    tree, trash, activeId, saveStatus, searchQuery,
    theme, sidebarWidth, sidebarVisible, zenMode,
    sortBy, sortDirection, contextMenu,
    renamingId, renameValue, tagFilter, tagFilterMode, openTabs,
    lastSavedAt,
  } = state

  const activeNote = useMemo(() => findNote(tree, activeId), [tree, activeId])

  // Format last saved time as HH:MM
  const savedTimeStr = useMemo(() => {
    if (!lastSavedAt) return ''
    const d = new Date(lastSavedAt)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [lastSavedAt])

  // Auto-focus editor when rename finishes (after creating a note)
  const prevRenamingRef = useRef(renamingId)
  useEffect(() => {
    if (prevRenamingRef.current && !renamingId) {
      // Rename just finished — focus the editor contenteditable
      requestAnimationFrame(() => {
        const editable = document.querySelector('.mdxeditor-root-contenteditable [contenteditable]') as HTMLElement
        editable?.focus()
      })
    }
    prevRenamingRef.current = renamingId
  }, [renamingId])

  // Pre-lowercased search index
  const searchIndex = useMemo(() => buildSearchIndex(tree), [tree])

  // Filtered & sorted tree for display
  const displayTree = useMemo(() => {
    let result = tree
    if (searchQuery) result = filterTree(result, searchQuery, searchIndex)
    if (tagFilter.length > 0) {
      result = filterTreeByTag(result, tagFilter, tagFilterMode)
    }
    result = sortTree(result, sortBy, sortDirection)
    return result
  }, [tree, searchQuery, searchIndex, tagFilter, tagFilterMode, sortBy, sortDirection])

  // Collect all item IDs for DnD sortable context
  const sortableIds = useMemo(() => {
    const collectIds = (items: TreeItem[]): string[] => {
      const ids: string[] = []
      for (const item of items) {
        ids.push(item.id)
        if (item.children) ids.push(...collectIds(item.children))
      }
      return ids
    }
    return collectIds(displayTree)
  }, [displayTree])

  // Drag & drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (isDescendant(tree, activeId, overId)) return

    const overItem = findItem(tree, overId)
    if (overItem?.type === 'folder') {
      dispatch({ type: 'MOVE_ITEM', itemId: activeId, targetId: overId, position: 'inside' })
    } else {
      dispatch({ type: 'MOVE_ITEM', itemId: activeId, targetId: overId, position: 'after' })
    }
  }, [tree, dispatch])

  const handleDelete = useCallback((id: string) => {
    if (hasChildren(tree, id)) {
      setDialog({
        title: 'Delete Folder',
        message: 'This folder has items inside it. Delete anyway?',
        confirmLabel: 'Delete',
        onConfirm: () => { dispatch({ type: 'MOVE_TO_TRASH', id }); setDialog(null) },
        danger: true,
      })
      return
    }
    dispatch({ type: 'MOVE_TO_TRASH', id })
  }, [tree, dispatch])

  const handleImportMd = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    try {
      const items = await importMarkdownFiles(files)
      dispatch({ type: 'IMPORT_ITEMS', items })
    } catch (err) {
      setDialog({
        title: 'Import Failed',
        message: err instanceof Error ? err.message : 'Could not read one or more files.',
        confirmLabel: 'OK',
        onConfirm: () => setDialog(null),
        showCancel: false,
      })
    }
    e.target.value = ''
  }, [dispatch])

  const handleImportJson = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    let text: string
    try {
      text = await file.text()
    } catch {
      setDialog({
        title: 'Import Failed',
        message: 'Could not read the backup file. It may be corrupted or inaccessible.',
        confirmLabel: 'OK',
        onConfirm: () => setDialog(null),
        showCancel: false,
      })
      e.target.value = ''
      return
    }
    const data = parseJSONBackup(text)
    if (data) {
      setDialog({
        title: 'Restore Backup',
        message: 'Replace all notes with this backup, or merge the backup into your existing notes?',
        confirmLabel: 'Replace',
        cancelLabel: 'Merge',
        onConfirm: () => {
          dispatch({ type: 'LOAD_STATE', state: { tree: data.tree, trash: data.trash } })
          setDialog(null)
        },
        onCancelAction: () => {
          dispatch({ type: 'IMPORT_ITEMS', items: data.tree })
          setDialog(null)
        },
      })
    } else {
      setDialog({
        title: 'Invalid Backup',
        message: 'This file is not a valid MDNotebook backup.',
        confirmLabel: 'OK',
        onConfirm: () => setDialog(null),
        showCancel: false,
      })
    }
    e.target.value = ''
  }, [dispatch])

  // Sort label
  const sortLabel = sortBy === 'name'
    ? (sortDirection === 'asc' ? 'Name (A-Z)' : 'Name (Z-A)')
    : sortBy === 'modified' ? 'Last Modified' : 'Date Created'

  const cycleSortOptions = useCallback(() => {
    const options: Array<{ sortBy: 'name' | 'modified' | 'created'; direction: 'asc' | 'desc' }> = [
      { sortBy: 'name', direction: 'asc' },
      { sortBy: 'name', direction: 'desc' },
      { sortBy: 'modified', direction: 'desc' },
      { sortBy: 'created', direction: 'desc' },
    ]
    const currentIdx = options.findIndex((o) => o.sortBy === sortBy && o.direction === sortDirection)
    const next = options[(currentIdx + 1) % options.length]
    dispatch({ type: 'SET_SORT', sortBy: next.sortBy, direction: next.direction })
  }, [sortBy, sortDirection, dispatch])

  // Daily Note handler
  const handleDailyNote = useCallback(() => {
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const noteName = `${dateStr} - Daily Note`

    const existing = findNoteByName(tree, noteName)
    if (existing) {
      dispatch({ type: 'SET_ACTIVE', id: existing.id })
      return
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayName = dayNames[today.getDay()]
    const ts = Date.now()
    const newItem: TreeItem = {
      id: genId(),
      name: noteName,
      type: 'note',
      createdAt: ts,
      updatedAt: ts,
      content: `# ${dayName}, ${dateStr}\n\n## Tasks\n\n- [ ] \n\n## Notes\n\n\n`,
      tags: ['daily'],
    }
    dispatch({ type: 'IMPORT_ITEMS', items: [newItem] })
    dispatch({ type: 'SET_ACTIVE', id: newItem.id })
  }, [tree, dispatch])

  // New note from template
  const handleNewNoteFromTemplate = useCallback((template: NoteTemplate) => {
    const ts = Date.now()
    const newItem: TreeItem = {
      id: genId(),
      name: template.name === 'Blank Note' ? 'Untitled Note' : template.name,
      type: 'note',
      content: template.content,
      createdAt: ts,
      updatedAt: ts,
      tags: template.tags,
    }
    dispatch({ type: 'IMPORT_ITEMS', items: [newItem] })
    dispatch({ type: 'SET_ACTIVE', id: newItem.id })
    if (template.name !== 'Blank Note') {
      dispatch({ type: 'START_RENAME', id: newItem.id, name: newItem.name })
    }
    setShowTemplateModal(false)
  }, [dispatch])

  // PDF export
  const handleExportPDF = useCallback(() => {
    window.print()
  }, [])

  // Daily note shortcut listener
  useEffect(() => {
    const handler = () => handleDailyNote()
    window.addEventListener('daily-note-shortcut', handler)
    return () => window.removeEventListener('daily-note-shortcut', handler)
  }, [handleDailyNote])

  // System tray event listeners
  useEffect(() => {
    const unlisten1 = listen('tray-new-note', () => {
      dispatch({ type: 'ADD_ITEM', parentId: null, itemType: 'note' })
    })
    const unlisten2 = listen('tray-daily-note', () => {
      handleDailyNote()
    })
    return () => {
      unlisten1.then(fn => fn()).catch(() => {})
      unlisten2.then(fn => fn()).catch(() => {})
    }
  }, [dispatch, handleDailyNote])

  // File association: handle .md files opened with MDNotebook
  useEffect(() => {
    const unlisten = listen<string>('open-file', async (event) => {
      const filePath = event.payload
      try {
        const content = await invoke<string>('read_markdown_file', { path: filePath })
        const parts = filePath.replace(/\\/g, '/').split('/')
        const fileName = parts[parts.length - 1].replace(/\.(md|markdown)$/i, '')

        const existing = findNoteByName(tree, fileName)
        if (existing) {
          dispatch({ type: 'SET_ACTIVE', id: existing.id })
        } else {
          const ts = Date.now()
          const newItem: TreeItem = {
            id: genId(),
            name: fileName,
            type: 'note',
            content,
            createdAt: ts,
            updatedAt: ts,
          }
          dispatch({ type: 'IMPORT_ITEMS', items: [newItem] })
          dispatch({ type: 'SET_ACTIVE', id: newItem.id })
        }
      } catch (err) {
        console.error('Failed to open file:', err)
        setDialog({
          title: 'Open File Failed',
          message: err instanceof Error ? err.message : 'Could not open the file.',
          confirmLabel: 'OK',
          onConfirm: () => setDialog(null),
          showCancel: false,
        })
      }
    })
    return () => { unlisten.then(fn => fn()).catch(() => {}) }
  }, [tree, dispatch])

  // Show loading while vault is being fetched
  if (state.vaultLoading) {
    return (
      <div className="app-layout">
        <aside className="sidebar skeleton-sidebar">
          <div className="sidebar-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
            MDNotebook
          </div>
          <div className="skeleton-items">
            <div className="skeleton-line" style={{ width: '70%' }} />
            <div className="skeleton-line" style={{ width: '55%' }} />
            <div className="skeleton-line" style={{ width: '80%' }} />
            <div className="skeleton-line" style={{ width: '45%' }} />
            <div className="skeleton-line" style={{ width: '65%' }} />
          </div>
        </aside>
        <main className="editor-area">
          <div className="vault-loading">
            <div className="vault-loading-spinner" />
            Loading your vault...
          </div>
        </main>
      </div>
    )
  }

  // Zen mode
  if (zenMode) {
    return (
      <div className="zen-mode">
        <button
          className="zen-exit-btn"
          onClick={() => dispatch({ type: 'TOGGLE_ZEN_MODE' })}
          title="Exit Zen Mode (Ctrl+Shift+Z)"
        >
          <CloseIcon />
        </button>
        {activeNote ? (
          <div className="zen-editor">
            <EditorErrorBoundary key={activeId}>
              <Editor
                key={activeId}
                markdown={activeNote.content || ''}
                onChange={(md) => dispatch({ type: 'UPDATE_NOTE_CONTENT', id: activeId, content: md })}
                theme={theme}
              />
            </EditorErrorBoundary>
          </div>
        ) : (
          <div className="zen-empty">Select a note first</div>
        )}
      </div>
    )
  }

  return (
    <div className="app-layout">
      <a className="skip-to-content" href="#editor-main">Skip to editor</a>
      {/* Hidden file inputs */}
      <input ref={importRef} type="file" accept=".md,.txt" multiple hidden onChange={handleImportMd} />
      <input ref={importJsonRef} type="file" accept=".json" hidden onChange={handleImportJson} />

      {/* Sidebar */}
      {sidebarVisible && (
        <>
          <div className="sidebar-backdrop" onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })} />
          <aside className="sidebar" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
            <div className="sidebar-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
              MDNotebook
              <div className="sidebar-actions">
                <button
                  className="sidebar-action-btn"
                  title={theme === 'light' ? 'Dark Mode (Ctrl+Shift+D)' : 'Light Mode (Ctrl+Shift+D)'}
                  onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
                >
                  {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                </button>
                <button
                  className="sidebar-action-btn"
                  title="New Note (Ctrl+N)"
                  onClick={() => dispatch({ type: 'ADD_ITEM', parentId: null, itemType: 'note' })}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                    <path d="M3 1h7l4 4v10H3V1z" />
                    <path d="M8 6v5M5.5 8.5h5" />
                  </svg>
                </button>
                <button
                  className="sidebar-action-btn"
                  title="New Folder (Ctrl+Shift+N)"
                  onClick={() => dispatch({ type: 'ADD_ITEM', parentId: null, itemType: 'folder' })}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                    <path d="M2 3h4l2 2h6v8H2V3z" />
                    <path d="M8 7v4M6 9h4" />
                  </svg>
                </button>
                <button
                  className="sidebar-action-btn"
                  title="Daily Note (Ctrl+Shift+T)"
                  onClick={handleDailyNote}
                >
                  <CalendarIcon />
                </button>
                <button
                  className="sidebar-action-btn"
                  title="New from Template"
                  onClick={() => setShowTemplateModal(true)}
                >
                  <TemplateIcon />
                </button>
              </div>
            </div>

            {/* Settings button */}
            {onOpenSettings && (
              <div className="sidebar-user">
                <span className="sidebar-user-name">{vaultName}</span>
                <button
                  className="sidebar-user-btn"
                  onClick={onOpenSettings}
                  title="Settings"
                >
                  <GearIcon />
                </button>
              </div>
            )}

            <SearchBar />

            {/* Sort & filter controls */}
            <div className="sidebar-controls">
              <button className="sidebar-control-btn" onClick={cycleSortOptions} title={`Sort: ${sortLabel}`}>
                <SortIcon />
                <span className="sidebar-control-label">{sortLabel}</span>
              </button>
              {tagFilter.length > 0 && (
                <>
                  {tagFilter.map(tag => (
                    <button
                      key={tag}
                      className="sidebar-control-btn tag-filter-active"
                      onClick={() => dispatch({ type: 'SET_TAG_FILTER', tag })}
                      title={`Remove #${tag} filter`}
                    >
                      #{tag} <CloseIcon />
                    </button>
                  ))}
                  {tagFilter.length > 1 && (
                    <button
                      className="sidebar-control-btn"
                      onClick={() => dispatch({ type: 'SET_TAG_FILTER_MODE', mode: tagFilterMode === 'or' ? 'and' : 'or' })}
                      title={`Mode: ${tagFilterMode.toUpperCase()} — click to toggle`}
                    >
                      {tagFilterMode.toUpperCase()}
                    </button>
                  )}
                  <button
                    className="sidebar-control-btn"
                    onClick={() => dispatch({ type: 'SET_TAG_FILTER', tag: null })}
                    title="Clear all tag filters"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>

            <div className="sidebar-tree">
              <DndContext id="sidebar-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  {displayTree.map((item) => (
                    <SidebarItem
                      key={item.id}
                      item={item}
                      depth={0}
                      searchQuery={searchQuery}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {displayTree.length === 0 && searchQuery && (
                <div className="sidebar-empty">No matching notes</div>
              )}
            </div>

            {/* Import/Export */}
            <div className="sidebar-footer">
              <button className="sidebar-footer-btn" onClick={() => importRef.current?.click()} title="Import Markdown files">
                <ImportIcon /> Import
              </button>
              <button className="sidebar-footer-btn" onClick={() => {
                setDialog({
                  title: 'Export Unencrypted Backup',
                  message: 'This will export all notes as an unencrypted JSON file. Store the backup securely.',
                  confirmLabel: 'Export',
                  onConfirm: () => { exportAllAsJSON(tree, trash); setDialog(null) },
                })
              }} title="Export all as JSON backup (unencrypted)">
                <ExportIcon /> Export
              </button>
              <button className="sidebar-footer-btn" onClick={() => importJsonRef.current?.click()} title="Import JSON backup">
                <ImportIcon /> Restore
              </button>
              {onOpenHelp && (
                <button className="sidebar-footer-btn" onClick={onOpenHelp} title="Help &amp; How to Use">
                  <HelpIcon /> Help
                </button>
              )}
            </div>

            {/* Trash section */}
            {trash.length > 0 && (
              <div className="trash-section">
                <div className="trash-header">
                  <TrashIcon />
                  <span>Trash ({trash.length})</span>
                  <button
                    className="trash-empty-btn"
                    onClick={() => {
                      setDialog({
                        title: 'Empty Trash',
                        message: 'Permanently delete all items in trash? This cannot be undone.',
                        confirmLabel: 'Delete All',
                        onConfirm: () => { dispatch({ type: 'EMPTY_TRASH' }); setDialog(null) },
                        danger: true,
                      })
                    }}
                    title="Empty Trash"
                  >
                    Empty
                  </button>
                </div>
                <div className="trash-items">
                  {trash.map((item) => (
                    <div key={item.id} className="trash-item">
                      <span className="trash-item-name">{item.name}</span>
                      <div className="trash-item-actions">
                        <button
                          className="trash-action-btn"
                          onClick={() => dispatch({ type: 'RESTORE_FROM_TRASH', id: item.id })}
                          title="Restore"
                        >
                          <RestoreIcon />
                        </button>
                        <button
                          className="trash-action-btn danger"
                          onClick={() => dispatch({ type: 'DELETE_PERMANENTLY', id: item.id })}
                          title="Delete Permanently"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
          <ResizeHandle />
        </>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          role="menu"
          aria-label="Context menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.itemType === 'folder' && (
            <>
              <div role="menuitem" className="context-menu-item" onClick={() => dispatch({ type: 'ADD_ITEM', parentId: contextMenu.itemId, itemType: 'note' })}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M3 1h7l4 4v10H3V1z" /><path d="M8 6v5M5.5 8.5h5" /></svg>
                New Note
              </div>
              <div role="menuitem" className="context-menu-item" onClick={() => dispatch({ type: 'ADD_ITEM', parentId: contextMenu.itemId, itemType: 'folder' })}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2 3h4l2 2h6v8H2V3z" /><path d="M8 7v4M6 9h4" /></svg>
                New Folder
              </div>
              <div className="context-menu-divider" />
            </>
          )}
          <div
            className="context-menu-item"
            onClick={() => dispatch({ type: 'START_RENAME', id: contextMenu.itemId, name: findItemName(tree, contextMenu.itemId) })}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M11 1l4 4-9 9H2v-4L11 1z" /></svg>
            Rename
          </div>
          <div
            className="context-menu-item"
            onClick={() => dispatch({ type: 'TOGGLE_PIN', id: contextMenu.itemId })}
          >
            <PinIcon />
            {findItem(tree, contextMenu.itemId)?.pinned ? 'Unpin' : 'Pin to Top'}
          </div>
          {contextMenu.itemType === 'note' && (
            <div
              className="context-menu-item"
              onClick={() => {
                const note = findNote(tree, contextMenu.itemId)
                if (note) exportNoteAsMarkdown(note)
                dispatch({ type: 'SET_CONTEXT_MENU', menu: null })
              }}
            >
              <ExportIcon />
              Export as .md
            </div>
          )}
          <div
            className="context-menu-item danger"
            onClick={() => handleDelete(contextMenu.itemId)}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 10h6l1-10" /></svg>
            Delete
          </div>
        </div>
      )}

      {/* Editor */}
      <main id="editor-main" className="editor-area">
        <TabBar />
        {activeNote ? (
          <>
            <div className="editor-toolbar-row">
              <Breadcrumbs />
              {saveStatus !== 'idle' ? (
                <span className={`save-indicator ${saveStatus}`}>
                  {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save failed'}
                </span>
              ) : lastSavedAt ? (
                <span className="save-indicator saved-time" title={`Last saved at ${savedTimeStr}`}>
                  Saved {savedTimeStr}
                </span>
              ) : null}
              <div className="toolbar-actions">
                <button
                  className="sidebar-action-btn"
                  title="Export as PDF (Print)"
                  onClick={handleExportPDF}
                >
                  <PDFIcon />
                </button>
                <button
                  className="sidebar-action-btn"
                  title="Zen Mode (Ctrl+Shift+Z)"
                  onClick={() => dispatch({ type: 'TOGGLE_ZEN_MODE' })}
                >
                  <ZenIcon />
                </button>
                {!sidebarVisible && (
                  <button
                    className="sidebar-action-btn"
                    title="Show Sidebar (Ctrl+\\)"
                    onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                      <rect x="1" y="2" width="14" height="12" rx="1" />
                      <path d="M5 2v12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <TagInput noteId={activeId} tags={activeNote.tags || []} />
            <div className="editor-pane">
              <EditorErrorBoundary key={activeId}>
                <Editor
                  key={activeId}
                  markdown={activeNote.content || ''}
                  onChange={(md) => dispatch({ type: 'UPDATE_NOTE_CONTENT', id: activeId, content: md })}
                  theme={theme}
                />
              </EditorErrorBoundary>
            </div>
            <StatusBar content={activeNote.content || ''} />
          </>
        ) : (
          <div className="empty-state">
            <p>Select a note to start editing</p>
            <p className="empty-state-hint">or press Ctrl+N to create a new note</p>
          </div>
        )}
      </main>

      {/* Generic confirm/alert dialog */}
      {dialog && (
        <ConfirmModal
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={dialog.cancelLabel}
          onConfirm={dialog.onConfirm}
          onCancel={() => setDialog(null)}
          onCancelAction={dialog.onCancelAction}
          showCancel={dialog.showCancel}
          danger={dialog.danger}
        />
      )}

      {/* Wiki-link create confirm */}
      {wikiLinkPrompt && (
        <ConfirmModal
          title="Create Note"
          message={`Note "${wikiLinkPrompt}" not found. Create it?`}
          confirmLabel="Create"
          cancelLabel="Cancel"
          onConfirm={handleCreateWikiLink}
          onCancel={() => setWikiLinkPrompt(null)}
        />
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <TemplateModal
          onSelect={handleNewNoteFromTemplate}
          onClose={() => setShowTemplateModal(false)}
        />
      )}
    </div>
  )
}

// Tag filter helper
function filterTreeByTag(items: TreeItem[], tags: string[], mode: 'and' | 'or'): TreeItem[] {
  return items.reduce<TreeItem[]>((acc, item) => {
    if (item.type === 'note') {
      const noteTags = item.tags || []
      const match = mode === 'or'
        ? tags.some(t => noteTags.includes(t))
        : tags.every(t => noteTags.includes(t))
      if (match) acc.push(item)
    } else if (item.type === 'folder') {
      const filtered = item.children ? filterTreeByTag(item.children, tags, mode) : []
      if (filtered.length > 0) {
        acc.push({ ...item, children: filtered, expanded: true })
      }
    }
    return acc
  }, [])
}

// ── App orchestration states ──

type AppPhase =
  | { phase: 'loading' }
  | { phase: 'vault-setup' }
  | { phase: 'passphrase-setup'; folder: string }
  | { phase: 'passphrase-unlock'; folder: string }
  | { phase: 'ready'; folder: string; passphrase: string }

export default function Home() {
  const [appPhase, setAppPhase] = useState<AppPhase>({ phase: 'loading' })
  const [passphraseError, setPassphraseError] = useState<string | null>(null)
  const [passphraseLoading, setPassphraseLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // Register global shortcut to show/focus app (Ctrl+Shift+M)
  useEffect(() => {
    async function registerShortcut() {
      try {
        await register('Ctrl+Shift+M', async (event) => {
          if (event.state === 'Pressed') {
            const win = getCurrentWindow()
            await win.show()
            await win.unminimize()
            await win.setFocus()
          }
        })
      } catch (err) {
        console.warn('Failed to register global shortcut:', err)
      }
    }
    registerShortcut()
  }, [])

  // F1 help shortcut listener
  useEffect(() => {
    const handler = () => setShowHelp(true)
    window.addEventListener('open-help', handler)
    return () => window.removeEventListener('open-help', handler)
  }, [])

  // On mount, check vault status
  useEffect(() => {
    async function init() {
      const status = await checkVaultStatus()
      if (status.state === 'no-folder') {
        setAppPhase({ phase: 'vault-setup' })
        return
      }

      const folder = status.folder
      const exists = await vaultFileExists(folder)
      if (!exists) {
        // Vault folder exists but no vault.json — new vault, need passphrase setup
        setAppPhase({ phase: 'passphrase-setup', folder })
        return
      }

      // vault.json exists — check if encrypted
      const raw = await readVaultFile(folder)
      if (raw && isEncryptedVault(raw)) {
        setAppPhase({ phase: 'passphrase-unlock', folder })
      } else {
        // Unencrypted vault — need passphrase setup to encrypt it
        setAppPhase({ phase: 'passphrase-setup', folder })
      }
    }
    init()
  }, [])

  // Vault folder selected
  const handleVaultReady = useCallback(async (folder: string) => {
    const exists = await vaultFileExists(folder)
    if (!exists) {
      setAppPhase({ phase: 'passphrase-setup', folder })
    } else {
      const raw = await readVaultFile(folder)
      if (raw && isEncryptedVault(raw)) {
        setAppPhase({ phase: 'passphrase-unlock', folder })
      } else {
        setAppPhase({ phase: 'passphrase-setup', folder })
      }
    }
  }, [])

  // Passphrase submitted for setup (new vault)
  const handlePassphraseSetup = useCallback(async (passphrase: string) => {
    if (appPhase.phase !== 'passphrase-setup') return
    setPassphraseLoading(true)
    setPassphraseError(null)
    try {
      const folder = appPhase.folder

      // Check if there's existing unencrypted data to migrate
      const raw = await readVaultFile(folder)
      if (raw && !isEncryptedVault(raw)) {
        // Encrypt existing data
        const encrypted = await encryptVault(raw, passphrase)
        await writeVaultFile(folder, encrypted)
      }
      // If no vault.json exists, the NotebookProvider will create one on first save

      setAppPhase({ phase: 'ready', folder, passphrase })
    } catch {
      setPassphraseError('Failed to create vault. Please try again.')
    } finally {
      setPassphraseLoading(false)
    }
  }, [appPhase])

  // Passphrase submitted for unlock (existing encrypted vault)
  const handlePassphraseUnlock = useCallback(async (passphrase: string) => {
    if (appPhase.phase !== 'passphrase-unlock') return
    setPassphraseLoading(true)
    setPassphraseError(null)
    try {
      const raw = await readVaultFile(appPhase.folder)
      if (!raw) {
        setPassphraseError('Vault file not found.')
        return
      }
      const valid = await verifyPassphrase(raw, passphrase)
      if (!valid) {
        setPassphraseError('Wrong passphrase. Please try again.')
        return
      }
      setAppPhase({ phase: 'ready', folder: appPhase.folder, passphrase })
    } catch {
      setPassphraseError('Failed to unlock vault.')
    } finally {
      setPassphraseLoading(false)
    }
  }, [appPhase])

  // Settings: change vault folder
  const handleVaultChanged = useCallback((folder: string) => {
    setShowSettings(false)
    // Reload to re-hydrate from new vault
    window.location.reload()
  }, [])

  // Extract folder name from path for display
  const getFolderName = (path: string) => {
    const parts = path.replace(/\\/g, '/').split('/')
    return parts[parts.length - 1] || path
  }

  // ── Render by phase ──

  if (appPhase.phase === 'loading') {
    return (
      <div className="vault-loading">
        <div className="vault-loading-spinner" />
        Loading...
      </div>
    )
  }

  if (appPhase.phase === 'vault-setup') {
    return <VaultSetup onComplete={handleVaultReady} />
  }

  if (appPhase.phase === 'passphrase-setup') {
    return (
      <PassphraseScreen
        mode="setup"
        onSubmit={handlePassphraseSetup}
        error={passphraseError}
        loading={passphraseLoading}
      />
    )
  }

  if (appPhase.phase === 'passphrase-unlock') {
    return (
      <PassphraseScreen
        mode="unlock"
        onSubmit={handlePassphraseUnlock}
        error={passphraseError}
        loading={passphraseLoading}
      />
    )
  }

  // Phase: ready
  const vaultName = getFolderName(appPhase.folder)
  return (
    <AppErrorBoundary>
      <NotebookProvider vaultFolder={appPhase.folder} passphrase={appPhase.passphrase}>
        <NotebookApp
          vaultName={vaultName}
          onOpenSettings={() => setShowSettings(true)}
          onOpenHelp={() => setShowHelp(true)}
        />
        {showSettings && (
          <SettingsPanel
            vaultName={vaultName}
            onClose={() => setShowSettings(false)}
            onVaultChanged={handleVaultChanged}
          />
        )}
        {showHelp && (
          <HelpPanel onClose={() => setShowHelp(false)} />
        )}
      </NotebookProvider>
    </AppErrorBoundary>
  )
}
