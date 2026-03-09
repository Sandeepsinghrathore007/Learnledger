/**
 * EmptyNotesState.jsx — Empty state display when no notes match filters/search.
 *
 * Shows different messages based on the context:
 *  - No notes at all (first time user)
 *  - No notes match current filters
 *  - No notes match search query
 *
 * Props:
 *  hasNotes        {boolean}  — Whether any notes exist at all
 *  hasActiveFilters{boolean}  — Whether filters are active
 *  searchQuery     {string}   — Current search query
 *  onClearFilters  {Function} — Callback to clear filters
 */

import { BORDER, TEXT1, TEXT3 } from '@/constants/theme'

export default function EmptyNotesState({ hasNotes, hasActiveFilters, searchQuery, onClearFilters }) {
  // ── DETERMINE WHICH EMPTY STATE TO SHOW ────────────────────────────────────

  // Case 1: No notes exist at all (first time user)
  if (!hasNotes) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>📝</div>
        <h3
          style={{
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '20px',
            fontWeight: '700',
            margin: '0 0 8px',
          }}
        >
          No notes yet
        </h3>
        <p
          style={{
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            margin: '0 0 24px',
            maxWidth: '400px',
            lineHeight: '1.6',
          }}
        >
          Start creating notes from your subjects. Open any subject, add a topic, then create your first note!
        </p>
      </div>
    )
  }

  // Case 2: Notes exist but search query returned nothing
  if (searchQuery.trim()) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔍</div>
        <h3
          style={{
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '18px',
            fontWeight: '700',
            margin: '0 0 8px',
          }}
        >
          No results for "{searchQuery}"
        </h3>
        <p
          style={{
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            margin: 0,
          }}
        >
          Try different keywords or check your spelling
        </p>
      </div>
    )
  }

  // Case 3: Notes exist but filters returned nothing
  if (hasActiveFilters) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎯</div>
        <h3
          style={{
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '18px',
            fontWeight: '700',
            margin: '0 0 8px',
          }}
        >
          No notes match these filters
        </h3>
        <p
          style={{
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            margin: '0 0 20px',
          }}
        >
          Try adjusting your filters to see more notes
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          style={{
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: '10px',
            padding: '10px 20px',
            color: '#a78bfa',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.18)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}
        >
          Clear All Filters
        </button>
      </div>
    )
  }

  // Fallback (shouldn't reach here)
  return null
}
