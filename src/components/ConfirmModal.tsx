'use client'

import { useEffect, useRef } from 'react'
import { CloseIcon } from './Icons'

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  onCancelAction?: () => void
  showCancel?: boolean
  danger?: boolean
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  onCancelAction,
  showCancel = true,
  danger = false,
}: ConfirmModalProps) {
  const focusRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    focusRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <div className="modal-overlay" onClick={onCancel} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close-btn" onClick={onCancel} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="confirm-modal-body">
          <p>{message}</p>
        </div>
        <div className="confirm-modal-actions">
          {showCancel && (
            <button
              ref={danger ? focusRef : undefined}
              className="confirm-modal-cancel"
              onClick={onCancelAction || onCancel}
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={danger ? undefined : focusRef}
            className={danger ? 'auth-btn confirm-modal-danger' : 'auth-btn'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
