'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { collectAllTags } from '@/lib/tree-utils'
import { CloseIcon } from './Icons'

interface TagInputProps {
  noteId: string
  tags: string[]
}

export default function TagInput({ noteId, tags }: TagInputProps) {
  const { tree } = useNotebook()
  const dispatch = useNotebookDispatch()
  const [isAdding, setIsAdding] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up blur timer on unmount
  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
    }
  }, [])

  const allTags = useMemo(() => collectAllTags(tree), [tree])
  const suggestions = useMemo(() => {
    if (!inputValue.trim()) return allTags.filter((t) => !tags.includes(t))
    const q = inputValue.toLowerCase()
    return allTags.filter((t) => t.toLowerCase().includes(q) && !tags.includes(t))
  }, [allTags, inputValue, tags])

  useEffect(() => {
    if (isAdding && inputRef.current) inputRef.current.focus()
  }, [isAdding])

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase()
    if (!trimmed) return
    dispatch({ type: 'ADD_TAG', noteId, tag: trimmed })
    setInputValue('')
    setIsAdding(false)
    setShowSuggestions(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Escape') {
      setIsAdding(false)
      setInputValue('')
      setShowSuggestions(false)
    }
  }

  return (
    <div className="tag-input-container">
      {tags.map((tag) => (
        <span
          key={tag}
          className="tag-pill"
          onClick={() => dispatch({ type: 'SET_TAG_FILTER', tag })}
          title={`Filter by #${tag}`}
          style={{ cursor: 'pointer' }}
        >
          {tag}
          <button
            className="tag-remove-btn"
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REMOVE_TAG', noteId, tag }) }}
            title={`Remove tag "${tag}"`}
          >
            <CloseIcon />
          </button>
        </span>
      ))}
      {isAdding ? (
        <span className="tag-input-wrapper">
          <input
            ref={inputRef}
            className="tag-input"
            aria-label="Add tag"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setShowSuggestions(true)
            }}
            maxLength={50}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (blurTimerRef.current) clearTimeout(blurTimerRef.current)
              blurTimerRef.current = setTimeout(() => {
                setIsAdding(false)
                setInputValue('')
                setShowSuggestions(false)
              }, 150)
            }}
            placeholder="Add tag..."
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="tag-suggestions">
              {suggestions.slice(0, 6).map((s) => (
                <div
                  key={s}
                  className="tag-suggestion-item"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    addTag(s)
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </span>
      ) : (
        <button
          className="tag-add-btn"
          onClick={() => setIsAdding(true)}
          title="Add tag"
        >
          +
        </button>
      )}
    </div>
  )
}
