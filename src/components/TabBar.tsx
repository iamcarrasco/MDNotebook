'use client'

import { memo, useRef, useEffect, useState, useCallback } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import { useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { findNote } from '@/lib/tree-utils'
import { CloseIcon } from './Icons'

const SortableTab = memo(function SortableTab({ tabId, isActive }: { tabId: string; isActive: boolean }) {
  const { tree } = useNotebook()
  const dispatch = useNotebookDispatch()
  const note = findNote(tree, tabId)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tabId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  }

  if (!note) return null

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ scale: 1, opacity: isDragging ? 0.5 : 1 }}
      exit={{ opacity: 0, scale: 0.9, width: 0 }}
      transition={{ duration: 0.2 }}
      className={`tab-item${isActive ? ' active' : ''}`}
      style={style}
      onClick={() => dispatch({ type: 'SET_ACTIVE', id: tabId })}
      title={note.name}
      {...attributes}
      {...listeners}
      role="tab"
      aria-selected={isActive}
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
    </motion.div>
  )
})

export default function TabBar() {
  const { openTabs, activeId } = useNotebook()
  const dispatch = useNotebookDispatch()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

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

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = openTabs.indexOf(String(active.id))
    const toIndex = openTabs.indexOf(String(over.id))
    if (fromIndex !== -1 && toIndex !== -1) {
      dispatch({ type: 'REORDER_TABS', fromIndex, toIndex })
    }
  }, [openTabs, dispatch])

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
        <DndContext id="tab-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={openTabs} strategy={horizontalListSortingStrategy}>
            {openTabs.map((tabId) => (
              <SortableTab key={tabId} tabId={tabId} isActive={tabId === activeId} />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      {canScrollRight && (
        <button className="tab-scroll-btn right" onClick={() => scroll(1)} aria-label="Scroll tabs right">
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3l5 5-5 5" /></svg>
        </button>
      )}
    </div>
  )
}
