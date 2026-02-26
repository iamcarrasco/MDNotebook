'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { useToast } from '@/components/Toast'
import {
  filterTree, sortTree, hasChildren, isDescendant, buildSearchIndex, collectAllTags, findItem,
} from '@/lib/tree-utils'
import SidebarItem from '@/components/SidebarItem'
import ResizeHandle from '@/components/ResizeHandle'
import ConfirmModal from '@/components/ConfirmModal'
import PanelErrorBoundary from '@/components/PanelErrorBoundary'
import {
  SortIcon, TrashIcon, RestoreIcon, CloseIcon,
} from '@/components/Icons'
import type { TreeItem, SortBy } from '@/lib/types'

// ── Tag filter helper ──

function filterTreeByTag(items: TreeItem[], tags: string[], mode: 'and' | 'or'): TreeItem[] {
  return items.reduce<TreeItem[]>((acc, item) => {
    if (item.type === 'note') {
      const noteTags = item.tags || []
      const match = mode === 'or'
        ? tags.some(t => noteTags.includes(t))
        : tags.every(t => noteTags.includes(t))
      if (match) acc.push(item)
    } else if (item.type === 'folder') {
      const filtered = item.children ? filterTreeByTag(item.children, tags, mode) : []
      if (filtered.length > 0) {
        acc.push({ ...item, children: filtered, expanded: true })
      }
    }
    return acc
  }, [])
}

// ── Component ──

export default function SidebarPanel() {
  const state = useNotebook()
  const dispatch = useNotebookDispatch()
  const { showToast } = useToast()
  const sidebarTreeRef = useRef<HTMLDivElement>(null)
  const dropIndicatorRef = useRef<{ targetId: string; position: 'before' | 'after' | 'inside' } | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{ targetId: string; position: 'before' | 'after' | 'inside' } | null>(null)
  const pointerYRef = useRef(0)
  const pointerListenerRef = useRef<((e: PointerEvent) => void) | null>(null)
  const [showTagPanel, setShowTagPanel] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [dialog, setDialog] = useState<{
    title: string
    message: string
    confirmLabel: string
    cancelLabel?: string
    onConfirm: () => void
    onCancelAction?: () => void
    showCancel?: boolean
    danger?: boolean
  } | null>(null)

  const {
    tree, trash, searchQuery, sidebarWidth,
    sortBy, sortDirection, tagFilter, tagFilterMode,
  } = state

  // All unique tags
  const allTags = useMemo(() => collectAllTags(tree), [tree])

  // Pre-lowercased search index
  const searchIndex = useMemo(() => buildSearchIndex(tree), [tree])

  const notesDndEnabled = useMemo(
    () => !searchQuery.trim() && tagFilter.length === 0 && sortBy === 'manual',
    [searchQuery, tagFilter, sortBy]
  )

  // Filtered & sorted tree for display
  const displayTree = useMemo(() => {
    let result = tree
    if (searchQuery) result = filterTree(result, searchQuery, searchIndex)
    if (tagFilter.length > 0) {
      result = filterTreeByTag(result, tagFilter, tagFilterMode)
    }
    if (sortBy !== 'manual') {
      result = sortTree(result, sortBy, sortDirection)
    }
    return result
  }, [tree, searchQuery, searchIndex, tagFilter, tagFilterMode, sortBy, sortDirection])

  // Collect all item IDs for DnD sortable context
  const sortableIds = useMemo(() => {
    const collectIds = (items: TreeItem[]): string[] => {
      const ids: string[] = []
      for (const item of items) {
        ids.push(item.id)
        if (item.children) ids.push(...collectIds(item.children))
      }
      return ids
    }
    return collectIds(displayTree)
  }, [displayTree])

  // Sort label for display
  const sortLabel = useMemo(() => {
    if (sortBy === 'manual') return 'Manual order'
    if (sortBy === 'name') return sortDirection === 'asc' ? 'File name (A-Z)' : 'File name (Z-A)'
    if (sortBy === 'modified') return sortDirection === 'desc' ? 'Modified (new)' : 'Modified (old)'
    return sortDirection === 'desc' ? 'Created (new)' : 'Created (old)'
  }, [sortBy, sortDirection])

  // Drag & drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Keyboard navigation for sidebar tree
  useEffect(() => {
    const container = sidebarTreeRef.current
    if (!container) return

    const handler = (e: KeyboardEvent) => {
      const rows = Array.from(container.querySelectorAll<HTMLElement>('.sidebar-item-row'))
      if (rows.length === 0) return

      const focusedIdx = rows.findIndex(r => r === document.activeElement || r.contains(document.activeElement as Node))

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = focusedIdx < rows.length - 1 ? focusedIdx + 1 : 0
        rows[next].focus()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = focusedIdx > 0 ? focusedIdx - 1 : rows.length - 1
        rows[prev].focus()
      } else if (e.key === 'Enter') {
        if (focusedIdx >= 0) rows[focusedIdx].click()
      } else if (e.key === 'ArrowRight') {
        if (focusedIdx >= 0) {
          const chevron = rows[focusedIdx].querySelector('.folder-chevron:not(.expanded)')
          if (chevron) (chevron.closest('.sidebar-item-row') as HTMLElement | null)?.click()
        }
      } else if (e.key === 'ArrowLeft') {
        if (focusedIdx >= 0) {
          const chevron = rows[focusedIdx].querySelector('.folder-chevron.expanded')
          if (chevron) (chevron.closest('.sidebar-item-row') as HTMLElement | null)?.click()
        }
      }
    }

    container.addEventListener('keydown', handler)
    return () => container.removeEventListener('keydown', handler)
  }, [])

  // Cleanup pointer tracking on unmount
  useEffect(() => {
    return () => {
      if (pointerListenerRef.current) {
        window.removeEventListener('pointermove', pointerListenerRef.current)
      }
    }
  }, [])

  const stopPointerTracking = useCallback(() => {
    if (pointerListenerRef.current) {
      window.removeEventListener('pointermove', pointerListenerRef.current)
      pointerListenerRef.current = null
    }
  }, [])

  const getDropPosition = useCallback((rect: { top: number; height: number }, isFolder: boolean): 'before' | 'after' | 'inside' => {
    const relativeY = pointerYRef.current - rect.top
    const ratio = rect.height > 0 ? relativeY / rect.height : 0.5
    if (isFolder) {
      if (ratio < 0.2) return 'before'
      if (ratio > 0.8) return 'after'
      return 'inside'
    }
    return ratio < 0.5 ? 'before' : 'after'
  }, [])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (!notesDndEnabled) return
    const activator = event.activatorEvent as PointerEvent
    pointerYRef.current = activator.clientY
    const handler = (e: PointerEvent) => { pointerYRef.current = e.clientY }
    pointerListenerRef.current = handler
    window.addEventListener('pointermove', handler)
  }, [notesDndEnabled])

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    if (!notesDndEnabled) return
    const { over } = event
    if (!over) {
      if (dropIndicatorRef.current !== null) {
        dropIndicatorRef.current = null
        setDropIndicator(null)
      }
      return
    }
    const isFolder = (over.data?.current as { type?: string })?.type === 'folder'
    const position = getDropPosition(over.rect, isFolder)
    const prev = dropIndicatorRef.current
    if (!prev || prev.targetId !== String(over.id) || prev.position !== position) {
      const indicator = { targetId: String(over.id), position }
      dropIndicatorRef.current = indicator
      setDropIndicator(indicator)
    }
  }, [getDropPosition, notesDndEnabled])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (!notesDndEnabled) return
    stopPointerTracking()
    const { active, over } = event
    const finalIndicator = dropIndicatorRef.current
    setDropIndicator(null)
    dropIndicatorRef.current = null
    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)
    if (isDescendant(tree, activeId, overId)) return

    const position = finalIndicator?.targetId === overId
      ? finalIndicator.position
      : getDropPosition(over.rect, (over.data?.current as { type?: string })?.type === 'folder')
    dispatch({ type: 'MOVE_ITEM', itemId: activeId, targetId: overId, position })
  }, [tree, dispatch, stopPointerTracking, notesDndEnabled, getDropPosition])

  const handleDragCancel = useCallback(() => {
    if (!notesDndEnabled) return
    stopPointerTracking()
    dropIndicatorRef.current = null
    setDropIndicator(null)
  }, [stopPointerTracking, notesDndEnabled])

  // If sorting/filtering disables DnD, clear transient drag state
  useEffect(() => {
    if (notesDndEnabled) return
    stopPointerTracking()
    dropIndicatorRef.current = null
    setDropIndicator(null)
  }, [notesDndEnabled, stopPointerTracking])

  const handleDelete = useCallback((id: string) => {
    const item = findItem(tree, id)
    dispatch({ type: 'MOVE_TO_TRASH', id })
    showToast(`Moved "${item?.name || 'item'}" to trash`, {
      action: {
        label: 'Undo',
        onClick: () => dispatch({ type: 'RESTORE_FROM_TRASH', id }),
      },
    })
  }, [tree, dispatch, showToast])

  const handleSortSelect = useCallback((newSortBy: SortBy, direction: 'asc' | 'desc') => {
    dispatch({ type: 'SET_SORT', sortBy: newSortBy, direction })
    setShowSortMenu(false)
  }, [dispatch])

  // Close sort menu on outside click
  useEffect(() => {
    if (!showSortMenu) return
    const close = () => setShowSortMenu(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showSortMenu])

  return (
    <PanelErrorBoundary panelName="Sidebar">
      <div className="sidebar-backdrop" onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })} />
      <aside className="sidebar" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
        <div className="sidebar-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
          MDNotebook
        </div>

        {/* Sort & filter controls */}
        <div className="sidebar-controls">
          <div className="sort-dropdown-wrapper">
            <button className="sidebar-control-btn" onClick={(e) => { e.stopPropagation(); setShowSortMenu(!showSortMenu) }} title={`Sort: ${sortLabel}`}>
              <SortIcon />
              <span className="sidebar-control-label">{sortLabel}</span>
            </button>
            {showSortMenu && (
              <div className="sort-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                <div className={`sort-dropdown-item${sortBy === 'manual' ? ' active' : ''}`} onClick={() => handleSortSelect('manual', 'asc')}>
                  Manual order{sortBy === 'manual' && <span className="sort-check">&#10003;</span>}
                </div>
                <div className="sort-dropdown-divider" />
                <div className={`sort-dropdown-item${sortBy === 'name' && sortDirection === 'asc' ? ' active' : ''}`} onClick={() => handleSortSelect('name', 'asc')}>
                  File name (A-Z){sortBy === 'name' && sortDirection === 'asc' && <span className="sort-check">&#10003;</span>}
                </div>
                <div className={`sort-dropdown-item${sortBy === 'name' && sortDirection === 'desc' ? ' active' : ''}`} onClick={() => handleSortSelect('name', 'desc')}>
                  File name (Z to A){sortBy === 'name' && sortDirection === 'desc' && <span className="sort-check">&#10003;</span>}
                </div>
                <div className="sort-dropdown-divider" />
                <div className={`sort-dropdown-item${sortBy === 'modified' && sortDirection === 'desc' ? ' active' : ''}`} onClick={() => handleSortSelect('modified', 'desc')}>
                  Modified time (new to old){sortBy === 'modified' && sortDirection === 'desc' && <span className="sort-check">&#10003;</span>}
                </div>
                <div className={`sort-dropdown-item${sortBy === 'modified' && sortDirection === 'asc' ? ' active' : ''}`} onClick={() => handleSortSelect('modified', 'asc')}>
                  Modified time (old to new){sortBy === 'modified' && sortDirection === 'asc' && <span className="sort-check">&#10003;</span>}
                </div>
                <div className="sort-dropdown-divider" />
                <div className={`sort-dropdown-item${sortBy === 'created' && sortDirection === 'desc' ? ' active' : ''}`} onClick={() => handleSortSelect('created', 'desc')}>
                  Created time (new to old){sortBy === 'created' && sortDirection === 'desc' && <span className="sort-check">&#10003;</span>}
                </div>
                <div className={`sort-dropdown-item${sortBy === 'created' && sortDirection === 'asc' ? ' active' : ''}`} onClick={() => handleSortSelect('created', 'asc')}>
                  Created time (old to new){sortBy === 'created' && sortDirection === 'asc' && <span className="sort-check">&#10003;</span>}
                </div>
              </div>
            )}
          </div>
          {tagFilter.length > 0 && (
            <>
              {tagFilter.map(tag => (
                <button
                  key={tag}
                  className="sidebar-control-btn tag-filter-active"
                  onClick={() => dispatch({ type: 'SET_TAG_FILTER', tag })}
                  title={`Remove #${tag} filter`}
                >
                  #{tag} <CloseIcon />
                </button>
              ))}
              {tagFilter.length > 1 && (
                <button
                  className="sidebar-control-btn"
                  onClick={() => dispatch({ type: 'SET_TAG_FILTER_MODE', mode: tagFilterMode === 'or' ? 'and' : 'or' })}
                  title={`Mode: ${tagFilterMode.toUpperCase()} — click to toggle`}
                >
                  {tagFilterMode.toUpperCase()}
                </button>
              )}
              <button
                className="sidebar-control-btn"
                onClick={() => dispatch({ type: 'SET_TAG_FILTER', tag: null })}
                title="Clear all tag filters"
              >
                Clear
              </button>
            </>
          )}
        </div>

        {/* Collapsible tag filter panel */}
        {allTags.length > 0 && (
          <div className="tag-panel">
            <button className="tag-panel-toggle" onClick={() => setShowTagPanel(!showTagPanel)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                <path d="M1 3h5l8 8-5 5-8-8V3z" /><circle cx="4.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              Tags ({allTags.length})
              <svg className={`tag-panel-chevron${showTagPanel ? ' expanded' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 6l3 3 3-3" /></svg>
            </button>
            {showTagPanel && (
              <div className="tag-panel-list">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    className={`tag-panel-item${tagFilter.includes(tag) ? ' active' : ''}`}
                    onClick={() => dispatch({ type: 'SET_TAG_FILTER', tag })}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!notesDndEnabled && sortBy !== 'manual' && !searchQuery.trim() && tagFilter.length === 0 && (
          <div className="sidebar-dnd-hint" onClick={() => handleSortSelect('manual', 'asc')}>
            Switch to manual order to drag &amp; reorder notes
          </div>
        )}
        <div className="sidebar-tree" ref={sidebarTreeRef} tabIndex={0}>
          {notesDndEnabled ? (
            <DndContext id="sidebar-dnd" sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                {displayTree.map((item) => (
                  <SidebarItem
                    key={item.id}
                    item={item}
                    depth={0}
                    searchQuery={searchQuery}
                    dropIndicator={dropIndicator}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <>
              {displayTree.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  depth={0}
                  searchQuery={searchQuery}
                  dndDisabled
                />
              ))}
            </>
          )}
          {displayTree.length === 0 && searchQuery && (
            <div className="sidebar-empty">No matching notes</div>
          )}
        </div>

        {/* Trash section */}
        {trash.length > 0 && (
          <div className="trash-section">
            <div className="trash-header">
              <TrashIcon />
              <span>Trash ({trash.length})</span>
              <button
                className="trash-empty-btn"
                onClick={() => {
                  setDialog({
                    title: 'Empty Trash',
                    message: 'Permanently delete all items in trash? This cannot be undone.',
                    confirmLabel: 'Delete All',
                    onConfirm: () => { dispatch({ type: 'EMPTY_TRASH' }); setDialog(null) },
                    danger: true,
                  })
                }}
                title="Empty Trash"
              >
                Empty
              </button>
            </div>
            <div className="trash-items">
              {trash.map((item) => (
                <div key={item.id} className="trash-item">
                  <span className="trash-item-name">{item.name}</span>
                  <div className="trash-item-actions">
                    <button
                      className="trash-action-btn"
                      onClick={() => dispatch({ type: 'RESTORE_FROM_TRASH', id: item.id })}
                      title="Restore"
                    >
                      <RestoreIcon />
                    </button>
                    <button
                      className="trash-action-btn danger"
                      onClick={() => dispatch({ type: 'DELETE_PERMANENTLY', id: item.id })}
                      title="Delete Permanently"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>
      <ResizeHandle />

      {/* Sidebar-specific dialogs */}
      {dialog && (
        <ConfirmModal
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={dialog.cancelLabel}
          onConfirm={dialog.onConfirm}
          onCancel={() => setDialog(null)}
          onCancelAction={dialog.onCancelAction}
          showCancel={dialog.showCancel}
          danger={dialog.danger}
        />
      )}
    </PanelErrorBoundary>
  )
}
