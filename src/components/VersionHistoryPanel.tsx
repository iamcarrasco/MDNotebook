'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { HistoryIcon } from './Icons'

interface VersionHistoryPanelProps {
  noteId: string
}

export default function VersionHistoryPanel({ noteId }: VersionHistoryPanelProps) {
  const { noteVersions } = useNotebook()
  const dispatch = useNotebookDispatch()
  const [expanded, setExpanded] = useState(false)
  const [previewTs, setPreviewTs] = useState<number | null>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const versions = noteVersions[noteId] || []

  // Calculate dropdown position from toggle button rect
  const updatePosition = useCallback(() => {
    if (!toggleRef.current) return
    const rect = toggleRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - 300),
    })
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!expanded) return
    updatePosition()
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        toggleRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return
      setExpanded(false)
      setPreviewTs(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [expanded, updatePosition])

  const handleSaveSnapshot = () => {
    dispatch({ type: 'SAVE_SNAPSHOT', noteId })
  }

  const handleRestore = (ts: number) => {
    dispatch({ type: 'RESTORE_VERSION', noteId, ts })
    setPreviewTs(null)
    setExpanded(false)
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (isToday) return `Today ${time}`
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`
  }

  const handleToggle = () => {
    if (!expanded) updatePosition()
    setExpanded(!expanded)
    setPreviewTs(null)
  }

  return (
    <div className="version-history-panel">
      <button
        ref={toggleRef}
        className="version-history-toggle"
        onClick={handleToggle}
        title="Version history"
      >
        <HistoryIcon />
        <span>History ({versions.length})</span>
      </button>
      {expanded && createPortal(
        <div
          ref={dropdownRef}
          className="version-history-content"
          style={{ top: pos.top, left: pos.left }}
        >
          <button className="version-snapshot-btn" onClick={handleSaveSnapshot}>
            Save Snapshot
          </button>
          {versions.length === 0 ? (
            <div className="version-empty">No versions saved yet</div>
          ) : (
            <div className="version-list">
              {[...versions].reverse().map(v => (
                <div key={v.ts} className="version-item">
                  <div className="version-item-header">
                    <span className="version-time">{formatTime(v.ts)}</span>
                    <div className="version-actions">
                      <button
                        className="version-action-btn"
                        onClick={() => setPreviewTs(previewTs === v.ts ? null : v.ts)}
                      >
                        {previewTs === v.ts ? 'Hide' : 'Preview'}
                      </button>
                      <button
                        className="version-action-btn version-restore-btn"
                        onClick={() => handleRestore(v.ts)}
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                  {previewTs === v.ts && (
                    <pre className="version-preview">{v.content.slice(0, 500)}{v.content.length > 500 ? '...' : ''}</pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
