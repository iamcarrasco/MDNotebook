'use client'

import { useMemo } from 'react'

interface StatusBarProps {
  content: string
}

export default function StatusBar({ content }: StatusBarProps) {
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
    </div>
  )
}
