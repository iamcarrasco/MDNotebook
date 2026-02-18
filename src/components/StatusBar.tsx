'use client'

import { useMemo } from 'react'

interface StatusBarProps {
  content: string
  createdAt?: number
  updatedAt?: number
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time}`
}

export default function StatusBar({ content, createdAt, updatedAt }: StatusBarProps) {
  const stats = useMemo(() => {
    const text = content
      .replace(/^---[\s\S]*?---\n?/, '') // strip frontmatter
      .replace(/[#*_~`>\[\]!|()-]/g, '') // strip markdown syntax
      .trim()

    if (!text) return { words: 0, chars: 0, readTime: 0 }

    const words = text.split(/\s+/).filter(Boolean).length
    const chars = text.length
    const readTime = Math.max(1, Math.ceil(words / 200))

    return { words, chars, readTime }
  }, [content])

  return (
    <div className="status-bar">
      <span>{stats.words.toLocaleString()} words</span>
      <span className="status-bar-sep">&middot;</span>
      <span>{stats.chars.toLocaleString()} characters</span>
      <span className="status-bar-sep">&middot;</span>
      <span>~{stats.readTime} min read</span>
      {createdAt && (
        <>
          <span className="status-bar-sep">&middot;</span>
          <span className="status-bar-date">Created {formatTimestamp(createdAt)}</span>
        </>
      )}
      {updatedAt && updatedAt !== createdAt && (
        <>
          <span className="status-bar-sep">&middot;</span>
          <span className="status-bar-date">Modified {formatTimestamp(updatedAt)}</span>
        </>
      )}
    </div>
  )
}
