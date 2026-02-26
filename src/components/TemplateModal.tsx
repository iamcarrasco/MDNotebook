'use client'

import { useMemo } from 'react'
import { noteTemplates, type NoteTemplate } from '@/lib/templates'
import { useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { CloseIcon } from './Icons'

interface TemplateModalProps {
  onSelect: (template: NoteTemplate) => void
  onClose: () => void
  currentNoteContent?: string
  currentNoteName?: string
}

export default function TemplateModal({ onSelect, onClose, currentNoteContent, currentNoteName }: TemplateModalProps) {
  const { customTemplates, disabledTemplates } = useNotebook()
  const dispatch = useNotebookDispatch()

  const enabledBuiltins = noteTemplates.filter(t => !disabledTemplates.includes(t.name))
  const enabledCustom = customTemplates.filter(t => !disabledTemplates.includes(t.name))

  // Group all enabled templates by category
  const grouped = useMemo(() => {
    const groups: Record<string, { templates: NoteTemplate[]; isCustom: boolean[] }> = {}

    for (const t of enabledBuiltins) {
      const cat = t.category || 'General'
      if (!groups[cat]) groups[cat] = { templates: [], isCustom: [] }
      groups[cat].templates.push(t)
      groups[cat].isCustom.push(false)
    }

    for (const t of enabledCustom) {
      const cat = t.category || 'Custom'
      if (!groups[cat]) groups[cat] = { templates: [], isCustom: [] }
      groups[cat].templates.push(t)
      groups[cat].isCustom.push(true)
    }

    return groups
  }, [enabledBuiltins, enabledCustom])

  const categories = Object.keys(grouped)

  const handleSaveAsTemplate = () => {
    if (!currentNoteContent && !currentNoteName) return
    const name = prompt('Template name:', currentNoteName || 'My Template')
    if (!name?.trim()) return
    const desc = prompt('Short description:', '') || ''
    dispatch({
      type: 'ADD_CUSTOM_TEMPLATE',
      template: { name: name.trim(), description: desc, content: currentNoteContent || '' },
    })
  }

  const handleDeleteTemplate = (templateName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({ type: 'REMOVE_CUSTOM_TEMPLATE', name: templateName })
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-label="Choose a template">
      <div className="modal-content template-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Choose a Template</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="template-grid-grouped">
          {categories.map((category) => (
            <div key={category} className="template-category">
              <span className="template-category-label">{category}</span>
              <div className="template-grid">
                {grouped[category].templates.map((template, i) => {
                  const isCustom = grouped[category].isCustom[i]
                  return (
                    <button
                      key={`${isCustom ? 'custom-' : ''}${template.name}`}
                      className={`template-card${isCustom ? ' template-card-custom' : ''}`}
                      onClick={() => onSelect(template)}
                    >
                      <span className="template-card-name">{template.name}</span>
                      <span className="template-card-desc">{template.description || 'Custom template'}</span>
                      {isCustom && (
                        <span
                          className="template-card-delete"
                          onClick={(e) => handleDeleteTemplate(template.name, e)}
                          title="Delete template"
                        >
                          <CloseIcon />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {currentNoteContent !== undefined && (
          <div className="template-footer">
            <button className="template-save-btn" onClick={handleSaveAsTemplate}>
              Save current note as template
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
