<p align="center">
  <img src="src-tauri/icons/icon.png" width="120" alt="MDNotebook icon" />
</p>

<h1 align="center">MDNotebook</h1>

<p align="center">
  A private, encrypted markdown notebook for Windows.
  <br />
  Your notes never leave your machine.
</p>

<p align="center">
  <a href="https://github.com/iamcarrasco/MDNotebook/releases/latest"><strong>Download for Windows</strong></a>
</p>

---

## Why MDNotebook?

Most note-taking apps sync your data to someone else's server. MDNotebook doesn't. Every note is encrypted with AES-256-GCM on your device. There are no accounts, no cloud, no telemetry — just your notes, your machine, your data.

## Screenshots

| Light Mode | Dark Mode |
|:---:|:---:|
| ![Light Mode](screenshots/light-mode.png) | ![Dark Mode](screenshots/dark-mode.png) |

| Zen Mode | Source View |
|:---:|:---:|
| ![Zen Mode](screenshots/zen-mode.png) | ![Source View](screenshots/source-view.png) |

---

## Download

Pre-built Windows installers — no dependencies required:

| Installer | Format |
|-----------|--------|
| [MDNotebook_0.1.0_x64-setup.exe](https://github.com/iamcarrasco/MDNotebook/releases/download/v0.1.0/MDNotebook_0.1.0_x64-setup.exe) | NSIS (recommended) |
| [MDNotebook_0.1.0_x64_en-US.msi](https://github.com/iamcarrasco/MDNotebook/releases/download/v0.1.0/MDNotebook_0.1.0_x64_en-US.msi) | MSI |

> Windows may show a SmartScreen warning since the app is not code-signed. Click **"More info"** then **"Run anyway"** to proceed.

---

## Features

### Encrypted Vault
Your entire notebook is encrypted with a passphrase you choose. AES-256-GCM encryption with PBKDF2 key derivation (600,000 iterations). The passphrase is never stored anywhere — lose it and your data is gone. That's the point.

### Rich Markdown Editor
WYSIWYG editing powered by MDXEditor with a formatting toolbar, code blocks, tables, task lists, images, and more. Everything is stored as standard Markdown. Toggle between rich-text, source, and diff views at any time.

### Wiki Links & Backlinks
Link notes together with `[[Note Name]]` syntax. A backlinks panel shows every note that references the current one.

### Organization
- **Folders & drag-and-drop** — Nest notes in folders, reorder freely
- **Tabs** — Open multiple notes, reorder with drag-and-drop
- **Tags** — Filter by AND/OR logic with a collapsible sidebar panel
- **Full-text search** — Search names and content with preview snippets
- **Daily notes** — One-click creation with `Ctrl+Shift+T`
- **Version history** — Save and restore snapshots, auto-snapshot on note switch

### Writing
- **Zen mode** — Distraction-free fullscreen writing
- **Mermaid diagrams** — Live-rendered diagram blocks
- **PDF export** — Print any note to PDF
- **Markdown export** — Bulk export all notes as `.md` files
- **Image support** — Paste or drag images directly into the editor

### Desktop Integration
- **System tray** — Runs in the background, hides on close
- **Global hotkey** — `Ctrl+Shift+M` brings the app to focus from anywhere
- **File associations** — Double-click `.md` files to open them
- **Dark mode** — System-aware toggle, title bar follows theme
- **Windows 11 Mica** — Native backdrop effect
- **Auto-save** — Saves after you stop typing (configurable 200ms–5000ms)
- **Import/Export** — Import `.md` files, backup and restore as JSON

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New note |
| `Ctrl+Shift+N` | New folder |
| `Ctrl+Shift+F` | Focus search |
| `Ctrl+Shift+T` | Daily note |
| `Ctrl+Shift+D` | Toggle dark mode |
| `Ctrl+Shift+Z` | Toggle zen mode |
| `Ctrl+\` | Toggle sidebar |
| `Ctrl+Shift+M` | Global focus hotkey |
| `F1` | Help |
| `F2` | Rename |
| `Escape` | Close modal / exit zen mode |

---

## Security

| | |
|---|---|
| **Encryption** | AES-256-GCM with PBKDF2 (600k iterations) |
| **Storage** | Passphrase never stored; atomic writes prevent corruption |
| **Network** | Zero outbound connections |
| **Telemetry** | None. No analytics, no tracking, no cloud sync |

---

## Build from Source

### Prerequisites

- [Node.js](https://nodejs.org/) >= 22.12.0
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri CLI prerequisites](https://tauri.app/start/prerequisites/) for Windows

### Commands

```bash
npm install          # Install dependencies
npm run tauri dev    # Development mode
npm test             # Run tests
npm run tauri build  # Production build (outputs MSI + NSIS installers)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript |
| Backend | Tauri 2 (Rust) |
| Editor | MDXEditor (Lexical) |
| Encryption | Web Crypto API (PBKDF2 + AES-256-GCM) |
| Diagrams | Mermaid.js |
| Drag & Drop | @dnd-kit |
| Testing | Vitest |

---

## License

[MIT](LICENSE)
