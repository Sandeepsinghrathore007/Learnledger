/**
 * TestTakingView.jsx — Interactive quiz interface for taking tests.
 * 
 * Features:
 * - Question-by-question navigation
 * - Timer (total or per-question)
 * - Answer selection
 * - Bookmark questions
 * - Hint system
 * - Progress tracking
 */

import { useState, useEffect } from 'react'
import { useTestTimer } from '@/hooks/useTestTimer'
import QuestionCard from '@/components/tests/QuestionCard'
import QuestionNavigator from '@/components/tests/QuestionNavigator'
import { calculateScore } from '@/utils/testScoring'
import { formatTimerDisplay } from '@/utils/testScoring'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

export default function TestTakingView({ test, onUpdateTest, onFinish, onExit }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showHint, setShowHint] = useState(false)

  const currentQuestion = test.questions[currentQuestionIndex]
  const totalQuestions = test.questions.length

  // Timer
  const {
    timeRemaining,
    isTimeUp,
    startTimer,
    pauseTimer,
    resetForNextQuestion,
    hasTimeLimit,
  } = useTestTimer(test.config, () => handleTimeUp())

  // Start timer on mount
  useEffect(() => {
    if (hasTimeLimit) {
      startTimer()
    }
  }, [])

  // Handle time up
  const handleTimeUp = () => {
    if (test.config.timingMode === 'per-question') {
      // Auto-move to next question
      handleNext()
    } else {
      // Submit entire test
      handleFinish()
    }
  }

  // Select answer
  const handleSelectAnswer = (optionId) => {
    const newAnswers = { ...test.answers, [currentQuestion.id]: optionId }
    onUpdateTest({ ...test, answers: newAnswers })
    setShowHint(false)
  }

  // Bookmark question
  const handleToggleBookmark = () => {
    const bookmarked = test.bookmarkedQuestions || []
    const newBookmarked = bookmarked.includes(currentQuestion.id)
      ? bookmarked.filter(id => id !== currentQuestion.id)
      : [...bookmarked, currentQuestion.id]
    onUpdateTest({ ...test, bookmarkedQuestions: newBookmarked })
  }

  // Use hint
  const handleUseHint = () => {
    setShowHint(true)
    const hintsUsed = test.hintsUsed || []
    if (!hintsUsed.includes(currentQuestion.id)) {
      onUpdateTest({ ...test, hintsUsed: [...hintsUsed, currentQuestion.id] })
    }
  }

  // Navigation
  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
      setShowHint(false)
      if (test.config.timingMode === 'per-question') {
        resetForNextQuestion()
      }
    }
  }

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setShowHint(false)
      if (test.config.timingMode === 'per-question') {
        resetForNextQuestion()
      }
    }
  }

  const handleJumpTo = (index) => {
    setCurrentQuestionIndex(index)
    setShowHint(false)
    if (test.config.timingMode === 'per-question') {
      resetForNextQuestion()
    }
  }

  // Finish test
  const handleFinish = () => {
    const endTime = new Date().toISOString()
    const timeTaken = Math.floor((new Date(endTime) - new Date(test.startTime)) / 1000)
    const scoreResult = calculateScore(test.questions, test.answers)
    
    const hintsUsedCount = (test.hintsUsed || []).length
    const hintPenalty = hintsUsedCount * 5 // 5% penalty per hint
    const finalPercentage = Math.max(0, scoreResult.percentage - hintPenalty)

    const testAttempt = {
      ...test,
      endTime,
      timeTaken,
      ...scoreResult,
      percentage: finalPercentage,
      passed: finalPercentage >= 70,
      completedAt: endTime,
    }

    onFinish(testAttempt)
  }

  // Calculate progress
  const answeredCount = Object.keys(test.answers).length
  const progress = Math.round((answeredCount / totalQuestions) * 100)

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '900px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        flexWrap: 'wrap',
        padding: '16px 20px',
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${BORDER}`,
        borderRadius: '14px',
      }}>
        <div>
          <h2 style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '18px', fontWeight: '700', margin: 0 }}>
            {test.title}
          </h2>
          <p style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', margin: '4px 0 0' }}>
            Question {currentQuestionIndex + 1} of {totalQuestions} • {answeredCount} answered
          </p>
        </div>

        {hasTimeLimit && (
          <div style={{
            padding: '10px 16px',
            background: timeRemaining < 60 ? 'rgba(239,68,68,0.12)' : 'rgba(139,92,246,0.12)',
            border: `1px solid ${timeRemaining < 60 ? 'rgba(239,68,68,0.3)' : 'rgba(139,92,246,0.3)'}`,
            borderRadius: '10px',
            color: timeRemaining < 60 ? '#ef4444' : '#a78bfa',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '16px',
            fontWeight: '700',
          }}>
            ⏱️ {formatTimerDisplay(timeRemaining)}
          </div>
        )}
      </div>

      {/* Question Card */}
      <QuestionCard
        question={currentQuestion}
        questionNumber={currentQuestionIndex + 1}
        selectedAnswer={test.answers[currentQuestion.id]}
        onSelectAnswer={handleSelectAnswer}
        showHint={showHint}
        onUseHint={handleUseHint}
        isBookmarked={(test.bookmarkedQuestions || []).includes(currentQuestion.id)}
        onToggleBookmark={handleToggleBookmark}
        hasUsedHint={(test.hintsUsed || []).includes(currentQuestion.id)}
      />

      {/* Question Navigator */}
      <QuestionNavigator
        questions={test.questions}
        currentIndex={currentQuestionIndex}
        answers={test.answers}
        bookmarkedQuestions={test.bookmarkedQuestions || []}
        onJumpTo={handleJumpTo}
      />

      {/* Navigation Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          className="w-full sm:w-auto"
          type="button"
          onClick={onExit}
          style={{
            padding: '12px 20px',
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '10px',
            color: '#ef4444',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Exit Test
        </button>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
          <button
            className="w-full sm:w-auto"
            type="button"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            style={{
              padding: '12px 20px',
              background: currentQuestionIndex === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${BORDER}`,
              borderRadius: '10px',
              color: currentQuestionIndex === 0 ? TEXT3 : TEXT2,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: '600',
              cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            ← Previous
          </button>

          {currentQuestionIndex < totalQuestions - 1 ? (
            <button
              className="w-full sm:w-auto"
              type="button"
              onClick={handleNext}
              style={{
                padding: '12px 20px',
                background: 'rgba(139,92,246,0.15)',
                border: '1px solid rgba(139,92,246,0.4)',
                borderRadius: '10px',
                color: '#a78bfa',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Next →
            </button>
          ) : (
            <button
              className="w-full sm:w-auto"
              type="button"
              onClick={handleFinish}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              ✓ Finish Test
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        height: '8px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '4px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
          transition: 'width 0.3s',
        }} />
      </div>
    </div>
  )
}
