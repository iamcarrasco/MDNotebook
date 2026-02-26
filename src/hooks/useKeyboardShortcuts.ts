'use client'

import { useEffect } from 'react'
import { useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { findParentPath, findItem } from '@/lib/tree-utils'

export function useKeyboardShortcuts() {
  const state = useNotebook()
  const dispatch = useNotebookDispatch()
  const { tree, activeId, selectedFolderId, zenMode, openTabs } = state

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tag = target.tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable

      // F1 — help
      if (e.key === 'F1') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('open-help'))
        return
      }

      // Ctrl+S — prevent browser save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        return
      }

      // Escape — exit zen mode or close panels
      if (e.key === 'Escape' && zenMode) {
        e.preventDefault()
        dispatch({ type: 'TOGGLE_ZEN_MODE' })
        return
      }

      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+W — close tab
      if (ctrl && !e.shiftKey && e.key === 'w') {
        e.preventDefault()
        if (activeId) dispatch({ type: 'CLOSE_TAB', id: activeId })
        return
      }

      // Ctrl+, — preferences
      if (ctrl && e.key === ',') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('open-preferences'))
        return
      }

      // Ctrl+Shift+P — command palette
      if (ctrl && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('open-command-palette'))
        return
      }

      // Ctrl+PageDown — next tab
      if (ctrl && e.key === 'PageDown') {
        e.preventDefault()
        if (openTabs.length > 1 && activeId) {
          const idx = openTabs.indexOf(activeId)
          const nextIdx = (idx + 1) % openTabs.length
          dispatch({ type: 'SET_ACTIVE', id: openTabs[nextIdx] })
        }
        return
      }

      // Ctrl+PageUp — prev tab
      if (ctrl && e.key === 'PageUp') {
        e.preventDefault()
        if (openTabs.length > 1 && activeId) {
          const idx = openTabs.indexOf(activeId)
          const prevIdx = (idx - 1 + openTabs.length) % openTabs.length
          dispatch({ type: 'SET_ACTIVE', id: openTabs[prevIdx] })
        }
        return
      }

      // F10 — open menu
      if (e.key === 'F10' && !e.shiftKey) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('open-menu'))
        return
      }

      // Skip remaining shortcuts when typing in inputs
      if (isEditable) return

      const getParentId = (): string | null => {
        if (selectedFolderId) return selectedFolderId
        if (!activeId) return null
        const path = findParentPath(tree, activeId)
        if (path && path.length > 0) return path[path.length - 1].id
        return null
      }

      // F9 — toggle sidebar (GNOME HIG standard)
      if (e.key === 'F9') {
        e.preventDefault()
        dispatch({ type: 'TOGGLE_SIDEBAR' })
        return
      }

      // Ctrl+N — new note (open template picker)
      if (ctrl && !e.shiftKey && e.key === 'n') {
        e.preventDefault()
        window.dispatchEvent(new Event('open-template-modal'))
        return
      }

      // Ctrl+Shift+N — new folder
      if (ctrl && e.shiftKey && e.key === 'N') {
        e.preventDefault()
        dispatch({ type: 'ADD_ITEM', parentId: getParentId(), itemType: 'folder' })
        return
      }

      // Ctrl+Shift+F — focus search (global note search)
      if (ctrl && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('open-search'))
        return
      }

      // Ctrl+Shift+D — toggle theme
      if (ctrl && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        dispatch({ type: 'TOGGLE_THEME' })
        return
      }

      // Ctrl+Shift+Z — zen mode
      if (ctrl && e.shiftKey && e.key === 'Z') {
        e.preventDefault()
        dispatch({ type: 'TOGGLE_ZEN_MODE' })
        return
      }

      // Ctrl+Shift+T — daily note
      if (ctrl && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('daily-note-shortcut'))
        return
      }

      // F2 — rename
      if (e.key === 'F2') {
        e.preventDefault()
        const targetId = selectedFolderId || activeId
        if (!targetId) return
        const item = findItem(tree, targetId)
        if (!item) return
        dispatch({ type: 'START_RENAME', id: item.id, name: item.name })
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [dispatch, tree, activeId, selectedFolderId, zenMode, openTabs])
}
