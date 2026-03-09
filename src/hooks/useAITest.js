import { useCallback, useEffect, useMemo, useState } from 'react'
import { determinePerformanceLevel } from '@/utils/testScoring'
import {
  deleteTest as deleteTestDoc,
  generateTest as generateTestFromService,
  saveTestResult as saveTestResultDoc,
  subscribeToTests,
} from '@/services/firebase/testsService'

export function useAITest(subjects, onUpdateSubject, user) {
  const [cloudTestHistory, setCloudTestHistory] = useState([])
  const [guestTestHistory, setGuestTestHistory] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(null)

  const isAuthenticated = Boolean(user?.uid)
  const testHistory = useMemo(
    () => (isAuthenticated ? cloudTestHistory : guestTestHistory),
    [cloudTestHistory, guestTestHistory, isAuthenticated]
  )

  useEffect(() => {
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
  }, [isAuthenticated, user?.uid])

  useEffect(() => {
    if (!onUpdateSubject) return
    if (!isAuthenticated && guestTestHistory.length === 0) return

    subjects.forEach((subject) => {
      const subjectTests = testHistory.filter((test) =>
        test.metadata?.subjects?.some((item) => item.id === subject.id)
      )

      const aiScore = determinePerformanceLevel(subjectTests)
      const testsAttempted = subjectTests.length

      if (subject.aiScore === aiScore && subject.testsAttempted === testsAttempted) {
        return
      }

      onUpdateSubject({
        ...subject,
        aiScore,
        testsAttempted,
      })
    })
  }, [guestTestHistory.length, isAuthenticated, onUpdateSubject, subjects, testHistory])

  const generateTest = useCallback(async (config) => {
    setIsGenerating(true)
    setError(null)

    try {
      const test = await generateTestFromService({
        config,
        subjects,
        userId: user?.uid || null,
      })

      return test
    } catch (generationError) {
      console.error('Test generation error:', generationError)
      setError(generationError.message || 'Unable to generate test right now.')
      throw generationError
    } finally {
      setIsGenerating(false)
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
    error,
    generateTest,
    saveTestResult,
    getAIPerformance,
    deleteTest,
  }
}
