'use client'

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { CloseIcon } from './Icons'

/* ── Types ── */

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastOptions {
  action?: ToastAction
  duration?: number
}

interface ToastItem {
  id: string
  title: string
  action?: ToastAction
  duration: number
  createdAt: number
}

interface ToastContextValue {
  showToast: (title: string, options?: ToastOptions) => void
}

/* ── Context ── */

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}

/* ── Individual Toast ── */

interface ToastEntryProps {
  toast: ToastItem
  onDismiss: (id: string) => void
}

function ToastEntry({ toast, onDismiss }: ToastEntryProps) {
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    setExiting(true)
    setTimeout(() => onDismiss(toast.id), 200)
  }, [onDismiss, toast.id])

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, toast.duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [dismiss, toast.duration])

  const handleAction = () => {
    if (toast.action) {
      toast.action.onClick()
    }
    dismiss()
  }

  return (
    <div
      className={`toast${exiting ? ' toast-exit' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="toast-title">{toast.title}</span>
      <div className="toast-actions">
        {toast.action && (
          <button
            className="toast-action-btn"
            onClick={handleAction}
          >
            {toast.action.label}
          </button>
        )}
        <button
          className="toast-dismiss-btn"
          onClick={dismiss}
          aria-label="Dismiss notification"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}

/* ── Provider ── */

let idCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((title: string, options?: ToastOptions) => {
    const id = `toast-${++idCounter}-${Date.now()}`
    const newToast: ToastItem = {
      id,
      title,
      action: options?.action,
      duration: options?.duration ?? 4000,
      createdAt: Date.now(),
    }
    setToasts((prev) => [...prev, newToast])
  }, [])

  const handleDismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" aria-label="Notifications">
        {toasts.map((toast) => (
          <ToastEntry
            key={toast.id}
            toast={toast}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
