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
 *   - Render subject card grid
 */

import { useEffect, useMemo, useState } from 'react'
import SubjectCard from '@/components/subjects/SubjectCard'
import PrimaryCtaButton from '@/components/ui/PrimaryCtaButton'
import PaginationControls from '@/components/ui/PaginationControls'
import { SearchIcon, PlusIcon } from '@/components/ui/Icons'
import { BORDER, TEXT1, TEXT3 } from '@/constants/theme'
import { getTotalTests } from '@/utils/subjectStats'

const SUBJECTS_PAGE_SIZE = 8

const subjectCtaTheme = {
  '--cta-start': '#9d62ff',
  '--cta-end': '#6d28d9',
  '--cta-border': 'rgba(196, 181, 253, 0.3)',
  '--cta-glow': 'rgba(124, 58, 237, 0.52)',
}

export default function SubjectsPage({ subjects, onSelect, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Filter subjects by name or description
  const filtered = useMemo(
    () => subjects.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
    ),
    [search, subjects]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / SUBJECTS_PAGE_SIZE))
  const pageStart = (page - 1) * SUBJECTS_PAGE_SIZE
  const visibleSubjects = useMemo(
    () => filtered.slice(pageStart, pageStart + SUBJECTS_PAGE_SIZE),
    [filtered, pageStart]
  )

  useEffect(() => {
    setPage(1)
  }, [search, subjects.length])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const summaryStats = [
    {
      label: 'Total Subjects',
      value: subjects.length,
      color: '#8b5cf6',
      glow: 'rgba(124,58,237,0.22)',
    },
    {
      label: 'Tests Done',
      value: getTotalTests(subjects),
      color: '#22c55e',
      glow: 'rgba(34,197,94,0.2)',
    },
  ]

  return (
    <>
      {/* ── TOP ROW: search + new subject button ────────────────────── */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <PrimaryCtaButton
          className="w-full sm:w-auto"
          onClick={onAdd}
          icon={PlusIcon}
          style={subjectCtaTheme}
        >
          New Subject
        </PrimaryCtaButton>
      </div>

      {/* ── SUMMARY STATS ────────────────────────────────────────────── */}
      <div
        className="mb-4 grid grid-cols-2 gap-3 md:mb-5"
        style={{
          padding: '10px',
          borderRadius: '18px',
          border: `1px solid ${BORDER}`,
          background: 'linear-gradient(135deg, rgba(20,16,36,0.96), rgba(11,9,22,0.98))',
          boxShadow: '0 20px 42px rgba(0,0,0,0.16)',
        }}
      >
        {summaryStats.map((stat) => {
          return (
            <div
              key={stat.label}
              style={{
                position: 'relative',
                overflow: 'hidden',
                minWidth: 0,
                padding: '14px 18px',
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
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
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
        <>
          <div
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
            style={{ gap: '12px', alignItems: 'stretch' }}
          >
            {visibleSubjects.map((subject) => (
              <SubjectCard
                key={subject.id}
                subject={subject}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            label={`Showing ${pageStart + 1}-${Math.min(pageStart + SUBJECTS_PAGE_SIZE, filtered.length)} of ${filtered.length} subjects`}
          />
        </>
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
        <PrimaryCtaButton
          onClick={onAdd}
          icon={PlusIcon}
          style={subjectCtaTheme}
        >
          Create Subject
        </PrimaryCtaButton>
      )}
    </div>
  )
}
