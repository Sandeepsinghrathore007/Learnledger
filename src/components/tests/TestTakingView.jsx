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
import { formatTimerDisplay } from '@/utils/testScoring'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import {
  getInlineQuestionTranslation,
  inferQuestionLanguageFromQuestion,
  normalizeQuestionLanguage,
  translateQuestionBatch,
} from '@/utils/questionTranslation'
import { finalizeTestAttemptWithStoredAnswers } from '@/utils/testReviewState'

function cloneQuestions(questions) {
  return Array.isArray(questions)
    ? questions.map((question) => ({
        ...question,
        options: Array.isArray(question?.options)
          ? question.options.map((option) => ({ ...option }))
          : [],
      }))
    : []
}

function getStoredQuestionArray(questions, defaultLanguage, targetLanguage) {
  const normalizedTargetLanguage = normalizeQuestionLanguage(targetLanguage)
  const normalizedDefaultLanguage = normalizeQuestionLanguage(defaultLanguage)

  if (normalizedTargetLanguage === normalizedDefaultLanguage) {
    return cloneQuestions(questions)
  }

  const inlineTranslations = (Array.isArray(questions) ? questions : [])
    .map((question) => getInlineQuestionTranslation(question, normalizedTargetLanguage))

  return inlineTranslations.every(Boolean) ? inlineTranslations : []
}

function buildQuestionLanguageState(questions, defaultLanguage) {
  return {
    questions_en: getStoredQuestionArray(questions, defaultLanguage, 'english'),
    questions_hi: getStoredQuestionArray(questions, defaultLanguage, 'hindi'),
  }
}

function getQuestionArrayByLanguage(questionState, language, fallbackQuestions) {
  const normalizedLanguage = normalizeQuestionLanguage(language)
  const key = normalizedLanguage === 'hindi' ? 'questions_hi' : 'questions_en'
  const questionArray = Array.isArray(questionState?.[key]) ? questionState[key] : []

  return questionArray.length === (Array.isArray(fallbackQuestions) ? fallbackQuestions.length : 0)
    ? questionArray
    : Array.isArray(fallbackQuestions)
      ? fallbackQuestions
      : []
}

function hasStoredQuestionArrayForLanguage(questionState, language, totalQuestions) {
  const normalizedLanguage = normalizeQuestionLanguage(language)
  const key = normalizedLanguage === 'hindi' ? 'questions_hi' : 'questions_en'
  return Array.isArray(questionState?.[key]) && questionState[key].length === totalQuestions
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
  const [questionTranslations, setQuestionTranslations] = useState(() =>
    buildQuestionLanguageState(test?.questions, testDefaultLanguage)
  )
  const [translationState, setTranslationState] = useState({
    language: '',
    loading: false,
    error: '',
  })
  const questions = Array.isArray(test?.questions) ? test.questions : []
  const totalQuestions = questions.length
  const displayedQuestions = getQuestionArrayByLanguage(questionTranslations, questionLanguage, questions)
  const currentQuestion = questions[currentQuestionIndex] || null
  const translatedCurrentQuestion = displayedQuestions[currentQuestionIndex] || null
  const currentQuestionId = String(currentQuestion?.id || '').trim()
  const removedQuestionIds = Array.isArray(test?.removedQuestionIds) ? test.removedQuestionIds : []
  const removedQuestionsCount = Number.isFinite(test?.removedQuestionsCount)
    ? test.removedQuestionsCount
    : removedQuestionIds.length
  const translationSessionRef = useRef(0)
  const isManualParsingMode = String(test?.config?.parsingMode || '').trim().toLowerCase() === 'manual'
  const displayQuestion = translatedCurrentQuestion || currentQuestion
  const expectedQuestionCount = Math.max(
    totalQuestions,
    Number(test?.metadata?.examGeneration?.totalQuestions || test?.metadata?.examSource?.questionCount || 0)
  )
  const displayQuestionCount = Math.max(totalQuestions, expectedQuestionCount - removedQuestionsCount)
  const isAiReviewProcessing = Boolean(test?.metadata?.reviewGeneration?.isAiProcessing)
  const aiReviewStatus = String(test?.metadata?.reviewGeneration?.statusText || '').trim()
  const isQuestionGenerationPending = Boolean(
    test?.metadata?.examGeneration
    && test.metadata.examGeneration.isComplete === false
    && totalQuestions < displayQuestionCount
  )
  const questionGenerationStatus = String(test?.metadata?.examGeneration?.statusText || '').trim()
  const isTranslationLoading = (
    translationState.loading
    && translationState.language === questionLanguage
  )
  const translationError = translationState.language === questionLanguage ? translationState.error : ''

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
    if (currentQuestionIndex < totalQuestions) return
    setCurrentQuestionIndex(Math.max(0, totalQuestions - 1))
  }, [currentQuestionIndex, totalQuestions])

  useEffect(() => {
    setBookmarkedQuestions(test.bookmarkedQuestions || [])
  }, [test.id])

  useEffect(() => {
    translationSessionRef.current += 1
    setQuestionTranslations(buildQuestionLanguageState(test?.questions, testDefaultLanguage))
    setQuestionLanguage(inferQuestionLanguageFromQuestion(test?.questions?.[0], testDefaultLanguage))
    setTranslationState({
      language: '',
      loading: false,
      error: '',
    })
  }, [test.id, testDefaultLanguage, totalQuestions])

  useEffect(() => {
    if (isManualParsingMode) return
    if (isQuestionGenerationPending) return
    if (totalQuestions === 0) return

    const baseLanguage = normalizeQuestionLanguage(testDefaultLanguage)
    const targetLanguage = baseLanguage === 'hindi' ? 'english' : 'hindi'
    const translationKey = targetLanguage === 'hindi' ? 'questions_hi' : 'questions_en'
    const alreadyTranslated = questionTranslations[translationKey]?.length === totalQuestions
    if (alreadyTranslated) {
      return
    }

    const sessionId = translationSessionRef.current
    setTranslationState({
      language: targetLanguage,
      loading: true,
      error: '',
    })

    translateQuestionBatch(questions, targetLanguage)
      .then((translatedBatch) => {
        if (translationSessionRef.current !== sessionId) return

        startTransition(() => {
          setQuestionTranslations((previous) => ({
            ...previous,
            [translationKey]: translatedBatch,
          }))
        })

        setTranslationState({
          language: targetLanguage,
          loading: false,
          error: '',
        })
      })
      .catch((error) => {
        if (translationSessionRef.current !== sessionId) return

        console.warn('Question translation failed. Falling back to the original language.', error)
        setQuestionLanguage((previousLanguage) => (
          normalizeQuestionLanguage(previousLanguage) === targetLanguage
            ? baseLanguage
            : previousLanguage
        ))
        setTranslationState({
          language: '',
          loading: false,
          error: '',
        })
      })
  }, [
    isManualParsingMode,
    isQuestionGenerationPending,
    questionTranslations,
    questions,
    testDefaultLanguage,
    totalQuestions,
  ])

  // Handle time up
  const handleTimeUp = () => {
    if (totalQuestions === 0) {
      handleFinish()
      return
    }

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
    if (!currentQuestionId) return

    onUpdateTest((previous) => ({
      ...previous,
      answers: {
        ...(previous?.answers || {}),
        [currentQuestionId]: optionId,
      },
    }))
    setShowHint(false)
  }

  // Bookmark question
  const handleToggleBookmark = () => {
    if (!currentQuestionId) return

    setBookmarkedQuestions((previous) =>
      previous.includes(currentQuestionId)
        ? previous.filter((id) => id !== currentQuestionId)
        : [...previous, currentQuestionId]
    )
  }

  // Use hint
  const handleUseHint = () => {
    if (!currentQuestionId) return

    setShowHint(true)
    const hintsUsed = test.hintsUsed || []
    if (!hintsUsed.includes(currentQuestionId)) {
      onUpdateTest((previous) => {
        const previousHintsUsed = previous?.hintsUsed || []
        if (previousHintsUsed.includes(currentQuestionId)) {
          return previous
        }

        return {
          ...previous,
          hintsUsed: [...previousHintsUsed, currentQuestionId],
        }
      })
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

    if (normalizedLanguage !== testDefaultLanguage) {
      const isStoredTranslationAvailable = hasStoredQuestionArrayForLanguage(
        questionTranslations,
        normalizedLanguage,
        totalQuestions
      )
      const isTranslationInFlight = (
        translationState.loading
        && translationState.language === normalizedLanguage
      )

      if (!isStoredTranslationAvailable && !isTranslationInFlight) {
        setQuestionLanguage(testDefaultLanguage)
        return
      }
    }

    setQuestionLanguage(normalizedLanguage)
  }

  const handleRemoveQuestion = () => {
    if (!isManualParsingMode || !currentQuestion || !currentQuestionId) return
    if (!window.confirm('Remove this question from the test? It will not affect your final result.')) {
      return
    }

    const removedQuestion = currentQuestion
    const remainingQuestionCount = Math.max(0, totalQuestions - 1)

    setBookmarkedQuestions((previous) => previous.filter((questionId) => questionId !== currentQuestionId))
    setShowHint(false)

    onUpdateTest((previous) => {
      const previousQuestions = Array.isArray(previous?.questions) ? previous.questions : []
      const nextQuestions = previousQuestions.filter((question) => question?.id !== currentQuestionId)
      const nextAnswers = { ...(previous?.answers || {}) }
      delete nextAnswers[currentQuestionId]

      const nextBookmarks = (previous?.bookmarkedQuestions || []).filter((questionId) => questionId !== currentQuestionId)
      const nextHints = (previous?.hintsUsed || []).filter((questionId) => questionId !== currentQuestionId)
      const nextRemovedQuestionIds = [
        ...new Set([
          ...(Array.isArray(previous?.removedQuestionIds) ? previous.removedQuestionIds : []),
          currentQuestionId,
        ]),
      ]

      return {
        ...previous,
        questions: nextQuestions,
        answers: nextAnswers,
        bookmarkedQuestions: nextBookmarks,
        hintsUsed: nextHints,
        removedQuestionIds: nextRemovedQuestionIds,
        removedQuestionsCount: nextRemovedQuestionIds.length,
        removedQuestions: [
          ...(Array.isArray(previous?.removedQuestions) ? previous.removedQuestions.filter((question) => question?.id !== currentQuestionId) : []),
          removedQuestion,
        ],
      }
    })

    setCurrentQuestionIndex((previous) => (
      remainingQuestionCount > 0
        ? Math.min(previous, remainingQuestionCount - 1)
        : 0
    ))

    if (test.config.timingMode === 'per-question') {
      if (remainingQuestionCount > 0) {
        resetForNextQuestion()
      } else {
        pauseTimer()
      }
    }
  }

  // Finish test
  const handleFinish = () => {
    const endTime = new Date().toISOString()
    const timeTaken = Math.floor((new Date(endTime) - new Date(test.startTime)) / 1000)
    const testAttempt = finalizeTestAttemptWithStoredAnswers({
      ...test,
      endTime,
      timeTaken,
      completedAt: endTime,
      bookmarkedQuestions,
      removedQuestionIds,
      removedQuestionsCount,
    })

    onFinish(testAttempt)
  }

  // Calculate progress
  const answeredCount = Object.keys(test.answers).length
  const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0
  const isStoredTranslationAvailable = hasStoredQuestionArrayForLanguage(
    questionTranslations,
    questionLanguage,
    totalQuestions
  )
  const shouldShowTranslationState = (
    !isManualParsingMode
    && questionLanguage !== testDefaultLanguage
    && (!isStoredTranslationAvailable || Boolean(translationError))
  )

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
            {currentQuestion
              ? `Question ${currentQuestionIndex + 1} of ${displayQuestionCount}`
              : 'No questions remaining'}
            {displayQuestionCount > totalQuestions && currentQuestion ? ` loaded (${displayQuestionCount} total)` : ''}
            {' • '}
            {answeredCount} answered
            {removedQuestionsCount > 0 ? ` • ${removedQuestionsCount} removed` : ''}
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
          {questionGenerationStatus || `Generating remaining questions in background. ${totalQuestions} of ${displayQuestionCount} are ready.`}
        </div>
      )}

      {isAiReviewProcessing && (
        <div style={{
          padding: '11px 14px',
          background: 'rgba(56,189,248,0.08)',
          border: '1px solid rgba(56,189,248,0.2)',
          borderRadius: '10px',
          color: '#bae6fd',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '12px',
          lineHeight: 1.5,
        }}>
          {aiReviewStatus || 'AI analysis in progress. Answers and explanations will be ready in the background.'}
        </div>
      )}

      {currentQuestion ? (
        <>
          <QuestionCard
            question={displayQuestion}
            questionNumber={currentQuestionIndex + 1}
            selectedAnswer={test.answers[currentQuestionId]}
            onSelectAnswer={handleSelectAnswer}
            showHint={showHint}
            onUseHint={handleUseHint}
            isBookmarked={bookmarkedQuestions.includes(currentQuestionId)}
            onToggleBookmark={handleToggleBookmark}
            hasUsedHint={(test.hintsUsed || []).includes(currentQuestionId)}
            questionLanguage={questionLanguage}
            onChangeQuestionLanguage={handleQuestionLanguageChange}
            showLanguageToggle={!isManualParsingMode}
            isTranslationLoading={shouldShowTranslationState && isTranslationLoading}
            translationError={shouldShowTranslationState ? translationError : ''}
            showRemoveQuestion={isManualParsingMode}
            onRemoveQuestion={handleRemoveQuestion}
          />

          <QuestionNavigator
            questions={questions}
            currentIndex={currentQuestionIndex}
            answers={test.answers}
            bookmarkedQuestions={bookmarkedQuestions}
            onJumpTo={handleJumpTo}
          />
        </>
      ) : (
        <div style={{
          padding: '24px',
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${BORDER}`,
          borderRadius: '14px',
          color: TEXT2,
          fontFamily: "'DM Sans', sans-serif",
          lineHeight: 1.6,
        }}>
          <div style={{ color: TEXT1, fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>
            No Questions Left
          </div>
          <div style={{ fontSize: '13px' }}>
            All active questions have been removed from this test. Finish the test to save the cleaned attempt, or exit without saving.
          </div>
        </div>
      )}

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
            disabled={!currentQuestion || currentQuestionIndex === 0}
            style={{
              padding: '12px 20px',
              background: !currentQuestion || currentQuestionIndex === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${BORDER}`,
              borderRadius: '10px',
              color: !currentQuestion || currentQuestionIndex === 0 ? TEXT3 : TEXT2,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: '600',
              cursor: !currentQuestion || currentQuestionIndex === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            ← Previous
          </button>

          {currentQuestion && currentQuestionIndex < totalQuestions - 1 ? (
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
          ) : currentQuestion && isQuestionGenerationPending ? (
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
