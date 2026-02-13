# MDNotebook

An offline-first, encrypted markdown notebook for Windows. Your notes never leave your device.

## Download

Pre-built Windows installers (no dependencies required):

| Installer | Format |
|-----------|--------|
| [MDNotebook_0.1.0_x64-setup.exe](installers/MDNotebook_0.1.0_x64-setup.exe) | NSIS (recommended) |
| [MDNotebook_0.1.0_x64_en-US.msi](installers/MDNotebook_0.1.0_x64_en-US.msi) | MSI |

> Windows may show a SmartScreen warning since the app is not code-signed. Click "More info" then "Run anyway" to proceed.

## Features

- **AES-256-GCM Encryption** — Vault is encrypted with your passphrase using PBKDF2 key derivation. No server, no cloud, no telemetry.
- **WYSIWYG Editor** — Rich-text editing powered by MDXEditor (Lexical) with a formatting toolbar, code blocks, tables, task lists, and more. Stored as Markdown.
- **Wiki Links** — Link between notes with `[[Note Name]]` syntax. Click to navigate or create.
- **Mermaid Diagrams** — Write diagrams in fenced code blocks with live preview.
- **Tabs** — Open multiple notes at once with a tab bar.
- **Daily Notes** — One-click daily note creation with `Ctrl+Shift+T` or the calendar button.
- **Templates** — Create notes from built-in templates (Meeting Notes, Project Plan, Journal Entry, etc.).
- **Tags** — Organize notes with tags and filter by AND/OR logic.
- **Folders & Drag-and-Drop** — Nest notes in folders, reorder with drag-and-drop.
- **Zen Mode** — Distraction-free writing with `Ctrl+Shift+Z`.
- **PDF Export** — Export any note to PDF via the system print dialog.
- **Source View** — Toggle between rich-text, source, and diff modes in the editor toolbar.
- **System Tray** — Runs in the background. Close the window and it hides to tray.
- **Global Hotkey** — `Ctrl+Shift+M` brings the app to focus from anywhere.
- **File Associations** — Double-click `.md` files to open them in MDNotebook.
- **Dark Mode** — Toggle with `Ctrl+Shift+D`.
- **Auto-Save** — Notes save automatically after you stop typing.
- **Import/Export** — Import `.md` files, export all notes as JSON backup, restore from backup.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `F1` | Open help panel |
| `Ctrl+N` | New note |
| `Ctrl+Shift+N` | New folder |
| `Ctrl+Shift+F` | Focus search bar |
| `Ctrl+Shift+T` | Open/create daily note |
| `Ctrl+Shift+D` | Toggle dark mode |
| `Ctrl+Shift+Z` | Toggle zen mode |
| `Ctrl+\` | Toggle sidebar |
| `Ctrl+Shift+M` | Global hotkey — bring app to focus |

## Prerequisites

- [Node.js](https://nodejs.org/) >= 22.12.0
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri CLI prerequisites](https://tauri.app/start/prerequisites/) for Windows

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Run tests
npm test

# Build for production (outputs MSI and NSIS installers)
npm run tauri build
```

Installers are written to `src-tauri/target/release/bundle/`.

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript
- **Backend:** Tauri 2 (Rust)
- **Editor:** MDXEditor (Lexical) for WYSIWYG with built-in source mode
- **Encryption:** Web Crypto API (PBKDF2 + AES-256-GCM)
- **Diagrams:** Mermaid.js
- **Drag & Drop:** @dnd-kit
- **Testing:** Vitest

## Security

- Your passphrase is never stored. It derives an encryption key via PBKDF2 with 100,000 iterations.
- All vault data is encrypted with AES-256-GCM before writing to disk.
- No network requests. No analytics. No telemetry. Fully offline.
- Vault files use atomic writes (temp file + rename) to prevent corruption on crash.

## License

[MIT](LICENSE)
