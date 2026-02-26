'use client'

import { useState } from 'react'
import { useNotebookDispatch } from '@/lib/notebook-context'
import { CloseIcon } from './Icons'

interface FrontmatterEditorProps {
  noteId: string
  frontmatter: Record<string, string>
}

const COMMON_KEYS = ['author', 'status', 'category', 'description', 'draft', 'weight', 'slug']

export default function FrontmatterEditor({ noteId, frontmatter }: FrontmatterEditorProps) {
  const dispatch = useNotebookDispatch()
  const [expanded, setExpanded] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const entries = Object.entries(frontmatter)

  const handleAdd = () => {
    const key = newKey.trim().toLowerCase().replace(/\s+/g, '_')
    if (!key) return
    dispatch({ type: 'SET_FRONTMATTER_FIELD', noteId, key, value: newValue.trim() })
    setNewKey('')
    setNewValue('')
  }

  const handleRemove = (key: string) => {
    dispatch({ type: 'REMOVE_FRONTMATTER_FIELD', noteId, key })
  }

  const handleValueChange = (key: string, value: string) => {
    dispatch({ type: 'SET_FRONTMATTER_FIELD', noteId, key, value })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    } else if (e.key === 'Escape') {
      setNewKey('')
      setNewValue('')
    }
  }

  return (
    <div className="frontmatter-container">
      <button
        className="frontmatter-toggle"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <svg
          className={`frontmatter-chevron${expanded ? ' expanded' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <span>Frontmatter</span>
        {entries.length > 0 && (
          <span className="frontmatter-count">{entries.length}</span>
        )}
      </button>

      {expanded && (
        <div className="frontmatter-body">
          {entries.map(([key, value]) => (
            <div key={key} className="frontmatter-row">
              <span className="frontmatter-key">{key}</span>
              <input
                className="frontmatter-value-input"
                value={value}
                onChange={(e) => handleValueChange(key, e.target.value)}
                placeholder="value"
              />
              <button
                className="frontmatter-remove-btn"
                onClick={() => handleRemove(key)}
                title={`Remove ${key}`}
              >
                <CloseIcon />
              </button>
            </div>
          ))}

          <div className="frontmatter-add-row">
            <input
              className="frontmatter-key-input"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="key"
              list="frontmatter-key-suggestions"
            />
            <datalist id="frontmatter-key-suggestions">
              {COMMON_KEYS.filter(k => !frontmatter[k]).map(k => (
                <option key={k} value={k} />
              ))}
            </datalist>
            <input
              className="frontmatter-value-input"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="value"
            />
            <button
              className="frontmatter-add-btn"
              onClick={handleAdd}
              disabled={!newKey.trim()}
              title="Add field"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
