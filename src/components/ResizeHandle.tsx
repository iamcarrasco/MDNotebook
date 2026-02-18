'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useNotebookDispatch } from '@/lib/notebook-context'

export default function ResizeHandle() {
  const dispatch = useNotebookDispatch()
  const isDragging = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  const handleResize = useCallback((clientX: number) => {
    const width = Math.max(180, Math.min(500, clientX))
    dispatch({ type: 'SET_SIDEBAR_WIDTH', width })
  }, [dispatch])

  const cleanup = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
  }, [])

  // Clean up any active drag listeners on unmount
  useEffect(() => {
    return () => { cleanup() }
  }, [cleanup])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      handleResize(ev.clientX)
    }

    const handleMouseUp = () => {
      cleanup()
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    cleanupRef.current = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleResize, cleanup])

  const handleTouchStart = useCallback(() => {
    isDragging.current = true
    document.body.style.userSelect = 'none'

    const handleTouchMove = (ev: TouchEvent) => {
      if (!isDragging.current) return
      const touch = ev.touches[0]
      if (touch) handleResize(touch.clientX)
    }

    const handleTouchEnd = () => {
      cleanup()
    }

    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)

    cleanupRef.current = () => {
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleResize, cleanup])

  return (
    <div
      className="resize-handle"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    />
  )
}
