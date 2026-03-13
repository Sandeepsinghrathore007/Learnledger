import {
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { gatherContentForTest, buildAIPrompt, parseAIResponse } from '@/utils/testGeneration'
import { generateTextFromAI } from '@/utils/aiClient'
import { uid } from '@/utils/id'
import { isGitHubPagesHost } from '@/utils/runtimeRecovery'
import { ACTIVITY_TYPES, logActivity } from './analyticsService'
import { userTestDocRef, userTestsCol } from './firestorePaths'

const HAS_FRONTEND_AI_KEY = Boolean(String(import.meta.env.VITE_OPENROUTER_API_KEY || '').trim())
const TEST_GENERATION_ATTEMPTS = [
  {
    promptOptions: {
      maxNotes: 8,
      maxPdfs: 4,
      noteCharLimit: 1000,
      pdfCharLimit: 900,
      totalContextChars: 9000,
    },
    maxTokens: 3200,
  },
  {
    promptOptions: {
      maxNotes: 5,
      maxPdfs: 2,
      noteCharLimit: 650,
      pdfCharLimit: 500,
      totalContextChars: 5000,
    },
    maxTokens: 2200,
  },
]

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
  const totalQuestions = Number.isFinite(data.totalQuestions)
    ? data.totalQuestions
    : Array.isArray(data.questions)
      ? data.questions.length
      : 0
  const correctAnswers = Number.isFinite(data.correct)
    ? data.correct
    : Number.isFinite(data.score)
      ? data.score
      : totalQuestions > 0 && Number.isFinite(data.percentage)
        ? Math.round((data.percentage / 100) * totalQuestions)
        : 0
  const unanswered = Number.isFinite(data.unanswered)
    ? data.unanswered
    : Math.max(0, totalQuestions - correctAnswers - (Number.isFinite(data.incorrect) ? data.incorrect : 0))
  const incorrect = Number.isFinite(data.incorrect)
    ? data.incorrect
    : Math.max(0, totalQuestions - correctAnswers - unanswered)

  return {
    id: snapshot.id,
    ...data,
    score: correctAnswers,
    correct: correctAnswers,
    incorrect,
    unanswered,
    totalQuestions,
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

function isRetryableGenerationError(error) {
  const message = String(error?.message || '').toLowerCase()
  return [
    'internal server error',
    'timed out',
    'timeout',
    '503',
    '502',
    'temporarily unavailable',
    'bad gateway',
    'gateway timeout',
    'service unavailable',
    'context length',
    'too large',
  ].some((fragment) => message.includes(fragment))
}

function getGenerationMaxTokens(questionCount, configuredMaxTokens) {
  const requested = Math.max(1200, Number(questionCount || 0) * 260)
  return Math.min(configuredMaxTokens, requested)
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
  if (isGitHubPagesHost() && !HAS_FRONTEND_AI_KEY) {
    throw new Error(
      'AI mock tests are not enabled in this public build yet. Add a direct OpenRouter key to the build first.'
    )
  }

  const content = gatherContentForTest(config, subjects)

  if (content.notesContent.length === 0 && content.pdfContent.length === 0) {
    throw new Error('No content found. Please add notes or PDFs to the selected subjects/topics.')
  }

  let generatedText = ''
  let modelUsed = null
  let provider = null
  let lastError = null

  for (let index = 0; index < TEST_GENERATION_ATTEMPTS.length; index += 1) {
    const attempt = TEST_GENERATION_ATTEMPTS[index]
    const prompt = buildAIPrompt(config, content, attempt.promptOptions)

    try {
      const generated = await generateTextFromAI({
        systemPrompt: 'Return strict JSON only. No markdown or additional prose.',
        userPrompt: prompt,
        temperature: 0.35,
        maxTokens: getGenerationMaxTokens(config.questionCount, attempt.maxTokens),
      })

      generatedText = generated.text
      modelUsed = generated.modelUsed
      provider = generated.provider
      lastError = null
      break
    } catch (error) {
      lastError = error
      if (!isRetryableGenerationError(error) || index === TEST_GENERATION_ATTEMPTS.length - 1) {
        break
      }
    }
  }

  if (lastError) {
    if (isRetryableGenerationError(lastError)) {
      throw new Error(
        'AI mock test generation is temporarily overloaded. Please try again in a few seconds or use fewer subjects/topics.'
      )
    }

    throw lastError
  }

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
    score: Number.isFinite(testAttempt.correct)
      ? testAttempt.correct
      : Number.isFinite(testAttempt.score)
        ? testAttempt.score
        : 0,
    correct: Number.isFinite(testAttempt.correct)
      ? testAttempt.correct
      : Number.isFinite(testAttempt.score)
        ? testAttempt.score
        : 0,
    incorrect: Number.isFinite(testAttempt.incorrect) ? testAttempt.incorrect : 0,
    unanswered: Number.isFinite(testAttempt.unanswered) ? testAttempt.unanswered : 0,
    totalQuestions: Number.isFinite(testAttempt.totalQuestions)
      ? testAttempt.totalQuestions
      : Array.isArray(testAttempt.questions)
        ? testAttempt.questions.length
        : 0,
    percentage: Number.isFinite(testAttempt.percentage) ? testAttempt.percentage : 0,
    passed: Boolean(testAttempt.passed),
    timeTaken: Number.isFinite(testAttempt.timeTaken) ? testAttempt.timeTaken : 0,
    results: Array.isArray(testAttempt.results) ? testAttempt.results : [],
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
