/**
 * TopicAccordion.jsx — Expandable accordion row for a single topic.
 *
 * Shows: topic name, note count, expand/collapse toggle, add note button,
 * delete topic button. When open, renders the list of note rows.
 *
 * Props:
 *   topic        {Object}   — Topic: { id, name, questionsCount, notes[] }
 *   subjectColor {string}   — Accent colour for borders and buttons
 *   onAddNote    {Function} — (topicId) create new note and open editor
 *   onOpenNote   {Function} — (note, topicId) open existing note in editor
 *   onDeleteNote {Function} — (topicId, noteId) remove a note
 *   onDeleteTopic{Function} — (topicId) remove the topic
 *   onToggleComplete {Function} — (topicId) toggle completion state
 *
 * State:
 *   isOpen {boolean} — Whether the accordion panel is expanded
 */

import { useState } from 'react'
import { ChevronDownIcon, PlusIcon, TrashIcon, NoteIcon } from '@/components/ui/Icons'
import { SURFACE, BORDER, BORDER2, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

export default function TopicAccordion({
  topic, subjectColor,
  onAddNote, onOpenNote, onDeleteNote, onDeleteTopic, onToggleComplete,
}) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div style={{
      background: SURFACE, border: `1px solid ${BORDER}`,
      borderRadius: '13px', overflow: 'hidden',
    }}>
      {/* ── ACCORDION HEADER ──────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-start gap-2.5 sm:items-center sm:gap-3"
        style={{
          padding: '13px 16px', cursor: 'pointer',
          borderLeft: `3px solid ${subjectColor}`,
        }}
        onClick={() => setIsOpen(v => !v)}
      >
        {/* Chevron rotate indicator */}
        <span style={{
          width: '14px', height: '14px', color: TEXT3, flexShrink: 0,
          transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.2s',
        }}>
          <ChevronDownIcon />
        </span>

        <span style={{
          flex: '1 1 180px', minWidth: 0, color: TEXT1, fontFamily: "'DM Sans',sans-serif",
          fontWeight: '700', fontSize: '14px',
          lineHeight: 1.35,
        }}>
          {topic.name}
        </span>

        <span style={{ color: TEXT3, fontSize: '12px', fontFamily: "'DM Sans',sans-serif", flexShrink: 0 }}>
          {topic.notes.length} {topic.notes.length === 1 ? 'note' : 'notes'}
        </span>

        {/* Action buttons — stop propagation so they don't toggle open */}
        <div
          className="flex w-full justify-end gap-1.5 sm:w-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onToggleComplete(topic.id)}
            style={{
              padding: '4px 10px',
              borderRadius: '999px',
              background: topic.isCompleted ? 'rgba(34,197,94,0.16)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${topic.isCompleted ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.08)'}`,
              color: topic.isCompleted ? '#86efac' : TEXT3,
              fontSize: '11.5px',
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: '700',
            }}
          >
            {topic.isCompleted ? 'Completed' : 'Mark Done'}
          </button>

          <button
            onClick={() => onAddNote(topic.id)}
            style={{
              padding: '4px 10px', borderRadius: '7px',
              background: `${subjectColor}14`, border: `1px solid ${subjectColor}28`,
              color: subjectColor, fontSize: '12px',
              fontFamily: "'DM Sans',sans-serif", fontWeight: '600',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <span style={{ width: '11px', height: '11px' }}><PlusIcon /></span>New Note
          </button>

          <button
            onClick={() => onDeleteTopic(topic.id)}
            style={{
              width: '26px', height: '26px', borderRadius: '6px',
              background: 'transparent', border: 'none',
              color: 'rgba(239,68,68,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(239,68,68,0.28)')}
          >
            <span style={{ width: '12px', height: '12px' }}><TrashIcon /></span>
          </button>
        </div>
      </div>

      {/* ── NOTES LIST (visible when open) ──────────────────────────── */}
      {isOpen && (
        <div className="px-2.5 pb-3 pt-1.5 sm:px-3.5" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {topic.notes.length === 0 ? (
            <p style={{ color: TEXT3, fontSize: '12px', fontFamily: "'DM Sans',sans-serif", padding: '6px 0' }}>
              No notes yet — click New Note to start
            </p>
          ) : (
            topic.notes.map(note => (
              <NoteRow
                key={note.id}
                note={note}
                subjectColor={subjectColor}
                onClick={() => onOpenNote(note, topic.id)}
                onDelete={() => onDeleteNote(topic.id, note.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── NOTE ROW ────────────────────────────────────────────────────────────────
/**
 * NoteRow — A single note item inside a topic accordion.
 *
 * Shows: note icon, title, preview text snippet, block count, delete button.
 *
 * Props:
 *   note         {Object}   — { id, title, blocks[]?, content? }
 *   subjectColor {string}   — Accent colour
 *   onClick      {Function} — Open note in editor
 *   onDelete     {Function} — Delete this note
 */
function stripHtmlTags(html = '') {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getNotePreview(note) {
  if (Array.isArray(note.blocks) && note.blocks.length > 0) {
    const paragraph = note.blocks.find((block) => block.type === 'p')?.text
    const firstBlockText = note.blocks[0]?.text
    const source = paragraph || firstBlockText
    if (source) return source.slice(0, 80)
  }

  if (typeof note.content === 'string' && note.content.trim().length > 0) {
    return stripHtmlTags(note.content).slice(0, 80)
  }

  return 'Empty note'
}

function getNoteBlockCount(note) {
  if (Array.isArray(note.blocks)) return note.blocks.length
  return 0
}

function NoteRow({ note, subjectColor, onClick, onDelete }) {
  const previewText = getNotePreview(note)
  const blockCount = getNoteBlockCount(note)

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '11px',
        padding: '9px 13px', borderRadius: '9px',
        background: 'rgba(255,255,255,0.018)',
        border: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onClick={onClick}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(139,92,246,0.07)'; e.currentTarget.style.borderColor = BORDER2 }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.018)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', width: '100%', minWidth: 0 }}>
        <span style={{ width: '13px', height: '13px', color: subjectColor, flexShrink: 0 }}>
          <NoteIcon />
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: TEXT1, fontFamily: "'DM Sans',sans-serif",
            fontWeight: '600', fontSize: '13px',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {note.title}
          </div>
          <div style={{
            color: TEXT3, fontSize: '11px', fontFamily: "'DM Sans',sans-serif",
            marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {previewText}
          </div>
          <div style={{
            color: TEXT3,
            fontSize: '10.5px',
            fontFamily: "'DM Sans',sans-serif",
            marginTop: '2px',
          }}>
            {blockCount} blocks
          </div>
        </div>

        {/* Delete note — stop propagation to prevent opening the editor */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          style={{
            width: '24px', height: '24px', borderRadius: '5px',
            background: 'transparent', border: 'none',
            color: 'rgba(239,68,68,0.25)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(239,68,68,0.25)')}
        >
          <span style={{ width: '11px', height: '11px' }}><TrashIcon /></span>
        </button>
      </div>
    </div>
  )
}
