import {
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { gatherContentForTest, buildAIPrompt, parseAIResponse } from '@/utils/testGeneration'
import { generateTextFromAI } from '@/utils/aiClient'
import { uid } from '@/utils/id'
import { ACTIVITY_TYPES, logActivity } from './analyticsService'
import { userTestDocRef, userTestsCol } from './firestorePaths'

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === 'function') return value.toDate()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function toIso(value) {
  return toDate(value)?.toISOString() || null
}

function normalizeTest(snapshot) {
  const data = snapshot.data()

  return {
    id: snapshot.id,
    ...data,
    createdAt: toIso(data.createdAt) || data.createdAt || null,
    updatedAt: toIso(data.updatedAt) || data.updatedAt || null,
    startTime: toIso(data.startTime) || data.startTime || null,
    endTime: toIso(data.endTime) || data.endTime || null,
    completedAt: toIso(data.completedAt) || data.completedAt || null,
  }
}

function generateTestTitle(config, metadata) {
  const subjectNames = (metadata.subjects || []).map((subject) => subject.name).join(' + ')

  if (config.scope === 'topic' && metadata.topics.length === 1) {
    return `${subjectNames} - ${metadata.topics[0].name}`
  }

  if (config.scope === 'multi-subject') {
    return `Multi-Subject Test: ${subjectNames}`
  }

  return `${subjectNames} - Full Subject Test`
}

export function subscribeToTests(userId, onNext, onError) {
  return onSnapshot(
    userTestsCol(userId),
    (snapshot) => {
      const items = snapshot.docs
        .map(normalizeTest)
        .sort((a, b) => (b.completedAt || b.createdAt || '').localeCompare(a.completedAt || a.createdAt || ''))

      onNext(items)
    },
    onError
  )
}

export async function generateTest({ config, subjects, userId = null }) {
  const content = gatherContentForTest(config, subjects)

  if (content.notesContent.length === 0 && content.pdfContent.length === 0) {
    throw new Error('No content found. Please add notes or PDFs to the selected subjects/topics.')
  }

  const prompt = buildAIPrompt(config, content)

  const { text: generatedText, modelUsed, provider } = await generateTextFromAI({
    systemPrompt: 'Return strict JSON only. No markdown or additional prose.',
    userPrompt: prompt,
    temperature: 0.5,
    maxTokens: 8192,
  })

  const parsedQuestions = parseAIResponse(generatedText)
  if (parsedQuestions.length < config.questionCount) {
    throw new Error(
      `AI returned only ${parsedQuestions.length} valid questions. Please try again with the same settings.`
    )
  }

  const questions = parsedQuestions.slice(0, config.questionCount)
  const questionsWithIds = questions.map((question, index) => ({
    ...question,
    id: uid(),
    questionNumber: index + 1,
    sourceTopic: content.metadata.topics[0]?.id || null,
    topicName: content.metadata.topics[0]?.name || null,
    sourceSubject: content.metadata.subjects[0]?.id || null,
    subjectName: content.metadata.subjects[0]?.name || null,
  }))

  return {
    id: uid(),
    userId,
    title: generateTestTitle(config, content.metadata),
    config,
    questions: questionsWithIds,
    createdAt: new Date().toISOString(),
    metadata: {
      ...content.metadata,
      modelUsed,
      provider,
    },
  }
}

export async function saveTestResult(userId, testAttempt) {
  if (!userId) {
    throw new Error('saveTestResult requires an authenticated user id.')
  }

  const testId = testAttempt?.id || uid()
  const testRef = userTestDocRef(userId, testId)
  const completedAt = testAttempt.completedAt || new Date().toISOString()

  const payload = {
    userId,
    title: testAttempt.title || 'Untitled Test',
    config: testAttempt.config || {},
    questions: Array.isArray(testAttempt.questions) ? testAttempt.questions : [],
    answers: testAttempt.answers || {},
    score: Number.isFinite(testAttempt.score) ? testAttempt.score : 0,
    totalQuestions: Number.isFinite(testAttempt.totalQuestions)
      ? testAttempt.totalQuestions
      : Array.isArray(testAttempt.questions)
        ? testAttempt.questions.length
        : 0,
    percentage: Number.isFinite(testAttempt.percentage) ? testAttempt.percentage : 0,
    passed: Boolean(testAttempt.passed),
    timeTaken: Number.isFinite(testAttempt.timeTaken) ? testAttempt.timeTaken : 0,
    startTime: testAttempt.startTime || null,
    endTime: testAttempt.endTime || null,
    completedAt,
    metadata: testAttempt.metadata || {},
    bookmarkedQuestions: Array.isArray(testAttempt.bookmarkedQuestions)
      ? testAttempt.bookmarkedQuestions
      : [],
    hintsUsed: Array.isArray(testAttempt.hintsUsed) ? testAttempt.hintsUsed : [],
    createdAt: testAttempt.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  await setDoc(testRef, payload, { merge: true })

  await logActivity(userId, {
    type: ACTIVITY_TYPES.TEST_TAKEN,
    timestamp: completedAt,
    subjectId: testAttempt.metadata?.subjects?.[0]?.id || null,
    testId,
    metadata: {
      score: payload.score,
      totalQuestions: payload.totalQuestions,
      percentage: payload.percentage,
      passed: payload.passed,
    },
  })

  return {
    id: testId,
    ...payload,
  }
}

export async function deleteTest(userId, testId) {
  if (!userId || !testId) {
    throw new Error('deleteTest requires userId and testId.')
  }

  await deleteDoc(userTestDocRef(userId, testId))
}
