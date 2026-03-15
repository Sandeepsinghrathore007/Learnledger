/**
 * TestCard.jsx — Card component for test history display.
 */

import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import { formatTime } from '@/utils/testScoring'

function formatRelativeDate(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function TestCard({ test, onView, onRetake, onDelete }) {
  const { title, score, totalQuestions, percentage, passed, timeTaken, completedAt, metadata } = test
  const subjectColor = metadata?.subjects?.[0]?.color || '#8b5cf6'

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${BORDER}`,
        borderRadius: '14px',
        padding: '10px 12px',
        transition: 'all 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
        e.currentTarget.style.borderColor = `${subjectColor}30`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
        e.currentTarget.style.borderColor = BORDER
      }}
      onClick={onView}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* TOP ROW — Score badge + Title + Delete */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>

          {/* Score Badge */}
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: `${subjectColor}12`,
              border: `2px solid ${subjectColor}30`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <div style={{
              color: subjectColor,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '15px',
              fontWeight: '800',
              lineHeight: 1,
            }}>
              {percentage}%
            </div>
            <div style={{
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '9px',
              marginTop: '2px',
            }}>
              {score}/{totalQuestions}
            </div>
          </div>
          {/* Title + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{
              color: TEXT1,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: '700',
              margin: '0 0 6px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {title}
            </h4>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: passed ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${passed ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                borderRadius: '6px',
                padding: '2px 7px',
                color: passed ? '#22c55e' : '#ef4444',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '10px',
                fontWeight: '700',
              }}>
                {passed ? '✓ Passed' : '✗ Failed'}
              </span>
            </div>
          </div>

          {/* Delete button — top right */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (window.confirm('Delete this test from history?')) {
                onDelete()
              }
            }}
            style={{
              width: '26px',
              height: '26px',
              padding: 0,
              background: 'transparent',
              border: `1px solid ${BORDER}`,
              borderRadius: '8px',
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.12)'
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
              e.currentTarget.style.color = '#ef4444'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = BORDER
              e.currentTarget.style.color = TEXT3
            }}
          >
            🗑
          </button>
        </div>

        {/* BOTTOM ROW — Time + Date + Retake */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto auto minmax(0, 1fr)',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '11px',
            whiteSpace: 'nowrap',
          }}>
            ⏱ {formatTime(timeTaken)}
          </span>

          <span style={{
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '11px',
            whiteSpace: 'nowrap',
          }}>
            📅 {formatRelativeDate(completedAt)}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRetake()
            }}
            style={{
              width: '100%',
              height: '32px',
              padding: '0 12px',
              background: 'rgba(139,92,246,0.12)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '8px',
              color: '#a78bfa',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.18)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}
          >
            🔄 Retake
          </button>
        </div>
      </div>
    </div>
  )
}
