/**
 * TestCard.jsx — Card component for test history display.
 *
 * Shows:
 *  - Test title
 *  - Score and percentage
 *  - Time taken
 *  - Date completed
 *  - View/Retake/Delete actions
 *
 * Props:
 *  test     {Object}   — Test attempt object
 *  onView   {Function} — View results callback
 *  onRetake {Function} — Retake test callback
 *  onDelete {Function} — Delete test callback
 */

import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import { formatTime } from '@/utils/testScoring'

/**
 * Format date to relative time
 */
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

  // Use stored metadata color if present; fallback to default accent.
  const subjectColor = metadata?.subjects?.[0]?.color || '#8b5cf6'

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${BORDER}`,
        borderRadius: '14px',
        padding: '16px 18px',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        
        {/* Score Badge */}
        <div
          style={{
            width: '70px',
            height: '70px',
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
            fontSize: '20px',
            fontWeight: '800',
            lineHeight: 1,
          }}>
            {percentage}%
          </div>
          <div style={{
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '10px',
            marginTop: '2px',
          }}>
            {score}/{totalQuestions}
          </div>
        </div>

        {/* Test Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '15px',
            fontWeight: '700',
            margin: '0 0 6px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {title}
          </h4>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}>
            {/* Pass/Fail Badge */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: passed ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${passed ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: '6px',
              padding: '3px 8px',
              color: passed ? '#22c55e' : '#ef4444',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '11px',
              fontWeight: '600',
            }}>
              {passed ? '✓ Passed' : '✗ Failed'}
            </span>

            {/* Time Taken */}
            <span style={{
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
            }}>
              ⏱️ {formatTime(timeTaken)}
            </span>

            {/* Date */}
            <span style={{
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
            }}>
              📅 {formatRelativeDate(completedAt)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRetake()
            }}
            style={{
              padding: '8px 14px',
              background: 'rgba(139,92,246,0.12)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '8px',
              color: '#a78bfa',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.18)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}
          >
            🔄 Retake
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (window.confirm('Delete this test from history?')) {
                onDelete()
              }
            }}
            style={{
              padding: '8px 12px',
              background: 'transparent',
              border: `1px solid ${BORDER}`,
              borderRadius: '8px',
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
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
            🗑️
          </button>
        </div>
      </div>
    </div>
  )
}
