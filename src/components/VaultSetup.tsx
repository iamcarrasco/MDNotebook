'use client'

import { useState } from 'react'
import { pickVaultFolder } from '@/lib/local-vault'

interface VaultSetupProps {
  onComplete: (folder: string) => void
}

export default function VaultSetup({ onComplete }: VaultSetupProps) {
  const [error, setError] = useState<string | null>(null)

  const handlePick = async () => {
    setError(null)
    try {
      const folder = await pickVaultFolder()
      onComplete(folder)
    } catch {
      // User cancelled or error — only show error for real failures
      setError('Failed to select folder. Please try again.')
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <div className="auth-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
          MDNotebook
        </div>
        <h1 className="auth-title">Choose Your Vault Location</h1>
        <p className="auth-subtitle">
          Select a folder on your computer where your notes will be stored.
          A <code style={{ fontSize: 12 }}>vault.json</code> file will be created there.
        </p>
        {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}
        <button className="auth-btn" style={{ width: '100%' }} onClick={handlePick}>
          Select Folder
        </button>
      </div>
    </div>
  )
}
