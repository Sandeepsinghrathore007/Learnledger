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
import EditorToolbar from '@/components/editor/EditorToolbar'
import FloatingToolbar from '@/components/editor/FloatingToolbar'
import LinkedNotesPanel from '@/components/notes/LinkedNotesPanel'
import { buildEditorExtensions } from '@/components/editor/EditorExtensions'
import { BackIcon, SaveIcon } from '@/components/ui/Icons'
import { BORDER, BORDER2, SURFACE, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import { uid } from '@/utils/id'

const EMPTY_DOC_HTML = '<p></p>'
const AUTOSAVE_DELAY_MS = 900

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

function listNodeToBlock(node, ordered = false) {
  if (!Array.isArray(node?.content)) return null

  const lines = node.content
    .map((item, index) => {
      const text = extractText(item).trim()
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
    const text = extractText(node)

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

    if (text.trim().length > 0) {
      blocks.push({ id: uid(), type: 'p', text })
    }
  })

  return blocks.length > 0 ? blocks : [{ id: uid(), type: 'p', text: '' }]
}

function getDocStats(editor) {
  if (!editor) return { words: 0, chars: 0 }
  const rawText = editor.getText() ?? ''
  const trimmed = rawText.trim()
  return {
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    chars: rawText.length,
  }
}

function normalizeTitle(value) {
  const trimmed = value.trim()
  return trimmed || 'Untitled Note'
}

function normalizeTag(value = '') {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '')
}

function normalizeTags(values = []) {
  if (!Array.isArray(values)) return []

  const unique = new Set()
  values.forEach((tag) => {
    const normalized = normalizeTag(String(tag || ''))
    if (normalized) unique.add(normalized)
  })

  return Array.from(unique)
}

export default function Editor({ 
  note, 
  subjectColor, 
  onBack, 
  onSave,
  // Props for linked notes feature
  allNotes = [],           // All notes across subjects (for linking)
  onAddLinkedNote = null,  // (targetNoteId) => void
  onRemoveLinkedNote = null, // (targetNoteId) => void
  onNavigateToNote = null, // (note) => void - Navigate to linked note
}) {
  const [title, setTitle] = useState(note.title ?? 'Untitled Note')
  const [tags, setTags] = useState(() => normalizeTags(note.tags))
  const [tagInput, setTagInput] = useState('')
  const [saveState, setSaveState] = useState('saved')
  const [stats, setStats] = useState({ words: 0, chars: 0 })

  const noteRef = useRef(note)
  const titleRef = useRef(note.title ?? 'Untitled Note')
  const tagsRef = useRef(normalizeTags(note.tags))
  const activeNoteIdRef = useRef(note.id)
  const saveTimerRef = useRef(null)
  const initialContentRef = useRef(getInitialContent(note))
  const editorFrameRef = useRef(null)

  const extensions = useMemo(() => buildEditorExtensions(), [])

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

  const persistNote = useCallback(() => {
    if (!editor) return

    const currentTitle = normalizeTitle(titleRef.current)
    const content = editor.getHTML()
    const blocks = tiptapJsonToBlocks(editor.getJSON())
    const currentTags = normalizeTags(tagsRef.current)

    onSave({
      ...noteRef.current,
      title: currentTitle,
      content,
      blocks,
      tags: currentTags,
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

  const updateTags = useCallback(
    (nextTags) => {
      const normalized = normalizeTags(nextTags)
      setTags(normalized)
      tagsRef.current = normalized
      noteRef.current = { ...noteRef.current, tags: normalized }
      queueAutosave()
    },
    [queueAutosave]
  )

  const handleAddTag = useCallback(() => {
    const nextTag = normalizeTag(tagInput)
    if (!nextTag) return
    if (tagsRef.current.includes(nextTag)) {
      setTagInput('')
      return
    }
    updateTags([...tagsRef.current, nextTag])
    setTagInput('')
  }, [tagInput, updateTags])

  const handleRemoveTag = useCallback(
    (tagToRemove) => {
      updateTags(tagsRef.current.filter((tag) => tag !== tagToRemove))
    },
    [updateTags]
  )

  const handleTagInputKeyDown = useCallback(
    (event) => {
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault()
        handleAddTag()
        return
      }

      if (event.key === 'Backspace' && !tagInput && tagsRef.current.length > 0) {
        event.preventDefault()
        handleRemoveTag(tagsRef.current[tagsRef.current.length - 1])
      }
    },
    [handleAddTag, handleRemoveTag, tagInput]
  )

  const handleBack = () => {
    if (saveState !== 'saved') {
      handleSaveNow()
    }
    onBack()
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
    const nextTags = normalizeTags(note.tags)

    setTitle(nextTitle)
    titleRef.current = nextTitle
    setTags(nextTags)
    tagsRef.current = nextTags
    setTagInput('')
    setSaveState('saved')
    clearTimeout(saveTimerRef.current)

    editor.commands.setContent(getInitialContent(note), {
      emitUpdate: false,
      parseOptions: { preserveWhitespace: 'full' },
    })

    setStats(getDocStats(editor))
  }, [editor, note])

  useEffect(() => {
    if (!editor) return

    setStats(getDocStats(editor))

    const handleUpdate = () => {
      setStats(getDocStats(editor))
      queueAutosave()
    }

    editor.on('update', handleUpdate)
    return () => editor.off('update', handleUpdate)
  }, [editor, queueAutosave])

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
          background: SURFACE,
          border: `1px solid ${BORDER}`,
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
            border: `1px solid ${BORDER}`,
            background: 'rgba(255,255,255,0.02)',
            color: TEXT2,
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
            background: 'rgba(139,92,246,0.08)',
            borderColor: BORDER2,
            fontWeight: '700',
            color: TEXT1,
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '11px',
          }}
        >
          <span>{stats.words} words</span>
          <span>{stats.chars} chars</span>
          <span style={{ color: saveState === 'saved' ? subjectColor : TEXT2 }}>
            {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving...' : 'Unsaved'}
          </span>
          <button
            type="button"
            onClick={handleSaveNow}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: `1px solid ${subjectColor}3a`,
              background: `${subjectColor}18`,
              color: subjectColor,
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

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: '14px',
          padding: '10px 12px',
        }}
      >
        <span
          style={{
            color: TEXT2,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            fontWeight: '700',
            flexShrink: 0,
          }}
        >
          Tags
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flex: 1, minWidth: '220px' }}>
          {tags.length === 0 ? (
            <span
              style={{
                color: TEXT3,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
              }}
            >
              No tags yet
            </span>
          ) : (
            tags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: `${subjectColor}16`,
                  border: `1px solid ${subjectColor}33`,
                  borderRadius: '999px',
                  padding: '3px 9px',
                  color: subjectColor,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '11px',
                  fontWeight: '700',
                }}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: subjectColor,
                    fontSize: '12px',
                    lineHeight: 1,
                    padding: 0,
                  }}
                  aria-label={`Remove tag ${tag}`}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={handleTagInputKeyDown}
            placeholder="Add custom tag"
            className="learnledger-input"
            style={{
              width: '170px',
              borderRadius: '9px',
              padding: '8px 10px',
              fontSize: '12px',
            }}
          />
          <button
            type="button"
            onClick={handleAddTag}
            style={{
              border: `1px solid ${subjectColor}3a`,
              background: `${subjectColor}18`,
              color: subjectColor,
              borderRadius: '9px',
              padding: '8px 11px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              fontWeight: '700',
            }}
          >
            Add Tag
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
              background: SURFACE,
              border: `1px solid ${BORDER}`,
              borderRadius: '16px',
              overflow: 'hidden',
              minHeight: '540px',
            }}
          >
            <EditorToolbar editor={editor} subjectColor={subjectColor} />
            <FloatingToolbar editor={editor} subjectColor={subjectColor} containerRef={editorFrameRef} />
            <EditorContent editor={editor} className="learnledger-tiptap-shell" />
          </div>
        </div>

        {/* Sidebar: Linked Notes Panel */}
        {onAddLinkedNote && onRemoveLinkedNote && allNotes.length > 0 && (
          <div className="w-full xl:w-[280px] xl:flex-shrink-0">
            <LinkedNotesPanel
              currentNote={note}
              allNotes={allNotes}
              onAddLink={onAddLinkedNote}
              onRemoveLink={onRemoveLinkedNote}
              onNavigateToNote={onNavigateToNote || (() => {})}
            />
          </div>
        )}
      </div>
    </div>
  )
}
