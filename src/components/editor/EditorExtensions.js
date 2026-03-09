/**
 * EditorExtensions.js
 *
 * Single place to configure TipTap extensions used by the note editor.
 */

import { Mark, mergeAttributes } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'

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

/**
 * Exported factory keeps extension setup declarative and easy to test.
 */
export function buildEditorExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: true,
      bulletList: true,
      orderedList: true,
      blockquote: true,
    }),
    Underline,
    TextColor,
  ]
}
