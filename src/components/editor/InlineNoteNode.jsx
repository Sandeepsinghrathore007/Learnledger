import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { useEffect, useMemo, useState } from 'react'
import { decodeNodeAttribute, encodeNodeAttribute } from '@/components/editor/nodeAttributeEncoding'
import { XIcon } from '@/components/ui/Icons'

function removeCurrentNode(editor, node, getPos) {
  if (!editor || typeof getPos !== 'function') return

  const from = getPos()
  const to = from + node.nodeSize
  editor.chain().focus().deleteRange({ from, to }).run()
}

function getInlineNoteDepth(editor, getPos) {
  if (!editor || typeof getPos !== 'function') return 0

  try {
    const resolved = editor.state.doc.resolve(getPos())
    let level = 0

    for (let depth = 0; depth <= resolved.depth; depth += 1) {
      if (resolved.node(depth).type.name === 'inlineNote') {
        level += 1
      }
    }

    return Math.max(0, level - 1)
  } catch {
    return 0
  }
}

function isBodyEmpty(node) {
  if (!node) return true
  if (node.content.childCount !== 1) return false

  const firstChild = node.content.firstChild
  return firstChild?.type.name === 'paragraph' && firstChild.content.size === 0
}

function stopHeaderToggle(event) {
  event.stopPropagation()
}

function InlineNoteView({ node, editor, getPos, updateAttributes }) {
  const [collapsed, setCollapsed] = useState(Boolean(node.attrs.collapsed))

  useEffect(() => {
    setCollapsed(Boolean(node.attrs.collapsed))
  }, [node.attrs.collapsed])

  const nestingLevel = useMemo(() => getInlineNoteDepth(editor, getPos), [editor, getPos, node])
  const isNested = nestingLevel > 0
  const bodyEmpty = isBodyEmpty(node)

  const handleToggleCollapse = () => {
    const nextCollapsed = !collapsed
    setCollapsed(nextCollapsed)
    updateAttributes({ collapsed: nextCollapsed })
  }

  const panelBackground = isNested ? 'rgba(124,58,237,0.04)' : 'rgba(255,255,255,0.02)'
  const panelBorderLeft = isNested ? '#7c3aed' : '#4f46e5'

  return (
    <NodeViewWrapper
      as="div"
      style={{
        margin: isNested ? '8px 0 4px 4px' : '8px 0',
      }}
    >
      <div
        style={{
          background: panelBackground,
          border: '0.5px solid rgba(255,255,255,0.1)',
          borderLeft: `3px solid ${panelBorderLeft}`,
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <div
          contentEditable={false}
          onClick={handleToggleCollapse}
          style={{
            padding: '9px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: collapsed ? 'none' : '0.5px solid rgba(255,255,255,0.06)',
            cursor: 'pointer',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontSize: '10px',
              color: '#6b5e8a',
              lineHeight: 1,
              flexShrink: 0,
              width: '10px',
              textAlign: 'center',
            }}
          >
            {collapsed ? '▶' : '▼'}
          </span>

          <span
            aria-hidden="true"
            style={{
              fontSize: '13px',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            📄
          </span>

          <input
            value={node.attrs.title || ''}
            onChange={(event) => updateAttributes({ title: event.target.value })}
            onClick={stopHeaderToggle}
            onMouseDown={stopHeaderToggle}
            onKeyDown={stopHeaderToggle}
            placeholder="Untitled Note"
            className="learnledger-inline-note-title"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: '#ede6ff',
              fontSize: '13px',
              fontWeight: '500',
              fontFamily: "'DM Sans', sans-serif",
              padding: 0,
            }}
          />

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              removeCurrentNode(editor, node, getPos)
            }}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            style={{
              width: '18px',
              height: '18px',
              border: 'none',
              background: 'transparent',
              color: '#4a4066',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              borderRadius: '999px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.color = '#9d8ec4'
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.color = '#4a4066'
            }}
          >
            <span style={{ width: '10px', height: '10px' }}>
              <XIcon />
            </span>
          </button>
        </div>

        {!collapsed && (
          <div
            style={{
              padding: '10px 14px 12px',
            }}
          >
            <div
              style={{
                position: 'relative',
                minHeight: '60px',
              }}
            >
              {bodyEmpty && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    color: 'rgba(196,181,253,0.25)',
                    fontSize: '12px',
                    lineHeight: 1.65,
                    fontFamily: "'DM Sans', sans-serif",
                    pointerEvents: 'none',
                  }}
                >
                  Add content...
                </span>
              )}

              <NodeViewContent
                as="div"
                data-inline-note-body="true"
                className="learnledger-inline-note-body"
              />
            </div>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export function createInlineNoteContent(attrs = {}) {
  return {
    type: 'inlineNote',
    attrs: {
      title: '',
      collapsed: false,
      ...attrs,
    },
    content: [
      {
        type: 'paragraph',
      },
    ],
  }
}

export function insertInlineNoteAtRange(editor, range = null, attrs = {}) {
  if (!editor) return null

  const insertPos = range?.from ?? editor.state.selection.from
  const chain = editor.chain().focus()

  if (range?.from != null && range?.to != null) {
    chain.deleteRange(range)
  }

  const inserted = chain
    .insertContent([
      createInlineNoteContent(attrs),
      { type: 'paragraph' },
    ])
    .run()

  return inserted ? insertPos : null
}

export const InlineNoteNode = Node.create({
  name: 'inlineNote',
  group: 'block',
  content: 'block+',
  atom: false,
  defining: true,
  isolating: true,
  selectable: true,

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (element) => decodeNodeAttribute(element.getAttribute('data-title') || ''),
        renderHTML: (attributes) => ({ 'data-title': encodeNodeAttribute(attributes.title || '') }),
      },
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-collapsed') === 'true',
        renderHTML: (attributes) => ({ 'data-collapsed': String(Boolean(attributes.collapsed)) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="inline-note"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'inline-note' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineNoteView)
  },
})
