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
import AiAssistantPanel from '@/components/editor/AiAssistantPanel'
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
import { BackIcon, PlusIcon, SaveIcon } from '@/components/ui/Icons'
import { uid } from '@/utils/id'

const EMPTY_DOC_HTML = '<p></p>'
const AUTOSAVE_DELAY_MS = 900
const EMPTY_AI_PANEL = {
  open: false,
  selectedText: '',
  range: null,
  insertionPos: null,
}
const EMPTY_SLASH_MENU = {
  open: false,
  range: null,
  top: 0,
  left: 0,
}

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

function getSafeTags(note) {
  return Array.isArray(note?.tags) ? note.tags : []
}

export default function Editor({ 
  note, 
  onBack, 
  onSave,
  onCreateNote = null,
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
  const [saveState, setSaveState] = useState('saved')
  const [aiPanel, setAiPanel] = useState(EMPTY_AI_PANEL)
  const [slashMenu, setSlashMenu] = useState(EMPTY_SLASH_MENU)

  const noteRef = useRef(note)
  const titleRef = useRef(note.title ?? 'Untitled Note')
  const themeRef = useRef(getNoteThemeId(note.theme))
  const fontSizeRef = useRef(getNoteFontSizeId(note.fontSize))
  const activeNoteIdRef = useRef(note.id)
  const saveTimerRef = useRef(null)
  const initialContentRef = useRef(getInitialContent(note))
  const editorFrameRef = useRef(null)

  const extensions = useMemo(() => buildEditorExtensions(), [])
  const currentTheme = getNoteTheme(themeId)
  const currentFontSize = getNoteFontSize(fontSizeId)
  const showLinkedNotes = Boolean(onAddLinkedNote && onRemoveLinkedNote && allNotes.length > 0)

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
    setOutlineItems(nextItems)
    setActiveOutlineId((previous) => {
      if (nextItems.length === 0) return null
      if (previous && nextItems.some((item) => item.id === previous)) return previous
      return nextItems[0].id
    })
  }, [editor])

  const syncSlashMenu = useCallback(() => {
    if (!editor || !editorFrameRef.current) {
      setSlashMenu(EMPTY_SLASH_MENU)
      return
    }

    const slashState = getInlineNoteSlashCommandState(editor.state)
    if (!slashState.active || !slashState.range) {
      setSlashMenu(EMPTY_SLASH_MENU)
      return
    }

    const frameRect = editorFrameRef.current.getBoundingClientRect()
    const coords = editor.view.coordsAtPos(slashState.range.from)
    const maxLeft = Math.max(16, frameRect.width - 236)
    const maxTop = Math.max(16, frameRect.height - 72)

    setSlashMenu({
      open: true,
      range: slashState.range,
      top: clampPosition(coords.bottom - frameRect.top + 10, 16, maxTop),
      left: clampPosition(coords.left - frameRect.left, 16, maxLeft),
    })
  }, [editor])

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

  const handleOpenAiAssistant = useCallback(({ text, range, insertionPos }) => {
    setAiPanel({
      open: true,
      selectedText: text,
      range,
      insertionPos,
    })
  }, [])

  const handleCloseAiAssistant = useCallback(() => {
    setAiPanel(EMPTY_AI_PANEL)
  }, [])

  const handleInsertAiResponse = useCallback(
    (response) => {
      if (!editor || !editorFrameRef.current) return

      const explanation = String(response?.explanation || '').trim()
      const keyPoints = Array.isArray(response?.keyPoints)
        ? response.keyPoints.map((item) => String(item || '').trim()).filter(Boolean)
        : []

      if (!explanation && keyPoints.length === 0) return

      const calloutId = uid()
      const insertAt = Number.isInteger(aiPanel.insertionPos) ? aiPanel.insertionPos : editor.state.selection.to

      const inserted = editor
        .chain()
        .focus()
        .insertContentAt(insertAt, [
          {
            type: 'aiCallout',
            attrs: {
              calloutId,
              explanation,
              keyPoints,
            },
          },
          { type: 'paragraph' },
        ])
        .run()

      if (!inserted) return

      setAiPanel(EMPTY_AI_PANEL)

      requestAnimationFrame(() => {
        const calloutNode = editorFrameRef.current?.querySelector(`[data-callout-id="${calloutId}"]`)
        calloutNode?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
    },
    [aiPanel.insertionPos, editor]
  )

  const handleInsertInlineNote = useCallback(() => {
    if (!editor || !slashMenu.range) return

    const insertPos = insertInlineNoteAtRange(editor, slashMenu.range)
    setSlashMenu(EMPTY_SLASH_MENU)

    if (insertPos == null) return

    requestAnimationFrame(() => {
      editor.chain().focus(insertPos + 2).run()
    })
  }, [editor, slashMenu.range])

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
    setAiPanel(EMPTY_AI_PANEL)
    setSlashMenu(EMPTY_SLASH_MENU)
    clearTimeout(saveTimerRef.current)

    editor.commands.setContent(getInitialContent(note), {
      emitUpdate: false,
      parseOptions: { preserveWhitespace: 'full' },
    })

    requestAnimationFrame(() => {
      syncOutlineItems()
      updateActiveOutline()
      syncSlashMenu()
    })
  }, [editor, note, syncOutlineItems, syncSlashMenu, updateActiveOutline])

  useEffect(() => {
    if (!editor) return

    syncOutlineItems()

    const handleUpdate = () => {
      syncOutlineItems()
      syncSlashMenu()
      queueAutosave()
      requestAnimationFrame(updateActiveOutline)
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
  }, [editor, queueAutosave, syncOutlineItems, syncSlashMenu, updateActiveOutline])

  useEffect(() => {
    if (outlineItems.length === 0) return undefined

    const handleScroll = () => {
      requestAnimationFrame(updateActiveOutline)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleScroll)
    }
  }, [outlineItems, updateActiveOutline])

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
    },
    []
  )

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          background: currentTheme.panelBackground,
          border: `1px solid ${currentTheme.panelBorder}`,
          borderRadius: '14px',
          padding: '10px 12px',
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
            borderRadius: '10px',
            background: currentTheme.titleInputBackground,
            borderColor: currentTheme.titleInputBorder,
            fontWeight: '700',
            color: currentTheme.titleInputText,
          }}
        />

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
      </div>

      <div className="flex flex-col gap-3.5 xl:flex-row">
        {/* Main Editor Area */}
        <div style={{ flex: 1 }}>
          <div
            ref={editorFrameRef}
            style={{
              position: 'relative',
              background: currentTheme.editorFrameBackground,
              border: `1px solid ${currentTheme.editorFrameBorder}`,
              borderRadius: '16px',
              overflow: 'hidden',
              minHeight: '540px',
              boxShadow: currentTheme.editorFrameShadow,
              ...currentTheme.cssVars,
              '--note-editor-font-size': currentFontSize.fontSize,
              '--note-editor-line-height': currentFontSize.lineHeight,
            }}
          >
            <EditorToolbar editor={editor} themeStyles={currentTheme} />
            <FloatingToolbar
              editor={editor}
              themeStyles={currentTheme}
              containerRef={editorFrameRef}
              onAskAI={handleOpenAiAssistant}
            />
            <InlineNoteSlashMenu
              open={slashMenu.open}
              top={slashMenu.top}
              left={slashMenu.left}
              onInsert={handleInsertInlineNote}
            />
            <EditorContent editor={editor} className="learnledger-tiptap-shell" />
          </div>
        </div>

        <div className="w-full xl:w-[280px] xl:flex-shrink-0">
          <div className="flex flex-col gap-3.5">
            <AiAssistantPanel
              open={aiPanel.open}
              selectedText={aiPanel.selectedText}
              onClose={handleCloseAiAssistant}
              onInsert={handleInsertAiResponse}
            />

            <OutlinePanel
              items={outlineItems}
              activeId={activeOutlineId}
              onSelect={handleSelectOutlineItem}
            />

            {showLinkedNotes && (
              <LinkedNotesPanel
                currentNote={note}
                allNotes={allNotes}
                onAddLink={onAddLinkedNote}
                onRemoveLink={onRemoveLinkedNote}
                onNavigateToNote={onNavigateToNote || (() => {})}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
