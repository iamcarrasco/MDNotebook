'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  linkPlugin,
  linkDialogPlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  toolbarPlugin,
  diffSourcePlugin,
  markdownShortcutPlugin,
  imagePlugin,
  directivesPlugin,
  AdmonitionDirectiveDescriptor,
  InsertAdmonition,
  InsertImage,
  UndoRedo,
  BoldItalicUnderlineToggles,
  CodeToggle,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  InsertTable,
  InsertThematicBreak,
  InsertCodeBlock,
  DiffSourceToggleWrapper,
  Separator,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { useVaultCredentials, useNotebook, useNotebookDispatch } from '@/lib/notebook-context'
import { saveAsset, loadAssetAsObjectUrl } from '@/lib/asset-manager'

interface EditorProps {
  markdown: string
  onChange?: (markdown: string) => void
  theme?: 'light' | 'dark'
  spellcheck?: boolean
}

// ── Wiki-link pre/post processing ──

function wikiLinksToMarkdownLinks(md: string): string {
  return md.replace(/\[\[([^\]]+)\]\]/g, (_, name) => {
    return `[${name}](wikilink://${encodeURIComponent(name)})`
  })
}

function markdownLinksToWikiLinks(md: string): string {
  return md.replace(/\[([^\]]*)\]\(wikilink:\/\/([^)]+)\)/g, (_, _text, encoded) => {
    return `[[${decodeURIComponent(encoded)}]]`
  })
}

// ── Wiki-link toolbar button ──

function InsertWikiLink() {
  return (
    <button
      className="toolbar-wiki-link-btn"
      title="Insert wiki link [[...]]"
      onClick={() => window.dispatchEvent(new CustomEvent('wiki-link-insert-request'))}
    >
      {'[[]]'}
    </button>
  )
}

// ── Toolbar ──

function EditorToolbar() {
  return (
    <DiffSourceToggleWrapper options={['rich-text', 'source']}>
      <UndoRedo />
      <Separator />
      <BoldItalicUnderlineToggles />
      <CodeToggle />
      <Separator />
      <BlockTypeSelect />
      <Separator />
      <ListsToggle />
      <Separator />
      <CreateLink />
      <InsertWikiLink />
      <InsertTable />
      <InsertThematicBreak />
      <InsertCodeBlock />
      <InsertImage />
      <Separator />
      <InsertAdmonition />
    </DiffSourceToggleWrapper>
  )
}

// ── Editor Component ──

export default function Editor({ markdown: value, onChange, theme = 'light', spellcheck = true }: EditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null)
  const mermaidContainerRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const prevValueRef = useRef(value)

  // Vault asset refs (stable references for plugin callbacks)
  const { vaultFolder, passphrase } = useVaultCredentials()
  const { assets } = useNotebook()
  const dispatch = useNotebookDispatch()
  const vaultFolderRef = useRef(vaultFolder)
  vaultFolderRef.current = vaultFolder
  const passphraseRef = useRef(passphrase)
  passphraseRef.current = passphrase
  const assetsRef = useRef(assets)
  assetsRef.current = assets

  // Defer mount to avoid flushSync during React render cycle
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Convert wiki-links before feeding to MDXEditor
  const initialMarkdown = useMemo(() => wikiLinksToMarkdownLinks(value), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync content when value prop changes (e.g. switching notes)
  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value
      editorRef.current?.setMarkdown(wikiLinksToMarkdownLinks(value))
    }
  }, [value])

  // Wrap onChange in microtask to avoid flushSync conflict with React 19
  const handleChange = useCallback((md: string) => {
    queueMicrotask(() => {
      const restored = markdownLinksToWikiLinks(md)
      if (restored === prevValueRef.current) return
      prevValueRef.current = restored
      onChangeRef.current?.(restored)

      // If raw markdown has [[...]] wiki links (e.g. typed in source view),
      // convert them to wikilink:// links so rich-text renders them clickable
      const converted = wikiLinksToMarkdownLinks(restored)
      if (converted !== md) {
        editorRef.current?.setMarkdown(converted)
      }
    })
  }, [])

  // Handle wiki-link clicks
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a[href^="wikilink://"]') as HTMLAnchorElement | null
      if (anchor) {
        e.preventDefault()
        e.stopPropagation()
        const href = anchor.getAttribute('href') || ''
        const name = decodeURIComponent(href.replace('wikilink://', ''))
        if (name) {
          window.dispatchEvent(
            new CustomEvent('wiki-link-click', { detail: { name } })
          )
        }
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  // Handle wiki-link insertion from toolbar/picker
  useEffect(() => {
    const handler = (e: Event) => {
      const { name } = (e as CustomEvent).detail
      if (name && editorRef.current) {
        editorRef.current.insertMarkdown(`[${name}](wikilink://${encodeURIComponent(name)})`)
      }
    }
    window.addEventListener('wiki-link-insert', handler)
    return () => window.removeEventListener('wiki-link-insert', handler)
  }, [])

  // Plugins
  const plugins = useMemo(() => [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    directivesPlugin({ directiveDescriptors: [AdmonitionDirectiveDescriptor] }),
    thematicBreakPlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    tablePlugin(),
    codeBlockPlugin({ defaultCodeBlockLanguage: '' }),
    codeMirrorPlugin({
      codeBlockLanguages: {
        js: 'JavaScript',
        javascript: 'JavaScript',
        ts: 'TypeScript',
        typescript: 'TypeScript',
        py: 'Python',
        python: 'Python',
        rust: 'Rust',
        go: 'Go',
        java: 'Java',
        csharp: 'C#',
        css: 'CSS',
        html: 'HTML',
        sql: 'SQL',
        bash: 'Bash',
        sh: 'Shell',
        json: 'JSON',
        yaml: 'YAML',
        xml: 'XML',
        markdown: 'Markdown',
        mermaid: 'Mermaid',
        '': 'Plain text',
      },
    }),
    imagePlugin({
      imageUploadHandler: async (file: File) => {
        const meta = await saveAsset(vaultFolderRef.current, passphraseRef.current, file)
        dispatch({ type: 'ADD_ASSET', meta })
        return `vault://${meta.id}`
      },
      imagePreviewHandler: async (src: string) => {
        if (src.startsWith('vault://')) {
          const assetId = src.replace('vault://', '')
          const meta = assetsRef.current[assetId]
          if (meta) {
            return loadAssetAsObjectUrl(vaultFolderRef.current, passphraseRef.current, assetId, meta.mimeType)
          }
        }
        return src
      },
    }),
    diffSourcePlugin({ viewMode: 'rich-text' }),
    markdownShortcutPlugin(),
    toolbarPlugin({ toolbarContents: () => <EditorToolbar /> }),
  ], [])

  // Extract mermaid code blocks from markdown
  const mermaidBlocks = useMemo(() => {
    const regex = /```mermaid\n([\s\S]*?)```/g
    const blocks: string[] = []
    let match
    while ((match = regex.exec(value)) !== null) {
      blocks.push(match[1].trim())
    }
    return blocks
  }, [value])

  // Render mermaid diagrams
  useEffect(() => {
    if (mermaidBlocks.length === 0 || !mermaidContainerRef.current) return

    const container = mermaidContainerRef.current
    let cancelled = false

    import('mermaid').then(({ default: mermaid }) => {
      if (cancelled) return
      mermaid.initialize({
        startOnLoad: false,
        theme: theme === 'dark' ? 'dark' : 'default',
        securityLevel: 'strict',
      })

      container.innerHTML = ''

      const label = document.createElement('div')
      label.className = 'mermaid-preview-label'
      label.textContent = 'Diagram Preview'
      container.appendChild(label)

      mermaidBlocks.forEach(async (code, i) => {
        if (cancelled) return
        try {
          const { svg } = await mermaid.render(`mermaid-diagram-${Date.now()}-${i}`, code)
          if (cancelled) return
          const div = document.createElement('div')
          div.className = 'mermaid-rendered'
          const parser = new DOMParser()
          const doc = parser.parseFromString(svg, 'image/svg+xml')
          const svgEl = doc.querySelector('svg')
          if (svgEl) {
            div.appendChild(document.importNode(svgEl, true))
          }
          container.appendChild(div)
        } catch (err) {
          const div = document.createElement('div')
          div.className = 'mermaid-error'
          const msg = err instanceof Error ? err.message : 'Invalid syntax'
          div.textContent = `Diagram ${i + 1}: ${msg}`
          container.appendChild(div)
        }
      })
    }).catch(() => {
      if (cancelled) return
      container.innerHTML = ''
      const div = document.createElement('div')
      div.className = 'mermaid-error'
      div.textContent = 'Mermaid library could not be loaded.'
      container.appendChild(div)
    })

    return () => { cancelled = true }
  }, [mermaidBlocks, theme])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }} spellCheck={spellcheck}>
      {mounted && (
        <MDXEditor
          ref={editorRef}
          markdown={initialMarkdown}
          onChange={handleChange}
          plugins={plugins}
          className={theme === 'dark' ? 'dark-editor' : ''}
        />
      )}
      {mermaidBlocks.length > 0 && (
        <div ref={mermaidContainerRef} className="mermaid-preview-container" />
      )}
    </div>
  )
}
