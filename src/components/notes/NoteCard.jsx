/**
 * NoteCard.jsx — Individual note card component for grid/list display.
 *
 * Shows:
 *  - Note title with favorite star toggle
 *  - Content preview (truncated)
 *  - Subject badge with color
 *  - Topic name
 *  - Tags
 *  - Word count and last updated time
 *  - Delete button on hover
 *
 * Props:
 *  note             {Object}   — Note object with enriched metadata
 *  onOpenNote       {Function} — (note) => void — Opens editor
 *  onToggleFavorite {Function} — (noteId) => void
 *  onDeleteNote     {Function} — (noteId) => void
 */

import { useState } from 'react'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

/**
 * Star icon — filled when favorite, outline when not
 */
function StarIcon({ filled }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

/**
 * Pin icon — for pinned notes
 */
function PinIcon({ filled }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  )
}

/**
 * Three dots menu icon
 */
function MoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="6" r="1.5" />
      <circle cx="12" cy="18" r="1.5" />
    </svg>
  )
}

/**
 * Trash icon for delete action
 */
function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

export default function NoteCard({ 
  note, 
  onOpenNote, 
  onToggleFavorite, 
  onTogglePin,
  onDeleteNote,
  onExportMarkdown,
  onExportPDF,
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // ── EVENT HANDLERS ─────────────────────────────────────────────────────────

  const handleClick = (e) => {
    // Don't open note if clicking on action buttons or menu
    if (e.target.closest('button')) return
    onOpenNote(note)
  }

  const handleToggleFavorite = (e) => {
    e.stopPropagation()
    onToggleFavorite(note.id)
  }

  const handleTogglePin = (e) => {
    e.stopPropagation()
    onTogglePin(note.id)
    setMenuOpen(false)
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    if (window.confirm(`Delete "${note.title}"?`)) {
      onDeleteNote(note.id)
    }
    setMenuOpen(false)
  }

  const handleExportMarkdown = (e) => {
    e.stopPropagation()
    onExportMarkdown(note.id)
    setMenuOpen(false)
  }

  const handleExportPDF = (e) => {
    e.stopPropagation()
    onExportPDF(note.id)
    setMenuOpen(false)
  }

  const handleMenuToggle = (e) => {
    e.stopPropagation()
    setMenuOpen(!menuOpen)
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="note-card"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${BORDER}`,
        borderRadius: '14px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
        position: 'relative',
        overflow: 'hidden',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isHovered
          ? `0 8px 24px ${note.subjectColor}15, 0 0 0 1px ${note.subjectColor}20`
          : 'none',
      }}
    >
      {/* Subject color accent bar on left edge */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '3px',
          background: `linear-gradient(to bottom, ${note.subjectColor}, ${note.subjectColor}80)`,
        }}
      />

      {/* Pinned indicator (top-right corner) */}
      {note.isPinned && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '20px',
            height: '20px',
            color: '#fbbf24',
            transform: 'rotate(45deg)',
          }}
        >
          <PinIcon filled={true} />
        </div>
      )}

      {/* Header: Favorite Star + Title + Menu Button */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
        {/* Favorite Star Button */}
        <button
          type="button"
          onClick={handleToggleFavorite}
          style={{
            width: '18px',
            height: '18px',
            flexShrink: 0,
            color: note.isFavorite ? '#fbbf24' : TEXT3,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            transition: 'color 0.15s, transform 0.15s',
            transform: isHovered && !note.isFavorite ? 'scale(1.1)' : 'scale(1)',
          }}
          aria-label={note.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <StarIcon filled={note.isFavorite} />
        </button>

        {/* Note Title */}
        <h3
          style={{
            flex: 1,
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: '700',
            fontSize: '15px',
            margin: 0,
            lineHeight: '1.4',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            paddingRight: note.isPinned ? '24px' : '0', // Make room for pin icon
          }}
        >
          {note.title}
        </h3>

        {/* Three-dot Menu Button */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={handleMenuToggle}
            style={{
              width: '20px',
              height: '20px',
              flexShrink: 0,
              color: menuOpen ? TEXT1 : TEXT3,
              background: menuOpen ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              padding: 0,
              opacity: isHovered || menuOpen ? 1 : 0,
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Note actions"
          >
            <MoreIcon />
          </button>

          {/* Dropdown Menu */}
          {menuOpen && (
            <>
              {/* Backdrop to close menu */}
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(false)
                }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 10,
                }}
              />
              
              {/* Menu content */}
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  right: 0,
                  background: '#1a1625',
                  border: `1px solid ${BORDER}`,
                  borderRadius: '10px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  overflow: 'hidden',
                  minWidth: '160px',
                  zIndex: 20,
                }}
              >
                <button
                  type="button"
                  onClick={handleTogglePin}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    padding: '10px 14px',
                    textAlign: 'left',
                    color: TEXT2,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ width: '14px', height: '14px', color: '#fbbf24' }}>
                    <PinIcon filled={note.isPinned} />
                  </span>
                  {note.isPinned ? 'Unpin Note' : 'Pin to Top'}
                </button>

                <div style={{ height: '1px', background: BORDER, margin: '4px 0' }} />

                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    padding: '10px 14px',
                    textAlign: 'left',
                    color: TEXT2,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>📄</span>
                  Export as Markdown
                </button>

                <button
                  type="button"
                  onClick={handleExportPDF}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    padding: '10px 14px',
                    textAlign: 'left',
                    color: TEXT2,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>📑</span>
                  Export as PDF
                </button>

                <div style={{ height: '1px', background: BORDER, margin: '4px 0' }} />

                <button
                  type="button"
                  onClick={handleDelete}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    padding: '10px 14px',
                    textAlign: 'left',
                    color: '#ef4444',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ width: '14px', height: '14px' }}>
                    <TrashIcon />
                  </span>
                  Delete Note
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content Preview */}
      <p
        style={{
          color: TEXT2,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          lineHeight: '1.6',
          margin: '0 0 14px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {note.preview}
      </p>

      {/* Metadata Row: Subject Badge + Topic */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {/* Subject Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: `${note.subjectColor}15`,
            border: `1px solid ${note.subjectColor}25`,
            borderRadius: '8px',
            padding: '3px 9px',
            fontSize: '11px',
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: '600',
            color: note.subjectColor,
          }}
        >
          <span>{note.subjectIcon}</span>
          <span>{note.subjectName}</span>
        </div>

        {/* Topic Name */}
        <span
          style={{
            color: TEXT3,
            fontSize: '11px',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {note.topicName}
        </span>
      </div>

      {/* Tags Row */}
      {note.tags && note.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {note.tags.map(tag => (
            <span
              key={tag}
              style={{
                display: 'inline-block',
                background: 'rgba(139,92,246,0.12)',
                border: '1px solid rgba(139,92,246,0.2)',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '10px',
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: '500',
                color: '#a78bfa',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: Word Count + Time */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: TEXT3,
          fontSize: '11px',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <span>{note.wordCount} words</span>
        <span>{note.relativeTime}</span>
      </div>
    </div>
  )
}
