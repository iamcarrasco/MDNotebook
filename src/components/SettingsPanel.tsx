'use client'

import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { CloseIcon } from './Icons'
import { useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { pickVaultFolder } from '@/lib/local-vault'
import { exportAllAsMarkdownFolder } from '@/lib/export-import'

interface SettingsPanelProps {
  vaultName: string
  onClose: () => void
  onVaultChanged: (folder: string) => void
}

export default function SettingsPanel({ vaultName, onClose, onVaultChanged }: SettingsPanelProps) {
  const state = useNotebook()
  const { autosaveDelay, tree } = state
  const dispatch = useNotebookDispatch()
  const [error, setError] = useState<string | null>(null)
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  const handleChangeLocation = async () => {
    setError(null)
    try {
      const folder = await pickVaultFolder()
      onVaultChanged(folder)
    } catch {
      setError('Failed to select folder.')
    }
  }

  const handleExportMdFolder = async () => {
    setExportMsg(null)
    try {
      const folder = await invoke<string>('pick_vault_folder')
      if (!folder) return
      const count = await exportAllAsMarkdownFolder(tree, folder)
      setExportMsg(`Exported ${count} notes as .md files.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('No folder selected')) return
      setExportMsg(msg || 'Export failed.')
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
          <label className="settings-label">Export All Notes</label>
          <p className="settings-warning">
            Export all notes as individual .md files to a folder.
          </p>
          {exportMsg && (
            <div className="auth-error" style={{
              marginBottom: 8,
              ...(exportMsg.startsWith('Exported') ? { color: 'var(--accent)', borderColor: 'var(--accent)', background: 'var(--accent-light)' } : {}),
            }}>
              {exportMsg}
            </div>
          )}
          <button className="auth-btn" onClick={handleExportMdFolder}>
            Export as .md Files
          </button>
        </div>
      </div>
    </div>
  )
}
