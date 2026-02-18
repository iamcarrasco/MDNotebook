'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('MDNotebook error:', error)
  }, [error])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '2rem',
      textAlign: 'center',
      background: '#1a1a2e',
      color: '#e0e0e0',
    }}>
      <div style={{
        background: '#16213e',
        borderRadius: 12,
        padding: '2.5rem',
        maxWidth: 480,
        width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.5rem', color: '#fff' }}>
          Something went wrong
        </h2>
        <p style={{ margin: '0 0 1.5rem', color: '#aaa', fontSize: '0.95rem', lineHeight: 1.5 }}>
          An unexpected error occurred. Your notes are safe on disk. Try reloading or restarting the app.
        </p>
        <p style={{ margin: '0 0 1.5rem', color: '#888', fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-word' }}>
          {error.message}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              padding: '0.6rem 1.5rem',
              borderRadius: 6,
              border: 'none',
              background: '#42B0D5',
              color: '#fff',
              fontSize: '0.95rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.6rem 1.5rem',
              borderRadius: 6,
              border: '1px solid #444',
              background: 'transparent',
              color: '#ccc',
              fontSize: '0.95rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Reload App
          </button>
        </div>
      </div>
    </div>
  )
}
