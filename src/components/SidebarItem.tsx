'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { motion, AnimatePresence } from 'framer-motion'
import { useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { FileIcon, FolderIcon, ChevronIcon, PinIcon } from './Icons'
import { getContentSnippet } from '@/lib/tree-utils'
import type { TreeItem } from '@/lib/types'

interface DropIndicator {
  targetId: string
  position: 'before' | 'after' | 'inside'
}

interface SidebarItemProps {
  item: TreeItem
  depth: number
  searchQuery?: string
  dropIndicator?: DropIndicator | null
  dndDisabled?: boolean
}

function highlightMatch(text: string, query: string) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function SidebarItem({ item, depth, searchQuery, dropIndicator, dndDisabled = false }: SidebarItemProps) {
  const { activeId, renamingId, renameValue } = useNotebook()
  const dispatch = useNotebookDispatch()
  const renameRef = useRef<HTMLInputElement>(null)
  const isRenaming = renamingId === item.id

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { type: item.type, item },
    disabled: dndDisabled,
  })

  const style = {
    paddingLeft: 12 + depth * 16,
    opacity: isDragging ? 0.5 : 1,
  }

  useEffect(() => {
    if (isRenaming && renameRef.current) {
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [isRenaming])

  const handleClick = () => {
    if (item.type === 'folder') {
      dispatch({ type: 'TOGGLE_FOLDER', id: item.id })
      dispatch({ type: 'SELECT_FOLDER', id: item.id })
    } else {
      dispatch({ type: 'SET_ACTIVE', id: item.id })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      dispatch({ type: 'CONFIRM_RENAME' })
    } else if (e.key === 'Escape') {
      dispatch({ type: 'CANCEL_RENAME' })
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dispatch({
      type: 'SET_CONTEXT_MENU',
      menu: { x: e.clientX, y: e.clientY, itemId: item.id, itemType: item.type },
    })
  }

  const isActive = item.type === 'note' && activeId === item.id

  // Drop indicator classes
  const isDropTarget = dropIndicator?.targetId === item.id
  const dropClass = isDropTarget
    ? dropIndicator.position === 'before'
      ? ' dnd-drop-indicator-before'
      : dropIndicator.position === 'after'
        ? ' dnd-drop-indicator-after'
        : ' dnd-drop-target'
    : ''

  const rowRef = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node)
    if (node && isActive) {
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [setNodeRef, isActive])

  return (
    <>
      <div
        ref={rowRef}
        className={`sidebar-item-row${isActive ? ' active' : ''}${dropClass}`}
        style={style}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        {...attributes}
        {...listeners}
        role="treeitem"
        aria-selected={isActive}
        aria-label={item.name}
        tabIndex={0}
      >
        {item.type === 'folder' && <ChevronIcon expanded={!!item.expanded} />}
        {item.type === 'folder' ? <FolderIcon /> : <FileIcon />}
        {isRenaming ? (
          <input
            ref={renameRef}
            className="sidebar-rename-input"
            aria-label="Rename item"
            value={renameValue}
            onChange={(e) => dispatch({ type: 'SET_RENAME_VALUE', value: e.target.value })}
            onKeyDown={handleKeyDown}
            onBlur={() => dispatch({ type: 'CONFIRM_RENAME' })}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="sidebar-item-name" title={item.name}>
            {searchQuery ? highlightMatch(item.name, searchQuery) : item.name}
          </span>
        )}
        {item.pinned && (
          <span className="sidebar-pin-indicator" title="Pinned">
            <PinIcon />
          </span>
        )}
        {item.tags && item.tags.length > 0 && (
          <span className="sidebar-tag-count" title={item.tags.join(', ')}>
            {item.tags.length}
          </span>
        )}
      </div>
      {searchQuery && item.type === 'note' && item.content && (() => {
        const snippet = getContentSnippet(item.content, searchQuery)
        if (!snippet || item.name.toLowerCase().includes(searchQuery.toLowerCase())) return null
        return <div className="sidebar-content-snippet" style={{ paddingLeft: 12 + depth * 16 + 28 }}>{snippet}</div>
      })()}
      <AnimatePresence initial={false}>
        {item.type === 'folder' && item.expanded && item.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {item.children.map((child) => (
              <SidebarItem
                key={child.id}
                item={child}
                depth={depth + 1}
                searchQuery={searchQuery}
                dropIndicator={dropIndicator}
                dndDisabled={dndDisabled}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
