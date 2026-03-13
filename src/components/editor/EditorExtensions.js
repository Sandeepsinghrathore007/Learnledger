/**
 * EditorExtensions.js
 *
 * Single place to configure TipTap extensions used by the note editor.
 */

import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import Heading from '@tiptap/extension-heading'
import { Plugin } from '@tiptap/pm/state'
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
  ]
}
