'use client'

import { useCallback, useRef } from 'react'
import { useNotebookDispatch } from '@/lib/notebook-context'

export default function ResizeHandle() {
  const dispatch = useNotebookDispatch()
  const isDragging = useRef(false)

  const handleResize = useCallback((clientX: number) => {
    const width = Math.max(180, Math.min(500, clientX))
    dispatch({ type: 'SET_SIDEBAR_WIDTH', width })
  }, [dispatch])

  const handleEnd = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

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
      handleEnd()
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [handleResize, handleEnd])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true
    document.body.style.userSelect = 'none'

    const handleTouchMove = (ev: TouchEvent) => {
      if (!isDragging.current) return
      const touch = ev.touches[0]
      if (touch) handleResize(touch.clientX)
    }

    const handleTouchEnd = () => {
      handleEnd()
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }

    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)
  }, [handleResize, handleEnd])

  return (
    <div
      className="resize-handle"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    />
  )
}
