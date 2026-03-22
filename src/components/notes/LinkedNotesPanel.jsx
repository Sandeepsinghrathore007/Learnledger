/**
 * LinkedNotesPanel.jsx — Panel for managing linked notes in the editor.
 */

import { useState } from 'react'

const DEFAULT_THEME = {
  accent: '#a855f7',
  accentSecondary: '#22d3ee',
  panelBackground: 'linear-gradient(135deg, rgba(11,20,38,0.74), rgba(23,12,42,0.58))',
  panelBorder: 'rgba(148,163,184,0.16)',
  panelShadow: '0 20px 46px rgba(3,10,25,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
  titleInputBackground: 'rgba(8,17,35,0.56)',
  titleInputBorder: 'rgba(148,163,184,0.18)',
  titleInputText: '#f8fbff',
  pillBackground: 'rgba(255,255,255,0.04)',
  pillBorder: 'rgba(148,163,184,0.14)',
  pillText: '#d3defa',
  pillActiveBackground: 'linear-gradient(135deg, rgba(34,211,238,0.16), rgba(168,85,247,0.22))',
  pillActiveBorder: 'rgba(103,232,249,0.28)',
  pillActiveText: '#ffffff',
  editorFrameBackground:
    'radial-gradient(circle at top left, rgba(34,211,238,0.13), transparent 26%), radial-gradient(circle at top right, rgba(168,85,247,0.16), transparent 24%), linear-gradient(180deg, rgba(6,12,28,0.92), rgba(7,10,23,0.88))',
  editorFrameBorder: 'rgba(148,163,184,0.14)',
  floatingBackground: 'linear-gradient(180deg, rgba(10,16,33,0.96), rgba(9,11,26,0.92))',
  floatingBorder: 'rgba(148,163,184,0.18)',
  floatingText: '#dbe7ff',
  cssVars: {
    '--note-editor-heading': '#ffffff',
    '--note-editor-text': '#edf3ff',
    '--note-editor-muted': '#9fb1d6',
  },
}

function getPalette(themeStyles) {
  const palette = themeStyles || DEFAULT_THEME

  return {
    ...DEFAULT_THEME,
    ...palette,
    cssVars: {
      ...DEFAULT_THEME.cssVars,
      ...(palette?.cssVars || {}),
    },
  }
}

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
  themeStyles = null,
}) {
  const palette = getPalette(themeStyles)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const linkedNoteIds = currentNote.linkedNotes || []
  const linkedNotes = linkedNoteIds
    .map((id) => allNotes.find((note) => note.id === id))
    .filter(Boolean)
  const availableNotes = allNotes.filter(
    (note) => note.id !== currentNote.id && !linkedNoteIds.includes(note.id)
  )
  const filteredAvailableNotes = searchQuery.trim()
    ? availableNotes.filter((note) =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableNotes

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

  return (
    <div
      style={{
        background: palette.panelBackground,
        border: `1px solid ${palette.panelBorder}`,
        borderRadius: '18px',
        padding: '14px',
        boxShadow: palette.panelShadow,
        backdropFilter: 'blur(22px) saturate(160%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: palette.accentSecondary }}>
            <LinkIcon />
          </span>
          <h4
            style={{
              color: palette.cssVars['--note-editor-heading'],
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
                background: palette.pillActiveBackground,
                color: palette.pillActiveText,
                border: `1px solid ${palette.pillActiveBorder}`,
                borderRadius: '999px',
                padding: '2px 7px',
                fontSize: '10px',
                fontWeight: '700',
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
            background: palette.pillBackground,
            border: `1px solid ${palette.pillBorder}`,
            borderRadius: '999px',
            padding: '6px 11px',
            color: palette.pillText,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'background 0.15s ease, border-color 0.15s ease',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = palette.pillActiveBackground
            event.currentTarget.style.borderColor = palette.pillActiveBorder
            event.currentTarget.style.color = palette.pillActiveText
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = palette.pillBackground
            event.currentTarget.style.borderColor = palette.pillBorder
            event.currentTarget.style.color = palette.pillText
          }}
        >
          <PlusIcon />
          Link Note
        </button>
      </div>

      {linkedNotes.length === 0 ? (
        <p
          style={{
            color: palette.cssVars['--note-editor-muted'],
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            margin: 0,
            textAlign: 'center',
            padding: '18px 0',
          }}
        >
          No linked notes yet
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {linkedNotes.map((note) => (
            <div
              key={note.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: palette.pillBackground,
                border: `1px solid ${palette.pillBorder}`,
                borderRadius: '14px',
                padding: '10px 12px',
                transition: 'all 0.18s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = palette.floatingBackground
                event.currentTarget.style.borderColor = `${note.subjectColor}66`
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = palette.pillBackground
                event.currentTarget.style.borderColor = palette.pillBorder
              }}
              onClick={() => onNavigateToNote(note)}
            >
              <div
                style={{
                  width: '4px',
                  height: '32px',
                  background: note.subjectColor,
                  borderRadius: '999px',
                  flexShrink: 0,
                }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: palette.cssVars['--note-editor-heading'],
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px',
                    fontWeight: '700',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {note.title}
                </div>
                <div
                  style={{
                    color: palette.cssVars['--note-editor-muted'],
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '10px',
                    marginTop: '3px',
                  }}
                >
                  {note.subjectName} • {note.topicName}
                </div>
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  handleRemoveLink(note.id)
                }}
                style={{
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '999px',
                  color: palette.cssVars['--note-editor-muted'],
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = 'rgba(248,113,113,0.12)'
                  event.currentTarget.style.color = '#fda4af'
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = 'transparent'
                  event.currentTarget.style.color = palette.cssVars['--note-editor-muted']
                }}
              >
                <XIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {addModalOpen && (
        <>
          <div
            onClick={() => {
              setAddModalOpen(false)
              setSearchQuery('')
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(2,8,23,0.72)',
              backdropFilter: 'blur(10px)',
              zIndex: 100,
            }}
          />

          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%',
              maxWidth: '520px',
              maxHeight: '620px',
              background: palette.editorFrameBackground,
              border: `1px solid ${palette.editorFrameBorder}`,
              borderRadius: '20px',
              boxShadow: '0 32px 72px rgba(2,8,23,0.48)',
              zIndex: 101,
              display: 'flex',
              flexDirection: 'column',
              backdropFilter: 'blur(26px) saturate(160%)',
            }}
          >
            <div
              style={{
                padding: '20px',
                borderBottom: `1px solid ${palette.panelBorder}`,
              }}
            >
              <h3
                style={{
                  color: palette.cssVars['--note-editor-heading'],
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
                onChange={(event) => setSearchQuery(event.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  background: palette.titleInputBackground,
                  border: `1px solid ${palette.titleInputBorder}`,
                  borderRadius: '12px',
                  padding: '10px 12px',
                  color: palette.titleInputText,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '13px',
                  outline: 'none',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              />
            </div>

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
                    color: palette.cssVars['--note-editor-muted'],
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '13px',
                    textAlign: 'center',
                    padding: '40px 20px',
                  }}
                >
                  {searchQuery ? 'No notes found' : 'No more notes to link'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredAvailableNotes.map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => handleAddLink(note.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        background: palette.pillBackground,
                        border: `1px solid ${palette.pillBorder}`,
                        borderRadius: '16px',
                        padding: '13px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.18s ease',
                      }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background = palette.floatingBackground
                        event.currentTarget.style.borderColor = `${note.subjectColor}66`
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = palette.pillBackground
                        event.currentTarget.style.borderColor = palette.pillBorder
                      }}
                    >
                      <div
                        style={{
                          width: '4px',
                          height: '38px',
                          background: note.subjectColor,
                          borderRadius: '999px',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            color: palette.cssVars['--note-editor-heading'],
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '13px',
                            fontWeight: '700',
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
                            color: palette.cssVars['--note-editor-muted'],
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
