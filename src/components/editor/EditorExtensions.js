/**
 * EditorExtensions.js
 *
 * Single place to configure TipTap extensions used by the note editor.
 */

import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import Heading from '@tiptap/extension-heading'
import { Plugin, TextSelection } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import { AiCalloutNode } from '@/components/editor/AiCalloutNode'
import { buildHeadingIdFromText, createHeadingIdGenerator } from '@/components/editor/headingOutline'
import { InlineNoteNode } from '@/components/editor/InlineNoteNode'
import { InlineNoteSlashCommand } from '@/components/editor/inlineNoteSlashCommand'

/**
 * Underline is not part of StarterKit, so we define a compact mark extension
 * locally to avoid adding extra packages.
 */
const Underline = Mark.create({
  name: 'underline',

  parseHTML() {
    return [
      { tag: 'u' },
      {
        style: 'text-decoration',
        getAttrs: (value) => {
          if (typeof value !== 'string') return false
          return value.includes('underline') ? {} : false
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['u', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setUnderline:
        () =>
        ({ commands }) =>
          commands.setMark(this.name),
      toggleUnderline:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
      unsetUnderline:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-u': () => this.editor.commands.toggleUnderline(),
    }
  },
})

/**
 * Lightweight text color mark so templates (like MCQ) can ship readable
 * default colors without adding extra TipTap packages.
 */
const TextColor = Mark.create({
  name: 'textColor',

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.color || null,
        renderHTML: (attributes) => {
          if (!attributes.color) return {}
          return { style: `color: ${attributes.color}` }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        style: 'color',
        getAttrs: (value) => {
          if (typeof value !== 'string' || !value.trim()) return false
          return { color: value }
        },
      },
      {
        tag: 'span[style]',
        getAttrs: (element) => {
          const color = element.style?.color
          return color ? { color } : false
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setTextColor:
        (color) =>
        ({ commands }) =>
          commands.setMark(this.name, { color }),
      unsetTextColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})

const HeadingWithId = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('id'),
        renderHTML: (attributes) => {
          if (!attributes.id) return {}
          return { id: attributes.id }
        },
      },
    }
  },
})

const HeadingIdSync = Extension.create({
  name: 'headingIdSync',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (_transactions, _oldState, newState) => {
          const createHeadingId = createHeadingIdGenerator()
          const transaction = newState.tr

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'heading') return

            const nextId = buildHeadingIdFromText(node.textContent, createHeadingId)
            if (node.attrs?.id === nextId) return

            transaction.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              id: nextId,
            })
          })

          return transaction.steps.length > 0 ? transaction : null
        },
      }),
    ]
  },
})

const TAB_CHARACTER = '\t'
const TAB_WIDTH = 4

function clampEditorPosition(doc, position) {
  return Math.max(0, Math.min(position, doc.content.size))
}

function setMappedSelection(transaction, selection) {
  const nextFrom = clampEditorPosition(transaction.doc, transaction.mapping.map(selection.from, 1))
  const nextTo = clampEditorPosition(transaction.doc, transaction.mapping.map(selection.to, 1))

  try {
    transaction.setSelection(TextSelection.create(transaction.doc, nextFrom, nextTo))
  } catch {
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(nextTo)))
  }
}

function getSelectedTextblocks(doc, from, to) {
  const blocks = []
  const seenStarts = new Set()

  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return

    const start = pos + 1
    if (seenStarts.has(start)) return

    seenStarts.add(start)
    blocks.push({ start, text: node.textContent || '' })
  })

  return blocks
}

function getLeadingIndent(text = '') {
  if (text.startsWith(TAB_CHARACTER)) return TAB_CHARACTER

  const leadingSpaces = text.match(/^ +/)?.[0] || ''
  if (!leadingSpaces) return ''

  return leadingSpaces.slice(0, TAB_WIDTH)
}

function indentSelectedText(editor) {
  const { state, view } = editor
  const { selection } = state
  const transaction = state.tr

  if (selection.empty) {
    transaction.insertText(TAB_CHARACTER, selection.from, selection.to)
    const cursorPos = clampEditorPosition(transaction.doc, transaction.mapping.map(selection.to, 1))
    transaction.setSelection(TextSelection.create(transaction.doc, cursorPos, cursorPos))
    view.dispatch(transaction.scrollIntoView())
    return true
  }

  const blocks = getSelectedTextblocks(state.doc, selection.from, selection.to)
  if (blocks.length === 0) return false

  blocks
    .slice()
    .reverse()
    .forEach(({ start }) => {
      transaction.insertText(TAB_CHARACTER, start, start)
    })

  setMappedSelection(transaction, selection)
  view.dispatch(transaction.scrollIntoView())
  return true
}

function outdentSelectedText(editor) {
  const { state, view } = editor
  const { selection } = state
  const transaction = state.tr

  if (selection.empty) {
    const blockStart = selection.$from.start()
    const indent = getLeadingIndent(selection.$from.parent.textContent || '')
    if (!indent) return false

    transaction.delete(blockStart, blockStart + indent.length)
    const cursorPos = clampEditorPosition(transaction.doc, transaction.mapping.map(selection.from, 1))
    transaction.setSelection(TextSelection.create(transaction.doc, cursorPos, cursorPos))
    view.dispatch(transaction.scrollIntoView())
    return true
  }

  const blocks = getSelectedTextblocks(state.doc, selection.from, selection.to)
  if (blocks.length === 0) return false

  let changed = false

  blocks
    .slice()
    .reverse()
    .forEach(({ start }) => {
      const mappedStart = clampEditorPosition(transaction.doc, transaction.mapping.map(start, 1))
      const resolvedStart = transaction.doc.resolve(mappedStart)
      const indent = getLeadingIndent(resolvedStart.parent.textContent || '')

      if (!indent) return

      transaction.delete(mappedStart, mappedStart + indent.length)
      changed = true
    })

  if (!changed) return false

  setMappedSelection(transaction, selection)
  view.dispatch(transaction.scrollIntoView())
  return true
}

const SelectionTabIndentation = Extension.create({
  name: 'selectionTabIndentation',

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive('listItem') && this.editor.commands.sinkListItem('listItem')) {
          return true
        }

        return indentSelectedText(this.editor)
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('listItem') && this.editor.commands.liftListItem('listItem')) {
          return true
        }

        return outdentSelectedText(this.editor)
      },
    }
  },
})

/**
 * Exported factory keeps extension setup declarative and easy to test.
 */
export function buildEditorExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      codeBlock: true,
      bulletList: true,
      orderedList: true,
      blockquote: true,
    }),
    HeadingWithId.configure({ levels: [1, 2, 3] }),
    HeadingIdSync,
    Underline,
    TextColor,
    AiCalloutNode,
    InlineNoteNode,
    InlineNoteSlashCommand,
    SelectionTabIndentation,
  ]
}
