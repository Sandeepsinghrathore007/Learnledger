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

import { startTransition, useEffect, useRef, useState } from 'react'
import { useTestTimer } from '@/hooks/useTestTimer'
import QuestionCard from '@/components/tests/QuestionCard'
import QuestionNavigator from '@/components/tests/QuestionNavigator'
import { calculateScore } from '@/utils/testScoring'
import { formatTimerDisplay } from '@/utils/testScoring'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import {
  inferQuestionLanguageFromQuestion,
  normalizeQuestionLanguage,
  translateQuestionBatch,
} from '@/utils/questionTranslation'

const QUESTION_TRANSLATION_BATCH_SIZE = 10

function getBatchStartIndex(index) {
  return Math.max(0, Math.floor(Number(index || 0) / QUESTION_TRANSLATION_BATCH_SIZE) * QUESTION_TRANSLATION_BATCH_SIZE)
}

function buildBatchStartOrder(currentIndex, totalQuestions) {
  const totalBatches = Math.ceil(Number(totalQuestions || 0) / QUESTION_TRANSLATION_BATCH_SIZE)
  const starts = Array.from({ length: totalBatches }, (_, index) => index * QUESTION_TRANSLATION_BATCH_SIZE)
  const currentStart = getBatchStartIndex(currentIndex)

  return [
    currentStart,
    ...starts.filter((start) => start > currentStart),
    ...starts.filter((start) => start < currentStart),
  ]
}

export default function TestTakingView({ test, onUpdateTest, onFinish, onExit }) {
  const testDefaultLanguage = normalizeQuestionLanguage(
    test?.metadata?.examSource?.language || test?.config?.language || 'english'
  )
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState(() => test.bookmarkedQuestions || [])
  const [questionLanguage, setQuestionLanguage] = useState(() =>
    inferQuestionLanguageFromQuestion(test?.questions?.[0], testDefaultLanguage)
  )
  const [translatedQuestions, setTranslatedQuestions] = useState({})
  const [translationState, setTranslationState] = useState({
    questionId: '',
    language: '',
    loading: false,
    error: '',
  })
  const translatedQuestionsRef = useRef({})
  const batchRequestsRef = useRef(new Map())
  const completedBatchesRef = useRef(new Set())
  const translationSessionRef = useRef(0)

  const currentQuestion = test.questions[currentQuestionIndex]
  const currentQuestionBaseLanguage = inferQuestionLanguageFromQuestion(currentQuestion, testDefaultLanguage)
  const translatedCurrentQuestion = translatedQuestions[currentQuestion.id]?.[questionLanguage] || null
  const displayQuestion = translatedCurrentQuestion || currentQuestion
  const totalQuestions = test.questions.length
  const expectedQuestionCount = Math.max(
    totalQuestions,
    Number(test?.metadata?.examGeneration?.totalQuestions || test?.metadata?.examSource?.questionCount || 0)
  )
  const isQuestionGenerationPending = Boolean(
    test?.metadata?.examGeneration
    && test.metadata.examGeneration.isComplete === false
    && totalQuestions < expectedQuestionCount
  )
  const questionGenerationStatus = String(test?.metadata?.examGeneration?.statusText || '').trim()
  const isTranslationLoading = (
    translationState.loading
    && translationState.questionId === currentQuestion.id
    && translationState.language === questionLanguage
  )
  const translationError = (
    translationState.questionId === currentQuestion.id
    && translationState.language === questionLanguage
      ? translationState.error
      : ''
  )

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

  useEffect(() => {
    setBookmarkedQuestions(test.bookmarkedQuestions || [])
  }, [test.id])

  useEffect(() => {
    translatedQuestionsRef.current = translatedQuestions
  }, [translatedQuestions])

  useEffect(() => {
    translationSessionRef.current += 1
    translatedQuestionsRef.current = {}
    batchRequestsRef.current = new Map()
    completedBatchesRef.current = new Set()
    setQuestionLanguage(inferQuestionLanguageFromQuestion(test?.questions?.[0], testDefaultLanguage))
    setTranslatedQuestions({})
    setTranslationState({
      questionId: '',
      language: '',
      loading: false,
      error: '',
    })
  }, [test.id, testDefaultLanguage])

  const requestQuestionBatchTranslation = (targetLanguage, batchStartIndex, surfaceQuestionId = '') => {
    const normalizedLanguage = normalizeQuestionLanguage(targetLanguage)
    const batchKey = `${normalizedLanguage}:${batchStartIndex}`
    const sessionId = translationSessionRef.current
    const batchQuestions = test.questions
      .slice(batchStartIndex, batchStartIndex + QUESTION_TRANSLATION_BATCH_SIZE)
      .filter((question) => {
        if (!question?.id) return false
        const baseLanguage = inferQuestionLanguageFromQuestion(question, testDefaultLanguage)
        if (baseLanguage === normalizedLanguage) return false
        return !translatedQuestionsRef.current[question.id]?.[normalizedLanguage]
      })

    const syncSurfaceState = (patch) => {
      if (!surfaceQuestionId) return

      setTranslationState((previous) => {
        if (
          previous.questionId
          && previous.questionId !== surfaceQuestionId
          && previous.language === normalizedLanguage
          && previous.loading
        ) {
          return previous
        }

        return {
          questionId: surfaceQuestionId,
          language: normalizedLanguage,
          ...patch,
        }
      })
    }

    if (batchQuestions.length === 0) {
      completedBatchesRef.current.add(batchKey)
      syncSurfaceState({ loading: false, error: '' })
      return Promise.resolve()
    }

    syncSurfaceState({ loading: true, error: '' })

    if (completedBatchesRef.current.has(batchKey)) {
      syncSurfaceState({ loading: false, error: '' })
      return Promise.resolve()
    }

    const existingRequest = batchRequestsRef.current.get(batchKey)
    if (existingRequest) {
      return existingRequest
        .then(() => {
          if (translationSessionRef.current !== sessionId) return
          syncSurfaceState({ loading: false, error: '' })
        })
        .catch((error) => {
          if (translationSessionRef.current !== sessionId) return

          syncSurfaceState({
            loading: false,
            error: error?.message || 'Question translation is unavailable right now.',
          })

          throw error
        })
    }

    const requestPromise = translateQuestionBatch(batchQuestions, normalizedLanguage)
      .then((translatedBatch) => {
        if (translationSessionRef.current !== sessionId) return

        startTransition(() => {
          setTranslatedQuestions((previous) => {
            const nextState = { ...previous }

            translatedBatch.forEach((translatedQuestion) => {
              const questionId = translatedQuestion.id
              nextState[questionId] = {
                ...(nextState[questionId] || {}),
                [normalizedLanguage]: translatedQuestion,
              }
            })

            translatedQuestionsRef.current = nextState
            return nextState
          })
        })

        completedBatchesRef.current.add(batchKey)
        syncSurfaceState({ loading: false, error: '' })
      })
      .catch((error) => {
        if (translationSessionRef.current !== sessionId) return

        syncSurfaceState({
          loading: false,
          error: error?.message || 'Question translation is unavailable right now.',
        })

        throw error
      })
      .finally(() => {
        if (batchRequestsRef.current.get(batchKey) === requestPromise) {
          batchRequestsRef.current.delete(batchKey)
        }
      })

    batchRequestsRef.current.set(batchKey, requestPromise)
    return requestPromise
  }

  useEffect(() => {
    if (!currentQuestion?.id) return
    if (questionLanguage === currentQuestionBaseLanguage) return

    const sessionId = translationSessionRef.current
    const orderedBatchStarts = buildBatchStartOrder(currentQuestionIndex, totalQuestions)
    let cancelled = false

    ;(async () => {
      for (let index = 0; index < orderedBatchStarts.length; index += 1) {
        if (cancelled || translationSessionRef.current !== sessionId) return

        const batchStartIndex = orderedBatchStarts[index]
        const surfaceQuestionId = index === 0 ? currentQuestion.id : ''

        try {
          await requestQuestionBatchTranslation(questionLanguage, batchStartIndex, surfaceQuestionId)
        } catch {
          if (index === 0) {
            return
          }
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [currentQuestion?.id, currentQuestionBaseLanguage, currentQuestionIndex, questionLanguage, test.id, totalQuestions])

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
    setBookmarkedQuestions((previous) =>
      previous.includes(currentQuestion.id)
        ? previous.filter((id) => id !== currentQuestion.id)
        : [...previous, currentQuestion.id]
    )
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

  const handleQuestionLanguageChange = (nextLanguage) => {
    const normalizedLanguage = normalizeQuestionLanguage(nextLanguage)
    const isRetryingCurrentLanguage = (
      normalizedLanguage === questionLanguage
      && Boolean(translationError)
      && normalizedLanguage !== currentQuestionBaseLanguage
    )

    setQuestionLanguage(normalizedLanguage)

    if (isRetryingCurrentLanguage) {
      requestQuestionBatchTranslation(
        normalizedLanguage,
        getBatchStartIndex(currentQuestionIndex),
        currentQuestion.id
      )
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
      bookmarkedQuestions,
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
            Question {currentQuestionIndex + 1} of {totalQuestions}
            {expectedQuestionCount > totalQuestions ? ` loaded (${expectedQuestionCount} total)` : ''}
            {' • '}
            {answeredCount} answered
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

      {isQuestionGenerationPending && (
        <div style={{
          padding: '12px 14px',
          background: 'rgba(14,165,233,0.08)',
          border: '1px solid rgba(14,165,233,0.2)',
          borderRadius: '10px',
          color: '#bae6fd',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '12px',
          lineHeight: 1.5,
        }}>
          {questionGenerationStatus || `Generating remaining questions in background. ${totalQuestions} of ${expectedQuestionCount} are ready.`}
        </div>
      )}

      {/* Question Card */}
      <QuestionCard
        question={displayQuestion}
        questionNumber={currentQuestionIndex + 1}
        selectedAnswer={test.answers[currentQuestion.id]}
        onSelectAnswer={handleSelectAnswer}
        showHint={showHint}
        onUseHint={handleUseHint}
        isBookmarked={bookmarkedQuestions.includes(currentQuestion.id)}
        onToggleBookmark={handleToggleBookmark}
        hasUsedHint={(test.hintsUsed || []).includes(currentQuestion.id)}
        questionLanguage={questionLanguage}
        onChangeQuestionLanguage={handleQuestionLanguageChange}
        isTranslationLoading={isTranslationLoading}
        translationError={translationError}
      />

      {/* Question Navigator */}
      <QuestionNavigator
        questions={test.questions}
        currentIndex={currentQuestionIndex}
        answers={test.answers}
        bookmarkedQuestions={bookmarkedQuestions}
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
          ) : isQuestionGenerationPending ? (
            <button
              className="w-full sm:w-auto"
              type="button"
              disabled
              style={{
                padding: '12px 24px',
                background: 'rgba(14,165,233,0.12)',
                border: '1px solid rgba(14,165,233,0.24)',
                borderRadius: '10px',
                color: '#7dd3fc',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'wait',
              }}
            >
              Generating More Questions...
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
