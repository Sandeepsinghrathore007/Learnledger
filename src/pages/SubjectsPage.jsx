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
import { SearchIcon, PlusIcon } from '@/components/ui/Icons'
import { SURFACE, BORDER, ACCENT, ACCENT2, TEXT1, TEXT3 } from '@/constants/theme'
import { getTotalNotesAll, getTotalTopics, getTotalTests } from '@/utils/subjectStats'

export default function SubjectsPage({ subjects, onSelect, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState('')

  // Filter subjects by name or description
  const filtered = subjects.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  )

  // Summary stats for the top row
  const summaryStats = [
    { label: 'Subjects',   value: subjects.length,             color: '#8b5cf6' },
    { label: 'Topics',     value: getTotalTopics(subjects),    color: '#3b82f6' },
    { label: 'Notes',      value: getTotalNotesAll(subjects),  color: '#10b981' },
    { label: 'Tests Done', value: getTotalTests(subjects),     color: '#f472b6' },
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
      <div className="mb-6 grid grid-cols-2 gap-3 md:mb-8 lg:grid-cols-4">
        {summaryStats.map(s => (
          <div key={s.label} style={{
            padding: '15px 18px', background: SURFACE,
            border: `1px solid ${s.color}18`, borderRadius: '12px',
          }}>
            <div style={{ color: s.color, fontWeight: '800', fontSize: '23px', fontFamily: "'DM Sans',sans-serif", letterSpacing: '-0.5px' }}>
              {s.value}
            </div>
            <div style={{ color: TEXT3, fontSize: '12px', fontFamily: "'DM Sans',sans-serif", marginTop: '2px' }}>
              {s.label}
            </div>
          </div>
        ))}
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
