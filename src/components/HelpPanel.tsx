'use client'

import { useState } from 'react'
import { CloseIcon } from './Icons'

const tabs = ['Getting Started', 'Shortcuts', 'Markdown', 'Features'] as const
type Tab = typeof tabs[number]

export default function HelpPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('Getting Started')

  return (
    <div className="settings-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Help">
      <div className="help-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">How to Use MDNotebook</h2>
          <button className="sidebar-action-btn" onClick={onClose} title="Close" aria-label="Close help">
            <CloseIcon />
          </button>
        </div>

        <div className="help-tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`help-tab${activeTab === tab ? ' active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="help-body">
          {activeTab === 'Getting Started' && <GettingStarted />}
          {activeTab === 'Shortcuts' && <Shortcuts />}
          {activeTab === 'Markdown' && <MarkdownGuide />}
          {activeTab === 'Features' && <Features />}
        </div>
      </div>
    </div>
  )
}

function GettingStarted() {
  return (
    <div className="help-content">
      <section className="help-section">
        <h3>Welcome to MDNotebook</h3>
        <p>An offline-first, encrypted markdown notebook that lives on your computer. Your notes never leave your device.</p>
      </section>

      <section className="help-section">
        <h3>Creating Notes</h3>
        <p>Click the new note button in the header bar, or use <kbd>Ctrl+N</kbd>. Notes are edited in a rich-text WYSIWYG editor with markdown storage.</p>
      </section>

      <section className="help-section">
        <h3>Organizing with Folders</h3>
        <p>Click the folder icon in the header bar or use <kbd>Ctrl+Shift+N</kbd> to create folders. Drag and drop notes and folders in the sidebar to reorganize them. Right-click any item for more options like rename, pin, or move to trash.</p>
      </section>

      <section className="help-section">
        <h3>Tags</h3>
        <p>Add tags to any note using the tag bar below the toolbar. Click the <strong>+</strong> button to add a tag. Click any tag pill to filter your sidebar by that tag. Combine multiple tags with AND/OR filtering.</p>
      </section>

      <section className="help-section">
        <h3>Encryption</h3>
        <p>Your vault is encrypted with your passphrase using <strong>AES-256-GCM</strong>. The passphrase never leaves your device. If you forget it, your data cannot be recovered.</p>
      </section>

      <section className="help-section">
        <h3>Saving</h3>
        <p>Notes auto-save a moment after you stop typing. Look for the <em>Saving...</em> and <em>Saved</em> indicator in the toolbar.</p>
      </section>
    </div>
  )
}

function Shortcuts() {
  const shortcuts = [
    { keys: 'F1', action: 'Open this help panel' },
    { keys: 'F2', action: 'Rename selected note or folder' },
    { keys: 'F9', action: 'Toggle sidebar' },
    { keys: 'F10', action: 'Open main menu' },
    { keys: 'Ctrl + N', action: 'New note' },
    { keys: 'Ctrl + Shift + N', action: 'New folder' },
    { keys: 'Ctrl + Shift + F', action: 'Search all notes' },
    { keys: 'Ctrl + Shift + T', action: 'Open/create daily note' },
    { keys: 'Ctrl + Shift + D', action: 'Cycle theme (light/dark/system)' },
    { keys: 'Ctrl + Shift + Z', action: 'Toggle zen/focus mode' },
    { keys: 'Ctrl + Shift + P', action: 'Open command palette' },
    { keys: 'Ctrl + W', action: 'Close current tab' },
    { keys: 'Ctrl + ,', action: 'Open preferences' },
    { keys: 'Ctrl + S', action: 'Save (auto-handled)' },
    { keys: 'Ctrl + PageDown', action: 'Next tab' },
    { keys: 'Ctrl + PageUp', action: 'Previous tab' },
    { keys: 'Ctrl + Shift + M', action: 'Global hotkey \u2014 bring app to focus' },
    { keys: 'Escape', action: 'Close panel / exit zen mode' },
  ]

  return (
    <div className="help-content">
      <section className="help-section">
        <h3>Keyboard Shortcuts</h3>
        <table className="help-shortcut-table">
          <thead>
            <tr>
              <th>Shortcut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {shortcuts.map((s) => (
              <tr key={s.keys}>
                <td><kbd>{s.keys}</kbd></td>
                <td>{s.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="help-section">
        <h3>Editor Shortcuts</h3>
        <p>Inside the editor, standard editing shortcuts work:</p>
        <table className="help-shortcut-table">
          <thead>
            <tr>
              <th>Shortcut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><kbd>Ctrl + B</kbd></td><td>Bold</td></tr>
            <tr><td><kbd>Ctrl + I</kbd></td><td>Italic</td></tr>
            <tr><td><kbd>Ctrl + U</kbd></td><td>Underline</td></tr>
            <tr><td><kbd>Ctrl + Z</kbd></td><td>Undo</td></tr>
            <tr><td><kbd>Ctrl + Shift + Z</kbd></td><td>Redo</td></tr>
            <tr><td><kbd>Tab</kbd></td><td>Indent list item</td></tr>
            <tr><td><kbd>Shift + Tab</kbd></td><td>Dedent list item</td></tr>
          </tbody>
        </table>
        <p>Use the toolbar buttons to insert <strong>bold</strong>, <em>italic</em>, headings, lists, links, tables, and code blocks.</p>
      </section>
    </div>
  )
}

function MarkdownGuide() {
  return (
    <div className="help-content">
      <section className="help-section">
        <h3>Markdown Basics</h3>
        <p>MDNotebook uses a rich-text WYSIWYG editor powered by MDXEditor. Bold is bold, headings are headings — no raw syntax visible. Notes are stored as Markdown. Use the toolbar or keyboard shortcuts (Ctrl+B, Ctrl+I) for formatting.</p>
      </section>

      <section className="help-section">
        <table className="help-markdown-table">
          <thead>
            <tr>
              <th>Syntax</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code># Heading 1</code></td><td>Large heading</td></tr>
            <tr><td><code>## Heading 2</code></td><td>Medium heading</td></tr>
            <tr><td><code>### Heading 3</code></td><td>Small heading</td></tr>
            <tr><td><code>**bold**</code></td><td><strong>bold</strong></td></tr>
            <tr><td><code>*italic*</code></td><td><em>italic</em></td></tr>
            <tr><td><code>`inline code`</code></td><td><code>inline code</code></td></tr>
            <tr><td><code>[link](url)</code></td><td>Clickable link</td></tr>

            <tr><td><code>- item</code></td><td>Bullet list</td></tr>
            <tr><td><code>1. item</code></td><td>Numbered list</td></tr>
            <tr><td><code>- [ ] task</code></td><td>Task checkbox</td></tr>
            <tr><td><code>&gt; quote</code></td><td>Blockquote</td></tr>
            <tr><td><code>---</code></td><td>Horizontal rule</td></tr>
          </tbody>
        </table>
      </section>

      <section className="help-section">
        <h3>Code Blocks</h3>
        <p>Use triple backticks for code blocks:</p>
        <pre className="help-code-example">{'```javascript\nconsole.log("hello")\n```'}</pre>
        <p>Code blocks preserve whitespace and formatting. Use the Source View to edit raw markdown directly.</p>
      </section>

      <section className="help-section">
        <h3>Wiki Links</h3>
        <p>Link between notes using double brackets: <code>[[Note Name]]</code>. Clicking a wiki link navigates to the linked note, or prompts to create it if it doesn&apos;t exist.</p>
        <p>Use the <strong>{'[[]]'}</strong> toolbar button to search your notes and insert a wiki link from rich-text mode. You can also type <code>[[Note Name]]</code> in Source View.</p>
        <p>The <strong>Backlinks</strong> panel at the bottom of each note shows every note that links to the current one.</p>
      </section>

      <section className="help-section">
        <h3>Mermaid Diagrams</h3>
        <p>Create diagrams using Mermaid syntax in a code block with the <code>mermaid</code> language. A live preview renders below the editor.</p>
        <pre className="help-code-example">{'```mermaid\ngraph LR\n  A --> B --> C\n```'}</pre>
      </section>
    </div>
  )
}

function Features() {
  return (
    <div className="help-content">
      <section className="help-section">
        <h3>Header Bar</h3>
        <p>The header bar provides quick access to creating notes and folders, search, zen mode, PDF export, and the main menu. Use the hamburger menu for exports, preferences, and help.</p>
      </section>

      <section className="help-section">
        <h3>Command Palette</h3>
        <p>Press <kbd>Ctrl+Shift+P</kbd> to open the command palette. Search for any action by name and execute it instantly. All keyboard shortcuts are listed alongside their commands.</p>
      </section>

      <section className="help-section">
        <h3>Tabs</h3>
        <p>Open multiple notes at once. Navigate with <kbd>Ctrl+PageDown</kbd> / <kbd>Ctrl+PageUp</kbd>. Close the current tab with <kbd>Ctrl+W</kbd>.</p>
      </section>

      <section className="help-section">
        <h3>Daily Notes</h3>
        <p>Press <kbd>Ctrl+Shift+T</kbd> to quickly create or open today&apos;s daily note. Daily notes are auto-tagged with <code>#daily</code> and include a template with sections for tasks and notes.</p>
      </section>

      <section className="help-section">
        <h3>Templates</h3>
        <p>Create notes from templates organized by category (Quick, Planning, Reflection). Open <strong>Manage Templates</strong> from the main menu to enable/disable templates, create custom ones, and assign categories.</p>
      </section>

      <section className="help-section">
        <h3>Admonitions / Callouts</h3>
        <p>Insert callout boxes using the toolbar button or markdown syntax. Available types: <code>note</code>, <code>tip</code>, <code>info</code>, <code>caution</code>, <code>danger</code>.</p>
        <pre className="help-code-example">{':::note\nThis is a note callout.\n:::'}</pre>
      </section>

      <section className="help-section">
        <h3>Frontmatter</h3>
        <p>Add custom metadata to notes using the collapsible <strong>Frontmatter</strong> panel below the tag bar. Common fields include author, status, category, and description. When exporting as Markdown, frontmatter is prepended as a YAML block. Toggle this in Preferences.</p>
      </section>

      <section className="help-section">
        <h3>Zen Mode</h3>
        <p>Press <kbd>Ctrl+Shift+Z</kbd> for a distraction-free writing experience. Press <kbd>Escape</kbd> to exit.</p>
      </section>

      <section className="help-section">
        <h3>Export</h3>
        <p>Export notes as Markdown (with YAML frontmatter), HTML, or PDF from the header bar menu. Export all notes as a JSON vault backup or as individual Markdown files. Images are embedded in exports automatically.</p>
      </section>

      <section className="help-section">
        <h3>Source View</h3>
        <p>Use the source mode toggle in the editor toolbar to switch between rich-text editing and raw markdown source.</p>
      </section>

      <section className="help-section">
        <h3>Appearance</h3>
        <p>Choose Light, Dark, or Follow System theme from Preferences (<kbd>Ctrl+,</kbd>). Cycle with <kbd>Ctrl+Shift+D</kbd>. Spellcheck can also be toggled in Preferences.</p>
      </section>

      <section className="help-section">
        <h3>Vault Security</h3>
        <p>Your vault is encrypted with AES-256-GCM. A backup (<code>vault.json.bak</code>) is automatically created before each save. Change your passphrase in Preferences. Trash items are automatically purged after 30 days.</p>
      </section>

      <section className="help-section">
        <h3>System Tray</h3>
        <p>MDNotebook lives in your system tray. Closing the window hides the app to the tray. Click the tray icon or use <kbd>Ctrl+Shift+M</kbd> from any app to bring it back.</p>
      </section>

      <section className="help-section">
        <h3>File Associations</h3>
        <p>After installing, <code>.md</code> and <code>.markdown</code> files can be opened with MDNotebook. The content is imported as a new note.</p>
      </section>
    </div>
  )
}
