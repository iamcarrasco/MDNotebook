'use client'

import { useState } from 'react'
import { CloseIcon } from './Icons'
import { pickVaultFolder, clearStoredVaultPath } from '@/lib/local-vault'

interface SettingsPanelProps {
  vaultName: string
  onClose: () => void
  onVaultChanged: (folder: string) => void
}

export default function SettingsPanel({ vaultName, onClose, onVaultChanged }: SettingsPanelProps) {
  const [error, setError] = useState<string | null>(null)

  const handleChangeLocation = async () => {
    setError(null)
    try {
      clearStoredVaultPath()
      const folder = await pickVaultFolder()
      onVaultChanged(folder)
    } catch {
      setError('Failed to select folder.')
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
      </div>
    </div>
  )
}
