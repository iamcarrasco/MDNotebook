'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { NotebookProvider, useNotebook, useNotebookDispatch, useVaultCredentials } from '@/lib/notebook-context'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { findNote, findNoteByName, genId, findParentPath, hasChildren } from '@/lib/tree-utils'
import SidebarPanel from '@/components/SidebarPanel'
import ContextMenuOverlay from '@/components/ContextMenuOverlay'
import StatusBar from '@/components/StatusBar'
import Breadcrumbs from '@/components/Breadcrumbs'
import TagInput from '@/components/TagInput'
import VaultSetup from '@/components/VaultSetup'
import PassphraseScreen from '@/components/PassphraseScreen'
import SettingsPanel from '@/components/SettingsPanel'
import TabBar from '@/components/TabBar'
import TemplateModal from '@/components/TemplateModal'
import HelpPanel from '@/components/HelpPanel'
import BacklinksPanel from '@/components/BacklinksPanel'
import VersionHistoryPanel from '@/components/VersionHistoryPanel'
import EditorErrorBoundary from '@/components/EditorErrorBoundary'
import AppErrorBoundary from '@/components/AppErrorBoundary'
import PanelErrorBoundary from '@/components/PanelErrorBoundary'
import ConfirmModal from '@/components/ConfirmModal'
import HeaderBar from '@/components/HeaderBar'
import SearchOverlay from '@/components/SearchOverlay'
import CommandPalette from '@/components/CommandPalette'
import TemplateManager from '@/components/TemplateManager'
import FrontmatterEditor from '@/components/FrontmatterEditor'
import { ToastProvider, useToast } from '@/components/Toast'
import type { NoteTemplate } from '@/lib/templates'
import { CloseIcon } from '@/components/Icons'
import { exportNoteAsMarkdown, exportNoteAsHTML, exportAllAsJSON, exportAllAsMarkdownFolder } from '@/lib/export-import'
import { checkVaultStatus, vaultFileExists, readVaultFile, writeVaultFile } from '@/lib/local-vault'
import { isEncryptedVault, verifyPassphrase, encryptVault } from '@/lib/crypto'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { register } from '@tauri-apps/plugin-global-shortcut'
import type { TreeItem } from '@/lib/types'

const Editor = dynamic(() => import('@/components/Editor'), { ssr: false })

function normalizeFilePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

function findNoteBySourcePath(items: TreeItem[], sourcePath: string): TreeItem | null {
  for (const item of items) {
    if (item.type === 'note' && item.sourcePath === sourcePath) return item
    if (item.children) {
      const found = findNoteBySourcePath(item.children, sourcePath)
      if (found) return found
    }
  }
  return null
}

// ── Main notebook UI ──

function NotebookApp({
  vaultName,
  onOpenSettings,
  onOpenHelp,
}: {
  vaultName: string
  onOpenSettings: () => void
  onOpenHelp: () => void
}) {
  const state = useNotebook()
  const dispatch = useNotebookDispatch()
  const { vaultFolder, passphrase } = useVaultCredentials()
  const { showToast } = useToast()
  const treeRef = useRef(state.tree)
  treeRef.current = state.tree
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [wikiLinkPrompt, setWikiLinkPrompt] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{
    title: string
    message: string
    confirmLabel: string
    onConfirm: () => void
    showCancel?: boolean
  } | null>(null)

  // Search overlay state
  const [searchVisible, setSearchVisible] = useState(false)

  // Command Palette state
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false)

  // About dialog
  const [showAbout, setShowAbout] = useState(false)

  // Template Manager
  const [showTemplateManager, setShowTemplateManager] = useState(false)

  useKeyboardShortcuts()

  const {
    tree, trash, activeId, saveStatus, theme, sidebarVisible, zenMode,
    renamingId, selectedFolderId, searchQuery, assets, spellcheck, includeFrontmatter,
  } = state

  const activeNote = useMemo(() => findNote(tree, activeId), [tree, activeId])

  // Resolve effective theme from system preference
  const effectiveTheme = useMemo(() => {
    if (theme !== 'system') return theme
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }, [theme])

  // Listen for system theme changes when theme is 'system'
  useEffect(() => {
    if (theme !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      // Force re-render by toggling a dummy attribute on document
      document.documentElement.setAttribute(
        'data-theme',
        mql.matches ? 'dark' : 'light'
      )
    }
    handler() // Set initial
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [theme])

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }, [effectiveTheme])

  const activeParentId = useMemo(() => {
    if (selectedFolderId) return selectedFolderId
    if (!activeId) return null
    const path = findParentPath(tree, activeId)
    if (path && path.length > 0) return path[path.length - 1].id
    return null
  }, [tree, activeId, selectedFolderId])

  const getParentId = useCallback((): string | null => {
    if (selectedFolderId) return selectedFolderId
    if (!activeId) return null
    const path = findParentPath(tree, activeId)
    if (path && path.length > 0) return path[path.length - 1].id
    return null
  }, [tree, activeId, selectedFolderId])

  // Wiki-link click handler
  useEffect(() => {
    const handler = (e: Event) => {
      const { name } = (e as CustomEvent).detail
      const note = findNoteByName(treeRef.current, name)
      if (note) {
        dispatch({ type: 'SET_ACTIVE', id: note.id })
      } else {
        setWikiLinkPrompt(name)
      }
    }
    window.addEventListener('wiki-link-click', handler)
    return () => window.removeEventListener('wiki-link-click', handler)
  }, [dispatch])

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

  // Auto-focus editor when rename finishes
  const prevRenamingRef = useRef(renamingId)
  useEffect(() => {
    if (prevRenamingRef.current && !renamingId) {
      requestAnimationFrame(() => {
        const editable = document.querySelector('.mdxeditor-root-contenteditable [contenteditable]') as HTMLElement
        editable?.focus()
      })
    }
    prevRenamingRef.current = renamingId
  }, [renamingId])

  // Blank Note handler (one-click)
  const handleNewBlankNote = useCallback(() => {
    const ts = Date.now()
    const newItem: TreeItem = {
      id: genId(),
      name: 'Untitled Note',
      type: 'note',
      content: '',
      createdAt: ts,
      updatedAt: ts,
    }
    dispatch({ type: 'IMPORT_ITEMS', items: [newItem] })
    dispatch({ type: 'SET_ACTIVE', id: newItem.id })
  }, [dispatch])

  // Meeting Notes handler (one-click)
  const handleNewMeetingNotes = useCallback(() => {
    const ts = Date.now()
    const dateStr = new Date().toISOString().slice(0, 10)
    const content = `# Meeting Notes\n\n**Date**: ${dateStr}\n**Attendees**:\n\n## Agenda\n\n1.\n\n## Discussion\n\n-\n\n## Action Items\n\n- [ ]\n\n## Next Steps\n\n`
    const newItem: TreeItem = {
      id: genId(),
      name: 'Meeting Notes',
      type: 'note',
      content,
      createdAt: ts,
      updatedAt: ts,
      tags: ['meeting'],
    }
    dispatch({ type: 'IMPORT_ITEMS', items: [newItem] })
    dispatch({ type: 'SET_ACTIVE', id: newItem.id })
    dispatch({ type: 'START_RENAME', id: newItem.id, name: newItem.name })
  }, [dispatch])

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
    const dateStr = new Date().toISOString().slice(0, 10)
    let name = template.name
    if (name === 'Blank Note') name = 'Untitled Note'
    else if (name === 'Daily Note') name = `${dateStr} - Daily Note`
    const newItem: TreeItem = {
      id: genId(),
      name,
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

  const handleExportPDF = useCallback(() => {
    window.print()
  }, [])

  // Export handlers for header bar menu
  const handleExportMarkdown = useCallback(async () => {
    if (!activeNote) return
    try {
      await exportNoteAsMarkdown(activeNote, assets, vaultFolder, passphrase, includeFrontmatter)
      showToast('Exported as Markdown')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('cancelled') && !msg.includes('No file selected')) {
        showToast(msg || 'Export failed')
      }
    }
  }, [activeNote, assets, vaultFolder, passphrase, includeFrontmatter, showToast])

  const handleExportHTML = useCallback(async () => {
    if (!activeNote) return
    try {
      await exportNoteAsHTML(activeNote, assets, vaultFolder, passphrase)
      showToast('Exported as HTML')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('cancelled') && !msg.includes('No file selected')) {
        showToast(msg || 'Export failed')
      }
    }
  }, [activeNote, assets, vaultFolder, passphrase, showToast])

  const handleExportJSON = useCallback(async () => {
    try {
      await exportAllAsJSON(tree, trash)
      showToast('Exported vault backup')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('cancelled') && !msg.includes('No file selected')) {
        showToast(msg || 'Export failed')
      }
    }
  }, [tree, trash, showToast])

  const handleExportAllMarkdown = useCallback(async () => {
    try {
      const count = await exportAllAsMarkdownFolder(tree, includeFrontmatter)
      showToast(`Exported ${count} notes as Markdown`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('cancelled') && !msg.includes('No folder selected')) {
        showToast(msg || 'Export failed')
      }
    }
  }, [tree, includeFrontmatter, showToast])

  // Event listeners for keyboard shortcuts (custom events from useKeyboardShortcuts)
  useEffect(() => {
    const onOpenSearch = () => setSearchVisible(v => !v)
    const onOpenCommandPalette = () => setCommandPaletteVisible(true)
    const onOpenPreferences = () => onOpenSettings()
    const onOpenTemplateModal = () => handleNewBlankNote()
    const onOpenMenu = () => {
      // Trigger a click on the menu button in the header bar
      const menuBtn = document.querySelector('.header-menu-wrapper .header-bar-btn') as HTMLElement
      menuBtn?.click()
    }

    window.addEventListener('open-search', onOpenSearch)
    window.addEventListener('open-command-palette', onOpenCommandPalette)
    window.addEventListener('open-preferences', onOpenPreferences)
    window.addEventListener('open-template-modal', onOpenTemplateModal)
    window.addEventListener('open-menu', onOpenMenu)

    return () => {
      window.removeEventListener('open-search', onOpenSearch)
      window.removeEventListener('open-command-palette', onOpenCommandPalette)
      window.removeEventListener('open-preferences', onOpenPreferences)
      window.removeEventListener('open-template-modal', onOpenTemplateModal)
      window.removeEventListener('open-menu', onOpenMenu)
    }
  }, [onOpenSettings, handleNewBlankNote])

  // Daily note shortcut listener
  useEffect(() => {
    const handler = () => handleDailyNote()
    window.addEventListener('daily-note-shortcut', handler)
    return () => window.removeEventListener('daily-note-shortcut', handler)
  }, [handleDailyNote])

  // System tray event listeners
  useEffect(() => {
    const unlisten1 = listen('tray-new-note', () => {
      handleNewBlankNote()
    })
    const unlisten2 = listen('tray-daily-note', () => {
      handleDailyNote()
    })
    return () => {
      unlisten1.then(fn => fn()).catch(err => console.warn('Failed to unlisten tray-new-note:', err))
      unlisten2.then(fn => fn()).catch(err => console.warn('Failed to unlisten tray-daily-note:', err))
    }
  }, [dispatch, handleNewBlankNote, handleDailyNote])

  // File association: handle .md files opened with MDNotebook
  useEffect(() => {
    const unlisten = listen<string>('open-file', async (event) => {
      const filePath = event.payload
      try {
        const content = await invoke<string>('read_markdown_file', { path: filePath })
        const normalizedSourcePath = normalizeFilePath(filePath)
        const parts = filePath.replace(/\\/g, '/').split('/')
        const fileName = parts[parts.length - 1].replace(/\.(md|markdown)$/i, '')

        const existing = findNoteBySourcePath(treeRef.current, normalizedSourcePath)
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
            sourcePath: normalizedSourcePath,
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
    return () => { unlisten.then(fn => fn()).catch(err => console.warn('Failed to unlisten open-file:', err)) }
  }, [dispatch])

  // Context menu delete handler (needs confirmation for folders with children)
  const handleDelete = useCallback((id: string) => {
    const item = findNote(tree, id) || tree.find(i => i.id === id)
    dispatch({ type: 'MOVE_TO_TRASH', id })
    showToast(`Moved "${item?.name || 'item'}" to trash`, {
      action: {
        label: 'Undo',
        onClick: () => dispatch({ type: 'RESTORE_FROM_TRASH', id }),
      },
    })
  }, [tree, dispatch, showToast])

  // Command palette actions
  const commandActions = useMemo(() => [
    { id: 'new-note', label: 'New Blank Note', shortcut: 'Ctrl+N', section: 'Notes', action: handleNewBlankNote },
    { id: 'new-folder', label: 'New Folder', shortcut: 'Ctrl+Shift+N', section: 'Notes', action: () => dispatch({ type: 'ADD_ITEM', parentId: getParentId(), itemType: 'folder' }) },
    { id: 'daily-note', label: 'New Daily Note', shortcut: 'Ctrl+Shift+T', section: 'Notes', action: handleDailyNote },
    { id: 'meeting-notes', label: 'New Meeting Notes', section: 'Notes', action: handleNewMeetingNotes },
    { id: 'more-templates', label: 'More Templates…', section: 'Notes', action: () => setShowTemplateModal(true) },
    { id: 'search-notes', label: 'Search All Notes', shortcut: 'Ctrl+Shift+F', section: 'Edit', action: () => setSearchVisible(true) },
    { id: 'zen-mode', label: 'Toggle Zen Mode', shortcut: 'Ctrl+Shift+Z', section: 'View', action: () => dispatch({ type: 'TOGGLE_ZEN_MODE' }) },
    { id: 'toggle-sidebar', label: 'Toggle Sidebar', shortcut: 'F9', section: 'View', action: () => dispatch({ type: 'TOGGLE_SIDEBAR' }) },
    { id: 'toggle-theme', label: 'Cycle Theme', shortcut: 'Ctrl+Shift+D', section: 'View', action: () => dispatch({ type: 'TOGGLE_THEME' }) },
    { id: 'export-pdf', label: 'Export as PDF', section: 'Export', action: handleExportPDF },
    { id: 'export-md', label: 'Export as Markdown', section: 'Export', action: handleExportMarkdown },
    { id: 'export-html', label: 'Export as HTML', section: 'Export', action: handleExportHTML },
    { id: 'export-json', label: 'Export All as JSON', section: 'Export', action: handleExportJSON },
    { id: 'export-all-md', label: 'Export All as Markdown', section: 'Export', action: handleExportAllMarkdown },
    { id: 'manage-templates', label: 'Manage Templates', section: 'Settings', action: () => setShowTemplateManager(true) },
    { id: 'preferences', label: 'Preferences', shortcut: 'Ctrl+,', section: 'Settings', action: onOpenSettings },
    { id: 'help', label: 'Help', shortcut: 'F1', section: 'Settings', action: onOpenHelp },
  ], [dispatch, getParentId, handleNewBlankNote, handleDailyNote, handleNewMeetingNotes, handleExportPDF, handleExportMarkdown, handleExportHTML, handleExportJSON, handleExportAllMarkdown, onOpenSettings, onOpenHelp])

  // Search query handler for the overlay
  const handleSearchQueryChange = useCallback((q: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', query: q })
  }, [dispatch])

  // Count search results
  const searchResultCount = useMemo(() => {
    if (!searchQuery.trim()) return 0
    const lower = searchQuery.toLowerCase()
    let count = 0
    const countInTree = (items: TreeItem[]) => {
      for (const item of items) {
        if (item.type === 'note') {
          if (item.name.toLowerCase().includes(lower) || (item.content || '').toLowerCase().includes(lower)) {
            count++
          }
        }
        if (item.children) countInTree(item.children)
      }
    }
    countInTree(tree)
    return count
  }, [tree, searchQuery])

  // Loading state
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
                theme={effectiveTheme}
                spellcheck={spellcheck}
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

      {/* Sidebar */}
      {sidebarVisible && (
        <SidebarPanel />
      )}

      {/* Context Menu */}
      <ContextMenuOverlay onDelete={handleDelete} />

      {/* Editor */}
      <main id="editor-main" className="editor-area">
        {/* Header Bar (GNOME HIG) */}
        <HeaderBar
          noteTitle={activeNote?.name}
          onNewBlankNote={handleNewBlankNote}
          onNewDailyNote={handleDailyNote}
          onNewMeetingNotes={handleNewMeetingNotes}
          onOpenTemplates={() => setShowTemplateModal(true)}
          onNewFolder={() => dispatch({ type: 'ADD_ITEM', parentId: getParentId(), itemType: 'folder' })}
          onToggleSearch={() => setSearchVisible(v => !v)}
          onToggleZen={() => dispatch({ type: 'TOGGLE_ZEN_MODE' })}
          onExportPDF={handleExportPDF}
          onExportMarkdown={handleExportMarkdown}
          onExportHTML={handleExportHTML}
          onExportJSON={handleExportJSON}
          onExportAllMarkdown={handleExportAllMarkdown}
          onOpenPreferences={onOpenSettings}
          onOpenHelp={onOpenHelp}
          onOpenAbout={() => setShowAbout(true)}
          onOpenTemplateManager={() => setShowTemplateManager(true)}
          searchActive={searchVisible}
        />

        {/* Search Overlay (slides from under header bar) */}
        <SearchOverlay
          visible={searchVisible}
          onClose={() => { setSearchVisible(false); dispatch({ type: 'SET_SEARCH_QUERY', query: '' }) }}
          query={searchQuery}
          onQueryChange={handleSearchQueryChange}
          resultCount={searchResultCount}
        />

        <TabBar />
        {activeNote ? (
          <>
            <div className="editor-toolbar-row">
              <Breadcrumbs />
              {saveStatus === 'saving' ? (
                <span className="save-indicator saving">Saving...</span>
              ) : saveStatus === 'saved' ? (
                <span className="save-indicator saved">Saved</span>
              ) : saveStatus === 'error' ? (
                <span className="save-indicator error">Save failed</span>
              ) : null}
              {!sidebarVisible && (
                <div className="toolbar-actions">
                  <button
                    className="sidebar-action-btn"
                    title="Show Sidebar (F9)"
                    onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                      <rect x="1" y="2" width="14" height="12" rx="1" />
                      <path d="M5 2v12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <TagInput noteId={activeId} tags={activeNote.tags || []} />
            <FrontmatterEditor noteId={activeId} frontmatter={activeNote.frontmatter || {}} />
            <div className="editor-meta-row">
              <PanelErrorBoundary panelName="Backlinks">
                <BacklinksPanel noteId={activeId} noteName={activeNote.name} />
              </PanelErrorBoundary>
              <PanelErrorBoundary panelName="Version History">
                <VersionHistoryPanel noteId={activeId} />
              </PanelErrorBoundary>
            </div>
            <div className="editor-pane">
              <EditorErrorBoundary key={activeId}>
                <Editor
                  key={activeId}
                  markdown={activeNote.content || ''}
                  onChange={(md) => dispatch({ type: 'UPDATE_NOTE_CONTENT', id: activeId, content: md })}
                  theme={effectiveTheme}
                  spellcheck={spellcheck}
                />
              </EditorErrorBoundary>
            </div>
            <StatusBar content={activeNote.content || ''} createdAt={activeNote.createdAt} updatedAt={activeNote.updatedAt} />
          </>
        ) : (
          <div className="empty-state">
            <p>Select a note to start editing</p>
            <p className="empty-state-hint">or press Ctrl+N to create a new note</p>
          </div>
        )}
      </main>

      {/* Command Palette */}
      <CommandPalette
        visible={commandPaletteVisible}
        onClose={() => setCommandPaletteVisible(false)}
        actions={commandActions}
      />

      {/* Dialogs */}
      {dialog && (
        <ConfirmModal
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel}
          onConfirm={dialog.onConfirm}
          onCancel={() => setDialog(null)}
          showCancel={dialog.showCancel}
        />
      )}

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

      {showTemplateModal && (
        <TemplateModal
          onSelect={handleNewNoteFromTemplate}
          onClose={() => setShowTemplateModal(false)}
          currentNoteContent={activeNote?.content}
          currentNoteName={activeNote?.name}
        />
      )}

      {showAbout && (
        <ConfirmModal
          title="About MDNotebook"
          message="MDNotebook v0.2.0 — An offline, encrypted markdown notebook built for technical writing. Your notes never leave your device."
          confirmLabel="OK"
          onConfirm={() => setShowAbout(false)}
          onCancel={() => setShowAbout(false)}
          showCancel={false}
        />
      )}

      {showTemplateManager && (
        <TemplateManager onClose={() => setShowTemplateManager(false)} />
      )}
    </div>
  )
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
    let cancelled = false

    async function init() {
      try {
        const status = await checkVaultStatus()
        if (cancelled) return

        if (status.state === 'no-folder') {
          setAppPhase({ phase: 'vault-setup' })
          return
        }

        const folder = status.folder
        const exists = await vaultFileExists(folder)
        if (cancelled) return

        if (!exists) {
          setAppPhase({ phase: 'passphrase-setup', folder })
          return
        }

        const raw = await readVaultFile(folder)
        if (cancelled) return

        if (raw && isEncryptedVault(raw)) {
          setAppPhase({ phase: 'passphrase-unlock', folder })
        } else {
          setAppPhase({ phase: 'passphrase-setup', folder })
        }
      } catch (err) {
        console.error('Startup initialization failed:', err)
        if (cancelled) return
        setPassphraseError('Failed to initialize vault. Please select your vault folder again.')
        setAppPhase({ phase: 'vault-setup' })
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

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

  const handlePassphraseSetup = useCallback(async (passphrase: string) => {
    if (appPhase.phase !== 'passphrase-setup') return
    setPassphraseLoading(true)
    setPassphraseError(null)
    try {
      const folder = appPhase.folder
      const raw = await readVaultFile(folder)
      if (raw && !isEncryptedVault(raw)) {
        const encrypted = await encryptVault(raw, passphrase)
        await writeVaultFile(folder, encrypted)
      }
      setAppPhase({ phase: 'ready', folder, passphrase })
    } catch {
      setPassphraseError('Failed to create vault. Please try again.')
    } finally {
      setPassphraseLoading(false)
    }
  }, [appPhase])

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

  const handleVaultChanged = useCallback(() => {
    setShowSettings(false)
    window.location.reload()
  }, [])

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

  const vaultName = getFolderName(appPhase.folder)
  return (
    <AppErrorBoundary>
      <NotebookProvider vaultFolder={appPhase.folder} passphrase={appPhase.passphrase}>
        <ToastProvider>
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
        </ToastProvider>
      </NotebookProvider>
    </AppErrorBoundary>
  )
}
