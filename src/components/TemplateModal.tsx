'use client'

import { noteTemplates, type NoteTemplate } from '@/lib/templates'
import { CloseIcon } from './Icons'

interface TemplateModalProps {
  onSelect: (template: NoteTemplate) => void
  onClose: () => void
}

export default function TemplateModal({ onSelect, onClose }: TemplateModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-label="Choose a template">
      <div className="modal-content template-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Choose a Template</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="template-grid">
          {noteTemplates.map((template) => (
            <button
              key={template.name}
              className="template-card"
              onClick={() => onSelect(template)}
            >
              <span className="template-card-name">{template.name}</span>
              <span className="template-card-desc">{template.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
