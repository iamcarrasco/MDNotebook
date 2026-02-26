'use client'

import { useState, useMemo } from 'react'
import { getPassphraseStrength } from '@/lib/crypto'

interface PassphraseScreenProps {
  mode: 'setup' | 'unlock'
  onSubmit: (passphrase: string) => void
  error?: string | null
  loading?: boolean
}

export default function PassphraseScreen({ mode, onSubmit, error, loading }: PassphraseScreenProps) {
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const strength = useMemo(() => getPassphraseStrength(passphrase), [passphrase])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (mode === 'setup') {
      if (passphrase.length < 8) {
        setLocalError('Passphrase must be at least 8 characters.')
        return
      }
      if (passphrase !== confirm) {
        setLocalError('Passphrases do not match.')
        return
      }
    }

    if (!passphrase) {
      setLocalError('Please enter a passphrase.')
      return
    }

    onSubmit(passphrase)
  }

  const displayError = error || localError

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <div className="auth-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
          MDNotebook
        </div>
        <h1 className="auth-title">
          {mode === 'setup' ? 'Create a Passphrase' : 'Unlock Your Vault'}
        </h1>
        <p className="auth-subtitle">
          {mode === 'setup'
            ? 'Choose a passphrase to encrypt your notes. You\u2019ll need this every time you open MDNotebook.'
            : 'Enter your passphrase to decrypt and access your notes.'}
        </p>

        {displayError && <div className="auth-error" style={{ marginBottom: 16 }}>{displayError}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="passphrase">
              Passphrase
            </label>
            <input
              id="passphrase"
              className="auth-input"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={mode === 'setup' ? 'At least 8 characters' : 'Enter your passphrase'}
              autoFocus
              disabled={loading}
            />
            {mode === 'setup' && passphrase.length > 0 && (
              <div className="passphrase-strength">
                <div className="passphrase-strength-track">
                  <div
                    className="passphrase-strength-fill"
                    style={{
                      width: `${(strength.level / 3) * 100}%`,
                      backgroundColor: strength.color,
                    }}
                  />
                </div>
                <span className="passphrase-strength-label" style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          {mode === 'setup' && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="confirm">
                Confirm Passphrase
              </label>
              <input
                id="confirm"
                className="auth-input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter passphrase"
                disabled={loading}
              />
            </div>
          )}

          <button
            className="auth-btn"
            type="submit"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
          >
            {loading
              ? (mode === 'setup' ? 'Creating...' : 'Unlocking...')
              : (mode === 'setup' ? 'Create Vault' : 'Unlock')}
          </button>
        </form>
      </div>
    </div>
  )
}
