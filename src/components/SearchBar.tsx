'use client'

import { useState, useEffect, useRef } from 'react'
import { useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { SearchIcon, CloseIcon } from './Icons'

export default function SearchBar() {
  const { searchQuery } = useNotebook()
  const dispatch = useNotebookDispatch()
  const [localValue, setLocalValue] = useState(searchQuery)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local state when external searchQuery changes (e.g. cleared externally)
  useEffect(() => {
    setLocalValue(searchQuery)
  }, [searchQuery])

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleChange = (value: string) => {
    setLocalValue(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      dispatch({ type: 'SET_SEARCH_QUERY', query: value })
    }, 300)
  }

  const handleClear = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setLocalValue('')
    dispatch({ type: 'SET_SEARCH_QUERY', query: '' })
  }

  return (
    <div className="search-bar" role="search">
      <span className="search-bar-icon" aria-hidden="true"><SearchIcon /></span>
      <input
        className="search-bar-input"
        type="text"
        placeholder="Search notes..."
        aria-label="Search notes"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
      />
      {localValue && (
        <button
          className="search-bar-clear"
          onClick={handleClear}
          title="Clear search"
          aria-label="Clear search"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  )
}
