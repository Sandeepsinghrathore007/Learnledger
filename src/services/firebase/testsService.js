import {
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { gatherContentForTest, buildAIPrompt, parseAIResponse } from '@/utils/testGeneration'
import { buildExamPrompt, extractQuestionBlocksFromText } from '@/utils/examGeneration'
import { generateTextFromAI } from '@/utils/aiClient'
import { uid } from '@/utils/id'
import { buildTestTitle } from '@/utils/testDisplay'
import { isGitHubPagesHost } from '@/utils/runtimeRecovery'
import { TEST_KIND } from '@/utils/testKinds'
import { ACTIVITY_TYPES, logActivity } from './analyticsService'
import { userTestDocRef, userTestsCol } from './firestorePaths'

const HAS_FRONTEND_AI_KEY = Boolean(String(import.meta.env.VITE_OPENROUTER_API_KEY || '').trim())
const EXAM_SOURCE_SCOPE = 'exam-source'
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
const EXAM_GENERATION_ATTEMPTS = [
  { maxTokens: 5600 },
  { maxTokens: 3800 },
]
const INITIAL_EXAM_READY_COUNT = 10
const EXAM_CHUNK_SIZE = 20
const MIN_EXAM_CHUNK_SIZE = 8

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

function buildExamGenerationChunks(
  questionBlocks,
  chunkSize = EXAM_CHUNK_SIZE,
  initialChunkSize = INITIAL_EXAM_READY_COUNT
) {
  const normalizedChunkSize = Math.max(1, Number(chunkSize || EXAM_CHUNK_SIZE))
  const normalizedInitialChunkSize = Math.max(1, Number(initialChunkSize || INITIAL_EXAM_READY_COUNT))
  const chunks = []

  if (questionBlocks.length <= normalizedInitialChunkSize) {
    return [
      {
        startIndex: 0,
        questionBlocks: questionBlocks.slice(),
      },
    ]
  }

  chunks.push({
    startIndex: 0,
    questionBlocks: questionBlocks.slice(0, normalizedInitialChunkSize),
  })

  for (
    let startIndex = normalizedInitialChunkSize;
    startIndex < questionBlocks.length;
    startIndex += normalizedChunkSize
  ) {
    chunks.push({
      startIndex,
      questionBlocks: questionBlocks.slice(startIndex, startIndex + normalizedChunkSize),
    })
  }

  return chunks
}

function buildExamProgressMessage(startIndex, chunkLength, totalQuestions) {
  const from = startIndex + 1
  const to = Math.min(totalQuestions, startIndex + chunkLength)

  if (totalQuestions <= chunkLength) {
    return `Generating ${totalQuestions} exam questions...`
  }

  return `Generating questions ${from}-${to} of ${totalQuestions}...`
}

function isChunkableExamGenerationError(error) {
  const message = String(error?.message || '').toLowerCase()

  return (
    isRetryableGenerationError(error)
    || message.includes('failed to parse ai-generated questions')
    || message.includes('response is not valid json')
    || message.includes('response does not contain questions')
    || message.includes('does not contain a questions array')
    || message.includes('must include 4 valid options')
    || message.includes('has invalid correctanswer')
    || message.includes('returned only')
  )
}

function isExamGenerationConfig(config) {
  return String(config?.scope || '').trim().toLowerCase() === EXAM_SOURCE_SCOPE
}

function normalizeLookupKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function findSelectedSubjects(config, subjects) {
  const selectedIds = new Set(
    (Array.isArray(config?.subjectIds) ? config.subjectIds : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )

  if (selectedIds.size === 0) return []
  return subjects.filter((subject) => selectedIds.has(subject.id))
}

function resolveExamQuestionMapping(question, linkedSubjects) {
  const subjectMap = new Map(
    linkedSubjects.map((subject) => [normalizeLookupKey(subject.name), subject])
  )
  const requestedSubject = normalizeLookupKey(question.subjectName)
  const matchedSubject = subjectMap.get(requestedSubject) || (linkedSubjects.length === 1 ? linkedSubjects[0] : null)
  const topics = matchedSubject
    ? matchedSubject.topics
    : linkedSubjects.flatMap((subject) => subject.topics || [])
  const topicMap = new Map(
    topics.map((topic) => [normalizeLookupKey(topic.name), topic])
  )
  const requestedTopic = normalizeLookupKey(question.topicName)
  const matchedTopic = topicMap.get(requestedTopic) || null
  const topicSubject = matchedTopic
    ? linkedSubjects.find((subject) => subject.id === matchedTopic.subjectId)
      || linkedSubjects.find((subject) => (subject.topics || []).some((topic) => topic.id === matchedTopic.id))
    : matchedSubject

  return {
    subject: topicSubject || matchedSubject || null,
    topic: matchedTopic || null,
  }
}

async function generateMockTest({ config, subjects, userId }) {
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
    title: buildTestTitle(config, content.metadata),
    config,
    questions: questionsWithIds,
    createdAt: new Date().toISOString(),
    metadata: {
      ...content.metadata,
      testType: TEST_KIND.MOCK,
      modelUsed,
      provider,
    },
  }
}

function buildExamMetadata({ config, linkedSubjects, generatedQuestions, questionBlocks, modelUsed, provider }) {
  const metadataSubjects = linkedSubjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    color: subject.color,
    icon: subject.icon,
  }))
  const seenTopics = new Set()
  const metadataTopics = []

  generatedQuestions.forEach((question) => {
    if (!question?.sourceTopic || seenTopics.has(question.sourceTopic)) return
    seenTopics.add(question.sourceTopic)
    metadataTopics.push({
      id: question.sourceTopic,
      name: question.topicName || '',
      subjectId: question.sourceSubject || null,
      subjectName: question.subjectName || '',
    })
  })

  return {
    testType: TEST_KIND.EXAM,
    subjects: metadataSubjects,
    topics: metadataTopics,
    modelUsed,
    provider,
    examSource: {
      title: String(config?.examTitle || '').trim() || 'Custom Exam',
      sourceLabel: String(config?.sourceLabel || 'Pasted Text').trim() || 'Pasted Text',
      language: config?.language === 'hindi' ? 'hindi' : 'english',
      questionCount: questionBlocks.length,
      preview: questionBlocks.slice(0, 2).join(' '),
      groupId: config?.groupId || null,
      groupName: config?.groupName || '',
    },
    examGeneration: {
      availableQuestions: generatedQuestions.length,
      totalQuestions: questionBlocks.length,
      isComplete: generatedQuestions.length >= questionBlocks.length,
      statusText:
        generatedQuestions.length >= questionBlocks.length
          ? 'All questions are ready.'
          : `${generatedQuestions.length} of ${questionBlocks.length} questions are ready.`,
    },
  }
}

function buildExamTestResult({
  testId,
  userId,
  config,
  createdAt,
  questionBlocks,
  linkedSubjects,
  generatedQuestions,
  modelUsed,
  provider,
}) {
  const metadata = buildExamMetadata({
    config,
    linkedSubjects,
    generatedQuestions,
    questionBlocks,
    modelUsed,
    provider,
  })
  const finalConfig = {
    ...config,
    scope: EXAM_SOURCE_SCOPE,
    questionCount: questionBlocks.length,
    difficulty: config?.difficulty || 'mixed',
  }

  return {
    id: testId,
    userId,
    title: buildTestTitle(finalConfig, metadata),
    config: finalConfig,
    questions: generatedQuestions.map((question) => ({ ...question })),
    createdAt: createdAt || new Date().toISOString(),
    metadata,
  }
}

function normalizeGeneratedExamQuestion(question, overallIndex, sourceQuestion, linkedSubjects) {
  const mapping = resolveExamQuestionMapping(question, linkedSubjects)

  return {
    ...question,
    id: uid(),
    questionNumber: overallIndex + 1,
    sourceQuestion: question.sourceQuestion || sourceQuestion,
    sourceTopic: mapping.topic?.id || null,
    topicName: mapping.topic?.name || question.topicName || '',
    sourceSubject: mapping.subject?.id || null,
    subjectName: mapping.subject?.name || question.subjectName || '',
  }
}

async function generateExamQuestionChunk({
  config,
  linkedSubjects,
  questionBlocks,
  startIndex,
  totalQuestions,
  onProgress,
}) {
  let lastError = null
  let modelUsed = null
  let provider = null

  for (let attemptIndex = 0; attemptIndex < EXAM_GENERATION_ATTEMPTS.length; attemptIndex += 1) {
    const attempt = EXAM_GENERATION_ATTEMPTS[attemptIndex]
    const prompt = buildExamPrompt({
      examTitle: config?.examTitle,
      questionBlocks,
      linkedSubjects,
      sourceLabel: config?.sourceLabel || 'Pasted Text',
      language: config?.language || 'english',
    })

    onProgress?.({
      message: buildExamProgressMessage(startIndex, questionBlocks.length, totalQuestions),
      startIndex,
      endIndex: Math.min(totalQuestions, startIndex + questionBlocks.length),
      totalQuestions,
    })

    try {
      const generated = await generateTextFromAI({
        systemPrompt: 'Return strict JSON only. No markdown or additional prose.',
        userPrompt: prompt,
        temperature: 0.25,
        maxTokens: getGenerationMaxTokens(questionBlocks.length, attempt.maxTokens),
      })

      const parsedQuestions = parseAIResponse(generated.text)
      if (parsedQuestions.length < questionBlocks.length) {
        throw new Error(
          `AI returned only ${parsedQuestions.length} questions for ${questionBlocks.length} detected questions. Please try again.`
        )
      }

      return {
        questions: parsedQuestions.slice(0, questionBlocks.length),
        modelUsed: generated.modelUsed || modelUsed,
        provider: generated.provider || provider,
      }
    } catch (error) {
      lastError = error
      modelUsed = modelUsed || error?.modelUsed || null
      provider = provider || error?.provider || null

      if (!isRetryableGenerationError(error) || attemptIndex === EXAM_GENERATION_ATTEMPTS.length - 1) {
        break
      }
    }
  }

  if (questionBlocks.length > MIN_EXAM_CHUNK_SIZE && isChunkableExamGenerationError(lastError)) {
    const midpoint = Math.ceil(questionBlocks.length / 2)
    const firstHalf = await generateExamQuestionChunk({
      config,
      linkedSubjects,
      questionBlocks: questionBlocks.slice(0, midpoint),
      startIndex,
      totalQuestions,
      onProgress,
    })
    const secondHalf = await generateExamQuestionChunk({
      config,
      linkedSubjects,
      questionBlocks: questionBlocks.slice(midpoint),
      startIndex: startIndex + midpoint,
      totalQuestions,
      onProgress,
    })

    return {
      questions: [...firstHalf.questions, ...secondHalf.questions],
      modelUsed: firstHalf.modelUsed || secondHalf.modelUsed || modelUsed,
      provider: firstHalf.provider || secondHalf.provider || provider,
    }
  }

  if (lastError) {
    if (isRetryableGenerationError(lastError)) {
      throw new Error(
        'AI exam generation is temporarily overloaded. Please try again in a few seconds.'
      )
    }

    throw lastError
  }

  return {
    questions: [],
    modelUsed,
    provider,
  }
}

async function generateExamTest({ config, subjects, userId, onProgress }) {
  const sourceText = String(config?.sourceText || '').trim()
  const questionBlocks = extractQuestionBlocksFromText(sourceText)

  if (!sourceText) {
    throw new Error('Add pasted questions or upload a PDF before creating an exam.')
  }

  if (questionBlocks.length === 0) {
    throw new Error('No questions could be detected. Use numbered questions or clear line-separated questions.')
  }

  const linkedSubjects = findSelectedSubjects(config, subjects)
  const testId = uid()
  const createdAt = new Date().toISOString()
  let modelUsed = null
  let provider = null
  const generatedQuestions = []
  const generationChunks = buildExamGenerationChunks(questionBlocks)
  let hasEmittedInitialExam = false

  for (const chunk of generationChunks) {
    const chunkResult = await generateExamQuestionChunk({
      config,
      linkedSubjects,
      questionBlocks: chunk.questionBlocks,
      startIndex: chunk.startIndex,
      totalQuestions: questionBlocks.length,
      onProgress,
    })

    chunkResult.questions.forEach((question, index) => {
      generatedQuestions.push(
        normalizeGeneratedExamQuestion(
          question,
          chunk.startIndex + index,
          chunk.questionBlocks[index],
          linkedSubjects
        )
      )
    })
    modelUsed = modelUsed || chunkResult.modelUsed
    provider = provider || chunkResult.provider

    const partialTest = buildExamTestResult({
      testId,
      userId,
      config,
      createdAt,
      questionBlocks,
      linkedSubjects,
      generatedQuestions,
      modelUsed,
      provider,
    })

    if (!hasEmittedInitialExam && generatedQuestions.length >= Math.min(questionBlocks.length, INITIAL_EXAM_READY_COUNT)) {
      hasEmittedInitialExam = true
      onProgress?.({
        type: 'partial-test-ready',
        message: `${generatedQuestions.length} questions are ready. Starting exam while the rest generate in background...`,
        test: partialTest,
        availableQuestions: generatedQuestions.length,
        totalQuestions: questionBlocks.length,
      })
      continue
    }

    if (hasEmittedInitialExam) {
      onProgress?.({
        type: 'partial-test-update',
        message:
          generatedQuestions.length >= questionBlocks.length
            ? 'All exam questions are ready.'
            : `${generatedQuestions.length} of ${questionBlocks.length} questions are ready.`,
        test: partialTest,
        availableQuestions: generatedQuestions.length,
        totalQuestions: questionBlocks.length,
      })
    }
  }

  onProgress?.({
    message: 'Finalizing exam...',
    type: 'partial-test-complete',
    totalQuestions: questionBlocks.length,
    availableQuestions: generatedQuestions.length,
  })

  if (generatedQuestions.length < questionBlocks.length) {
    throw new Error(
      `AI returned only ${generatedQuestions.length} questions for ${questionBlocks.length} detected questions. Please try again.`
    )
  }

  return buildExamTestResult({
    testId,
    userId,
    config,
    createdAt,
    questionBlocks,
    linkedSubjects,
    generatedQuestions,
    modelUsed,
    provider,
  })
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

export async function generateTest({ config, subjects, userId = null, onProgress = null }) {
  if (isGitHubPagesHost() && !HAS_FRONTEND_AI_KEY) {
    throw new Error(
      'AI mock tests are not enabled in this public build yet. Add a direct OpenRouter key to the build first.'
    )
  }
  if (isExamGenerationConfig(config)) {
    return generateExamTest({ config, subjects, userId, onProgress })
  }

  return generateMockTest({ config, subjects, userId })
}

export async function saveTestResult(userId, testAttempt) {
  if (!userId) {
    throw new Error('saveTestResult requires an authenticated user id.')
  }

  const testId = testAttempt?.id || uid()
  const testRef = userTestDocRef(userId, testId)
  const completedAt = testAttempt.completedAt || new Date().toISOString()
  const metadata = {
    ...(testAttempt.metadata || {}),
    testType: testAttempt?.metadata?.testType || (isExamGenerationConfig(testAttempt?.config) ? TEST_KIND.EXAM : TEST_KIND.MOCK),
  }

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
    metadata,
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
