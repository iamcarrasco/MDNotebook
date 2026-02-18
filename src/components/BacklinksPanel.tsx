'use client'

import { useMemo, useState } from 'react'
import { useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { findBacklinks } from '@/lib/tree-utils'
import { BacklinkIcon } from './Icons'

interface BacklinksPanelProps {
  noteId: string
  noteName: string
}

export default function BacklinksPanel({ noteId, noteName }: BacklinksPanelProps) {
  const { tree } = useNotebook()
  const dispatch = useNotebookDispatch()
  const [expanded, setExpanded] = useState(false)

  const backlinks = useMemo(
    () => findBacklinks(tree, noteName).filter(n => n.id !== noteId),
    [tree, noteName, noteId]
  )

  if (backlinks.length === 0) return null

  return (
    <div className="backlinks-panel">
      <button
        className="backlinks-toggle"
        onClick={() => setExpanded(!expanded)}
        title={`${backlinks.length} backlink${backlinks.length !== 1 ? 's' : ''}`}
      >
        <BacklinkIcon />
        <span>{backlinks.length} backlink{backlinks.length !== 1 ? 's' : ''}</span>
      </button>
      {expanded && (
        <div className="backlinks-content">
          <div className="backlinks-list">
            {backlinks.map(note => (
              <button
                key={note.id}
                className="backlink-item"
                onClick={() => dispatch({ type: 'SET_ACTIVE', id: note.id })}
                title={note.name}
              >
                {note.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
