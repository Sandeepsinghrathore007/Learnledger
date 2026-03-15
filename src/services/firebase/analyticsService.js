import {
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { uid } from '@/utils/id'
import { userActivityCol, userActivityDocRef } from './firestorePaths'

export const ACTIVITY_TYPES = Object.freeze({
  NOTE_CREATED: 'note_created',
  NOTE_UPDATED: 'note_updated',
  TOPIC_CREATED: 'topic_created',
  TOPIC_COMPLETED: 'topic_completed',
  TEST_TAKEN: 'test_taken',
  AI_QUESTION: 'ai_question',
})

const VALID_ACTIVITY_TYPES = new Set(Object.values(ACTIVITY_TYPES))

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === 'function') return value.toDate()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number)
  return new Date(year, month - 1, day)
}

function diffDaysFromKeys(previousDateKey, currentDateKey) {
  const previous = parseDateKey(previousDateKey)
  const current = parseDateKey(currentDateKey)
  return Math.round((current - previous) / (1000 * 60 * 60 * 24))
}

export function getDateKey(value = new Date()) {
  const date = toDate(value) || new Date()

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function mapActivityDoc(snapshot) {
  const data = snapshot.data()
  const timestamp = toDate(data.timestamp)?.toISOString() ?? null

  return {
    id: snapshot.id,
    ...data,
    timestamp,
  }
}

export function subscribeToActivity(userId, onNext, onError) {
  return onSnapshot(
    userActivityCol(userId),
    (snapshot) => {
      const items = snapshot.docs
        .map(mapActivityDoc)
        .sort((a, b) => {
          if (a.date === b.date) {
            return (a.occurredAt || '').localeCompare(b.occurredAt || '')
          }
          return a.date.localeCompare(b.date)
        })

      onNext(items)
    },
    onError
  )
}

export async function logActivity(userId, payload) {
  if (!userId) {
    throw new Error('logActivity requires an authenticated user id.')
  }

  const type = payload?.type
  if (!VALID_ACTIVITY_TYPES.has(type)) {
    throw new Error(
      `Invalid activity type "${type}". Valid types: ${Array.from(VALID_ACTIVITY_TYPES).join(', ')}`
    )
  }

  const eventDate = toDate(payload.timestamp || payload.occurredAt) || new Date()
  const activityId = payload?.id || uid()
  const activityRef = userActivityDocRef(userId, activityId)

  const activityDoc = {
    userId,
    type,
    date: payload?.date || getDateKey(eventDate),
    timestamp: serverTimestamp(),
    occurredAt: eventDate.toISOString(),
    subjectId: payload?.subjectId || null,
    topicId: payload?.topicId || null,
    noteId: payload?.noteId || null,
    testId: payload?.testId || null,
    aiChatId: payload?.aiChatId || null,
    metadata: payload?.metadata || {},
  }

  await setDoc(activityRef, activityDoc)

  return {
    id: activityRef.id,
    ...activityDoc,
    timestamp: eventDate.toISOString(),
  }
}

export async function getUserActivity(userId, options = {}) {
  if (!userId) return []

  const startKey = options.startDate ? getDateKey(options.startDate) : null
  const endKey = options.endDate ? getDateKey(options.endDate) : null

  const snapshot = await getDocs(userActivityCol(userId))

  return snapshot.docs
    .map(mapActivityDoc)
    .filter((entry) => {
      if (startKey && entry.date < startKey) return false
      if (endKey && entry.date > endKey) return false
      return true
    })
    .sort((a, b) => {
      if (a.date === b.date) {
        return (a.occurredAt || '').localeCompare(b.occurredAt || '')
      }
      return a.date.localeCompare(b.date)
    })
}

export async function getDailyActivityHeatmap(userId, options = {}) {
  const days = Number(options.days) > 0 ? Number(options.days) : 90
  const endDate = new Date()
  const startDate = addDays(endDate, -(days - 1))

  const logs = await getUserActivity(userId, { startDate, endDate })

  const aggregated = new Map()

  logs.forEach((log) => {
    const existing = aggregated.get(log.date) || {
      date: log.date,
      count: 0,
      types: {
        [ACTIVITY_TYPES.NOTE_CREATED]: 0,
        [ACTIVITY_TYPES.NOTE_UPDATED]: 0,
        [ACTIVITY_TYPES.TOPIC_CREATED]: 0,
        [ACTIVITY_TYPES.TOPIC_COMPLETED]: 0,
        [ACTIVITY_TYPES.TEST_TAKEN]: 0,
        [ACTIVITY_TYPES.AI_QUESTION]: 0,
      },
    }

    existing.count += 1
    existing.types[log.type] = (existing.types[log.type] || 0) + 1

    aggregated.set(log.date, existing)
  })

  const result = []
  for (let index = 0; index < days; index += 1) {
    const date = addDays(startDate, index)
    const dateKey = getDateKey(date)

    result.push(
      aggregated.get(dateKey) || {
        date: dateKey,
        count: 0,
        types: {
          [ACTIVITY_TYPES.NOTE_CREATED]: 0,
          [ACTIVITY_TYPES.NOTE_UPDATED]: 0,
          [ACTIVITY_TYPES.TOPIC_CREATED]: 0,
          [ACTIVITY_TYPES.TOPIC_COMPLETED]: 0,
          [ACTIVITY_TYPES.TEST_TAKEN]: 0,
          [ACTIVITY_TYPES.AI_QUESTION]: 0,
        },
      }
    )
  }

  return result
}

export async function getStudyStreak(userId, options = {}) {
  const referenceDate = toDate(options.referenceDate) || new Date()
  const dateKeys = [
    ...new Set((await getUserActivity(userId)).map((entry) => entry.date)),
  ].sort()

  if (dateKeys.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
    }
  }

  const activeDates = new Set(dateKeys)
  let currentStreak = 0
  let cursor = new Date(referenceDate)
  cursor.setHours(0, 0, 0, 0)

  while (activeDates.has(getDateKey(cursor))) {
    currentStreak += 1
    cursor = addDays(cursor, -1)
  }

  let longestStreak = 0
  let runningStreak = 0
  let previousDateKey = null

  dateKeys.forEach((dateKey) => {
    if (previousDateKey && diffDaysFromKeys(previousDateKey, dateKey) === 1) {
      runningStreak += 1
    } else {
      runningStreak = 1
    }

    if (runningStreak > longestStreak) {
      longestStreak = runningStreak
    }

    previousDateKey = dateKey
  })

  return {
    currentStreak,
    longestStreak,
    lastActiveDate: dateKeys[dateKeys.length - 1],
  }
}

export async function getActivityCounts(userId, options = {}) {
  const days = Number(options.days) > 0 ? Number(options.days) : 30
  const endDate = new Date()
  const startDate = addDays(endDate, -(days - 1))

  const logs = await getUserActivity(userId, { startDate, endDate })

  const counts = {
    notesCreatedCount: 0,
    topicsCreatedCount: 0,
    topicsCompletedCount: 0,
    testsTakenCount: 0,
    aiInteractionsCount: 0,
  }

  logs.forEach((log) => {
    if (log.type === ACTIVITY_TYPES.NOTE_CREATED) counts.notesCreatedCount += 1
    if (log.type === ACTIVITY_TYPES.TOPIC_CREATED) counts.topicsCreatedCount += 1
    if (log.type === ACTIVITY_TYPES.TOPIC_COMPLETED) counts.topicsCompletedCount += 1
    if (log.type === ACTIVITY_TYPES.TEST_TAKEN) counts.testsTakenCount += 1
    if (log.type === ACTIVITY_TYPES.AI_QUESTION) counts.aiInteractionsCount += 1
  })

  return {
    ...counts,
    totalActivity: logs.length,
    days,
  }
}

export async function getAnalyticsSummary(userId, options = {}) {
  const [counts, streak, heatmap] = await Promise.all([
    getActivityCounts(userId, { days: options.days || 30 }),
    getStudyStreak(userId),
    getDailyActivityHeatmap(userId, { days: options.heatmapDays || 90 }),
  ])

  return {
    counts,
    streak,
    heatmap,
  }
}
