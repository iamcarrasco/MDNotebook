'use client'

import { useState, useMemo } from 'react'
import { noteTemplates, type NoteTemplate } from '@/lib/templates'
import { useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { CloseIcon } from './Icons'

interface TemplateManagerProps {
  onClose: () => void
}

export default function TemplateManager({ onClose }: TemplateManagerProps) {
  const { customTemplates, disabledTemplates } = useNotebook()
  const dispatch = useNotebookDispatch()
  const [editing, setEditing] = useState<{
    mode: 'create' | 'edit'
    originalName?: string
    name: string
    description: string
    content: string
    tags: string
    category: string
  } | null>(null)

  const isDisabled = (name: string) => disabledTemplates.includes(name)

  const handleToggle = (name: string) => {
    dispatch({ type: 'TOGGLE_TEMPLATE_ENABLED', name })
  }

  const handleDelete = (name: string) => {
    dispatch({ type: 'REMOVE_CUSTOM_TEMPLATE', name })
  }

  const handleStartCreate = () => {
    setEditing({ mode: 'create', name: '', description: '', content: '', tags: '', category: '' })
  }

  const handleStartEdit = (template: NoteTemplate) => {
    setEditing({
      mode: 'edit',
      originalName: template.name,
      name: template.name,
      description: template.description,
      content: template.content,
      tags: (template.tags || []).join(', '),
      category: template.category || '',
    })
  }

  const handleSave = () => {
    if (!editing || !editing.name.trim()) return
    const tags = editing.tags.split(',').map(t => t.trim()).filter(Boolean)
    const template: NoteTemplate = {
      name: editing.name.trim(),
      description: editing.description.trim(),
      content: editing.content,
      ...(tags.length > 0 ? { tags } : {}),
      ...(editing.category.trim() ? { category: editing.category.trim() } : {}),
    }

    if (editing.mode === 'create') {
      dispatch({ type: 'ADD_CUSTOM_TEMPLATE', template })
    } else if (editing.originalName) {
      dispatch({ type: 'UPDATE_CUSTOM_TEMPLATE', oldName: editing.originalName, template })
    }
    setEditing(null)
  }

  // Group built-in templates by category
  const builtinGroups = useMemo(() => {
    const groups: Record<string, NoteTemplate[]> = {}
    for (const t of noteTemplates) {
      const cat = t.category || 'General'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(t)
    }
    return groups
  }, [])

  // Group custom templates by category
  const customGroups = useMemo(() => {
    const groups: Record<string, NoteTemplate[]> = {}
    for (const t of customTemplates) {
      const cat = t.category || 'Custom'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(t)
    }
    return groups
  }, [customTemplates])

  // ── Editor view ──
  if (editing) {
    return (
      <div className="settings-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Edit Template">
        <div className="template-manager-panel" onClick={(e) => e.stopPropagation()}>
          <div className="settings-header">
            <h2 className="settings-title">
              {editing.mode === 'create' ? 'New Template' : 'Edit Template'}
            </h2>
            <button className="sidebar-action-btn" onClick={() => setEditing(null)} title="Back" aria-label="Back">
              <CloseIcon />
            </button>
          </div>

          <div className="template-manager-body">
            <div className="settings-section">
              <label className="settings-label">Name</label>
              <input
                className="auth-input"
                type="text"
                placeholder="Template name"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="settings-section" style={{ borderTop: '1px solid var(--border-color)' }}>
              <label className="settings-label">Description</label>
              <input
                className="auth-input"
                type="text"
                placeholder="Short description"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            <div className="settings-section" style={{ borderTop: '1px solid var(--border-color)' }}>
              <label className="settings-label">Category (optional)</label>
              <input
                className="auth-input"
                type="text"
                placeholder="e.g. Security, Planning"
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
              />
            </div>
            <div className="settings-section" style={{ borderTop: '1px solid var(--border-color)' }}>
              <label className="settings-label">Content (Markdown)</label>
              <textarea
                className="template-manager-textarea"
                placeholder="# Template heading&#10;&#10;Template content..."
                value={editing.content}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                rows={10}
              />
            </div>
            <div className="settings-section" style={{ borderTop: '1px solid var(--border-color)' }}>
              <label className="settings-label">Tags (comma-separated, optional)</label>
              <input
                className="auth-input"
                type="text"
                placeholder="tag1, tag2"
                value={editing.tags}
                onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
              />
            </div>
            <div className="settings-section" style={{ borderTop: '1px solid var(--border-color)', display: 'flex', gap: 8 }}>
              <button className="confirm-modal-cancel" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                className="auth-btn"
                onClick={handleSave}
                disabled={!editing.name.trim()}
              >
                {editing.mode === 'create' ? 'Create Template' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── List view ──
  return (
    <div className="settings-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Manage Templates">
      <div className="template-manager-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">Manage Templates</h2>
          <button className="sidebar-action-btn" onClick={onClose} title="Close" aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="template-manager-body">
          {/* Built-in Templates */}
          <div className="settings-section">
            <label className="settings-label">Built-in Templates</label>
            {Object.entries(builtinGroups).map(([category, templates]) => (
              <div key={category}>
                <span className="template-manager-category-label">{category}</span>
                {templates.map((template) => (
                  <div key={template.name} className="template-manager-row">
                    <div className="template-manager-info">
                      <span className="template-manager-name">{template.name}</span>
                      <span className="template-manager-desc">{template.description}</span>
                    </div>
                    {template.name === 'Blank Note' ? (
                      <span className="template-manager-always-on">Always on</span>
                    ) : (
                      <label className="template-manager-toggle">
                        <input
                          type="checkbox"
                          checked={!isDisabled(template.name)}
                          onChange={() => handleToggle(template.name)}
                        />
                        <span className="template-manager-toggle-slider" />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Custom Templates */}
          <div className="settings-section" style={{ borderTop: '1px solid var(--border-color)' }}>
            <label className="settings-label">Custom Templates</label>
            {customTemplates.length === 0 && (
              <p className="settings-warning">No custom templates yet.</p>
            )}
            {Object.entries(customGroups).map(([category, templates]) => (
              <div key={category}>
                <span className="template-manager-category-label">{category}</span>
                {templates.map((template) => (
                  <div key={template.name} className="template-manager-row">
                    <div className="template-manager-info">
                      <span className="template-manager-name">{template.name}</span>
                      <span className="template-manager-desc">{template.description || 'Custom template'}</span>
                    </div>
                    <div className="template-manager-actions">
                      <label className="template-manager-toggle">
                        <input
                          type="checkbox"
                          checked={!isDisabled(template.name)}
                          onChange={() => handleToggle(template.name)}
                        />
                        <span className="template-manager-toggle-slider" />
                      </label>
                      <button
                        className="template-manager-edit-btn"
                        onClick={() => handleStartEdit(template)}
                        title="Edit template"
                      >
                        Edit
                      </button>
                      <button
                        className="template-manager-delete-btn"
                        onClick={() => handleDelete(template.name)}
                        title="Delete template"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <button className="template-manager-add-btn" onClick={handleStartCreate}>
              + New Template
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
