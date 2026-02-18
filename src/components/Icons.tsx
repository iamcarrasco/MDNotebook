export const FileIcon = () => (
  <svg className="sidebar-file-icon" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3 1h7l4 4v10H3V1zm7 0v4h4" fill="none" stroke="currentColor" strokeWidth="1.2" />
  </svg>
)

export const FolderIcon = () => (
  <svg className="folder-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M2 3h4l2 2h6v8H2V3z" />
  </svg>
)

export const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg className={`folder-chevron${expanded ? ' expanded' : ''}`} viewBox="0 0 16 16" fill="currentColor">
    <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const SearchIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
)

export const TrashIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 10h6l1-10" />
  </svg>
)

export const MoonIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.5 8.5a5.5 5.5 0 1 1-6-6 4 4 0 0 0 6 6z" />
  </svg>
)

export const SunIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
  </svg>
)

export const ExportIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <path d="M8 2v8M5 5l3-3 3 3M3 11v2h10v-2" />
  </svg>
)

export const ImportIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <path d="M8 10V2M5 7l3 3 3-3M3 11v2h10v-2" />
  </svg>
)

export const SortIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <path d="M3 4h10M3 8h7M3 12h4" />
  </svg>
)

export const ZenIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" />
  </svg>
)

export const RestoreIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 8a6 6 0 1 1 1.76 4.24" />
    <path d="M2 13V8h5" />
  </svg>
)

export const CloseIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
)

export const PinIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2.5L13.5 6.5L10.5 9.5L11 13L8 10L5 13L5.5 9.5L2.5 6.5L6.5 2.5z" />
    <path d="M8 10V14" />
  </svg>
)

export const CalendarIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="12" height="11" rx="1" />
    <path d="M5 1v3M11 1v3M2 7h12" />
  </svg>
)

export const TemplateIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </svg>
)

export const PDFIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M4 1h6l4 4v10H4V1z" />
    <path d="M10 1v4h4" />
    <path d="M6 8h4M6 10.5h4" />
  </svg>
)

export const HelpIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6.5" />
    <path d="M6 6.2a2 2 0 0 1 3.9.6c0 1.3-2 1.8-2 3" />
    <circle cx="8" cy="12.5" r="0.5" fill="currentColor" stroke="none" />
  </svg>
)

export const GearIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="2.5" />
    <path d="M6.7 1.5h2.6l.4 1.7a5.5 5.5 0 0 1 1.3.7l1.6-.6 1.3 2.2-1.2 1.1a5.5 5.5 0 0 1 0 1.5l1.2 1.1-1.3 2.2-1.6-.6a5.5 5.5 0 0 1-1.3.7l-.4 1.7H6.7l-.4-1.7a5.5 5.5 0 0 1-1.3-.7l-1.6.6-1.3-2.2 1.2-1.1a5.5 5.5 0 0 1 0-1.5L2.1 5.5l1.3-2.2 1.6.6a5.5 5.5 0 0 1 1.3-.7l.4-1.7z" />
  </svg>
)

export const HistoryIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 8a6.5 6.5 0 1 1 1.9 4.6" />
    <path d="M1 4.5V8h3.5" />
    <path d="M8 4.5V8l2.5 1.5" />
  </svg>
)

export const BacklinkIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 6.5a3 3 0 0 0-4.24 0l-2 2a3 3 0 0 0 4.24 4.24" />
    <path d="M6.5 9.5a3 3 0 0 0 4.24 0l2-2a3 3 0 0 0-4.24-4.24" />
    <path d="M2 2l3 3" />
  </svg>
)
