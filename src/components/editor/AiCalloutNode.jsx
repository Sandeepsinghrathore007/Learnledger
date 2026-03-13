import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { XIcon } from '@/components/ui/Icons'
import {
  decodeNodeAttribute,
  decodeNodeJson,
  encodeNodeAttribute,
  encodeNodeJson,
} from '@/components/editor/nodeAttributeEncoding'

function removeCurrentNode(editor, node, getPos) {
  if (!editor || typeof getPos !== 'function') return

  const from = getPos()
  const to = from + node.nodeSize
  editor.chain().focus().deleteRange({ from, to }).run()
}

function AiCalloutView({ node, editor, getPos }) {
  const explanation = typeof node.attrs.explanation === 'string' ? node.attrs.explanation : ''
  const keyPoints = Array.isArray(node.attrs.keyPoints) ? node.attrs.keyPoints : []

  return (
    <NodeViewWrapper
      as="div"
      data-callout-id={node.attrs.calloutId || ''}
      style={{
        margin: '8px 0',
      }}
    >
      <div
        contentEditable={false}
        style={{
          background: 'rgba(124,58,237,0.08)',
          border: '0.5px solid rgba(124,58,237,0.25)',
          borderLeft: '3px solid #7c3aed',
          borderRadius: '6px',
          padding: '10px 12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            marginBottom: '8px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span
            style={{
              color: '#7c3aed',
              fontSize: '11px',
              fontWeight: '500',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            ✦ AI Note
          </span>

          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => removeCurrentNode(editor, node, getPos)}
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '999px',
              border: 'none',
              background: 'transparent',
              color: 'rgba(237,230,255,0.62)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <span style={{ width: '10px', height: '10px' }}>
              <XIcon />
            </span>
          </button>
        </div>

        <div
          style={{
            color: '#c4b5fd',
            fontSize: '12px',
            lineHeight: 1.6,
            fontFamily: "'DM Sans', sans-serif",
            marginBottom: keyPoints.length > 0 ? '8px' : 0,
            whiteSpace: 'pre-wrap',
          }}
        >
          {explanation}
        </div>

        {keyPoints.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {keyPoints.map((point, index) => (
              <div
                key={`${node.attrs.calloutId || 'ai'}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  color: '#ede6ff',
                  fontSize: '11px',
                  lineHeight: 1.55,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '999px',
                    background: '#7c3aed',
                    marginTop: '6px',
                    flexShrink: 0,
                  }}
                />
                <span style={{ whiteSpace: 'pre-wrap' }}>{point}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export const AiCalloutNode = Node.create({
  name: 'aiCallout',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      calloutId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-callout-id') || null,
        renderHTML: (attributes) => (attributes.calloutId ? { 'data-callout-id': attributes.calloutId } : {}),
      },
      explanation: {
        default: '',
        parseHTML: (element) => decodeNodeAttribute(element.getAttribute('data-explanation') || ''),
        renderHTML: (attributes) => ({ 'data-explanation': encodeNodeAttribute(attributes.explanation || '') }),
      },
      keyPoints: {
        default: [],
        parseHTML: (element) => decodeNodeJson(element.getAttribute('data-key-points') || '', []),
        renderHTML: (attributes) => ({ 'data-key-points': encodeNodeJson(attributes.keyPoints, []) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="ai-callout"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'ai-callout' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AiCalloutView)
  },
})
