/**
 * QuestionCard.jsx — Display individual question with options and hint system.
 */

import { BookmarkIcon } from '@/components/ui/Icons'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

export default function QuestionCard({
  question,
  questionNumber,
  selectedAnswer,
  onSelectAnswer,
  showHint,
  onUseHint,
  isBookmarked,
  onToggleBookmark,
  hasUsedHint,
}) {
  return (
    <div className="p-4 sm:p-6" style={{
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${BORDER}`,
      borderRadius: '14px',
    }}>
      {/* Question Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>
            Question {questionNumber}
            {question.difficulty && (
              <span style={{ marginLeft: '8px', padding: '2px 8px', background: 'rgba(139,92,246,0.12)', borderRadius: '4px' }}>
                {question.difficulty}
              </span>
            )}
          </div>
          <h3 style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(16px, 4vw, 18px)', fontWeight: '700', margin: 0, lineHeight: 1.5 }}>
            {question.question}
          </h3>
        </div>

        <button
          type="button"
          onClick={onToggleBookmark}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
          style={{
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            borderRadius: '8px',
            color: isBookmarked ? '#7c3aed' : '#4a4066',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <span style={{ width: '18px', height: '18px', display: 'inline-flex' }}>
            <BookmarkIcon filled={isBookmarked} />
          </span>
        </button>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {question.options.map(option => {
          const isSelected = selectedAnswer === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectAnswer(option.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                background: isSelected ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isSelected ? 'rgba(139,92,246,0.4)' : BORDER}`,
                borderRadius: '10px',
                color: TEXT1,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '14px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: isSelected ? '#8b5cf6' : 'transparent',
                border: `2px solid ${isSelected ? '#8b5cf6' : TEXT3}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: '700',
                fontSize: '12px',
                flexShrink: 0,
              }}>
                {isSelected && '✓'}
              </div>
              <span><strong>{option.id.toUpperCase()}.</strong> {option.text}</span>
            </button>
          )
        })}
      </div>

      {/* Hint Button */}
      {!showHint && (
        <button
          className="w-full sm:w-auto"
          type="button"
          onClick={onUseHint}
          style={{
            padding: '8px 14px',
            background: hasUsedHint ? 'rgba(251,191,36,0.12)' : 'rgba(139,92,246,0.12)',
            border: `1px solid ${hasUsedHint ? 'rgba(251,191,36,0.3)' : 'rgba(139,92,246,0.3)'}`,
            borderRadius: '8px',
            color: hasUsedHint ? '#fbbf24' : '#a78bfa',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          💡 {hasUsedHint ? 'Show Hint Again' : 'Use Hint (-5% penalty)'}
        </button>
      )}

      {/* Hint Display */}
      {showHint && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: '10px',
          marginTop: '12px',
        }}>
          <div style={{ color: '#fbbf24', fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>
            💡 Hint:
          </div>
          <p style={{ color: TEXT2, fontFamily: "'DM Sans', sans-serif", fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
            {question.explanation ? question.explanation.split('.')[0] + '.' : 'Think about the fundamental concepts.'}
          </p>
        </div>
      )}
    </div>
  )
}
