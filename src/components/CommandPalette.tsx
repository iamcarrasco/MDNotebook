'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'

interface CommandAction {
  id: string
  label: string
  shortcut?: string
  section?: string
  icon?: React.ReactNode
  action: () => void
}

interface CommandPaletteProps {
  visible: boolean
  onClose: () => void
  actions: CommandAction[]
}

export default function CommandPalette({
  visible,
  onClose,
  actions,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter actions by query (case-insensitive match on label)
  const filteredActions = useMemo(() => {
    if (!query.trim()) return actions
    const lower = query.toLowerCase()
    return actions.filter((a) => a.label.toLowerCase().includes(lower))
  }, [actions, query])

  // Group filtered actions by section, preserving order
  const groupedActions = useMemo(() => {
    const groups: { section: string; items: CommandAction[] }[] = []
    const sectionMap = new Map<string, CommandAction[]>()

    for (const action of filteredActions) {
      const section = action.section || ''
      if (!sectionMap.has(section)) {
        const items: CommandAction[] = []
        sectionMap.set(section, items)
        groups.push({ section, items })
      }
      sectionMap.get(section)!.push(action)
    }

    return groups
  }, [filteredActions])

  // Build a flat list for keyboard navigation indexing
  const flatItems = useMemo(() => {
    return groupedActions.flatMap((g) => g.items)
  }, [groupedActions])

  // Reset state when palette opens
  useEffect(() => {
    if (visible) {
      setQuery('')
      setSelectedIndex(0)
      requestAnimationFrame(() => {
        searchInputRef.current?.focus()
      })
    }
  }, [visible])

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selectedEl = listRef.current.querySelector(
      '[data-selected="true"]'
    ) as HTMLElement | null
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const executeAction = useCallback(
    (action: CommandAction) => {
      onClose()
      // Execute after close to avoid UI flicker
      requestAnimationFrame(() => {
        action.action()
      })
    },
    [onClose]
  )

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < flatItems.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : flatItems.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (flatItems[selectedIndex]) {
          executeAction(flatItems[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Global Escape handler (in case focus is outside the dialog)
  useEffect(() => {
    if (!visible) return

    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleGlobalKey)
    return () => document.removeEventListener('keydown', handleGlobalKey)
  }, [visible, onClose])

  if (!visible) return null

  // Track a running flat index to map grouped rendering to flat selectedIndex
  let flatIndex = 0

  return (
    <div
      className="command-palette-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="command-palette" onKeyDown={handleKeyDown}>
        <div className="command-palette-search">
          <input
            ref={searchInputRef}
            className="command-palette-input"
            type="text"
            placeholder="Type a command..."
            aria-label="Search commands"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="command-palette-list" ref={listRef} role="listbox">
          {flatItems.length === 0 ? (
            <div className="command-palette-empty">No matching commands</div>
          ) : (
            groupedActions.map((group) => {
              const sectionElements = []

              if (group.section) {
                sectionElements.push(
                  <div
                    key={`section-${group.section}`}
                    className="command-palette-section"
                    role="presentation"
                  >
                    {group.section}
                  </div>
                )
              }

              for (const item of group.items) {
                const idx = flatIndex
                const isSelected = idx === selectedIndex
                flatIndex++

                sectionElements.push(
                  <div
                    key={item.id}
                    className={`command-palette-item${isSelected ? ' selected' : ''}`}
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected ? 'true' : undefined}
                    onClick={() => executeAction(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className="command-palette-item-label">
                      {item.icon && (
                        <span className="command-palette-item-icon">{item.icon}</span>
                      )}
                      {item.label}
                    </span>
                    {item.shortcut && (
                      <span className="command-palette-shortcut">{item.shortcut}</span>
                    )}
                  </div>
                )
              }

              return sectionElements
            })
          )}
        </div>
      </div>
    </div>
  )
}
