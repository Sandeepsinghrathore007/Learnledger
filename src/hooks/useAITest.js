import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { determinePerformanceLevel } from '@/utils/testScoring'
import {
  deleteTest as deleteTestDoc,
  generateTest as generateTestFromService,
  generateTestReviewData as generateTestReviewDataFromService,
  saveTestResult as saveTestResultDoc,
  saveTestReviewData as saveTestReviewDataDoc,
  subscribeToTests,
} from '@/services/firebase/testsService'

export function useAITest(subjects, onUpdateSubject, user, options = {}) {
  const {
    subscribe = true,
    syncSubjectStats = true,
  } = options
  const [cloudTestHistory, setCloudTestHistory] = useState([])
  const [guestTestHistory, setGuestTestHistory] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState('')
  const [error, setError] = useState(null)
  const reviewTaskMapRef = useRef(new Map())

  const isAuthenticated = Boolean(user?.uid)
  const testHistory = useMemo(
    () => (isAuthenticated ? cloudTestHistory : guestTestHistory),
    [cloudTestHistory, guestTestHistory, isAuthenticated]
  )

  useEffect(() => {
    if (!subscribe) return undefined

    if (!isAuthenticated) {
      setCloudTestHistory([])
      return
    }

    const unsubscribe = subscribeToTests(
      user.uid,
      (tests) => {
        setCloudTestHistory(tests)
      },
      (subscriptionError) => {
        console.error('Failed to subscribe tests:', subscriptionError)
        setError(subscriptionError.message || 'Unable to load test history from Firebase.')
      }
    )

    return () => unsubscribe()
  }, [isAuthenticated, subscribe, user?.uid])

  useEffect(() => {
    if (!syncSubjectStats) return
    if (!onUpdateSubject) return
    if (!isAuthenticated && guestTestHistory.length === 0) return

    let cancelled = false

    const syncSubjectStatsSequentially = async () => {
      for (const subject of subjects) {
        if (cancelled) break

        const subjectTests = testHistory.filter((test) =>
          test.metadata?.subjects?.some((item) => item.id === subject.id)
        )

        const aiScore = determinePerformanceLevel(subjectTests)
        const testsAttempted = subjectTests.length

        if (subject.aiScore === aiScore && subject.testsAttempted === testsAttempted) {
          continue
        }

        try {
          await onUpdateSubject({
            ...subject,
            aiScore,
            testsAttempted,
          })
        } catch (syncError) {
          if (!cancelled) {
            console.error('Failed to sync subject stats from tests:', syncError)
            setError(syncError?.message || 'Unable to refresh subject test stats.')
          }
          break
        }
      }
    }

    syncSubjectStatsSequentially()

    return () => {
      cancelled = true
    }
  }, [guestTestHistory.length, isAuthenticated, onUpdateSubject, subjects, syncSubjectStats, testHistory])

  const generateTest = useCallback(async (config, options = {}) => {
    setIsGenerating(true)
    setError(null)
    setGenerationStatus('')

    try {
      const test = await generateTestFromService({
        config,
        subjects,
        userId: user?.uid || null,
        onProgress: (progress) => {
          const message = typeof progress === 'string'
            ? progress
            : String(progress?.message || '').trim()

          setGenerationStatus(message)

          if (typeof options?.onProgress === 'function') {
            options.onProgress(progress)
          }
        },
      })

      return test
    } catch (generationError) {
      console.error('Test generation error:', generationError)
      setError(generationError.message || 'Unable to generate test right now.')
      throw generationError
    } finally {
      setIsGenerating(false)
      setGenerationStatus('')
    }
  }, [subjects, user?.uid])

  const saveTestResult = useCallback(async (testAttempt) => {
    if (!isAuthenticated) {
      setGuestTestHistory((previous) => [...previous, testAttempt])
      return
    }

    try {
      await saveTestResultDoc(user.uid, testAttempt)
    } catch (saveError) {
      console.error('Failed to save test result:', saveError)
      setError(saveError.message || 'Unable to save test result.')
    }
  }, [isAuthenticated, user?.uid])

  const saveTestReviewData = useCallback(async (testAttempt) => {
    if (!testAttempt?.id) return

    if (!isAuthenticated) {
      setGuestTestHistory((previous) => {
        const existingIndex = previous.findIndex((item) => item.id === testAttempt.id)
        if (existingIndex === -1) {
          return [...previous, testAttempt]
        }

        const next = previous.slice()
        next[existingIndex] = testAttempt
        return next
      })
      return
    }

    try {
      await saveTestReviewDataDoc(user.uid, testAttempt)
    } catch (saveError) {
      console.error('Failed to save test review data:', saveError)
    }
  }, [isAuthenticated, user?.uid])

  const startTestReviewGeneration = useCallback((test, { onComplete = null, onError = null } = {}) => {
    if (!test?.id || !test?.metadata?.reviewGeneration?.isAiProcessing) {
      return Promise.resolve(null)
    }

    const existingTask = reviewTaskMapRef.current.get(test.id)
    if (existingTask) {
      return existingTask
    }

    const task = generateTestReviewDataFromService({ test })
      .then((reviewPatch) => {
        if (typeof onComplete === 'function') {
          onComplete(reviewPatch)
        }
        return reviewPatch
      })
      .catch((reviewError) => {
        console.error('Failed to prepare test review data:', reviewError)
        if (typeof onError === 'function') {
          onError(reviewError)
        }
        return null
      })
      .finally(() => {
        reviewTaskMapRef.current.delete(test.id)
      })

    reviewTaskMapRef.current.set(test.id, task)
    return task
  }, [])

  const getAIPerformance = useCallback((subjectId) => {
    const subjectTests = testHistory.filter((test) =>
      test.metadata?.subjects?.some((subject) => subject.id === subjectId)
    )

    return determinePerformanceLevel(subjectTests)
  }, [testHistory])

  const deleteTest = useCallback(async (testId) => {
    if (!testId) return

    if (!isAuthenticated) {
      setGuestTestHistory((previous) => previous.filter((test) => test.id !== testId))
      return
    }

    try {
      await deleteTestDoc(user.uid, testId)
    } catch (deletionError) {
      console.error('Failed to delete test:', deletionError)
      setError(deletionError.message || 'Unable to delete the selected test.')
    }
  }, [isAuthenticated, user?.uid])

  return {
    testHistory,
    isGenerating,
    generationStatus,
    error,
    generateTest,
    saveTestResult,
    saveTestReviewData,
    startTestReviewGeneration,
    getAIPerformance,
    deleteTest,
  }
}
