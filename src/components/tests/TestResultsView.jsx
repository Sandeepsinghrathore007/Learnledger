/**
 * TestResultsView.jsx — Display test results with detailed question review.
 */

import { useState } from 'react'
import { analyzeWeakAreas, calculateAccuracyByDifficulty, formatTime } from '@/utils/testScoring'
import PerformanceChart from '@/components/tests/PerformanceChart'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

export default function TestResultsView({ testAttempt, onClose, onRetake = null, closeLabel = 'Back to Tests' }) {
  const [expandedQuestions, setExpandedQuestions] = useState(new Set())

  const { 
    title, 
    questions, 
    answers, 
    score, 
    totalQuestions, 
    percentage, 
    passed, 
    timeTaken,
    hintsUsed = [],
    metadata 
  } = testAttempt

  const toggleQuestion = (questionId) => {
    const newExpanded = new Set(expandedQuestions)
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId)
    } else {
      newExpanded.add(questionId)
    }
    setExpandedQuestions(newExpanded)
  }

  const weakAreas = analyzeWeakAreas(questions, answers, metadata)
  const accuracyByDifficulty = calculateAccuracyByDifficulty(questions, answers)

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: passed ? 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.05))' : 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.05))',
        border: `1px solid ${passed ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
        borderRadius: '16px',
        padding: 'clamp(20px, 6vw, 32px)',
        textAlign: 'center',
        marginBottom: '24px',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>
          {passed ? '🎉' : '📚'}
        </div>
        <h1 style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '28px', fontWeight: '800', margin: '0 0 8px' }}>
          {passed ? 'Test Passed!' : 'Keep Learning!'}
        </h1>
        <p style={{ color: TEXT2, fontFamily: "'DM Sans', sans-serif", fontSize: '16px', margin: 0 }}>
          {title}
        </p>
      </div>

      {/* Score Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: '800', color: passed ? '#22c55e' : '#ef4444', fontFamily: "'DM Sans', sans-serif" }}>
            {percentage}%
          </div>
          <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', marginTop: '4px' }}>
            Score
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#8b5cf6', fontFamily: "'DM Sans', sans-serif" }}>
            {score}/{totalQuestions}
          </div>
          <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', marginTop: '4px' }}>
            Correct
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#a78bfa', fontFamily: "'DM Sans', sans-serif" }}>
            {formatTime(timeTaken)}
          </div>
          <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', marginTop: '4px' }}>
            Time Taken
          </div>
        </div>

        {hintsUsed.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#fbbf24', fontFamily: "'DM Sans', sans-serif" }}>
              {hintsUsed.length}
            </div>
            <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', marginTop: '4px' }}>
              Hints Used
            </div>
          </div>
        )}
      </div>

      {/* Performance Chart */}
      {weakAreas.allTopics.length > 0 && (
        <PerformanceChart
          accuracyByDifficulty={accuracyByDifficulty}
          topicPerformance={weakAreas.allTopics}
          weakAreas={weakAreas.weakAreas}
        />
      )}

      {/* Questions Review */}
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>
          Question Review
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {questions.map((question, index) => {
            const userAnswer = answers[question.id]
            const isCorrect = userAnswer === question.correctAnswer
            const isExpanded = expandedQuestions.has(question.id)
            const usedHint = hintsUsed.includes(question.id)

            return (
              <div
                key={question.id}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleQuestion(question.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: isCorrect ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: isCorrect ? '#22c55e' : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: '700',
                    flexShrink: 0,
                  }}>
                    {isCorrect ? '✓' : '✗'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: '600' }}>
                      Question {index + 1}
                    </div>
                    <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px' }}>
                      {question.question.slice(0, 80)}...
                    </div>
                  </div>
                  {usedHint && <span style={{ fontSize: '16px' }}>💡</span>}
                  <span style={{ color: TEXT3, fontSize: '16px' }}>{isExpanded ? '▼' : '▶'}</span>
                </button>

                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${BORDER}` }}>
                    <div style={{ padding: '16px 0' }}>
                      <p style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: '600', margin: '0 0 12px' }}>
                        {question.question}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {question.options.map(opt => {
                          const isUserAnswer = userAnswer === opt.id
                          const isCorrectAnswer = question.correctAnswer === opt.id

                          return (
                            <div
                              key={opt.id}
                              style={{
                                padding: '10px 12px',
                                background: isCorrectAnswer ? 'rgba(34,197,94,0.08)' : isUserAnswer ? 'rgba(239,68,68,0.08)' : 'transparent',
                                border: `1px solid ${isCorrectAnswer ? 'rgba(34,197,94,0.3)' : isUserAnswer ? 'rgba(239,68,68,0.3)' : BORDER}`,
                                borderRadius: '8px',
                                color: TEXT2,
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: '13px',
                              }}
                            >
                              <strong>{opt.id.toUpperCase()}.</strong> {opt.text}
                              {isCorrectAnswer && <span style={{ marginLeft: '8px', color: '#22c55e' }}>✓ Correct</span>}
                              {isUserAnswer && !isCorrectAnswer && <span style={{ marginLeft: '8px', color: '#ef4444' }}>Your answer</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    {question.explanation && (
                      <div style={{ padding: '12px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px' }}>
                        <div style={{ color: '#a78bfa', fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>
                          💡 Explanation:
                        </div>
                        <p style={{ color: TEXT2, fontFamily: "'DM Sans', sans-serif", fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
                          {question.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button
          className="w-full sm:w-auto"
          type="button"
          onClick={onClose}
          style={{
            padding: '12px 24px',
            background: 'rgba(255,255,255,0.08)',
            border: `1px solid ${BORDER}`,
            borderRadius: '10px',
            color: TEXT2,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {closeLabel}
        </button>
        {typeof onRetake === 'function' && (
          <button
            className="w-full sm:w-auto"
            type="button"
            onClick={onRetake}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            🔄 Retake Test
          </button>
        )}
      </div>
    </div>
  )
}
