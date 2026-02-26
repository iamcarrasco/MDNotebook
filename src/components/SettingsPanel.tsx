'use client'

import { useState, useMemo } from 'react'
import { CloseIcon } from './Icons'
import { useNotebook, useNotebookDispatch, useVaultCredentials } from '@/lib/notebook-context'
import { pickVaultFolder, readVaultFile, writeVaultFile } from '@/lib/local-vault'
import { reEncryptVault, getPassphraseStrength } from '@/lib/crypto'
import { reEncryptAllAssets } from '@/lib/asset-manager'

interface SettingsPanelProps {
  vaultName: string
  onClose: () => void
  onVaultChanged: (folder: string) => void
}

export default function SettingsPanel({ vaultName, onClose, onVaultChanged }: SettingsPanelProps) {
  const state = useNotebook()
  const { autosaveDelay } = state
  const dispatch = useNotebookDispatch()
  const [error, setError] = useState<string | null>(null)
  const [showPassChange, setShowPassChange] = useState(false)
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passError, setPassError] = useState<string | null>(null)
  const [passSuccess, setPassSuccess] = useState<string | null>(null)
  const [passLoading, setPassLoading] = useState(false)

  const { vaultFolder, passphrase: currentPassphrase } = useVaultCredentials()
  const strength = useMemo(() => getPassphraseStrength(newPass), [newPass])

  const handleChangeLocation = async () => {
    setError(null)
    try {
      const folder = await pickVaultFolder()
      onVaultChanged(folder)
    } catch {
      setError('Failed to select folder.')
    }
  }

  const handleChangePassphrase = async () => {
    setPassError(null)
    setPassSuccess(null)
    if (oldPass !== currentPassphrase) {
      setPassError('Current passphrase is incorrect.')
      return
    }
    if (newPass.length < 8) {
      setPassError('New passphrase must be at least 8 characters.')
      return
    }
    if (newPass !== confirmPass) {
      setPassError('New passphrases do not match.')
      return
    }
    setPassLoading(true)
    try {
      const raw = await readVaultFile(vaultFolder)
      if (!raw) throw new Error('Vault file not found')
      const reEncrypted = await reEncryptVault(raw, oldPass, newPass)
      await reEncryptAllAssets(vaultFolder, oldPass, newPass)
      await writeVaultFile(vaultFolder, reEncrypted)
      setPassSuccess('Passphrase changed successfully. Please restart the app to use the new passphrase.')
      setOldPass('')
      setNewPass('')
      setConfirmPass('')
    } catch (err) {
      setPassError(err instanceof Error ? err.message : 'Failed to change passphrase.')
    } finally {
      setPassLoading(false)
    }
  }

  return (
    <div className="settings-overlay" onClick={onClose} role="dialog" aria-label="Settings">
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button className="sidebar-action-btn" onClick={onClose} title="Close" aria-label="Close settings">
            <CloseIcon />
          </button>
        </div>

        <div className="settings-section">
          <label className="settings-label">Vault Location</label>
          <div className="settings-vault-name">
            {vaultName}
          </div>
          <p className="settings-warning">
            Changing location will not move existing notes.
          </p>
          {error && <div className="auth-error" style={{ marginBottom: 8 }}>{error}</div>}
          <button className="auth-btn" onClick={handleChangeLocation}>
            Change Folder
          </button>
        </div>

        <div className="settings-section" style={{ borderTop: '1px solid var(--border-color)' }}>
          <label className="settings-label">Autosave Delay</label>
          <div className="settings-autosave">
            <input
              type="range"
              min={200}
              max={5000}
              step={100}
              value={autosaveDelay}
              onChange={(e) => dispatch({ type: 'SET_AUTOSAVE_DELAY', delay: Number(e.target.value) })}
              className="settings-range"
            />
            <span className="settings-range-value">{autosaveDelay}ms</span>
          </div>
          <p className="settings-warning">
            Lower values save more frequently. Default: 500ms.
          </p>
        </div>

        <div className="settings-section" style={{ borderTop: '1px solid var(--border-color)' }}>
          <label className="settings-label">Spellcheck</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={state.spellcheck}
                onChange={(e) => dispatch({ type: 'SET_SPELLCHECK', enabled: e.target.checked })}
              />
              Enable spell checking in the editor
            </label>
          </div>
        </div>

        <div className="settings-section" style={{ borderTop: '1px solid var(--border-color)' }}>
          <label className="settings-label">Markdown Export</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={state.includeFrontmatter}
                onChange={(e) => dispatch({ type: 'SET_INCLUDE_FRONTMATTER', enabled: e.target.checked })}
              />
              Include YAML frontmatter in Markdown exports
            </label>
          </div>
          <p className="settings-warning">
            Adds title, date, tags, and custom fields as a YAML header block.
          </p>
        </div>

        <div className="settings-section" style={{ borderTop: '1px solid var(--border-color)' }}>
          <label className="settings-label">Appearance</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                className={state.theme === t ? 'auth-btn' : 'confirm-modal-cancel'}
                style={{ flex: 1, textTransform: 'capitalize' }}
                onClick={() => dispatch({ type: 'SET_THEME', theme: t })}
              >
                {t === 'system' ? 'Follow System' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section" style={{ borderTop: '1px solid var(--border-color)' }}>
          <label className="settings-label">Change Passphrase</label>
          {!showPassChange ? (
            <button className="auth-btn" onClick={() => setShowPassChange(true)}>
              Change Passphrase
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {passError && <div className="auth-error" style={{ marginBottom: 4 }}>{passError}</div>}
              {passSuccess && (
                <div className="auth-error" style={{ marginBottom: 4, color: 'var(--accent)', borderColor: 'var(--accent)', background: 'var(--accent-light)' }}>
                  {passSuccess}
                </div>
              )}
              <input
                className="auth-input"
                type="password"
                placeholder="Current passphrase"
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
                disabled={passLoading}
              />
              <input
                className="auth-input"
                type="password"
                placeholder="New passphrase (min 8 characters)"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                disabled={passLoading}
              />
              {newPass.length > 0 && (
                <div className="passphrase-strength">
                  <div className="passphrase-strength-track">
                    <div
                      className="passphrase-strength-fill"
                      style={{ width: `${(strength.level / 3) * 100}%`, backgroundColor: strength.color }}
                    />
                  </div>
                  <span className="passphrase-strength-label" style={{ color: strength.color }}>
                    {strength.label}
                  </span>
                </div>
              )}
              <input
                className="auth-input"
                type="password"
                placeholder="Confirm new passphrase"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                disabled={passLoading}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="confirm-modal-cancel" onClick={() => { setShowPassChange(false); setPassError(null); setPassSuccess(null) }} disabled={passLoading}>
                  Cancel
                </button>
                <button className="auth-btn" onClick={handleChangePassphrase} disabled={passLoading}>
                  {passLoading ? 'Changing...' : 'Change Passphrase'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
