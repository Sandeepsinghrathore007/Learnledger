/**
 * EditorToolbar.jsx
 *
 * Fixed toolbar shown above the editor body.
 * Contains all primary formatting controls.
 */

import {
  canInsertObjectiveQuestion,
  insertObjectiveQuestionTemplate,
} from '@/components/editor/objectiveQuestion'

const TOOLBAR_BUTTONS = [
  {
    id: 'bold',
    label: 'B',
    title: 'Bold',
    isActive: (editor) => editor.isActive('bold'),
    isDisabled: (editor) => !editor.can().chain().focus().toggleBold().run(),
    onClick: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    id: 'italic',
    label: 'I',
    title: 'Italic',
    isActive: (editor) => editor.isActive('italic'),
    isDisabled: (editor) => !editor.can().chain().focus().toggleItalic().run(),
    onClick: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    id: 'underline',
    label: 'U',
    title: 'Underline',
    isActive: (editor) => editor.isActive('underline'),
    isDisabled: (editor) => !editor.can().chain().focus().toggleUnderline().run(),
    onClick: (editor) => editor.chain().focus().toggleUnderline().run(),
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
    id: 'bullet-list',
    label: '• List',
    title: 'Bullet List',
    isActive: (editor) => editor.isActive('bulletList'),
    isDisabled: (editor) => !editor.can().chain().focus().toggleBulletList().run(),
    onClick: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'ordered-list',
    label: '1. List',
    title: 'Numbered List',
    isActive: (editor) => editor.isActive('orderedList'),
    isDisabled: (editor) => !editor.can().chain().focus().toggleOrderedList().run(),
    onClick: (editor) => editor.chain().focus().toggleOrderedList().run(),
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
    title: 'Insert Objective Question Template',
    isActive: () => false,
    isDisabled: (editor) => !canInsertObjectiveQuestion(editor),
    onClick: (editor) => insertObjectiveQuestionTemplate(editor),
  },
]

const DEFAULT_THEME = {
  accent: '#8b5cf6',
  toolbarBackground: '#161129',
  toolbarBorder: 'rgba(139,92,246,0.12)',
  toolbarButtonBackground: 'rgba(255,255,255,0.02)',
  toolbarButtonBorder: 'rgba(139,92,246,0.14)',
  toolbarButtonText: '#c9bdf0',
  toolbarButtonActiveBackground: 'rgba(139,92,246,0.2)',
  toolbarButtonActiveBorder: 'rgba(167,139,250,0.38)',
  toolbarButtonActiveText: '#f7f2ff',
}

function ToolbarButton({ button, editor, themeStyles }) {
  const active = button.isActive(editor)
  const disabled = button.isDisabled(editor)
  const palette = themeStyles || DEFAULT_THEME

  return (
    <button
      type="button"
      title={button.title}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault()
        button.onClick(editor)
      }}
      style={{
        height: '30px',
        minWidth: '38px',
        borderRadius: '8px',
        border: `1px solid ${active ? palette.toolbarButtonActiveBorder : palette.toolbarButtonBorder}`,
        background: active ? palette.toolbarButtonActiveBackground : palette.toolbarButtonBackground,
        color: active ? palette.toolbarButtonActiveText : palette.toolbarButtonText,
        padding: '0 10px',
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: active ? '700' : '600',
        fontSize: '12px',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {button.label}
    </button>
  )
}

export default function EditorToolbar({ editor, themeStyles }) {
  if (!editor) return null
  const palette = themeStyles || DEFAULT_THEME

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap',
        padding: '10px 12px',
        borderBottom: `1px solid ${palette.toolbarBorder}`,
        background: palette.toolbarBackground,
      }}
    >
      {TOOLBAR_BUTTONS.map((button) => (
        <ToolbarButton key={button.id} button={button} editor={editor} themeStyles={palette} />
      ))}
    </div>
  )
}
