/**
 * TestCard.jsx — Card component for test history display.
 */

import { BORDER, TEXT1, TEXT3 } from '@/constants/theme'
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
  const {
    title,
    score,
    totalQuestions,
    percentage,
    passed,
    timeTaken,
    completedAt,
    metadata,
    scorableQuestions = totalQuestions,
    removedQuestionIds = [],
    removedQuestionsCount: rawRemovedQuestionsCount,
  } = test
  const removedQuestionsCount = Number.isFinite(rawRemovedQuestionsCount)
    ? rawRemovedQuestionsCount
    : Array.isArray(removedQuestionIds)
      ? removedQuestionIds.length
      : 0
  const subjectColor = metadata?.subjects?.[0]?.color || '#8b5cf6'
  const isReviewProcessing = Boolean(metadata?.reviewGeneration?.isAiProcessing)
  const isUngraded = Number(scorableQuestions || 0) === 0
  const statusTone = isReviewProcessing
    ? {
      background: 'rgba(56,189,248,0.12)',
      border: 'rgba(56,189,248,0.24)',
      color: '#7dd3fc',
    }
    : isUngraded
    ? {
      background: 'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.24)',
      color: '#fbbf24',
    }
    : passed
    ? {
      background: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.24)',
      color: '#4ade80',
    }
    : {
      background: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.24)',
      color: '#f87171',
    }
  const scoreLabel = isReviewProcessing ? 'AI key' : isUngraded ? 'No key' : `${score}/${scorableQuestions}`
  const percentageLabel = isReviewProcessing ? '...' : isUngraded ? 'NA' : `${percentage}%`
  const statusLabel = isReviewProcessing ? 'Preparing' : isUngraded ? 'Ungraded' : passed ? 'Passed' : 'Failed'

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
      <div className="flex items-center gap-3 sm:gap-4" style={{ minWidth: 0 }}>
        <div
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '14px',
            background: `${subjectColor}14`,
            border: `1px solid ${subjectColor}32`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: `inset 0 1px 0 ${subjectColor}24`,
          }}
        >
          <div style={{
            color: subjectColor,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '15px',
            fontWeight: '800',
            lineHeight: 1,
          }}>
            {percentageLabel}
          </div>
          <div style={{
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '9px',
            marginTop: '3px',
          }}>
            {scoreLabel}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h4 style={{
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            fontWeight: '700',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {title}
          </h4>

          <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: '999px',
              padding: '3px 8px',
              background: statusTone.background,
              border: `1px solid ${statusTone.border}`,
              color: statusTone.color,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '10px',
              fontWeight: '700',
              whiteSpace: 'nowrap',
            }}>
              {statusLabel}
            </span>

            <span style={{
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '11px',
              whiteSpace: 'nowrap',
            }}>
              Time {formatTime(timeTaken)}
            </span>

            <span style={{
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '11px',
              whiteSpace: 'nowrap',
            }}>
              {formatRelativeDate(completedAt)}
            </span>

            {removedQuestionsCount > 0 && (
              <span style={{
                color: '#fb923c',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '11px',
                whiteSpace: 'nowrap',
              }}>
                Removed {removedQuestionsCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRetake()
            }}
            style={{
              height: '32px',
              padding: '0 10px',
              background: 'rgba(139,92,246,0.12)',
              border: '1px solid rgba(139,92,246,0.26)',
              borderRadius: '9px',
              color: '#a78bfa',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(139,92,246,0.18)'
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.38)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(139,92,246,0.12)'
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.26)'
            }}
          >
            Retake
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
              width: '30px',
              height: '30px',
              padding: 0,
              background: 'transparent',
              border: `1px solid ${BORDER}`,
              borderRadius: '9px',
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              fontWeight: '700',
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
            aria-label="Delete test"
          >
            X
          </button>
        </div>
      </div>
    </div>
  )
}
