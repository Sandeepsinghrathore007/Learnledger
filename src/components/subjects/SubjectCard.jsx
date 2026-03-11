/**
 * SubjectCard.jsx — Card displayed in the subjects grid for a single subject.
 *
 * Shows: icon, name, description, stats (topics/notes/pdfs), AI score badge.
 * Edit and delete buttons appear on hover.
 *
 * Props:
 *   subject  {Object}   — Subject data object
 *   onSelect {Function} — (subject) open subject detail view
 *   onEdit   {Function} — (subject) open edit modal
 *   onDelete {Function} — (id) delete subject
 *
 * State:
 *   hovered {boolean} — Controls hover elevation and button visibility
 */

import { useState } from 'react'
import AiScoreBadge from '@/components/ui/AiScoreBadge'
import { EditIcon, TrashIcon } from '@/components/ui/Icons'
import { SURFACE, SURF2, BORDER, TEXT1, TEXT3 } from '@/constants/theme'
import { getTotalNotes } from '@/utils/subjectStats'

export default function SubjectCard({ subject, onSelect, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false)

  const totalNotes = getTotalNotes(subject)
  const totalPdfs  = (subject.pdfs ?? []).length
  const testsCompleted = Number.isFinite(subject.testsAttempted) ? subject.testsAttempted : 0

  const stats = [
    { label: 'Topics', value: subject.topics.length },
    { label: 'Notes',  value: totalNotes            },
    { label: 'PDFs',   value: totalPdfs             },
    { label: 'Tests Done', value: testsCompleted    },
  ]

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:  hovered ? SURF2 : SURFACE,
        border:      `1px solid ${hovered ? subject.color + '30' : BORDER}`,
        borderRadius: '18px', padding: '22px',
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
        transition: 'all 0.22s ease',
        transform:   hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow:   hovered
          ? `0 16px 48px ${subject.color}14, 0 2px 12px rgba(0,0,0,0.5)`
          : '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      {/* Radial glow decoration */}
      <div style={{
        position: 'absolute', top: '-50px', right: '-50px',
        width: '160px', height: '160px', borderRadius: '50%',
        background: `radial-gradient(circle,${subject.color}12,transparent 70%)`,
        pointerEvents: 'none', opacity: hovered ? 1 : 0.3,
        transition: 'opacity 0.3s',
      }} />

      {/* Edit / Delete buttons — visible on hover */}
      <div style={{
        position: 'absolute', top: '14px', right: '14px',
        display: 'flex', gap: '5px',
        opacity: hovered ? 1 : 0, transition: 'opacity 0.18s',
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(subject) }}
          style={{
            width: '28px', height: '28px', borderRadius: '7px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            color: TEXT1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ width: '13px', height: '13px' }}><EditIcon /></span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(subject.id) }}
          style={{
            width: '28px', height: '28px', borderRadius: '7px',
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.12)',
            color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ width: '13px', height: '13px' }}><TrashIcon /></span>
        </button>
      </div>

      {/* Main clickable area */}
      <div onClick={() => onSelect(subject)}>
        {/* Subject icon + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div style={{
            width: '50px', height: '50px', borderRadius: '14px', flexShrink: 0,
            background: `linear-gradient(135deg,${subject.color}20,${subject.color}08)`,
            border: `1px solid ${subject.color}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', color: subject.color,
          }}>
            {subject.icon}
          </div>
          <div style={{ minWidth: 0, paddingRight: '44px' }}>
            <h3 style={{
              color: TEXT1, fontFamily: "'DM Sans',sans-serif",
              fontWeight: '700', fontSize: '15.5px',
              margin: '0 0 3px', letterSpacing: '-0.3px',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {subject.name}
            </h3>
            <p style={{
              color: TEXT3, fontSize: '12px', fontFamily: "'DM Sans',sans-serif",
              margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {subject.description}
            </p>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '7px', marginBottom: '14px' }}>
          {stats.map(stat => (
            <div key={stat.label} style={{
              background: 'rgba(255,255,255,0.022)', borderRadius: '9px',
              padding: '7px', textAlign: 'center',
            }}>
              <div style={{ color: TEXT1, fontWeight: '700', fontSize: '17px', fontFamily: "'DM Sans',sans-serif" }}>
                {stat.value}
              </div>
              <div style={{ color: TEXT3, fontSize: '10.5px', fontFamily: "'DM Sans',sans-serif", marginTop: '1px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* AI performance badge */}
        <div style={{
          paddingTop: '11px', borderTop: `1px solid ${BORDER}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: TEXT3, fontSize: '11px', fontFamily: "'DM Sans',sans-serif", textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Performance
          </span>
          <AiScoreBadge score={subject.aiScore} tests={subject.testsAttempted} size="small" />
        </div>
      </div>
    </div>
  )
}
