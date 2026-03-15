import { ACTIVITY_TYPES } from '@/services/firebase/analyticsService'

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_HEATMAP_DAYS = 182
const DEFAULT_WEEK_WINDOW = 8
const DEFAULT_TREND_LIMIT = 12
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const STUDY_TIME_WEIGHTS = {
  [ACTIVITY_TYPES.NOTE_CREATED]: 18,
  [ACTIVITY_TYPES.TOPIC_CREATED]: 14,
  [ACTIVITY_TYPES.TOPIC_COMPLETED]: 28,
  [ACTIVITY_TYPES.AI_QUESTION]: 6,
}

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === 'function') return value.toDate()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function startOfDay(value = new Date()) {
  const date = typeof value === 'string' && DATE_KEY_PATTERN.test(value)
    ? new Date(...value.split('-').map((part, index) => (index === 1 ? Number(part) - 1 : Number(part))))
    : toDate(value) || new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(value, days) {
  const date = startOfDay(value)
  date.setDate(date.getDate() + days)
  return date
}

export function toDateKey(value = new Date()) {
  const date = startOfDay(value)

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function parseDateKey(dateKey) {
  return startOfDay(dateKey)
}

function diffDays(dateKeyA, dateKeyB) {
  return Math.round((parseDateKey(dateKeyB) - parseDateKey(dateKeyA)) / DAY_MS)
}

function formatDate(value, options) {
  const date = toDate(value)
  if (!date) return ''

  return date.toLocaleDateString('en-IN', options)
}

function round(value, digits = 0) {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function average(values) {
  const numbers = values.filter((value) => Number.isFinite(value))
  if (numbers.length === 0) return 0
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
}

function getTopicCount(subject) {
  return Array.isArray(subject?.topics) ? subject.topics.length : 0
}

function getCompletedTopicCount(subject) {
  return Array.isArray(subject?.topics)
    ? subject.topics.filter((topic) => Boolean(topic?.isCompleted)).length
    : 0
}

function getNoteCount(subject) {
  if (!Array.isArray(subject?.topics)) return 0

  return subject.topics.reduce(
    (sum, topic) => sum + (Array.isArray(topic?.notes) ? topic.notes.length : 0),
    0
  )
}

function getPdfCount(subject) {
  return Array.isArray(subject?.pdfs) ? subject.pdfs.length : 0
}

function getRelevantSubjectIds(test) {
  const fromMetadata = Array.isArray(test?.metadata?.subjects)
    ? test.metadata.subjects.map((subject) => subject?.id)
    : []
  const fallback = test?.questions?.[0]?.sourceSubject ? [test.questions[0].sourceSubject] : []

  return [...new Set([...fromMetadata, ...fallback].filter(Boolean))]
}

function getQuestionCount(test) {
  if (Array.isArray(test?.questions) && test.questions.length > 0) {
    return test.questions.length
  }

  return Number.isFinite(test?.totalQuestions) ? test.totalQuestions : 0
}

function getAnsweredCount(test) {
  if (test?.answers && typeof test.answers === 'object') {
    return Object.values(test.answers).filter(Boolean).length
  }

  const questionCount = getQuestionCount(test)
  if (questionCount === 0) return 0

  if (Number.isFinite(test?.unanswered)) {
    return Math.max(0, questionCount - test.unanswered)
  }

  return questionCount
}

function getCorrectCount(test) {
  if (Number.isFinite(test?.correct)) return test.correct
  if (Number.isFinite(test?.score)) return test.score

  const questionCount = getQuestionCount(test)
  if (!questionCount) return 0

  if (Number.isFinite(test?.percentage)) {
    return Math.round((test.percentage / 100) * questionCount)
  }

  return 0
}

function getAccuracy(test) {
  const answeredCount = getAnsweredCount(test)
  if (answeredCount === 0) return 0
  return round((getCorrectCount(test) / answeredCount) * 100)
}

function getCompletedAt(test) {
  return toDate(test?.completedAt || test?.createdAt || null)
}

function formatWeekLabel(weekStartKey) {
  const weekStart = parseDateKey(weekStartKey)
  const weekEnd = addDays(weekStart, 6)

  return `${formatDate(weekStart, { month: 'short', day: 'numeric' })} - ${formatDate(weekEnd, { month: 'short', day: 'numeric' })}`
}

function getWeekStartKey(value) {
  const date = startOfDay(value)
  const weekday = date.getDay()
  const diff = (weekday + 6) % 7
  date.setDate(date.getDate() - diff)
  return toDateKey(date)
}

function getRecentWeekKeys(count = DEFAULT_WEEK_WINDOW, today = new Date()) {
  const currentWeekStart = parseDateKey(getWeekStartKey(today))

  return Array.from({ length: count }, (_, index) =>
    toDateKey(addDays(currentWeekStart, (index - (count - 1)) * 7))
  )
}

export function getHeatmapColor(count) {
  if (count <= 0) return 'rgba(148,163,184,0.14)'
  if (count <= 3) return 'rgba(74,222,128,0.45)'
  if (count <= 7) return 'rgba(34,197,94,0.7)'
  return '#15803d'
}

export function formatMinutesCompact(minutes) {
  const rounded = Math.max(0, Math.round(minutes))
  const hours = Math.floor(rounded / 60)
  const mins = rounded % 60

  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export function buildHeatmap(activity = [], options = {}) {
  const days = Number(options.days) > 0 ? Number(options.days) : DEFAULT_HEATMAP_DAYS
  const endDate = startOfDay(options.today || new Date())
  const startDate = addDays(endDate, -(days - 1))
  const byDate = new Map()

  activity.forEach((entry) => {
    if (!entry?.date) return

    const existing = byDate.get(entry.date) || {
      date: entry.date,
      count: 0,
      types: {
        [ACTIVITY_TYPES.NOTE_CREATED]: 0,
        [ACTIVITY_TYPES.TOPIC_CREATED]: 0,
        [ACTIVITY_TYPES.TOPIC_COMPLETED]: 0,
        [ACTIVITY_TYPES.TEST_TAKEN]: 0,
        [ACTIVITY_TYPES.AI_QUESTION]: 0,
      },
    }

    existing.count += 1
    existing.types[entry.type] = (existing.types[entry.type] || 0) + 1
    byDate.set(entry.date, existing)
  })

  const daysList = Array.from({ length: days }, (_, index) => {
    const date = addDays(startDate, index)
    const dateKey = toDateKey(date)
    const item = byDate.get(dateKey) || {
      date: dateKey,
      count: 0,
      types: {
        [ACTIVITY_TYPES.NOTE_CREATED]: 0,
        [ACTIVITY_TYPES.TOPIC_CREATED]: 0,
        [ACTIVITY_TYPES.TOPIC_COMPLETED]: 0,
        [ACTIVITY_TYPES.TEST_TAKEN]: 0,
        [ACTIVITY_TYPES.AI_QUESTION]: 0,
      },
    }

    return {
      ...item,
      color: getHeatmapColor(item.count),
      label: `${formatDate(date, { month: 'short', day: 'numeric' })} - ${item.count} study activit${item.count === 1 ? 'y' : 'ies'}`,
    }
  })

  return {
    days: daysList,
    activeDays: daysList.filter((day) => day.count > 0).length,
    maxCount: Math.max(0, ...daysList.map((day) => day.count)),
  }
}

export function computeStudyStreak(activity = [], today = new Date()) {
  const dateKeys = [...new Set(activity.map((entry) => entry?.date).filter(Boolean))].sort()

  if (dateKeys.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDate: null,
    }
  }

  let longestStreak = 0
  let running = 0
  let previousDateKey = null

  dateKeys.forEach((dateKey) => {
    if (previousDateKey && diffDays(previousDateKey, dateKey) === 1) {
      running += 1
    } else {
      running = 1
    }

    longestStreak = Math.max(longestStreak, running)
    previousDateKey = dateKey
  })

  const activeDays = new Set(dateKeys)
  const todayKey = toDateKey(today)
  const yesterdayKey = toDateKey(addDays(today, -1))
  let anchorKey = null

  if (activeDays.has(todayKey)) {
    anchorKey = todayKey
  } else if (activeDays.has(yesterdayKey)) {
    anchorKey = yesterdayKey
  }

  let currentStreak = 0
  while (anchorKey && activeDays.has(anchorKey)) {
    currentStreak += 1
    anchorKey = toDateKey(addDays(parseDateKey(anchorKey), -1))
  }

  return {
    currentStreak,
    longestStreak,
    lastActiveDate: dateKeys[dateKeys.length - 1],
  }
}

export function buildAnalyticsDashboard({
  subjects = [],
  tests = [],
  aiChats = [],
  activity = [],
  examGroups = [],
  today = new Date(),
  heatmapDays = DEFAULT_HEATMAP_DAYS,
  weekWindow = DEFAULT_WEEK_WINDOW,
  trendLimit = DEFAULT_TREND_LIMIT,
} = {}) {
  const heatmap = buildHeatmap(activity, { today, days: heatmapDays })
  const streak = computeStudyStreak(activity, today)
  const subjectMap = new Map()

  subjects.forEach((subject) => {
    subjectMap.set(subject.id, {
      id: subject.id,
      name: subject.name,
      icon: subject.icon,
      color: subject.color,
      totalTopics: getTopicCount(subject),
      completedTopics: getCompletedTopicCount(subject),
      notesCreated: getNoteCount(subject),
      totalPdfs: getPdfCount(subject),
      testsTaken: 0,
      scoreSum: 0,
      averageScore: 0,
      aiQuestionsGenerated: 0,
      aiQuestionsAttempted: 0,
      aiCorrectAnswers: 0,
      aiChatCount: 0,
      studyActions: 0,
    })
  })

  const normalizedTests = tests
    .map((test) => {
      const completedAt = getCompletedAt(test)

      return {
        ...test,
        completedAt: completedAt?.toISOString() || null,
        subjectIds: getRelevantSubjectIds(test),
        questionCount: getQuestionCount(test),
        answeredCount: getAnsweredCount(test),
        correctCount: getCorrectCount(test),
        accuracy: getAccuracy(test),
        weekKey: completedAt ? getWeekStartKey(completedAt) : null,
      }
    })
    .sort((a, b) => (a.completedAt || '').localeCompare(b.completedAt || ''))

  const normalizedAIChats = aiChats
    .map((chat) => ({
      ...chat,
      createdAt: toDate(chat.createdAt)?.toISOString() || null,
      weekKey: chat.createdAt ? getWeekStartKey(chat.createdAt) : null,
    }))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))

  const questionsAttemptedByWeek = new Map()
  const studyTimeByWeek = new Map()
  const aiQuestionsAttemptedByWeek = new Map()

  normalizedTests.forEach((test) => {
    const subjectCount = Math.max(1, test.subjectIds.length)
    const score = Number.isFinite(test.percentage) ? test.percentage : test.accuracy
    const questionShare = test.questionCount / subjectCount
    const attemptedShare = test.answeredCount / subjectCount
    const correctShare = test.correctCount / subjectCount

    test.subjectIds.forEach((subjectId) => {
      const subjectStats = subjectMap.get(subjectId)
      if (!subjectStats) return

      subjectStats.testsTaken += 1
      subjectStats.scoreSum += score
      subjectStats.aiQuestionsGenerated += questionShare
      subjectStats.aiQuestionsAttempted += attemptedShare
      subjectStats.aiCorrectAnswers += correctShare
    })

    if (test.weekKey) {
      questionsAttemptedByWeek.set(
        test.weekKey,
        (questionsAttemptedByWeek.get(test.weekKey) || 0) + test.answeredCount
      )
      aiQuestionsAttemptedByWeek.set(
        test.weekKey,
        (aiQuestionsAttemptedByWeek.get(test.weekKey) || 0) + test.answeredCount
      )
      studyTimeByWeek.set(
        test.weekKey,
        (studyTimeByWeek.get(test.weekKey) || 0) + (Number.isFinite(test.timeTaken) ? test.timeTaken / 60 : 0)
      )
    }
  })

  normalizedAIChats.forEach((chat) => {
    if (chat.subjectId && subjectMap.has(chat.subjectId)) {
      subjectMap.get(chat.subjectId).aiChatCount += 1
    }
  })

  activity.forEach((entry) => {
    if (entry?.subjectId && subjectMap.has(entry.subjectId)) {
      subjectMap.get(entry.subjectId).studyActions += 1
    }

    const weekKey = entry?.date ? getWeekStartKey(entry.date) : null
    if (!weekKey) return

    const estimatedMinutes = STUDY_TIME_WEIGHTS[entry.type] || 0
    if (estimatedMinutes > 0) {
      studyTimeByWeek.set(weekKey, (studyTimeByWeek.get(weekKey) || 0) + estimatedMinutes)
    }
  })

  const subjectStats = subjects
    .map((subject) => {
      const stats = subjectMap.get(subject.id)
      const averageScore = stats.testsTaken > 0 ? stats.scoreSum / stats.testsTaken : 0
      const aiAccuracy = stats.aiQuestionsAttempted > 0
        ? (stats.aiCorrectAnswers / stats.aiQuestionsAttempted) * 100
        : 0

      return {
        ...stats,
        completionRate: stats.totalTopics > 0 ? (stats.completedTopics / stats.totalTopics) * 100 : 0,
        averageScore: round(averageScore),
        aiQuestionsGenerated: round(stats.aiQuestionsGenerated),
        aiQuestionsAttempted: round(stats.aiQuestionsAttempted),
        aiAccuracy: round(aiAccuracy),
      }
    })
    .sort((a, b) => {
      if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate
      return b.averageScore - a.averageScore
    })

  const totalSubjects = subjects.length
  const totalTopics = subjectStats.reduce((sum, subject) => sum + subject.totalTopics, 0)
  const completedTopics = subjectStats.reduce((sum, subject) => sum + subject.completedTopics, 0)
  const totalTestsTaken = normalizedTests.length
  const totalAIQuestionsGenerated = normalizedTests.reduce((sum, test) => sum + test.questionCount, 0)
  const totalAIQuestionsAttempted = normalizedTests.reduce((sum, test) => sum + test.answeredCount, 0)
  const totalCorrectAnswers = normalizedTests.reduce((sum, test) => sum + test.correctCount, 0)
  const averageTestScore = average(normalizedTests.map((test) => test.percentage))
  const aiAccuracyOverall = totalAIQuestionsAttempted > 0
    ? (totalCorrectAnswers / totalAIQuestionsAttempted) * 100
    : 0

  const weekKeys = getRecentWeekKeys(weekWindow, today)
  const weeklyQuestionsAttempted = weekKeys.map((weekKey) => ({
    id: weekKey,
    label: formatWeekLabel(weekKey),
    shortLabel: formatDate(parseDateKey(weekKey), { month: 'short', day: 'numeric' }),
    value: round(questionsAttemptedByWeek.get(weekKey) || 0),
  }))
  const weeklyStudyTime = weekKeys.map((weekKey) => ({
    id: weekKey,
    label: formatWeekLabel(weekKey),
    shortLabel: formatDate(parseDateKey(weekKey), { month: 'short', day: 'numeric' }),
    value: round(studyTimeByWeek.get(weekKey) || 0),
  }))
  const aiQuestionsAttemptedOverTime = weekKeys.map((weekKey) => ({
    id: weekKey,
    label: formatWeekLabel(weekKey),
    shortLabel: formatDate(parseDateKey(weekKey), { month: 'short', day: 'numeric' }),
    value: round(aiQuestionsAttemptedByWeek.get(weekKey) || 0),
  }))

  const examGroupStats = examGroups
    .map((group) => {
      const groupSubjectSet = new Set(group.subjectIds)
      const groupSubjects = subjects.filter((subject) => groupSubjectSet.has(subject.id))
      const groupTests = normalizedTests.filter((test) =>
        test.subjectIds.some((subjectId) => groupSubjectSet.has(subjectId))
      )
      const groupAIChats = normalizedAIChats.filter((chat) => chat.subjectId && groupSubjectSet.has(chat.subjectId))
      const totalGroupTopics = groupSubjects.reduce((sum, subject) => sum + getTopicCount(subject), 0)
      const completedGroupTopics = groupSubjects.reduce((sum, subject) => sum + getCompletedTopicCount(subject), 0)
      const totalGroupPdfs = Array.isArray(group.pdfs) ? group.pdfs.length : 0

      return {
        ...group,
        subjects: groupSubjects,
        totalSubjects: groupSubjects.length,
        totalTopics: totalGroupTopics,
        totalPdfs: totalGroupPdfs,
        completedTopics: completedGroupTopics,
        progressPercentage: totalGroupTopics > 0 ? round((completedGroupTopics / totalGroupTopics) * 100) : 0,
        testsTaken: groupTests.length,
        averageScore: round(average(groupTests.map((test) => test.percentage))),
        questionsAttempted: round(groupTests.reduce((sum, test) => sum + test.answeredCount, 0)),
        aiQuestionsGenerated: round(groupTests.reduce((sum, test) => sum + test.questionCount, 0)),
        aiQuestionsAttempted: round(groupTests.reduce((sum, test) => sum + test.answeredCount, 0)),
        aiPracticeUsage: round(
          groupTests.reduce((sum, test) => sum + test.answeredCount, 0) + groupAIChats.length
        ),
      }
    })
    .sort((a, b) => b.progressPercentage - a.progressPercentage)

  const scoreTrend = normalizedTests.slice(-trendLimit).map((test, index) => ({
    id: test.id || String(index),
    label: formatDate(test.completedAt, { month: 'short', day: 'numeric' }),
    shortLabel: formatDate(test.completedAt, { month: 'short', day: 'numeric' }),
    value: round(Number.isFinite(test.percentage) ? test.percentage : test.accuracy),
  }))

  const averageScoreBySubject = subjectStats
    .filter((subject) => subject.testsTaken > 0)
    .map((subject) => ({
      id: subject.id,
      label: subject.name,
      value: subject.averageScore,
      color: subject.color,
      meta: `${subject.testsTaken} test${subject.testsTaken === 1 ? '' : 's'}`,
    }))
    .sort((a, b) => b.value - a.value)

  const aiQuestionsPerSubject = subjectStats
    .filter((subject) => subject.aiQuestionsGenerated > 0 || subject.aiChatCount > 0)
    .map((subject) => ({
      id: subject.id,
      label: subject.name,
      value: subject.aiQuestionsAttempted,
      secondaryValue: subject.aiQuestionsGenerated,
      color: subject.color,
      meta: `${subject.aiChatCount} AI chat${subject.aiChatCount === 1 ? '' : 's'}`,
    }))
    .sort((a, b) => b.value - a.value)

  const mostPracticedSubjects = [...aiQuestionsPerSubject]
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value
      return b.secondaryValue - a.secondaryValue
    })
    .slice(0, 3)

  return {
    overview: {
      totalSubjects,
      totalTopics,
      completedTopics,
      totalTestsTaken,
      totalAIQuestionsGenerated: round(totalAIQuestionsGenerated),
      totalAIQuestionsAttempted: round(totalAIQuestionsAttempted),
      totalAIChats: normalizedAIChats.length,
      completionRate: totalTopics > 0 ? round((completedTopics / totalTopics) * 100) : 0,
      averageTestScore: round(averageTestScore),
    },
    streak,
    heatmap,
    examGroups: examGroupStats,
    subjects: subjectStats,
    performance: {
      scoreTrend,
      averageScoreBySubject,
      questionsAttemptedPerWeek: weeklyQuestionsAttempted,
      studyTimeEstimateByWeek: weeklyStudyTime,
    },
    aiPractice: {
      totalQuestionsGenerated: round(totalAIQuestionsGenerated),
      totalQuestionsAttempted: round(totalAIQuestionsAttempted),
      totalMockTestsCreated: normalizedTests.length,
      accuracy: round(aiAccuracyOverall),
      mostPracticedSubjects,
      questionsPerSubject: aiQuestionsPerSubject,
      questionsAttemptedOverTime: aiQuestionsAttemptedOverTime,
    },
  }
}
