/**
 * FloatingToolbar.jsx
 *
 * Custom Notion-style floating toolbar that tracks TipTap selection.
 * We position it manually so the project stays within the requested package set.
 */

import { useCallback, useEffect, useState } from 'react'
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

export default function FloatingToolbar({ editor, subjectColor, containerRef }) {
  const [position, setPosition] = useState({ visible: false, top: 0, left: 0 })

  const updatePosition = useCallback(() => {
    if (!editor || !containerRef?.current) {
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

    const nextLeft = (start.left + end.right) / 2 - frameRect.left
    const nextTop = Math.max(start.top - frameRect.top - 10, 12)

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

  if (!position.visible) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translate(-50%, -100%)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        background: '#141126',
        border: `1px solid ${BORDER}`,
        borderRadius: '10px',
        padding: '4px',
        boxShadow: '0 14px 32px rgba(0,0,0,0.45)',
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
