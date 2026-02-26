'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { SearchIcon } from './Icons'

/* ── Icon helpers (inline SVGs for icons not in Icons.tsx) ── */

const NewNoteIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <path d="M3 1h7l4 4v10H3V1z" />
    <path d="M10 1v4h4" />
    <path d="M8 7v5M5.5 9.5h5" />
  </svg>
)

const NewFolderIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    <path d="M2 3h4l2 2h6v8H2V3z" />
    <path d="M8 8v3M6.5 9.5h3" />
  </svg>
)

const MenuIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M3 4h10M3 8h10M3 12h10" />
  </svg>
)

/* ── Types ── */

interface HeaderBarProps {
  noteTitle?: string
  onNewBlankNote: () => void
  onNewDailyNote: () => void
  onNewMeetingNotes: () => void
  onOpenTemplates: () => void
  onNewFolder: () => void
  onToggleSearch: () => void
  onToggleZen: () => void
  onExportPDF: () => void
  onExportMarkdown: () => void
  onExportHTML: () => void
  onExportJSON: () => void
  onExportAllMarkdown: () => void
  onOpenPreferences: () => void
  onOpenHelp: () => void
  onOpenAbout: () => void
  onOpenTemplateManager: () => void
  searchActive?: boolean
}

/* ── Component ── */

export default function HeaderBar({
  noteTitle,
  onNewBlankNote,
  onNewDailyNote,
  onNewMeetingNotes,
  onOpenTemplates,
  onNewFolder,
  onToggleSearch,
  onToggleZen,
  onExportPDF,
  onExportMarkdown,
  onExportHTML,
  onExportJSON,
  onExportAllMarkdown,
  onOpenPreferences,
  onOpenHelp,
  onOpenAbout,
  onOpenTemplateManager,
  searchActive = false,
}: HeaderBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [newNoteOpen, setNewNoteOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const newNoteRef = useRef<HTMLDivElement>(null)
  const newNoteBtnRef = useRef<HTMLButtonElement>(null)

  /* Close menu on outside click */
  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuBtnRef.current &&
        !menuBtnRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  /* Close new-note popover on outside click */
  useEffect(() => {
    if (!newNoteOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        newNoteRef.current &&
        !newNoteRef.current.contains(e.target as Node) &&
        newNoteBtnRef.current &&
        !newNoteBtnRef.current.contains(e.target as Node)
      ) {
        setNewNoteOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNewNoteOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [newNoteOpen])

  const menuAction = useCallback((action: () => void) => {
    setMenuOpen(false)
    action()
  }, [])

  const newNoteAction = useCallback((action: () => void) => {
    setNewNoteOpen(false)
    action()
  }, [])

  return (
    <div className="header-bar" role="toolbar" aria-label="Header bar">
      {/* ── Left section ── */}
      <div className="header-bar-start">
        <div className="header-menu-wrapper">
          <button
            ref={newNoteBtnRef}
            className={`header-bar-btn${newNoteOpen ? ' active' : ''}`}
            onClick={() => setNewNoteOpen((v) => !v)}
            title="New Note (Ctrl+N)"
            aria-label="New Note"
            aria-expanded={newNoteOpen}
            aria-haspopup="menu"
          >
            <NewNoteIcon />
          </button>

          {newNoteOpen && (
            <div
              ref={newNoteRef}
              className="header-menu-popover header-newnote-popover"
              role="menu"
              aria-label="Quick templates"
            >
              <button
                className="header-menu-item"
                role="menuitem"
                onClick={() => newNoteAction(onNewBlankNote)}
              >
                <span>Blank Note</span>
                <span className="header-menu-shortcut">Ctrl+N</span>
              </button>
              <button
                className="header-menu-item"
                role="menuitem"
                onClick={() => newNoteAction(onNewDailyNote)}
              >
                <span>Daily Note</span>
                <span className="header-menu-shortcut">Ctrl+Shift+T</span>
              </button>
              <button
                className="header-menu-item"
                role="menuitem"
                onClick={() => newNoteAction(onNewMeetingNotes)}
              >
                <span>Meeting Notes</span>
              </button>
              <div className="header-menu-separator" role="separator" />
              <button
                className="header-menu-item"
                role="menuitem"
                onClick={() => newNoteAction(onOpenTemplates)}
              >
                <span>More Templates…</span>
              </button>
            </div>
          )}
        </div>
        <button
          className="header-bar-btn"
          onClick={onNewFolder}
          title="New Folder"
          aria-label="New Folder"
        >
          <NewFolderIcon />
        </button>
      </div>

      {/* ── Center section ── */}
      <div className="header-bar-center">
        <span className="header-bar-title">
          {noteTitle || 'MDNotebook'}
        </span>
      </div>

      {/* ── Right section ── */}
      <div className="header-bar-end">
        <button
          className={`header-bar-btn${searchActive ? ' active' : ''}`}
          onClick={onToggleSearch}
          title="Search All Notes (Ctrl+Shift+F)"
          aria-label="Toggle Search"
          aria-pressed={searchActive}
        >
          <SearchIcon />
        </button>

        {/* ── Primary menu ── */}
        <div className="header-menu-wrapper">
          <button
            ref={menuBtnRef}
            className={`header-bar-btn${menuOpen ? ' active' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            title="Main Menu"
            aria-label="Main Menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <MenuIcon />
          </button>

          {menuOpen && (
            <div
              ref={menuRef}
              className="header-menu-popover"
              role="menu"
              aria-label="Main menu"
            >
              <button
                className="header-menu-item"
                role="menuitem"
                onClick={() => menuAction(onToggleZen)}
              >
                <span>Zen Mode</span>
                <span className="header-menu-shortcut">Ctrl+Shift+Z</span>
              </button>
              <button
                className="header-menu-item"
                role="menuitem"
                onClick={() => menuAction(onOpenTemplateManager)}
              >
                <span>Manage Templates</span>
              </button>

              <div className="header-menu-separator" role="separator" />

              <button
                className="header-menu-item"
                role="menuitem"
                onClick={() => menuAction(onExportPDF)}
              >
                <span>Export as PDF</span>
              </button>
              <button
                className="header-menu-item"
                role="menuitem"
                onClick={() => menuAction(onExportMarkdown)}
              >
                <span>Export as Markdown</span>
              </button>
              <button
                className="header-menu-item"
                role="menuitem"
                onClick={() => menuAction(onExportHTML)}
              >
                <span>Export as HTML</span>
              </button>
              <button
                className="header-menu-item"
                role="menuitem"
                onClick={() => menuAction(onExportJSON)}
              >
                <span>Export All as JSON</span>
              </button>
              <button
                className="header-menu-item"
                role="menuitem"
                onClick={() => menuAction(onExportAllMarkdown)}
              >
                <span>Export All as Markdown</span>
              </button>

              <div className="header-menu-separator" role="separator" />

              <button
                className="header-menu-item"
                role="menuitem"
                onClick={() => menuAction(onOpenPreferences)}
              >
                <span>Preferences</span>
                <span className="header-menu-shortcut">Ctrl+,</span>
              </button>
              <button
                className="header-menu-item"
                role="menuitem"
                onClick={() => menuAction(onOpenHelp)}
              >
                <span>Help</span>
                <span className="header-menu-shortcut">F1</span>
              </button>

              <div className="header-menu-separator" role="separator" />

              <button
                className="header-menu-item"
                role="menuitem"
                onClick={() => menuAction(onOpenAbout)}
              >
                <span>About MDNotebook</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
