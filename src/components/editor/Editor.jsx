/**
 * Editor.jsx
 *
 * Main TipTap editor surface used for subject notes.
 * Handles:
 * - Legacy note migration (old `blocks[]` -> TipTap HTML)
 * - Debounced autosave + manual save
 * - Rich-text editing with a fixed toolbar + floating selection toolbar
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import OutlinePanel from '@/components/editor/OutlinePanel'
import EditorToolbar from '@/components/editor/EditorToolbar'
import FloatingToolbar from '@/components/editor/FloatingToolbar'
import InlineNoteSlashMenu from '@/components/editor/InlineNoteSlashMenu'
import { extractHeadingsFromJson } from '@/components/editor/headingOutline'
import { insertInlineNoteAtRange } from '@/components/editor/InlineNoteNode'
import {
  NOTE_FONT_SIZE_OPTIONS,
  NOTE_THEME_OPTIONS,
  getNoteFontSize,
  getNoteFontSizeId,
  getNoteTheme,
  getNoteThemeId,
} from '@/components/editor/noteThemes'
import LinkedNotesPanel from '@/components/notes/LinkedNotesPanel'
import { buildEditorExtensions } from '@/components/editor/EditorExtensions'
import { getInlineNoteSlashCommandState } from '@/components/editor/inlineNoteSlashCommand'
import { BackIcon, PlusIcon, SaveIcon, TopicsIcon } from '@/components/ui/Icons'
import { uid } from '@/utils/id'

const EMPTY_DOC_HTML = '<p></p>'
const AUTOSAVE_DELAY_MS = 900
const EMPTY_SLASH_MENU = {
  open: false,
  range: null,
  top: 0,
  left: 0,
}
const DEFAULT_APP_TOPBAR_HEIGHT = 58
const WORKSPACE_TOP_GAP = 16
const HEADER_TO_CONTENT_GAP = 14
const EDITOR_VIEWPORT_BOTTOM_GAP = 16
const EDITOR_EFFECT_BREAKPOINT = 1024
const EDITOR_MOBILE_BREAKPOINT = 768
const OUTLINE_SYNC_DELAY_MS = 120

function escapeHtml(text = '') {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function applyLegacyInlineMarks(text = '') {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}

function withLineBreaks(text = '') {
  return applyLegacyInlineMarks(text).replace(/\n/g, '<br />')
}

function legacyBlocksToHtml(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return EMPTY_DOC_HTML

  const html = blocks
    .map((block) => {
      const type = block?.type ?? 'p'
      const text = block?.text ?? ''

      if (type === 'h1' || type === 'h2' || type === 'h3') {
        return `<${type}>${withLineBreaks(text)}</${type}>`
      }

      if (type === 'code') {
        return `<pre><code>${escapeHtml(text)}</code></pre>`
      }

      if (type === 'quote' || type === 'callout') {
        return `<blockquote><p>${withLineBreaks(text)}</p></blockquote>`
      }

      if (type === 'bullet') {
        const items = text
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)

        if (items.length === 0) return '<ul><li></li></ul>'

        return `<ul>${items
          .map((item) => `<li>${withLineBreaks(item.replace(/^[\-*•]\s*/, ''))}</li>`)
          .join('')}</ul>`
      }

      return `<p>${withLineBreaks(text)}</p>`
    })
    .join('')

  return html || EMPTY_DOC_HTML
}

function getInitialContent(note) {
  if (typeof note?.content === 'string' && note.content.trim().length > 0) {
    return note.content
  }

  return legacyBlocksToHtml(note?.blocks)
}

function extractText(node) {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  if (!Array.isArray(node.content)) return ''
  return node.content.map(extractText).join('')
}

function extractStructuredText(node) {
  if (!node) return ''

  if (node?.type === 'aiCallout') {
    const explanation = typeof node.attrs?.explanation === 'string' ? node.attrs.explanation.trim() : ''
    const keyPoints = Array.isArray(node.attrs?.keyPoints)
      ? node.attrs.keyPoints.map((item) => String(item || '').trim()).filter(Boolean)
      : []

    return [explanation, ...keyPoints].filter(Boolean).join('\n')
  }

  if (node?.type === 'inlineNote') {
    const title = typeof node.attrs?.title === 'string' && node.attrs.title.trim()
      ? node.attrs.title.trim()
      : 'Untitled Note'
    const body = Array.isArray(node.content)
      ? node.content.map(extractStructuredText).filter(Boolean).join('\n')
      : ''
    return [title, body].filter(Boolean).join('\n')
  }

  if (node?.type === 'image') {
    const label = String(node.attrs?.alt || node.attrs?.title || '').trim()
    return label ? `[Image] ${label}` : ''
  }

  if (node?.type === 'clickableLink') {
    const href = String(node.attrs?.href || '').trim()
    const label = String(node.attrs?.label || '').trim() || href
    return href ? `${label} (${href})` : label
  }

  if (node?.type === 'table') {
    return Array.isArray(node.content)
      ? node.content.map(extractStructuredText).filter(Boolean).join('\n')
      : ''
  }

  if (node?.type === 'tableRow') {
    return Array.isArray(node.content)
      ? node.content.map(extractStructuredText).filter(Boolean).join(' | ')
      : ''
  }

  if (node?.type === 'tableCell' || node?.type === 'tableHeader') {
    return Array.isArray(node.content)
      ? node.content.map(extractStructuredText).filter(Boolean).join(' ')
      : ''
  }

  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  if (!Array.isArray(node.content)) return ''
  return node.content.map(extractStructuredText).join('')
}

function clampPosition(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function listNodeToBlock(node, ordered = false) {
  if (!Array.isArray(node?.content)) return null

  const lines = node.content
    .map((item, index) => {
      const text = extractStructuredText(item).trim()
      if (!text) return null
      return ordered ? `${index + 1}. ${text}` : text
    })
    .filter(Boolean)

  if (lines.length === 0) return null
  return { id: uid(), type: 'bullet', text: lines.join('\n') }
}

function tiptapJsonToBlocks(jsonDoc) {
  const nodes = Array.isArray(jsonDoc?.content) ? jsonDoc.content : []
  const blocks = []

  nodes.forEach((node) => {
    const text = extractStructuredText(node)

    if (node.type === 'paragraph') {
      blocks.push({ id: uid(), type: 'p', text })
      return
    }

    if (node.type === 'heading') {
      const level = node.attrs?.level
      const headingType = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'
      blocks.push({ id: uid(), type: headingType, text })
      return
    }

    if (node.type === 'codeBlock') {
      blocks.push({ id: uid(), type: 'code', text })
      return
    }

    if (node.type === 'blockquote') {
      blocks.push({ id: uid(), type: 'quote', text })
      return
    }

    if (node.type === 'bulletList') {
      const block = listNodeToBlock(node, false)
      if (block) blocks.push(block)
      return
    }

    if (node.type === 'orderedList') {
      const block = listNodeToBlock(node, true)
      if (block) blocks.push(block)
      return
    }

    if (node.type === 'aiCallout') {
      blocks.push({ id: uid(), type: 'quote', text })
      return
    }

    if (node.type === 'inlineNote') {
      blocks.push({ id: uid(), type: 'callout', text })
      return
    }

    if (node.type === 'table') {
      blocks.push({ id: uid(), type: 'p', text })
      return
    }

    if (node.type === 'image') {
      if (text.trim().length > 0) {
        blocks.push({ id: uid(), type: 'p', text })
      }
      return
    }

    if (text.trim().length > 0) {
      blocks.push({ id: uid(), type: 'p', text })
    }
  })

  return blocks.length > 0 ? blocks : [{ id: uid(), type: 'p', text: '' }]
}

function normalizeTitle(value) {
  const trimmed = value.trim()
  return trimmed || 'Untitled Note'
}

function isWebUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function getSafeTags(note) {
  return Array.isArray(note?.tags) ? note.tags : []
}

function areOutlineItemsEqual(previousItems = [], nextItems = []) {
  if (previousItems === nextItems) return true
  if (previousItems.length !== nextItems.length) return false

  return previousItems.every((item, index) => {
    const nextItem = nextItems[index]
    return (
      item?.id === nextItem?.id &&
      item?.level === nextItem?.level &&
      item?.text === nextItem?.text
    )
  })
}

function areSlashMenusEqual(previousMenu, nextMenu) {
  const previousRange = previousMenu?.range
  const nextRange = nextMenu?.range

  return (
    previousMenu?.open === nextMenu?.open &&
    previousMenu?.top === nextMenu?.top &&
    previousMenu?.left === nextMenu?.left &&
    previousRange?.from === nextRange?.from &&
    previousRange?.to === nextRange?.to
  )
}

function getViewportOptimizedTheme(theme, reduceEffects) {
  if (!reduceEffects) return theme

  return {
    ...theme,
    workspaceShadow: '0 12px 28px rgba(2,8,23,0.22)',
    panelShadow: '0 10px 22px rgba(3,10,25,0.18)',
    actionShadow: '0 10px 22px rgba(8,16,38,0.2)',
    editorFrameShadow: '0 14px 30px rgba(2,8,23,0.24)',
    floatingShadow: '0 16px 28px rgba(3,10,26,0.24)',
    cssVars: {
      ...theme.cssVars,
      '--note-editor-image-shadow': '0 10px 22px rgba(2,8,23,0.2)',
      '--note-editor-link-shadow': '0 8px 18px rgba(2,8,23,0.16)',
    },
  }
}

export default function Editor({ 
  note, 
  onBack, 
  onSave,
  onCreateNote = null,
  onGenerateSelectionTest = null,
  appTopOffset = DEFAULT_APP_TOPBAR_HEIGHT,
  // Props for linked notes feature
  allNotes = [],           // All notes across subjects (for linking)
  onAddLinkedNote = null,  // (targetNoteId) => void
  onRemoveLinkedNote = null, // (targetNoteId) => void
  onNavigateToNote = null, // (note) => void - Navigate to linked note
}) {
  const [title, setTitle] = useState(note.title ?? 'Untitled Note')
  const [themeId, setThemeId] = useState(() => getNoteThemeId(note.theme))
  const [fontSizeId, setFontSizeId] = useState(() => getNoteFontSizeId(note.fontSize))
  const [outlineItems, setOutlineItems] = useState([])
  const [activeOutlineId, setActiveOutlineId] = useState(null)
  const [headerBarHeight, setHeaderBarHeight] = useState(0)
  const [saveState, setSaveState] = useState('saved')
  const [slashMenu, setSlashMenu] = useState(EMPTY_SLASH_MENU)
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < EDITOR_EFFECT_BREAKPOINT : false
  )
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < EDITOR_MOBILE_BREAKPOINT : false
  )

  const noteRef = useRef(note)
  const titleRef = useRef(note.title ?? 'Untitled Note')
  const themeRef = useRef(getNoteThemeId(note.theme))
  const fontSizeRef = useRef(getNoteFontSizeId(note.fontSize))
  const activeNoteIdRef = useRef(note.id)
  const saveTimerRef = useRef(null)
  const initialContentRef = useRef(getInitialContent(note))
  const headerBarRef = useRef(null)
  const editorFrameRef = useRef(null)
  const outlineSectionRef = useRef(null)
  const outlineItemsRef = useRef([])
  const outlineSyncTimerRef = useRef(null)
  const activeOutlineFrameRef = useRef(null)

  const extensions = useMemo(() => buildEditorExtensions(), [])
  const currentTheme = useMemo(
    () => getViewportOptimizedTheme(getNoteTheme(themeId), isCompactViewport),
    [themeId, isCompactViewport]
  )
  const currentFontSize = getNoteFontSize(fontSizeId)
  const showLinkedNotes = Boolean(onAddLinkedNote && onRemoveLinkedNote && allNotes.length > 0)
  const resolvedAppTopOffset = Number.isFinite(appTopOffset)
    ? Math.max(0, appTopOffset)
    : DEFAULT_APP_TOPBAR_HEIGHT
  const workspaceViewportOffset = resolvedAppTopOffset + WORKSPACE_TOP_GAP
  const sidebarStickyTop = WORKSPACE_TOP_GAP
  const editorBodyHeight = `calc(100dvh - ${workspaceViewportOffset + headerBarHeight + HEADER_TO_CONTENT_GAP + EDITOR_VIEWPORT_BOTTOM_GAP}px)`
  const sidebarMaxHeight = `calc(100dvh - ${resolvedAppTopOffset + sidebarStickyTop + EDITOR_VIEWPORT_BOTTOM_GAP}px)`
  const reduceEffects = isCompactViewport
  const simplifyMobileEditor = isMobileViewport
  const showDesktopEditorChrome = !simplifyMobileEditor
  const workspaceBackdrop = reduceEffects ? 'none' : 'blur(28px) saturate(160%)'
  const panelBackdrop = reduceEffects ? 'none' : 'blur(24px) saturate(160%)'
  const editorFrameBackdrop = reduceEffects ? 'none' : 'blur(26px) saturate(165%)'
  const fabBackdrop = reduceEffects ? 'none' : 'blur(18px)'
  const workspacePadding = simplifyMobileEditor ? '10px' : '16px'
  const workspaceRadius = simplifyMobileEditor ? '20px' : '28px'
  const workspaceGap = simplifyMobileEditor ? '10px' : '14px'
  const headerPadding = simplifyMobileEditor ? '8px 10px' : '10px 12px'
  const headerRadius = simplifyMobileEditor ? '12px' : '14px'
  const headerWrap = simplifyMobileEditor ? 'nowrap' : 'wrap'
  const headerControlsGap = simplifyMobileEditor ? '8px' : '10px'
  const editorFrameRadius = simplifyMobileEditor ? '14px' : '16px'
  const editorFrameMinHeight = simplifyMobileEditor ? '420px' : '540px'
  const contentLayoutGap = simplifyMobileEditor ? '10px' : '14px'

  const editor = useEditor(
    {
      extensions,
      content: initialContentRef.current,
      autofocus: 'end',
      parseOptions: { preserveWhitespace: 'full' },
      editorProps: {
        attributes: {
          class: 'learnledger-tiptap focus:outline-none',
        },
      },
      immediatelyRender: true,
    },
    []
  )

  const syncOutlineItems = useCallback(() => {
    if (!editor) return

    const nextItems = extractHeadingsFromJson(editor.getJSON())
    const resolvedItems = areOutlineItemsEqual(outlineItemsRef.current, nextItems)
      ? outlineItemsRef.current
      : nextItems

    if (resolvedItems !== outlineItemsRef.current) {
      outlineItemsRef.current = resolvedItems
      setOutlineItems(resolvedItems)
    }

    setActiveOutlineId((previous) => {
      if (resolvedItems.length === 0) return null
      if (previous && resolvedItems.some((item) => item.id === previous)) return previous
      return resolvedItems[0].id
    })
  }, [editor])

  const applySlashMenuState = useCallback((nextMenu) => {
    setSlashMenu((previousMenu) =>
      areSlashMenusEqual(previousMenu, nextMenu) ? previousMenu : nextMenu
    )
  }, [])

  const scheduleOutlineSync = useCallback(() => {
    if (outlineSyncTimerRef.current) {
      window.clearTimeout(outlineSyncTimerRef.current)
    }

    outlineSyncTimerRef.current = window.setTimeout(() => {
      outlineSyncTimerRef.current = null
      syncOutlineItems()
    }, OUTLINE_SYNC_DELAY_MS)
  }, [syncOutlineItems])

  const syncSlashMenu = useCallback(() => {
    if (!editor || !editorFrameRef.current) {
      applySlashMenuState(EMPTY_SLASH_MENU)
      return
    }

    const slashState = getInlineNoteSlashCommandState(editor.state)
    if (!slashState.active || !slashState.range) {
      applySlashMenuState(EMPTY_SLASH_MENU)
      return
    }

    const frameRect = editorFrameRef.current.getBoundingClientRect()
    const coords = editor.view.coordsAtPos(slashState.range.from)
    const maxLeft = Math.max(16, frameRect.width - 236)
    const maxTop = Math.max(16, frameRect.height - 72)

    applySlashMenuState({
      open: true,
      range: slashState.range,
      top: clampPosition(coords.bottom - frameRect.top + 10, 16, maxTop),
      left: clampPosition(coords.left - frameRect.left, 16, maxLeft),
    })
  }, [applySlashMenuState, editor])

  const updateActiveOutline = useCallback(() => {
    if (!editorFrameRef.current || outlineItems.length === 0) {
      setActiveOutlineId(null)
      return
    }

    const headingNodes = outlineItems
      .map((item) => editorFrameRef.current.querySelector(`[id="${item.id}"]`))
      .filter(Boolean)

    if (headingNodes.length === 0) {
      setActiveOutlineId(null)
      return
    }

    const threshold = 150
    let nextActiveId = headingNodes[0].id

    headingNodes.forEach((node) => {
      if (node.getBoundingClientRect().top <= threshold) {
        nextActiveId = node.id
      }
    })

    setActiveOutlineId(nextActiveId)
  }, [outlineItems])

  const scheduleActiveOutlineUpdate = useCallback(() => {
    if (activeOutlineFrameRef.current) return

    activeOutlineFrameRef.current = requestAnimationFrame(() => {
      activeOutlineFrameRef.current = null
      updateActiveOutline()
    })
  }, [updateActiveOutline])

  const handleSelectOutlineItem = useCallback(
    (headingId) => {
      if (!editor || !editorFrameRef.current) return

      editor.commands.focus()

      requestAnimationFrame(() => {
        const headingNode = editorFrameRef.current.querySelector(`[id="${headingId}"]`)
        if (!headingNode) return

        headingNode.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setActiveOutlineId(headingId)
      })
    },
    [editor]
  )

  const handleJumpToOutline = useCallback(() => {
    outlineSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [])

  const handleGenerateSelectionTest = useCallback(
    ({ text, range, insertionPos }) => {
      if (!onGenerateSelectionTest) return

      onGenerateSelectionTest({
        text,
        range,
        insertionPos,
        noteId: noteRef.current?.id || null,
        noteTitle: normalizeTitle(titleRef.current),
      })
    },
    [onGenerateSelectionTest]
  )

  const handleInsertInlineNote = useCallback(() => {
    if (!editor || !slashMenu.range) return

    const insertPos = insertInlineNoteAtRange(editor, slashMenu.range)
    applySlashMenuState(EMPTY_SLASH_MENU)

    if (insertPos == null) return

    requestAnimationFrame(() => {
      editor.chain().focus(insertPos + 2).run()
    })
  }, [applySlashMenuState, editor, slashMenu.range])

  const handleInsertTable = useCallback(
    (options) => {
      if (!editor) return
      editor.chain().focus().insertTable(options).run()
    },
    [editor]
  )

  const handleInsertLinkBlock = useCallback(
    ({ href, label }) => {
      if (!editor) return false

      const nextHref = String(href || '').trim()
      const nextLabel = String(label || '').trim()

      if (!isWebUrl(nextHref)) {
        window.alert('Please paste a valid URL starting with http or https.')
        return false
      }

      return editor
        .chain()
        .focus()
        .insertClickableLink({
          href: nextHref,
          label: nextLabel || nextHref,
        })
        .run()
    },
    [editor]
  )

  const persistNote = useCallback(() => {
    if (!editor) return

    const currentTitle = normalizeTitle(titleRef.current)
    const content = editor.getHTML()
    const blocks = tiptapJsonToBlocks(editor.getJSON())
    const currentThemeId = getNoteThemeId(themeRef.current)
    const currentFontSizeId = getNoteFontSizeId(fontSizeRef.current)

    onSave({
      ...noteRef.current,
      title: currentTitle,
      content,
      blocks,
      tags: getSafeTags(noteRef.current),
      theme: currentThemeId,
      fontSize: currentFontSizeId,
    })

    setSaveState('saved')
  }, [editor, onSave])

  const queueAutosave = useCallback(() => {
    if (!editor) return

    clearTimeout(saveTimerRef.current)
    setSaveState('dirty')

    saveTimerRef.current = setTimeout(() => {
      setSaveState('saving')
      persistNote()
    }, AUTOSAVE_DELAY_MS)
  }, [editor, persistNote])

  const handleSaveNow = useCallback(() => {
    clearTimeout(saveTimerRef.current)
    setSaveState('saving')
    persistNote()
  }, [persistNote])

  const handleThemeChange = useCallback(
    (nextThemeId) => {
      const resolvedThemeId = getNoteThemeId(nextThemeId)
      if (themeRef.current === resolvedThemeId) return

      setThemeId(resolvedThemeId)
      themeRef.current = resolvedThemeId
      noteRef.current = { ...noteRef.current, theme: resolvedThemeId }
      queueAutosave()
    },
    [queueAutosave]
  )

  const handleFontSizeChange = useCallback(
    (nextFontSizeId) => {
      const resolvedFontSizeId = getNoteFontSizeId(nextFontSizeId)
      if (fontSizeRef.current === resolvedFontSizeId) return

      setFontSizeId(resolvedFontSizeId)
      fontSizeRef.current = resolvedFontSizeId
      noteRef.current = { ...noteRef.current, fontSize: resolvedFontSizeId }
      queueAutosave()
    },
    [queueAutosave]
  )

  const handleBack = () => {
    if (saveState !== 'saved') {
      handleSaveNow()
    }
    onBack()
  }

  const handleCreateNote = () => {
    if (saveState !== 'saved') {
      handleSaveNow()
    }

    onCreateNote?.()
  }

  useEffect(() => {
    noteRef.current = note
  }, [note])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const compactQuery = window.matchMedia(`(max-width: ${EDITOR_EFFECT_BREAKPOINT - 1}px)`)
    const mobileQuery = window.matchMedia(`(max-width: ${EDITOR_MOBILE_BREAKPOINT - 1}px)`)
    const syncViewportMode = () => {
      setIsCompactViewport(compactQuery.matches)
      setIsMobileViewport(mobileQuery.matches)
    }

    syncViewportMode()

    if (
      typeof compactQuery.addEventListener === 'function' &&
      typeof mobileQuery.addEventListener === 'function'
    ) {
      compactQuery.addEventListener('change', syncViewportMode)
      mobileQuery.addEventListener('change', syncViewportMode)
      return () => {
        compactQuery.removeEventListener('change', syncViewportMode)
        mobileQuery.removeEventListener('change', syncViewportMode)
      }
    }

    compactQuery.addListener(syncViewportMode)
    mobileQuery.addListener(syncViewportMode)
    return () => {
      compactQuery.removeListener(syncViewportMode)
      mobileQuery.removeListener(syncViewportMode)
    }
  }, [])

  useEffect(() => {
    titleRef.current = title
  }, [title])

  // Keep title/content in sync when the user opens a different note.
  useEffect(() => {
    if (!editor) return
    if (activeNoteIdRef.current === note.id) return

    activeNoteIdRef.current = note.id
    const nextTitle = note.title ?? 'Untitled Note'
    const nextThemeId = getNoteThemeId(note.theme)
    const nextFontSizeId = getNoteFontSizeId(note.fontSize)

    setTitle(nextTitle)
    titleRef.current = nextTitle
    setThemeId(nextThemeId)
    themeRef.current = nextThemeId
    setFontSizeId(nextFontSizeId)
    fontSizeRef.current = nextFontSizeId
    setSaveState('saved')
    applySlashMenuState(EMPTY_SLASH_MENU)
    clearTimeout(saveTimerRef.current)
    if (outlineSyncTimerRef.current) {
      window.clearTimeout(outlineSyncTimerRef.current)
      outlineSyncTimerRef.current = null
    }

    editor.commands.setContent(getInitialContent(note), {
      emitUpdate: false,
      parseOptions: { preserveWhitespace: 'full' },
    })

    requestAnimationFrame(() => {
      syncOutlineItems()
      scheduleActiveOutlineUpdate()
      syncSlashMenu()
    })
  }, [applySlashMenuState, editor, note, scheduleActiveOutlineUpdate, syncOutlineItems, syncSlashMenu])

  useEffect(() => {
    if (!editor) return

    syncOutlineItems()

    const handleUpdate = () => {
      scheduleOutlineSync()
      syncSlashMenu()
      queueAutosave()
      scheduleActiveOutlineUpdate()
    }

    const handleSelectionUpdate = () => {
      syncSlashMenu()
    }

    editor.on('update', handleUpdate)
    editor.on('selectionUpdate', handleSelectionUpdate)
    return () => {
      editor.off('update', handleUpdate)
      editor.off('selectionUpdate', handleSelectionUpdate)
    }
  }, [editor, queueAutosave, scheduleActiveOutlineUpdate, scheduleOutlineSync, syncOutlineItems, syncSlashMenu])

  useEffect(() => {
    if (outlineItems.length === 0) return undefined

    const handleScroll = () => {
      scheduleActiveOutlineUpdate()
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    window.addEventListener('resize', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [outlineItems, scheduleActiveOutlineUpdate])

  // Cmd/Ctrl + S should save instantly.
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        handleSaveNow()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSaveNow])

  useEffect(
    () => () => {
      clearTimeout(saveTimerRef.current)
      clearTimeout(outlineSyncTimerRef.current)
      if (activeOutlineFrameRef.current) {
        cancelAnimationFrame(activeOutlineFrameRef.current)
      }
    },
    []
  )

  useEffect(() => {
    const headerNode = headerBarRef.current
    if (!headerNode) return undefined

    const syncHeaderHeight = () => {
      setHeaderBarHeight(headerNode.getBoundingClientRect().height)
    }

    syncHeaderHeight()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncHeaderHeight)
      return () => window.removeEventListener('resize', syncHeaderHeight)
    }

    const observer = new ResizeObserver(() => {
      syncHeaderHeight()
    })

    observer.observe(headerNode)
    window.addEventListener('resize', syncHeaderHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncHeaderHeight)
    }
  }, [])

  return (
    <>
      <div
        className="animate-fade-in"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: workspaceGap,
          position: 'relative',
          isolation: 'isolate',
          padding: workspacePadding,
          borderRadius: workspaceRadius,
          background: currentTheme.workspaceBackground,
          border: `1px solid ${currentTheme.workspaceBorder}`,
          boxShadow: currentTheme.workspaceShadow,
          backdropFilter: workspaceBackdrop,
        }}
      >
      <div
        ref={headerBarRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: headerControlsGap,
          flexWrap: headerWrap,
          background: currentTheme.panelBackground,
          border: `1px solid ${currentTheme.panelBorder}`,
          borderRadius: headerRadius,
          padding: headerPadding,
          boxShadow: currentTheme.panelShadow,
          backdropFilter: panelBackdrop,
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: `1px solid ${currentTheme.pillBorder}`,
            background: currentTheme.pillBackground,
            color: currentTheme.pillText,
            borderRadius: '9px',
            padding: '7px 12px',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            fontWeight: '600',
            flexShrink: 0,
          }}
        >
          <span style={{ width: '13px', height: '13px' }}>
            <BackIcon />
          </span>
          Notes
        </button>

        <input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            queueAutosave()
          }}
          placeholder="Untitled Note"
          className="learnledger-input"
          style={{
            flex: 1,
            minWidth: 0,
            borderRadius: '10px',
            background: currentTheme.titleInputBackground,
            borderColor: currentTheme.titleInputBorder,
            fontWeight: '700',
            color: currentTheme.titleInputText,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        />

        {showDesktopEditorChrome && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              marginLeft: 'auto',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {NOTE_FONT_SIZE_OPTIONS.map((option) => {
                const active = option.id === fontSizeId
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleFontSizeChange(option.id)}
                    title={`Font size ${option.label}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '38px',
                      borderRadius: '999px',
                      border: `1px solid ${active ? currentTheme.pillActiveBorder : currentTheme.pillBorder}`,
                      background: active ? currentTheme.pillActiveBackground : currentTheme.pillBackground,
                      color: active ? currentTheme.pillActiveText : currentTheme.pillText,
                      padding: '7px 10px',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: option.id === 'large' ? '13px' : '12px',
                      fontWeight: '800',
                    }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {NOTE_THEME_OPTIONS.map((theme) => {
                const active = theme.id === themeId
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleThemeChange(theme.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '999px',
                      border: `1px solid ${active ? currentTheme.pillActiveBorder : currentTheme.pillBorder}`,
                      background: active ? currentTheme.pillActiveBackground : currentTheme.pillBackground,
                      color: active ? currentTheme.pillActiveText : currentTheme.pillText,
                      padding: '7px 11px',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '12px',
                      fontWeight: '700',
                      boxShadow: active ? currentTheme.actionShadow : 'none',
                    }}
                  >
                    <span
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '999px',
                        background: theme.preview,
                        border: '1px solid rgba(255,255,255,0.18)',
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.08) inset',
                      }}
                    />
                    {theme.label}
                  </button>
                )
              })}
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '72px',
                minHeight: '30px',
                color: saveState === 'saved' ? currentTheme.accent : currentTheme.pillText,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '11px',
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving...' : 'Unsaved'}
            </span>
            {onCreateNote && (
              <button
                type="button"
                onClick={handleCreateNote}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: `1px solid ${currentTheme.pillBorder}`,
                  background: currentTheme.pillBackground,
                  color: currentTheme.pillText,
                  borderRadius: '9px',
                  padding: '7px 12px',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '12px',
                  fontWeight: '700',
                  boxShadow: currentTheme.actionShadow,
                }}
              >
                <span style={{ width: '12px', height: '12px' }}>
                  <PlusIcon />
                </span>
                New Note
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveNow}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: `1px solid ${currentTheme.actionBorder}`,
                background: currentTheme.actionBackground,
                color: currentTheme.actionText,
                borderRadius: '9px',
                padding: '7px 12px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                fontWeight: '700',
              }}
            >
              <span style={{ width: '12px', height: '12px' }}>
                <SaveIcon />
              </span>
              Save
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3.5 md:flex-row md:items-start" style={{ gap: contentLayoutGap }}>
        {/* Main Editor Area */}
        <div
          className="[height:var(--editor-body-height)]"
          style={{
            flex: 1,
            minWidth: 0,
            '--editor-body-height': editorBodyHeight,
          }}
        >
          <div
            ref={editorFrameRef}
            className="flex h-full flex-col"
            style={{
              position: 'relative',
              background: currentTheme.editorFrameBackground,
              border: `1px solid ${currentTheme.editorFrameBorder}`,
              borderRadius: editorFrameRadius,
              overflow: 'hidden',
              minHeight: editorFrameMinHeight,
              boxShadow: currentTheme.editorFrameShadow,
              backdropFilter: editorFrameBackdrop,
              ...currentTheme.cssVars,
              '--note-editor-font-size': currentFontSize.fontSize,
              '--note-editor-line-height': currentFontSize.lineHeight,
            }}
          >
            {showDesktopEditorChrome && (
              <EditorToolbar
                editor={editor}
                themeStyles={currentTheme}
                onInsertTable={handleInsertTable}
                onInsertLink={handleInsertLinkBlock}
                reduceEffects={reduceEffects}
              />
            )}
            {showDesktopEditorChrome && (
              <FloatingToolbar
                editor={editor}
                themeStyles={currentTheme}
                containerRef={editorFrameRef}
                onGenerateTest={onGenerateSelectionTest ? handleGenerateSelectionTest : null}
                reduceEffects={reduceEffects}
              />
            )}
            {showDesktopEditorChrome && (
              <InlineNoteSlashMenu
                open={slashMenu.open}
                top={slashMenu.top}
                left={slashMenu.left}
                onInsert={handleInsertInlineNote}
              />
            )}
            <EditorContent
              editor={editor}
              className="learnledger-tiptap-shell min-h-0 flex-1 overflow-auto"
            />
          </div>
        </div>

        <div className="w-full md:w-[260px] md:flex-shrink-0 lg:w-[280px]">
          <div
            className="flex flex-col gap-3.5 md:sticky md:overflow-y-auto md:pr-1 md:[top:var(--editor-sidebar-top)] md:[max-height:var(--editor-sidebar-max-height)]"
            style={{
              alignSelf: 'flex-start',
              '--editor-sidebar-top': `${sidebarStickyTop}px`,
              '--editor-sidebar-max-height': sidebarMaxHeight,
            }}
          >
            <div
              ref={outlineSectionRef}
              id="note-outline-panel"
              style={{ scrollMarginTop: '84px' }}
            >
              <OutlinePanel
                items={outlineItems}
                activeId={activeOutlineId}
                onSelect={handleSelectOutlineItem}
                themeStyles={currentTheme}
                reduceEffects={reduceEffects}
              />
            </div>

            {showLinkedNotes && (
              <LinkedNotesPanel
                currentNote={note}
                allNotes={allNotes}
                onAddLink={onAddLinkedNote}
                onRemoveLink={onRemoveLinkedNote}
                onNavigateToNote={onNavigateToNote || (() => {})}
                themeStyles={currentTheme}
                reduceEffects={reduceEffects}
              />
            )}
          </div>
        </div>
      </div>

      </div>

      {simplifyMobileEditor && (
        <button
          type="button"
          onClick={handleJumpToOutline}
          aria-label="Scroll to outline"
          title="Scroll to outline"
          className="animate-fade-in fixed z-40 inline-flex items-center justify-center rounded-full"
          style={{
            right: 'max(12px, env(safe-area-inset-right))',
            bottom: 'max(12px, env(safe-area-inset-bottom))',
            width: '46px',
            height: '46px',
            background: currentTheme.actionBackground,
            border: `1px solid ${currentTheme.actionBorder}`,
            color: currentTheme.actionText,
            boxShadow: currentTheme.actionShadow,
            backdropFilter: fabBackdrop,
          }}
        >
          <span style={{ width: '18px', height: '18px', flexShrink: 0 }}>
            <TopicsIcon />
          </span>
        </button>
      )}
    </>
  )
}
