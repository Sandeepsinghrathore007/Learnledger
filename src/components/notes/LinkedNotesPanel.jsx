/**
 * LinkedNotesPanel.jsx — Panel for managing linked notes in the editor.
 *
 * Shows:
 *  - List of notes linked from the current note
 *  - Button to add new linked notes (opens modal with searchable list)
 *  - Click linked note to navigate to it
 *
 * Props:
 *  currentNote     {Object}   — Current note being edited
 *  allNotes        {Array}    — All notes across all subjects
 *  onAddLink       {Function} — (targetNoteId) => void
 *  onRemoveLink    {Function} — (targetNoteId) => void
 *  onNavigateToNote{Function} — (note) => void — Navigate to linked note
 */

import { useState } from 'react'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

/**
 * Link icon
 */
function LinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '14px', height: '14px' }}
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

/**
 * Plus icon
 */
function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '14px', height: '14px' }}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

/**
 * X icon for removing links
 */
function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '12px', height: '12px' }}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default function LinkedNotesPanel({ 
  currentNote, 
  allNotes, 
  onAddLink, 
  onRemoveLink,
  onNavigateToNote,
}) {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Get linked note objects
  const linkedNoteIds = currentNote.linkedNotes || []
  const linkedNotes = linkedNoteIds
    .map(id => allNotes.find(n => n.id === id))
    .filter(Boolean) // Remove any notes that no longer exist

  // Get available notes to link (exclude current note and already linked notes)
  const availableNotes = allNotes.filter(note => 
    note.id !== currentNote.id && !linkedNoteIds.includes(note.id)
  )

  // Filter available notes by search query
  const filteredAvailableNotes = searchQuery.trim()
    ? availableNotes.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableNotes

  // ── EVENT HANDLERS ─────────────────────────────────────────────────────────

  const handleAddLink = (targetNoteId) => {
    onAddLink(targetNoteId)
    setSearchQuery('')
    setAddModalOpen(false)
  }

  const handleRemoveLink = (targetNoteId) => {
    if (window.confirm('Remove this link?')) {
      onRemoveLink(targetNoteId)
    }
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${BORDER}`,
        borderRadius: '12px',
        padding: '14px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#a78bfa' }}>
            <LinkIcon />
          </span>
          <h4
            style={{
              color: TEXT1,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: '700',
              margin: 0,
            }}
          >
            Linked Notes
          </h4>
          {linkedNotes.length > 0 && (
            <span
              style={{
                background: 'rgba(139,92,246,0.12)',
                color: '#a78bfa',
                borderRadius: '6px',
                padding: '2px 6px',
                fontSize: '10px',
                fontWeight: '600',
              }}
            >
              {linkedNotes.length}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: '6px',
            padding: '5px 10px',
            color: '#a78bfa',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.18)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}
        >
          <PlusIcon />
          Link Note
        </button>
      </div>

      {/* Linked Notes List */}
      {linkedNotes.length === 0 ? (
        <p
          style={{
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            margin: 0,
            textAlign: 'center',
            padding: '16px 0',
          }}
        >
          No linked notes yet
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {linkedNotes.map(note => (
            <div
              key={note.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${BORDER}`,
                borderRadius: '8px',
                padding: '8px 10px',
                transition: 'all 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.borderColor = note.subjectColor + '40'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                e.currentTarget.style.borderColor = BORDER
              }}
              onClick={() => onNavigateToNote(note)}
            >
              {/* Subject color indicator */}
              <div
                style={{
                  width: '3px',
                  height: '28px',
                  background: note.subjectColor,
                  borderRadius: '2px',
                  flexShrink: 0,
                }}
              />

              {/* Note info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: TEXT1,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px',
                    fontWeight: '600',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {note.title}
                </div>
                <div
                  style={{
                    color: TEXT3,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '10px',
                  }}
                >
                  {note.subjectName} • {note.topicName}
                </div>
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveLink(note.id)
                }}
                style={{
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: TEXT3,
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.12)'
                  e.currentTarget.style.color = '#ef4444'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = TEXT3
                }}
              >
                <XIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Link Modal */}
      {addModalOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => {
              setAddModalOpen(false)
              setSearchQuery('')
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 100,
            }}
          />

          {/* Modal */}
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '600px',
              background: '#1a1625',
              border: `1px solid ${BORDER}`,
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              zIndex: 101,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px',
                borderBottom: `1px solid ${BORDER}`,
              }}
            >
              <h3
                style={{
                  color: TEXT1,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '16px',
                  fontWeight: '700',
                  margin: '0 0 12px',
                }}
              >
                Link a Note
              </h3>
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  background: 'rgba(139,92,246,0.08)',
                  border: `1px solid rgba(139,92,246,0.15)`,
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: TEXT1,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Notes List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
              }}
            >
              {filteredAvailableNotes.length === 0 ? (
                <p
                  style={{
                    color: TEXT3,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '13px',
                    textAlign: 'center',
                    padding: '40px 20px',
                  }}
                >
                  {searchQuery ? 'No notes found' : 'No more notes to link'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {filteredAvailableNotes.map(note => (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => handleAddLink(note.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'rgba(255,255,255,0.02)',
                        border: `1px solid ${BORDER}`,
                        borderRadius: '10px',
                        padding: '12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                        e.currentTarget.style.borderColor = note.subjectColor + '40'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                        e.currentTarget.style.borderColor = BORDER
                      }}
                    >
                      <div
                        style={{
                          width: '4px',
                          height: '36px',
                          background: note.subjectColor,
                          borderRadius: '2px',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            color: TEXT1,
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '13px',
                            fontWeight: '600',
                            marginBottom: '4px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {note.title}
                        </div>
                        <div
                          style={{
                            color: TEXT3,
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '11px',
                          }}
                        >
                          {note.subjectName} • {note.topicName}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
