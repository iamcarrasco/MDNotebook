'use client'

import { useEffect, useRef } from 'react'
import { SearchIcon, CloseIcon } from './Icons'

/* ── Types ── */

interface SearchOverlayProps {
  visible: boolean
  onClose: () => void
  query: string
  onQueryChange: (query: string) => void
  resultCount?: number
}

/* ── Component ── */

export default function SearchOverlay({
  visible,
  onClose,
  query,
  onQueryChange,
  resultCount,
}: SearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  /* Focus the input when the overlay becomes visible */
  useEffect(() => {
    if (visible) {
      // Small delay to allow the slide animation to start
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [visible])

  /* Close on Escape */
  useEffect(() => {
    if (!visible) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [visible, onClose])

  const handleClear = () => {
    onQueryChange('')
    inputRef.current?.focus()
  }

  return (
    <div
      className={`search-overlay${visible ? ' search-overlay-visible' : ''}`}
      role="search"
      aria-label="Search notes"
      aria-hidden={!visible}
    >
      <div className="search-overlay-inner">
        <span className="search-overlay-icon" aria-hidden="true">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          className="search-overlay-input"
          type="text"
          placeholder="Search all notes..."
          aria-label="Search all notes"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          tabIndex={visible ? 0 : -1}
        />
        {query && (
          <button
            className="search-overlay-clear"
            onClick={handleClear}
            title="Clear search"
            aria-label="Clear search"
            tabIndex={visible ? 0 : -1}
          >
            <CloseIcon />
          </button>
        )}
        {resultCount !== undefined && query && (
          <span className="search-overlay-count" aria-live="polite">
            {resultCount} {resultCount === 1 ? 'result' : 'results'}
          </span>
        )}
        <button
          className="search-overlay-close"
          onClick={onClose}
          title="Close search (Esc)"
          aria-label="Close search"
          tabIndex={visible ? 0 : -1}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
