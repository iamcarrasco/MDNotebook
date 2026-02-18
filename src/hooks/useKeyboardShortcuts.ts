'use client'

import { useEffect } from 'react'
import { useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { findParentPath, findItem } from '@/lib/tree-utils'

export function useKeyboardShortcuts() {
  const state = useNotebook()
  const dispatch = useNotebookDispatch()
  const { tree, activeId, selectedFolderId, zenMode } = state

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tag = target.tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable

      // F1 — open help
      if (e.key === 'F1') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('open-help'))
        return
      }

      // Ctrl+S — prevent browser save dialog (always)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        return
      }

      // Skip other shortcuts when typing in inputs
      if (isEditable && e.key !== 'Escape') return

      const ctrl = e.ctrlKey || e.metaKey

      // Compute parent folder from current selection
      const getParentId = (): string | null => {
        if (selectedFolderId) return selectedFolderId
        if (!activeId) return null
        const path = findParentPath(tree, activeId)
        if (path && path.length > 0) return path[path.length - 1].id
        return null
      }

      // Ctrl+N — new note
      if (ctrl && !e.shiftKey && e.key === 'n') {
        e.preventDefault()
        dispatch({ type: 'ADD_ITEM', parentId: getParentId(), itemType: 'note' })
        return
      }

      // Ctrl+Shift+N — new folder
      if (ctrl && e.shiftKey && e.key === 'N') {
        e.preventDefault()
        dispatch({ type: 'ADD_ITEM', parentId: getParentId(), itemType: 'folder' })
        return
      }

      // Ctrl+Shift+F — focus search
      if (ctrl && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        const searchInput = document.querySelector('.search-bar-input') as HTMLInputElement
        if (searchInput) searchInput.focus()
        return
      }

      // Ctrl+\ — toggle sidebar
      if (ctrl && e.key === '\\') {
        e.preventDefault()
        dispatch({ type: 'TOGGLE_SIDEBAR' })
        return
      }

      // Ctrl+Shift+D — toggle dark mode
      if (ctrl && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        dispatch({ type: 'TOGGLE_THEME' })
        return
      }

      // Ctrl+Shift+Z — toggle zen mode
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

      // F2 — rename selected note/folder
      if (e.key === 'F2') {
        e.preventDefault()
        const targetId = selectedFolderId || activeId
        if (!targetId) return
        const target = findItem(tree, targetId)
        if (!target) return
        dispatch({ type: 'START_RENAME', id: target.id, name: target.name })
        return
      }

      // Escape — exit zen mode
      if (e.key === 'Escape' && zenMode) {
        e.preventDefault()
        dispatch({ type: 'TOGGLE_ZEN_MODE' })
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [dispatch, tree, activeId, selectedFolderId, zenMode])
}
