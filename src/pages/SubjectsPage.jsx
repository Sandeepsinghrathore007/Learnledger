/**
 * SubjectsPage.jsx — Subjects overview grid page.
 *
 * Shows a summary stats bar, search input, and a responsive grid of SubjectCards.
 * Handles "New Subject" and "Edit Subject" modals by delegating to useSubjects hook.
 *
 * Props:
 *   subjects     {Array}    — Current subjects array
 *   onSelect     {Function} — (subject) open SubjectDetailPage
 *   onAdd        {Function} — Open add modal (sets form + isAddOpen)
 *   onEdit       {Function} — (subject) open edit modal
 *   onDelete     {Function} — (id) delete subject
 *
 * State:
 *   search {string} — Local search filter string
 *
 * Main responsibilities:
 *   - Filter subjects by search query
 *   - Render summary stats row
 *   - Render subject card grid with staggered fade-up animation
 */

import { useState } from 'react'
import SubjectCard from '@/components/subjects/SubjectCard'
import { SearchIcon, PlusIcon, SubjectsIcon, MockTestsIcon } from '@/components/ui/Icons'
import { BORDER, ACCENT, ACCENT2, TEXT1, TEXT3 } from '@/constants/theme'
import { getTotalTests } from '@/utils/subjectStats'

export default function SubjectsPage({ subjects, onSelect, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState('')

  // Filter subjects by name or description
  const filtered = subjects.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  )

  const summaryStats = [
    {
      label: 'Total Subjects',
      value: subjects.length,
      color: '#8b5cf6',
      glow: 'rgba(124,58,237,0.22)',
      icon: SubjectsIcon,
    },
    {
      label: 'Tests Done',
      value: getTotalTests(subjects),
      color: '#22c55e',
      glow: 'rgba(34,197,94,0.2)',
      icon: MockTestsIcon,
    },
  ]

  return (
    <>
      {/* ── TOP ROW: search + new subject button ────────────────────── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(255,255,255,0.025)', border: `1px solid ${BORDER}`,
          borderRadius: '11px', padding: '9px 14px', flex: 1, width: '100%', maxWidth: '420px',
        }}>
          <span style={{ width: '15px', height: '15px', color: TEXT3, flexShrink: 0 }}><SearchIcon /></span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subjects…"
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: '#ede6ff', fontSize: '13px',
              fontFamily: "'DM Sans',sans-serif", outline: 'none',
            }}
          />
        </div>

        {/* New subject button */}
        <button
          onClick={onAdd}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
            border: 'none', borderRadius: '11px', padding: '10px 19px',
            color: '#fff', fontWeight: '700', fontSize: '13px',
            fontFamily: "'DM Sans',sans-serif",
            boxShadow: `0 4px 18px ${ACCENT}40`, transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 7px 24px ${ACCENT}55` }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.boxShadow = `0 4px 18px ${ACCENT}40` }}
        >
          <span style={{ width: '15px', height: '15px' }}><PlusIcon /></span>
          New Subject
        </button>
      </div>

      {/* ── SUMMARY STATS ────────────────────────────────────────────── */}
      <div
        className="mb-6 grid grid-cols-2 gap-3 md:mb-8"
        style={{
          padding: '12px',
          borderRadius: '18px',
          border: `1px solid ${BORDER}`,
          background: 'linear-gradient(135deg, rgba(20,16,36,0.96), rgba(11,9,22,0.98))',
          boxShadow: '0 20px 42px rgba(0,0,0,0.16)',
        }}
      >
        {summaryStats.map((stat) => {
          const Icon = stat.icon

          return (
            <div
              key={stat.label}
              style={{
                position: 'relative',
                overflow: 'hidden',
                minWidth: 0,
                padding: '14px 16px',
                borderRadius: '14px',
                border: `1px solid ${stat.color}26`,
                background: `linear-gradient(135deg, ${stat.glow}, rgba(255,255,255,0.03))`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-20px',
                  right: '-20px',
                  width: '88px',
                  height: '88px',
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${stat.glow}, transparent 70%)`,
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    flexShrink: 0,
                    borderRadius: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: stat.color,
                    background: `${stat.color}18`,
                    border: `1px solid ${stat.color}2e`,
                    boxShadow: `0 10px 26px ${stat.glow}`,
                  }}
                >
                  <span style={{ width: '19px', height: '19px' }}>
                    <Icon />
                  </span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: TEXT1,
                      fontWeight: '800',
                      fontSize: '24px',
                      lineHeight: 1,
                      fontFamily: "'DM Sans',sans-serif",
                      letterSpacing: '-0.6px',
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    style={{
                      color: TEXT3,
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      fontFamily: "'DM Sans',sans-serif",
                      marginTop: '6px',
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── SUBJECTS GRID ────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyState search={search} onAdd={onAdd} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(264px,1fr))', gap: '15px' }}>
          {/* Subject cards with staggered fade-up animation */}
          {filtered.map((subject, i) => (
            <div
              key={subject.id}
              style={{ animation: `fadeUp 0.3s ease ${i * 0.05}s both` }}
            >
              <SubjectCard
                subject={subject}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          ))}

          {/* Add-subject ghost card */}
          <AddSubjectCard onAdd={onAdd} index={filtered.length} />
        </div>
      )}
    </>
  )
}

// ── EMPTY STATE ──────────────────────────────────────────────────────────────
function EmptyState({ search, onAdd }) {
  return (
    <div style={{
      textAlign: 'center', padding: '72px 24px',
      border: `1px dashed ${BORDER}`, borderRadius: '16px',
    }}>
      <div style={{ fontSize: '42px', marginBottom: '12px' }}>📚</div>
      <h3 style={{ color: TEXT1, fontFamily: "'DM Sans',sans-serif", fontWeight: '700', fontSize: '17px', margin: '0 0 8px' }}>
        {search ? 'No matches' : 'No subjects yet'}
      </h3>
      <p style={{ color: TEXT3, fontFamily: "'DM Sans',sans-serif", fontSize: '13px', margin: '0 0 20px' }}>
        {search ? `No results for "${search}"` : 'Create your first subject to get started'}
      </p>
      {!search && (
        <button
          onClick={onAdd}
          style={{
            background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`,
            border: 'none', borderRadius: '11px', padding: '10px 24px',
            color: '#fff', fontWeight: '700', fontSize: '14px',
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          Create Subject
        </button>
      )}
    </div>
  )
}

// ── ADD SUBJECT GHOST CARD ───────────────────────────────────────────────────
function AddSubjectCard({ onAdd, index }) {
  return (
    <button
      onClick={onAdd}
      style={{
        background: 'transparent', border: `2px dashed ${BORDER}`,
        borderRadius: '18px', minHeight: '195px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '9px', color: TEXT3,
        transition: 'all 0.2s',
        animation: `fadeUp 0.3s ease ${index * 0.05}s both`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(139,92,246,0.24)'
        e.currentTarget.style.color = '#9d8ec4'
        e.currentTarget.style.background = 'rgba(139,92,246,0.04)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = BORDER
        e.currentTarget.style.color = TEXT3
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <span style={{ width: '24px', height: '24px' }}><PlusIcon /></span>
      <span style={{ fontSize: '13px', fontFamily: "'DM Sans',sans-serif", fontWeight: '600' }}>
        New Subject
      </span>
    </button>
  )
}
