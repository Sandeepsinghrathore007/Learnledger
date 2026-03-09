/**
 * NotesFilters.jsx — Sidebar filter panel for the Notes page.
 *
 * Provides filtering options:
 *  - All Notes (clear all filters)
 *  - Filter by Subject (checkbox list)
 *  - Filter by Tags (checkbox list)
 *  - Favorites Only toggle
 *
 * Props:
 *  subjects             {Array}    — List of all subjects
 *  allTags              {Array}    — List of all unique tags
 *  filters              {Object}   — Current filter state
 *  onToggleSubject      {Function} — (subjectId) => void
 *  onToggleTag          {Function} — (tag) => void
 *  onToggleFavorites    {Function} — () => void
 *  onClearFilters       {Function} — () => void
 */

import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

/**
 * Checkbox component for filter items
 */
function Checkbox({ checked, color }) {
  return (
    <div
      style={{
        width: '16px',
        height: '16px',
        borderRadius: '5px',
        border: checked ? `2px solid ${color}` : `2px solid ${BORDER}`,
        background: checked ? `${color}20` : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >
      {checked && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: '10px', height: '10px' }}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  )
}

/**
 * Star icon for favorites filter
 */
function StarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ width: '14px', height: '14px' }}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

export default function NotesFilters({
  subjects,
  allTags,
  filters,
  onToggleSubject,
  onToggleTag,
  onToggleFavorites,
  onClearFilters,
}) {
  // Check if any filters are active
  const hasActiveFilters =
    filters.subjects.length > 0 ||
    filters.tags.length > 0 ||
    filters.showFavoritesOnly

  return (
    <div
      className="w-full lg:w-[220px]"
      style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}
    >
      {/* ── ALL NOTES (Clear Filters) ────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onClearFilters}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: hasActiveFilters ? 'rgba(255,255,255,0.02)' : 'rgba(139,92,246,0.12)',
          border: hasActiveFilters ? `1px solid ${BORDER}` : '1px solid rgba(139,92,246,0.25)',
          borderRadius: '10px',
          padding: '10px 14px',
          color: hasActiveFilters ? TEXT2 : '#a78bfa',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.15s',
          textAlign: 'left',
        }}
      >
        <span>All Notes</span>
        {!hasActiveFilters && <span style={{ fontSize: '16px' }}>📝</span>}
      </button>

      {/* ── SUBJECTS FILTER ───────────────────────────────────────────────────── */}
      <div>
        <h4
          style={{
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            margin: '0 0 10px',
          }}
        >
          Subjects
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {subjects.map(subject => {
            const isActive = filters.subjects.includes(subject.id)
            return (
              <button
                key={subject.id}
                type="button"
                onClick={() => onToggleSubject(subject.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: isActive ? `${subject.color}08` : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                <Checkbox checked={isActive} color={subject.color} />
                <span
                  style={{
                    fontSize: '16px',
                    color: isActive ? subject.color : `${subject.color}cc`,
                    textShadow: `0 0 10px ${subject.color}33`,
                    lineHeight: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '18px',
                  }}
                >
                  {subject.icon}
                </span>
                <span
                  style={{
                    flex: 1,
                    color: isActive ? TEXT1 : TEXT2,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '13px',
                    fontWeight: isActive ? '600' : '500',
                  }}
                >
                  {subject.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── FAVORITES FILTER ──────────────────────────────────────────────────── */}
      <div>
        <h4
          style={{
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            margin: '0 0 10px',
          }}
        >
          Quick Filters
        </h4>
        <button
          type="button"
          onClick={onToggleFavorites}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: filters.showFavoritesOnly ? 'rgba(251,191,36,0.12)' : 'transparent',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 10px',
            cursor: 'pointer',
            transition: 'background 0.15s',
            width: '100%',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            if (!filters.showFavoritesOnly) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
          }}
          onMouseLeave={(e) => {
            if (!filters.showFavoritesOnly) e.currentTarget.style.background = 'transparent'
          }}
        >
          <Checkbox checked={filters.showFavoritesOnly} color="#fbbf24" />
          <span style={{ color: '#fbbf24' }}>
            <StarIcon />
          </span>
          <span
            style={{
              flex: 1,
              color: filters.showFavoritesOnly ? TEXT1 : TEXT2,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: filters.showFavoritesOnly ? '600' : '500',
            }}
          >
            Favorites
          </span>
        </button>
      </div>

      {/* ── TAGS FILTER ───────────────────────────────────────────────────────── */}
      {allTags.length > 0 && (
        <div>
          <h4
            style={{
              color: TEXT1,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              margin: '0 0 10px',
            }}
          >
            Tags
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {allTags.map(tag => {
              const isActive = filters.tags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onToggleTag(tag)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: isActive ? 'rgba(139,92,246,0.12)' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <Checkbox checked={isActive} color="#a78bfa" />
                  <span
                    style={{
                      flex: 1,
                      color: isActive ? TEXT1 : TEXT2,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '12px',
                      fontWeight: isActive ? '600' : '500',
                    }}
                  >
                    {tag}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
