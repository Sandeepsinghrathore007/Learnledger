import { useEffect, useMemo, useState } from 'react'
import {
  createExamGroup,
  deleteExamGroup,
  subscribeToExamGroups,
  updateExamGroup,
} from '@/services/firebase/examGroupsService'
import { subscribeToAIChats } from '@/services/firebase/aiService'
import { subscribeToActivity } from '@/services/firebase/analyticsService'
import { subscribeToTests } from '@/services/firebase/testsService'
import { buildAnalyticsDashboard } from '@/utils/analytics'

export function useAnalyticsDashboard({ user, subjects }) {
  const [tests, setTests] = useState([])
  const [aiChats, setAIChats] = useState([])
  const [activity, setActivity] = useState([])
  const [examGroups, setExamGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.uid) {
      setTests([])
      setAIChats([])
      setActivity([])
      setExamGroups([])
      setLoading(false)
      setError('')
      return undefined
    }

    setLoading(true)
    setError('')

    const readyState = {
      tests: false,
      chats: false,
      activity: false,
      groups: false,
    }

    const markReady = (key) => {
      readyState[key] = true
      if (Object.values(readyState).every(Boolean)) {
        setLoading(false)
      }
    }

    const handleSubscriptionError = (subscriptionError) => {
      console.error('Failed to load analytics data:', subscriptionError)
      setError(subscriptionError?.message || 'Unable to load analytics right now.')
      setLoading(false)
    }

    const unsubscribeTests = subscribeToTests(
      user.uid,
      (items) => {
        setTests(items)
        markReady('tests')
      },
      handleSubscriptionError
    )

    const unsubscribeAIChats = subscribeToAIChats(
      user.uid,
      (items) => {
        setAIChats(items)
        markReady('chats')
      },
      handleSubscriptionError
    )

    const unsubscribeActivity = subscribeToActivity(
      user.uid,
      (items) => {
        setActivity(items)
        markReady('activity')
      },
      handleSubscriptionError
    )

    const unsubscribeExamGroups = subscribeToExamGroups(
      user.uid,
      (items) => {
        setExamGroups(items)
        markReady('groups')
      },
      handleSubscriptionError
    )

    return () => {
      unsubscribeTests()
      unsubscribeAIChats()
      unsubscribeActivity()
      unsubscribeExamGroups()
    }
  }, [user?.uid])

  const analytics = useMemo(
    () => buildAnalyticsDashboard({ subjects, tests, aiChats, activity, examGroups }),
    [activity, aiChats, examGroups, subjects, tests]
  )

  const saveExamGroup = async (groupInput) => {
    if (!user?.uid) {
      throw new Error('Login required to save exam groups.')
    }

    if (groupInput?.id) {
      await updateExamGroup(user.uid, groupInput.id, {
        name: groupInput.name,
        subjectIds: groupInput.subjectIds,
      })
      return
    }

    await createExamGroup(user.uid, {
      name: groupInput.name,
      subjectIds: groupInput.subjectIds,
    })
  }

  const removeExamGroup = async (examGroupId) => {
    if (!user?.uid) {
      throw new Error('Login required to delete exam groups.')
    }

    await deleteExamGroup(user.uid, examGroupId)
  }

  return {
    analytics,
    examGroups,
    loading,
    error,
    isAuthenticated: Boolean(user?.uid),
    saveExamGroup,
    removeExamGroup,
  }
}
