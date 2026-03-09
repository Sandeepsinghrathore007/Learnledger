/**
 * NotesPage.jsx — Unified notes page showing all notes across all subjects.
 *
 * Features:
 *  - Search bar for filtering by title/content
 *  - Subject/tag/favorites filters in left sidebar
 *  - Grid display of note cards
 *  - Sort dropdown (Recent, Alphabetical, Oldest)
 *  - Opens TipTap editor when clicking a note
 *
 * Props:
 *  subjects        {Array}    — All subjects from app state
 *  onUpdateSubject {Function} — Callback to update a subject
 *  onOpenNote      {Function} — (note, subjectId, topicId) => void — Opens editor
 */

import { useState } from 'react'
import { useNotes } from '@/hooks/useNotes'
import NoteCard from '@/components/notes/NoteCard'
import NotesFilters from '@/components/notes/NotesFilters'
import EmptyNotesState from '@/components/notes/EmptyNotesState'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

/**
 * Search icon for search bar
 */
function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '18px', height: '18px' }}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

/**
 * Grid icon for view toggle
 */
function GridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '16px', height: '16px' }}
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

/**
 * Chevron down icon for sort dropdown
 */
function ChevronDownIcon() {
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
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export default function NotesPage({ subjects, onUpdateSubject, onOpenNote }) {
  // ── NOTES HOOK (aggregates, searches, filters, sorts) ─────────────────────
  const {
    allNotes,
    filteredNotes,
    searchQuery,
    setSearchQuery,
    filters,
    sortBy,
    setSortBy,
    toggleSubjectFilter,
    toggleTagFilter,
    toggleFavoritesFilter,
    clearFilters,
    toggleFavorite,
    togglePin,
    deleteNote,
    exportAsMarkdown,
    exportAsPDF,
    allTags,
  } = useNotes(subjects, onUpdateSubject)

  // ── LOCAL STATE ────────────────────────────────────────────────────────────
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)

  // ── COMPUTED VALUES ────────────────────────────────────────────────────────
  const hasActiveFilters =
    filters.subjects.length > 0 ||
    filters.tags.length > 0 ||
    filters.showFavoritesOnly

  const sortOptions = [
    { id: 'recent', label: 'Most Recent' },
    { id: 'alphabetical', label: 'Alphabetical' },
    { id: 'oldest', label: 'Oldest First' },
  ]

  const currentSortLabel = sortOptions.find(opt => opt.id === sortBy)?.label ?? 'Most Recent'

  // ── EVENT HANDLERS ─────────────────────────────────────────────────────────

  /**
   * Opens the TipTap editor for a note.
   * Note already contains subjectId and topicId from aggregation.
   */
  const handleOpenNote = (note) => {
    onOpenNote(note, note.subjectId, note.topicId)
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in flex flex-col gap-4 lg:flex-row lg:gap-6">
      {/* ── LEFT SIDEBAR: FILTERS ──────────────────────────────────────────── */}
      <NotesFilters
        subjects={subjects}
        allTags={allTags}
        filters={filters}
        onToggleSubject={toggleSubjectFilter}
        onToggleTag={toggleTagFilter}
        onToggleFavorites={toggleFavoritesFilter}
        onClearFilters={clearFilters}
      />

      {/* ── MAIN CONTENT AREA ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* ── HEADER BAR: Search + View Toggle + Sort ──────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${BORDER}`,
            borderRadius: '14px',
            padding: '12px 16px',
          }}
        >
          {/* Search Bar */}
          <div
            style={{
              flex: 1,
              minWidth: '220px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(139,92,246,0.06)',
              border: `1px solid rgba(139,92,246,0.12)`,
              borderRadius: '10px',
              padding: '9px 14px',
            }}
          >
            <span style={{ color: TEXT3 }}>
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search notes by title or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: TEXT1,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '500',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: TEXT3,
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Grid View Icon (Static for now - could add list view later) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              background: 'rgba(139,92,246,0.12)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: '9px',
              color: '#a78bfa',
            }}
          >
            <GridIcon />
          </div>

          {/* Sort Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${BORDER}`,
                borderRadius: '9px',
                padding: '8px 14px',
                color: TEXT2,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
            >
              <span>Sort: {currentSortLabel}</span>
              <ChevronDownIcon />
            </button>

            {/* Dropdown Menu */}
            {sortDropdownOpen && (
              <>
                {/* Backdrop to close dropdown */}
                <div
                  onClick={() => setSortDropdownOpen(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 10,
                  }}
                />
                {/* Dropdown content */}
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    background: '#1a1625',
                    border: `1px solid ${BORDER}`,
                    borderRadius: '10px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                    minWidth: '180px',
                    zIndex: 20,
                  }}
                >
                  {sortOptions.map(option => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setSortBy(option.id)
                        setSortDropdownOpen(false)
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        background: sortBy === option.id ? 'rgba(139,92,246,0.12)' : 'transparent',
                        border: 'none',
                        padding: '10px 16px',
                        textAlign: 'left',
                        color: sortBy === option.id ? '#a78bfa' : TEXT2,
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '13px',
                        fontWeight: sortBy === option.id ? '600' : '500',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        if (sortBy !== option.id) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (sortBy !== option.id) {
                          e.currentTarget.style.background = 'transparent'
                        }
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── STATS BAR ──────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
          }}
        >
          <div>
            Showing <strong style={{ color: TEXT1 }}>{filteredNotes.length}</strong> of{' '}
            <strong style={{ color: TEXT1 }}>{allNotes.length}</strong> notes
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a78bfa',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* ── NOTES GRID ─────────────────────────────────────────────────────── */}
        {filteredNotes.length === 0 ? (
          <EmptyNotesState
            hasNotes={allNotes.length > 0}
            hasActiveFilters={hasActiveFilters}
            searchQuery={searchQuery}
            onClearFilters={clearFilters}
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '16px',
            }}
          >
            {filteredNotes.map((note, index) => (
              <div
                key={note.id}
                className="animate-fade-in"
                style={{
                  animationDelay: `${Math.min(index * 0.03, 0.3)}s`,
                }}
              >
                <NoteCard
                  note={note}
                  onOpenNote={handleOpenNote}
                  onToggleFavorite={toggleFavorite}
                  onTogglePin={togglePin}
                  onDeleteNote={deleteNote}
                  onExportMarkdown={exportAsMarkdown}
                  onExportPDF={exportAsPDF}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
