/**
 * FloatingToolbar.jsx
 *
 * Custom Notion-style floating toolbar that tracks TipTap selection.
 * We position it manually so the project stays within the requested package set.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { TextSelection } from '@tiptap/pm/state'
import { BORDER, TEXT1 } from '@/constants/theme'
import {
  canInsertObjectiveQuestion,
  insertObjectiveQuestionTemplate,
} from '@/components/editor/objectiveQuestion'

const FLOATING_BUTTONS = [
  {
    id: 'bold',
    label: 'B',
    title: 'Bold',
    isActive: (editor) => editor.isActive('bold'),
    onClick: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    id: 'italic',
    label: 'I',
    title: 'Italic',
    isActive: (editor) => editor.isActive('italic'),
    onClick: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    id: 'underline',
    label: 'U',
    title: 'Underline',
    isActive: (editor) => editor.isActive('underline'),
    onClick: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    id: 'code',
    label: '<>',
    title: 'Inline Code',
    isActive: (editor) => editor.isActive('code'),
    isDisabled: (editor) => !editor.can().chain().focus().toggleCode().run(),
    onClick: (editor) => editor.chain().focus().toggleCode().run(),
  },
  {
    id: 'h1',
    label: 'H1',
    title: 'Heading 1',
    isActive: (editor) => editor.isActive('heading', { level: 1 }),
    isDisabled: (editor) => !editor.can().chain().focus().toggleHeading({ level: 1 }).run(),
    onClick: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: 'h2',
    label: 'H2',
    title: 'Heading 2',
    isActive: (editor) => editor.isActive('heading', { level: 2 }),
    isDisabled: (editor) => !editor.can().chain().focus().toggleHeading({ level: 2 }).run(),
    onClick: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    label: 'H3',
    title: 'Heading 3',
    isActive: (editor) => editor.isActive('heading', { level: 3 }),
    isDisabled: (editor) => !editor.can().chain().focus().toggleHeading({ level: 3 }).run(),
    onClick: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: 'code-block',
    label: '{ }',
    title: 'Code Block',
    isActive: (editor) => editor.isActive('codeBlock'),
    isDisabled: (editor) => !editor.can().chain().focus().toggleCodeBlock().run(),
    onClick: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'objective-question',
    label: 'MCQ',
    title: 'Objective Question Template',
    isActive: () => false,
    isDisabled: (editor) => !canInsertObjectiveQuestion(editor),
    onClick: (editor) => insertObjectiveQuestionTemplate(editor),
  },
]

const TOOLBAR_MARGIN = 12
const TOOLBAR_OFFSET = 10

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

export default function FloatingToolbar({ editor, subjectColor, containerRef }) {
  const toolbarRef = useRef(null)
  const [position, setPosition] = useState({ visible: false, top: 0, left: 0 })

  const updatePosition = useCallback(() => {
    if (!editor || !containerRef?.current || !toolbarRef.current) {
      setPosition((prev) => (prev.visible ? { ...prev, visible: false } : prev))
      return
    }

    const { view, state } = editor
    const { selection } = state

    if (!(selection instanceof TextSelection) || selection.empty || !view.hasFocus()) {
      setPosition((prev) => (prev.visible ? { ...prev, visible: false } : prev))
      return
    }

    const start = view.coordsAtPos(selection.from)
    const end = view.coordsAtPos(selection.to)
    const frameRect = containerRef.current.getBoundingClientRect()
    const toolbarRect = toolbarRef.current.getBoundingClientRect()
    const selectionLeft = Math.min(start.left, end.left)
    const selectionRight = Math.max(start.right, end.right)
    const selectionTop = Math.min(start.top, end.top) - frameRect.top
    const selectionBottom = Math.max(start.bottom, end.bottom) - frameRect.top
    const anchorLeft = (selectionLeft + selectionRight) / 2 - frameRect.left
    const maxLeft = Math.max(TOOLBAR_MARGIN, frameRect.width - toolbarRect.width - TOOLBAR_MARGIN)
    const maxTop = Math.max(TOOLBAR_MARGIN, frameRect.height - toolbarRect.height - TOOLBAR_MARGIN)

    const nextLeft = clamp(anchorLeft - toolbarRect.width / 2, TOOLBAR_MARGIN, maxLeft)
    const preferredTop = selectionTop - toolbarRect.height - TOOLBAR_OFFSET
    const fallbackTop = selectionBottom + TOOLBAR_OFFSET
    const nextTop = clamp(
      preferredTop < TOOLBAR_MARGIN ? fallbackTop : preferredTop,
      TOOLBAR_MARGIN,
      maxTop,
    )

    setPosition({ visible: true, top: nextTop, left: nextLeft })
  }, [containerRef, editor])

  useEffect(() => {
    if (!editor) return

    const handleSelectionChange = () => {
      requestAnimationFrame(updatePosition)
    }

    const hideToolbar = () => {
      setPosition((prev) => (prev.visible ? { ...prev, visible: false } : prev))
    }

    editor.on('selectionUpdate', handleSelectionChange)
    editor.on('focus', handleSelectionChange)
    editor.on('blur', hideToolbar)
    window.addEventListener('resize', handleSelectionChange)
    window.addEventListener('scroll', handleSelectionChange, true)

    handleSelectionChange()

    return () => {
      editor.off('selectionUpdate', handleSelectionChange)
      editor.off('focus', handleSelectionChange)
      editor.off('blur', hideToolbar)
      window.removeEventListener('resize', handleSelectionChange)
      window.removeEventListener('scroll', handleSelectionChange, true)
    }
  }, [editor, updatePosition])

  return (
    <div
      ref={toolbarRef}
      aria-hidden={!position.visible}
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexWrap: 'wrap',
        maxWidth: 'calc(100% - 24px)',
        background: '#141126',
        border: `1px solid ${BORDER}`,
        borderRadius: '10px',
        padding: '4px',
        boxShadow: '0 14px 32px rgba(0,0,0,0.45)',
        opacity: position.visible ? 1 : 0,
        visibility: position.visible ? 'visible' : 'hidden',
        pointerEvents: position.visible ? 'auto' : 'none',
      }}
    >
      {FLOATING_BUTTONS.map((button) => {
        const active = button.isActive(editor)
        const disabled = button.isDisabled ? button.isDisabled(editor) : false

        return (
          <button
            key={button.id}
            type="button"
            title={button.title}
            disabled={disabled}
            onMouseDown={(event) => {
              event.preventDefault()
              if (disabled) return
              button.onClick(editor)
            }}
            style={{
              minWidth: '28px',
              height: '28px',
              borderRadius: '7px',
              border: 'none',
              background: active ? `${subjectColor}25` : 'transparent',
              color: active ? TEXT1 : '#b7abdd',
              fontSize: '12px',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: '700',
              opacity: disabled ? 0.45 : 1,
            }}
          >
            {button.label}
          </button>
        )
      })}
    </div>
  )
}
