'use client'

import { useMemo } from 'react'
import { useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { findParentPath, findNote } from '@/lib/tree-utils'

export default function Breadcrumbs() {
  const { tree, activeId } = useNotebook()
  const dispatch = useNotebookDispatch()

  const path = useMemo(() => {
    const parents = findParentPath(tree, activeId) || []
    const note = findNote(tree, activeId)
    return [...parents, ...(note ? [note] : [])]
  }, [tree, activeId])

  if (path.length === 0) return null

  return (
    <div className="breadcrumbs">
      <span
        className="breadcrumb-item breadcrumb-root"
        onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
      >
        MDNotebook
      </span>
      {path.map((item, i) => (
        <span key={item.id}>
          <span className="breadcrumb-sep">/</span>
          <span
            className={`breadcrumb-item${i === path.length - 1 ? ' breadcrumb-current' : ''}`}
            title={item.name}
            onClick={() => {
              if (item.type === 'folder') {
                dispatch({ type: 'TOGGLE_FOLDER', id: item.id })
              } else {
                dispatch({ type: 'SET_ACTIVE', id: item.id })
              }
            }}
          >
            {item.name}
          </span>
        </span>
      ))}
    </div>
  )
}
