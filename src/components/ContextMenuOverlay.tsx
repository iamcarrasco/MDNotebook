'use client'

import { useCallback } from 'react'
import { useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { findNote, findItem, findItemName, findParentPath } from '@/lib/tree-utils'
import { exportNoteAsMarkdown } from '@/lib/export-import'
import { ExportIcon, PinIcon } from '@/components/Icons'

interface Props {
  onDelete: (id: string) => void
}

export default function ContextMenuOverlay({ onDelete }: Props) {
  const { tree, contextMenu } = useNotebook()
  const dispatch = useNotebookDispatch()

  const handleExportMd = useCallback((itemId: string) => {
    const note = findNote(tree, itemId)
    if (note) exportNoteAsMarkdown(note)
    dispatch({ type: 'SET_CONTEXT_MENU', menu: null })
  }, [tree, dispatch])

  if (!contextMenu) return null

  const parentDepth = findParentPath(tree, contextMenu.itemId)?.length ?? 0

  return (
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
        <>
          <div
            className="context-menu-item"
            onClick={() => dispatch({ type: 'DUPLICATE_NOTE', id: contextMenu.itemId })}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="5" y="5" width="9" height="9" rx="1" /><path d="M3 11V3a1 1 0 011-1h8" /></svg>
            Duplicate
          </div>
          <div
            className="context-menu-item"
            onClick={() => handleExportMd(contextMenu.itemId)}
          >
            <ExportIcon />
            Export as .md
          </div>
        </>
      )}
      {parentDepth > 0 && (
        <div
          className="context-menu-item"
          onClick={() => dispatch({ type: 'MOVE_TO_ROOT', id: contextMenu.itemId })}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M8 12V4M5 7l3-3 3 3" /><path d="M3 14h10" /></svg>
          Move to Root
        </div>
      )}
      <div
        className="context-menu-item danger"
        onClick={() => onDelete(contextMenu.itemId)}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 10h6l1-10" /></svg>
        Delete
      </div>
    </div>
  )
}
