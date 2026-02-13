'use client'

import { useEffect } from 'react'
import { useNotebookDispatch } from '@/lib/notebook-context'

export function useKeyboardShortcuts() {
  const dispatch = useNotebookDispatch()

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

      // Ctrl+N — new note
      if (ctrl && !e.shiftKey && e.key === 'n') {
        e.preventDefault()
        dispatch({ type: 'ADD_ITEM', parentId: null, itemType: 'note' })
        return
      }

      // Ctrl+Shift+N — new folder
      if (ctrl && e.shiftKey && e.key === 'N') {
        e.preventDefault()
        dispatch({ type: 'ADD_ITEM', parentId: null, itemType: 'folder' })
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

      // Escape — exit zen mode
      if (e.key === 'Escape') {
        // Don't interfere with other escape handlers in editable fields
        return
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [dispatch])
}
