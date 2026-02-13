'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { findNote } from '@/lib/tree-utils'
import { CloseIcon } from './Icons'

export default function TabBar() {
  const { openTabs, activeId, tree } = useNotebook()
  const dispatch = useNotebookDispatch()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    updateScrollState()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState)
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState, openTabs])

  if (!openTabs || openTabs.length <= 1) return null

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 120, behavior: 'smooth' })
  }

  return (
    <div className="tab-bar-wrapper" role="tablist" aria-label="Open notes">
      {canScrollLeft && (
        <button className="tab-scroll-btn left" onClick={() => scroll(-1)} aria-label="Scroll tabs left">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3L5 8l5 5" /></svg>
        </button>
      )}
      <div className="tab-bar" ref={scrollRef}>
        {openTabs.map((tabId) => {
          const note = findNote(tree, tabId)
          if (!note) return null
          return (
            <div
              key={tabId}
              role="tab"
              aria-selected={tabId === activeId}
              className={`tab-item${tabId === activeId ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'SET_ACTIVE', id: tabId })}
              title={note.name}
            >
              <span className="tab-name">{note.name}</span>
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  dispatch({ type: 'CLOSE_TAB', id: tabId })
                }}
                title={`Close ${note.name}`}
                aria-label={`Close ${note.name}`}
              >
                <CloseIcon />
              </button>
            </div>
          )
        })}
      </div>
      {canScrollRight && (
        <button className="tab-scroll-btn right" onClick={() => scroll(1)} aria-label="Scroll tabs right">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3l5 5-5 5" /></svg>
        </button>
      )}
    </div>
  )
}
