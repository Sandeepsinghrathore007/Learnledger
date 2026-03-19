/**
 * EditorExtensions.js
 *
 * Single place to configure TipTap extensions used by the note editor.
 */

import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core'
import Heading from '@tiptap/extension-heading'
import { Plugin, TextSelection } from '@tiptap/pm/state'
import { addRowAfter, goToNextCell, isInTable, tableEditing } from '@tiptap/pm/tables'
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

const DEFAULT_TABLE_ROWS = 3
const DEFAULT_TABLE_COLUMNS = 3
const MAX_TABLE_ROWS = 20
const MAX_TABLE_COLUMNS = 12

function clampTableDimension(value, fallback, max) {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(parsed, max)
}

function parseColwidthAttribute(element) {
  const rawValue = element.getAttribute('data-colwidth')

  if (!rawValue) return null

  const values = rawValue
    .split(',')
    .map((segment) => Number.parseInt(segment.trim(), 10))
    .filter((segment) => Number.isFinite(segment) && segment > 0)

  return values.length > 0 ? values : null
}

function createTableNode(schema, options = {}) {
  const safeRows = clampTableDimension(options.rows, DEFAULT_TABLE_ROWS, MAX_TABLE_ROWS)
  const safeColumns = clampTableDimension(options.cols, DEFAULT_TABLE_COLUMNS, MAX_TABLE_COLUMNS)
  const withHeaderRow = options.withHeaderRow !== false

  if (!schema?.nodes?.table || !schema?.nodes?.tableRow || !schema?.nodes?.tableCell || !schema?.nodes?.tableHeader) {
    return null
  }

  const rows = Array.from({ length: safeRows }, (_, rowIndex) => {
    const cellType = rowIndex === 0 && withHeaderRow
      ? schema.nodes.tableHeader
      : schema.nodes.tableCell

    const cells = Array.from({ length: safeColumns }, () => cellType.createAndFill())
    return schema.nodes.tableRow.create(null, cells)
  })

  return schema.nodes.table.create(null, rows)
}

function moveSelectionInsideTable(transaction, insertPos) {
  const cursorPos = clampEditorPosition(transaction.doc, insertPos + 4)

  try {
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(cursorPos)))
  } catch {
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(insertPos)))
  }
}

const Table = Node.create({
  name: 'table',
  group: 'block',
  content: 'tableRow+',
  isolating: true,

  parseHTML() {
    return [{ tag: 'table' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['table', mergeAttributes(HTMLAttributes), ['tbody', 0]]
  },

  addCommands() {
    return {
      insertTable:
        (options = {}) =>
        ({ state, dispatch }) => {
          const tableNode = createTableNode(state.schema, options)
          if (!tableNode) return false

          const insertPos = state.selection.from
          const transaction = state.tr.replaceSelectionWith(tableNode, false)
          moveSelectionInsideTable(transaction, insertPos)

          if (dispatch) {
            dispatch(transaction.scrollIntoView())
          }

          return true
        },
      goToNextTableCell:
        () =>
        ({ state, dispatch, view }) => {
          if (goToNextCell(1)(state, dispatch, view)) return true
          if (!addRowAfter(state, dispatch)) return false
          return goToNextCell(1)(state, dispatch, view)
        },
      goToPreviousTableCell:
        () =>
        ({ state, dispatch, view }) =>
          goToNextCell(-1)(state, dispatch, view),
    }
  },

  addProseMirrorPlugins() {
    return [tableEditing()]
  },

  extendNodeSchema(extension) {
    if (extension.name !== this.name) return {}
    return { tableRole: 'table' }
  },
})

const TableRow = Node.create({
  name: 'tableRow',
  content: '(tableCell | tableHeader)*',

  parseHTML() {
    return [{ tag: 'tr' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['tr', mergeAttributes(HTMLAttributes), 0]
  },

  extendNodeSchema(extension) {
    if (extension.name !== this.name) return {}
    return { tableRole: 'row' }
  },
})

const cellAttributes = {
  colspan: {
    default: 1,
    parseHTML: (element) => Number.parseInt(element.getAttribute('colspan') || '1', 10) || 1,
    renderHTML: (attributes) => (
      Number(attributes.colspan) > 1
        ? { colspan: Number(attributes.colspan) }
        : {}
    ),
  },
  rowspan: {
    default: 1,
    parseHTML: (element) => Number.parseInt(element.getAttribute('rowspan') || '1', 10) || 1,
    renderHTML: (attributes) => (
      Number(attributes.rowspan) > 1
        ? { rowspan: Number(attributes.rowspan) }
        : {}
    ),
  },
  colwidth: {
    default: null,
    parseHTML: (element) => parseColwidthAttribute(element),
    renderHTML: (attributes) => (
      Array.isArray(attributes.colwidth) && attributes.colwidth.length > 0
        ? { 'data-colwidth': attributes.colwidth.join(',') }
        : {}
    ),
  },
}

const TableCell = Node.create({
  name: 'tableCell',
  content: 'block+',
  isolating: true,

  addAttributes() {
    return cellAttributes
  },

  parseHTML() {
    return [{ tag: 'td' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['td', mergeAttributes(HTMLAttributes), 0]
  },

  extendNodeSchema(extension) {
    if (extension.name !== this.name) return {}
    return { tableRole: 'cell' }
  },
})

const TableHeader = Node.create({
  name: 'tableHeader',
  content: 'block+',
  isolating: true,

  addAttributes() {
    return cellAttributes
  },

  parseHTML() {
    return [{ tag: 'th' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['th', mergeAttributes(HTMLAttributes), 0]
  },

  extendNodeSchema(extension) {
    if (extension.name !== this.name) return {}
    return { tableRole: 'header_cell' }
  },
})

const ImageNode = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [{ tag: 'img[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes({
      loading: 'lazy',
      referrerpolicy: 'no-referrer',
    }, HTMLAttributes)]
  },
})

const ClickableLinkNode = Node.create({
  name: 'clickableLink',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      href: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-href') || '',
        renderHTML: (attributes) => (
          attributes.href
            ? { 'data-href': attributes.href }
            : {}
        ),
      },
      label: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-label') || '',
        renderHTML: (attributes) => (
          attributes.label
            ? { 'data-label': attributes.label }
            : {}
        ),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="clickable-link"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const href = String(node.attrs?.href || '').trim()
    const label = String(node.attrs?.label || '').trim() || href

    return [
      'div',
      mergeAttributes(
        {
          'data-type': 'clickable-link',
        },
        HTMLAttributes
      ),
      [
        'a',
        {
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        label,
      ],
    ]
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      let currentNode = node

      const dom = document.createElement('div')
      dom.className = 'learnledger-link-block'
      dom.dataset.selected = 'false'
      dom.setAttribute('contenteditable', 'false')

      const anchor = document.createElement('a')
      anchor.className = 'learnledger-link-block__anchor'
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'

      const title = document.createElement('span')
      title.className = 'learnledger-link-block__title'

      const hrefText = document.createElement('span')
      hrefText.className = 'learnledger-link-block__href'

      anchor.appendChild(title)
      anchor.appendChild(hrefText)
      dom.appendChild(anchor)

      function applyNodeAttributes(nextNode) {
        currentNode = nextNode

        const href = String(currentNode.attrs?.href || '').trim()
        const label = String(currentNode.attrs?.label || '').trim() || href

        anchor.href = href
        title.textContent = label
        hrefText.textContent = href
      }

      dom.addEventListener('click', () => {
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (!Number.isFinite(pos)) return

        editor.commands.focus()
        editor.commands.setNodeSelection(pos)
      })

      anchor.addEventListener('click', (event) => {
        event.stopPropagation()
      })

      applyNodeAttributes(node)

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type !== currentNode.type) return false
          applyNodeAttributes(updatedNode)
          return true
        },
        selectNode() {
          dom.dataset.selected = 'true'
        },
        deselectNode() {
          dom.dataset.selected = 'false'
        },
        stopEvent(event) {
          return anchor.contains(event.target)
        },
      }
    }
  },

  addCommands() {
    return {
      insertClickableLink:
        (attributes = {}) =>
        ({ state, dispatch }) => {
          const href = String(attributes.href || '').trim()
          if (!href) return false

          const linkNode = state.schema.nodes.clickableLink?.create({
            href,
            label: String(attributes.label || '').trim() || href,
          })

          if (!linkNode) return false

          const insertPos = state.selection.from
          const transaction = state.tr.replaceSelectionWith(linkNode, false)

          try {
            transaction.setSelection(TextSelection.near(transaction.doc.resolve(insertPos + linkNode.nodeSize)))
          } catch {
            transaction.setSelection(TextSelection.near(transaction.doc.resolve(insertPos)))
          }

          if (dispatch) {
            dispatch(transaction.scrollIntoView())
          }

          return true
        },
    }
  },
})

const ClickableLinkPasteHandler = Extension.create({
  name: 'clickableLinkPasteHandler',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const clipboard = event?.clipboardData
            if (!clipboard) return false

            const html = String(clipboard.getData('text/html') || '').trim()
            if (html.includes('<a') || html.includes('<img')) return false

            const plainText = String(clipboard.getData('text/plain') || '').trim()
            try {
              const url = new URL(plainText)
              if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

              event.preventDefault()

              const label = url.hostname.replace(/^www\./, '') || plainText

              return this.editor
                .chain()
                .focus()
                .insertClickableLink({
                  href: plainText,
                  label,
                })
                .run()
            } catch {
              return false
            }
          },
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
        if (isInTable(this.editor.state)) {
          return this.editor.commands.goToNextTableCell()
        }

        if (this.editor.isActive('listItem') && this.editor.commands.sinkListItem('listItem')) {
          return true
        }

        return indentSelectedText(this.editor)
      },
      'Shift-Tab': () => {
        if (isInTable(this.editor.state)) {
          return this.editor.commands.goToPreviousTableCell()
        }

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
    Table,
    TableRow,
    TableCell,
    TableHeader,
    ImageNode,
    ClickableLinkNode,
    ClickableLinkPasteHandler,
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
