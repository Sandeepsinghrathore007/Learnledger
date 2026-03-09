/**
 * QuestionNavigator.jsx — Navigation grid showing all questions at a glance.
 */

import { BORDER, TEXT1, TEXT3 } from '@/constants/theme'

export default function QuestionNavigator({ questions, currentIndex, answers, bookmarkedQuestions, onJumpTo }) {
  return (
    <div style={{
      padding: '16px',
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${BORDER}`,
      borderRadius: '12px',
    }}>
      <h4 style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: '700', margin: '0 0 12px' }}>
        Question Navigator
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))', gap: '8px' }}>
        {questions.map((q, index) => {
          const isAnswered = !!answers[q.id]
          const isCurrent = index === currentIndex
          const isBookmarked = bookmarkedQuestions.includes(q.id)

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onJumpTo(index)}
              style={{
                position: 'relative',
                width: '40px',
                height: '40px',
                background: isCurrent ? '#8b5cf6' : isAnswered ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${isCurrent ? '#8b5cf6' : isAnswered ? 'rgba(139,92,246,0.3)' : BORDER}`,
                borderRadius: '8px',
                color: isCurrent ? '#fff' : isAnswered ? '#a78bfa' : TEXT3,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {index + 1}
              {isBookmarked && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', fontSize: '12px' }}>🔖</span>
              )}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '11px', color: TEXT3, fontFamily: "'DM Sans', sans-serif" }}>
        <span>● Current</span>
        <span>✓ Answered</span>
        <span>○ Unanswered</span>
        <span>🔖 Bookmarked</span>
      </div>
    </div>
  )
}
