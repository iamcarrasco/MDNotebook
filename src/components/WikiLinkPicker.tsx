'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useNotebook } from '@/lib/notebook-context'
import { flattenNotes } from '@/lib/tree-utils'
import { CloseIcon } from './Icons'

interface WikiLinkPickerProps {
  onSelect: (name: string) => void
  onClose: () => void
}

export default function WikiLinkPicker({ onSelect, onClose }: WikiLinkPickerProps) {
  const { tree } = useNotebook()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const notes = useMemo(() => flattenNotes(tree), [tree])

  const filtered = useMemo(() => {
    if (!query.trim()) return notes
    const lower = query.toLowerCase()
    return notes.filter(n => n.name.toLowerCase().includes(lower))
  }, [notes, query])

  const handleSelect = (name: string) => {
    onSelect(name)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length > 0) {
        handleSelect(filtered[0].name)
      } else if (query.trim()) {
        handleSelect(query.trim())
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div className="settings-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Insert Wiki Link">
      <div className="wiki-link-picker" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">Insert Wiki Link</h2>
          <button className="sidebar-action-btn" onClick={onClose} title="Close" aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="wiki-link-picker-body">
          <input
            ref={inputRef}
            className="auth-input"
            type="text"
            placeholder="Search notes or type a new name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="wiki-link-picker-list">
            {filtered.map(note => (
              <button
                key={note.id}
                className="wiki-link-picker-item"
                onClick={() => handleSelect(note.name)}
              >
                {note.name}
              </button>
            ))}
            {query.trim() && !filtered.some(n => n.name.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                className="wiki-link-picker-item wiki-link-picker-create"
                onClick={() => handleSelect(query.trim())}
              >
                Create &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
