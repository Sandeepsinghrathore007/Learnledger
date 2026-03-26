import {
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import {
  gatherContentForTest,
  buildAIQuestionOnlyPrompt,
  parseAIQuestionOnlyResponse,
  parseAIResponse,
} from '@/utils/testGeneration'
import { buildExamPrompt, extractQuestionBlocksFromText } from '@/utils/examGeneration'
import { parseQuestionsFromTextWithStats } from '@/utils/manualQuestionParser'
import { parseManualQuestionsWithStats } from '@/utils/manualInputQuestions'
import { generateTextFromAI } from '@/utils/aiClient'
import { uid } from '@/utils/id'
import { buildQuestionReviewBatchPrompt, parseQuestionReviewBatchResponse } from '@/utils/testReviewExplanation'
import { buildTestTitle } from '@/utils/testDisplay'
import { isGitHubPagesHost } from '@/utils/runtimeRecovery'
import { TEST_KIND } from '@/utils/testKinds'
import { ACTIVITY_TYPES, logActivity } from './analyticsService'
import { userTestDocRef, userTestsCol } from './firestorePaths'

const HAS_FRONTEND_AI_KEY = Boolean(String(import.meta.env.VITE_OPENROUTER_API_KEY || '').trim())
const EXAM_SOURCE_SCOPE = 'exam-source'
const MANUAL_EXAM_PARSING_MODE = 'manual'
const MANUAL_INPUT_SCOPE = 'manual-input'
const TEST_GENERATION_ATTEMPTS = [
  {
    promptOptions: {
      maxNotes: 8,
      maxPdfs: 4,
      noteCharLimit: 1000,
      pdfCharLimit: 900,
      totalContextChars: 9000,
    },
    maxTokens: 6400,
  },
  {
    promptOptions: {
      maxNotes: 5,
      maxPdfs: 2,
      noteCharLimit: 650,
      pdfCharLimit: 500,
      totalContextChars: 5000,
    },
    maxTokens: 4800,
  },
]
const EXAM_GENERATION_ATTEMPTS = [
  { maxTokens: 5600 },
  { maxTokens: 3800 },
]
const QUESTION_REVIEW_GENERATION_ATTEMPTS = [
  { maxTokens: 8192 },
  { maxTokens: 6400 },
]
const INITIAL_EXAM_READY_COUNT = 10
const EXAM_CHUNK_SIZE = INITIAL_EXAM_READY_COUNT
const MIN_EXAM_CHUNK_SIZE = 8
const MOCK_QUESTION_TARGET_CHUNK_SIZE = 15
const MOCK_QUESTION_MAX_CHUNK_SIZE = 20
const MIN_MOCK_QUESTION_CHUNK_SIZE = 8
const QUESTION_REVIEW_MAX_BATCH_SIZE = 12
const QUESTION_REVIEW_MAX_PROMPT_CHARS = 55_000
const MIN_QUESTION_REVIEW_CHUNK_SIZE = 10
const REVIEWABLE_OPTION_IDS = new Set(['a', 'b', 'c', 'd'])

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
  const requested = Math.max(2600, Number(questionCount || 0) * 720)
  return Math.min(configuredMaxTokens, requested)
}

function getMockQuestionGenerationMaxTokens(questionCount, configuredMaxTokens) {
  const requested = Math.max(1400, Number(questionCount || 0) * 230)
  return Math.min(configuredMaxTokens, requested)
}

function isRecoverableMockGenerationError(error) {
  const message = String(error?.message || '').toLowerCase()

  return (
    isRetryableGenerationError(error)
    || message.includes('invalid json')
    || message.includes('returned only')
    || message.includes('questions array')
    || message.includes('response does not contain questions')
    || message.includes('missing explanation')
    || message.includes('must include 4 valid options')
    || message.includes('has invalid correctanswer')
    || message.includes('failed to parse ai-generated questions')
  )
}

function normalizeGeneratedQuestionKey(question) {
  const normalized = String(question?.question || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (normalized) {
    return normalized
  }

  return String(question?.question || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function filterUniqueGeneratedQuestions(questions, existingQuestions = []) {
  const seen = new Set(
    (Array.isArray(existingQuestions) ? existingQuestions : [])
      .map((question) => normalizeGeneratedQuestionKey(question))
      .filter(Boolean)
  )

  return (Array.isArray(questions) ? questions : []).filter((question) => {
    const key = normalizeGeneratedQuestionKey(question)
    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function buildMockQuestionGenerationChunks(
  totalQuestions,
  preferredChunkSize = MOCK_QUESTION_TARGET_CHUNK_SIZE,
  maxChunkSize = MOCK_QUESTION_MAX_CHUNK_SIZE
) {
  const total = Math.max(0, Number(totalQuestions || 0))
  const normalizedPreferredChunkSize = Math.max(1, Number(preferredChunkSize || MOCK_QUESTION_TARGET_CHUNK_SIZE))
  const normalizedMaxChunkSize = Math.max(
    normalizedPreferredChunkSize,
    Number(maxChunkSize || MOCK_QUESTION_MAX_CHUNK_SIZE)
  )
  const chunks = []
  let startIndex = 0
  let remaining = total

  while (remaining > 0) {
    const questionCount = remaining <= normalizedMaxChunkSize
      ? remaining
      : normalizedPreferredChunkSize

    chunks.push({
      startIndex,
      questionCount,
    })

    startIndex += questionCount
    remaining -= questionCount
  }

  return chunks
}

function buildMockQuestionProgressMessage(startIndex, chunkLength, totalQuestions) {
  const from = startIndex + 1
  const to = Math.min(totalQuestions, startIndex + chunkLength)

  if (totalQuestions <= chunkLength) {
    return `Generating ${totalQuestions} questions...`
  }

  return `Generating questions ${from}-${to} of ${totalQuestions}...`
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

function isManualInputConfig(config) {
  return String(config?.scope || '').trim().toLowerCase() === MANUAL_INPUT_SCOPE
}

function getExamParsingMode(config) {
  return String(config?.parsingMode || '').trim().toLowerCase() === MANUAL_EXAM_PARSING_MODE
    ? MANUAL_EXAM_PARSING_MODE
    : 'ai'
}

function hasValidCorrectAnswer(value) {
  return REVIEWABLE_OPTION_IDS.has(String(value || '').trim().toLowerCase())
}

function hasStoredReviewData(question) {
  return (
    hasValidCorrectAnswer(question?.correctAnswer)
    && Boolean(String(question?.explanation || '').trim())
  )
}

function canGenerateReviewData(question) {
  return (
    Boolean(question?.id)
    && Boolean(String(question?.question || '').trim())
    && Array.isArray(question?.options)
    && question.options.length >= 2
  )
}

function estimateQuestionReviewPromptChars(question) {
  const questionTextLength = String(question?.question || '').trim().length
  const optionTextLength = Array.isArray(question?.options)
    ? question.options.reduce((sum, option) => sum + String(option?.text || '').trim().length + 8, 0)
    : 0

  return questionTextLength + optionTextLength + 160
}

function buildQuestionReviewChunks(questions) {
  const chunks = []
  let currentQuestions = []
  let currentChars = 0
  let startIndex = 0

  questions.forEach((question, index) => {
    const estimatedChars = estimateQuestionReviewPromptChars(question)
    const wouldOverflow =
      currentQuestions.length > 0
      && (
        currentQuestions.length >= QUESTION_REVIEW_MAX_BATCH_SIZE
        || currentChars + estimatedChars > QUESTION_REVIEW_MAX_PROMPT_CHARS
      )

    if (wouldOverflow) {
      chunks.push({
        startIndex,
        questions: currentQuestions,
      })
      currentQuestions = []
      currentChars = 0
      startIndex = index
    }

    currentQuestions.push(question)
    currentChars += estimatedChars
  })

  if (currentQuestions.length > 0) {
    chunks.push({
      startIndex,
      questions: currentQuestions,
    })
  }

  return chunks
}

function getQuestionReviewMaxTokens(questionCount, configuredMaxTokens) {
  const requested = Math.max(2200, Number(questionCount || 0) * 240)
  return Math.min(configuredMaxTokens, requested)
}

function buildQuestionReviewProgressMessage(startIndex, chunkLength, totalQuestions) {
  const from = startIndex + 1
  const to = Math.min(totalQuestions, startIndex + chunkLength)

  if (totalQuestions <= chunkLength) {
    return `Preparing answer key and explanations for ${totalQuestions} questions...`
  }

  return `Preparing answer key and explanations ${from}-${to} of ${totalQuestions}...`
}

function isChunkableQuestionReviewError(error) {
  const message = String(error?.message || '').toLowerCase()

  return (
    isRetryableGenerationError(error)
    || message.includes('review response')
    || message.includes('review batch')
    || message.includes('valid json')
    || message.includes('answer keys or explanations')
    || message.includes('context length')
    || message.includes('too large')
    || message.includes('timed out')
  )
}

function buildStoredReviewExplanations(questions, existingReviewExplanations = {}) {
  const nextReviewExplanations = (
    existingReviewExplanations && typeof existingReviewExplanations === 'object'
      ? { ...existingReviewExplanations }
      : {}
  )

  ;(Array.isArray(questions) ? questions : []).forEach((question) => {
    if (!question?.id || !hasStoredReviewData(question)) return

    const existing = nextReviewExplanations[question.id] || {}
    nextReviewExplanations[question.id] = {
      questionId: question.id,
      correctAnswer: String(question.correctAnswer || '').trim().toLowerCase(),
      userAnswer: existing.userAnswer || null,
      explanation: String(question.explanation || '').trim(),
      generatedAt: existing.generatedAt || null,
      modelUsed: existing.modelUsed || null,
      provider: existing.provider || null,
    }
  })

  return nextReviewExplanations
}

function getPendingReviewQuestions(questions) {
  return (Array.isArray(questions) ? questions : []).filter(
    (question) => !hasStoredReviewData(question) && canGenerateReviewData(question)
  )
}

function buildInitialReviewGenerationState(questions) {
  const pendingQuestions = getPendingReviewQuestions(questions)
  if (pendingQuestions.length === 0) {
    return null
  }

  return {
    totalQuestions: pendingQuestions.length,
    availableQuestions: 0,
    failedQuestions: 0,
    isComplete: false,
    isAiProcessing: true,
    statusText: 'AI analysis in progress...',
    modelUsed: null,
    provider: null,
    error: '',
  }
}

function buildReviewGenerationStatus(totalPendingQuestions, resolvedQuestionCount) {
  if (totalPendingQuestions === 0) {
    return null
  }

  if (resolvedQuestionCount >= totalPendingQuestions) {
    return `Answer key and explanations are ready for ${resolvedQuestionCount} questions.`
  }

  if (resolvedQuestionCount > 0) {
    return `Answer key and explanations are ready for ${resolvedQuestionCount} of ${totalPendingQuestions} questions.`
  }

  return 'Answer key and explanations could not be prepared automatically.'
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

function buildMetadataSubjects(linkedSubjects = []) {
  return linkedSubjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    color: subject.color,
    icon: subject.icon,
  }))
}

async function generateMockQuestionChunk({
  config,
  content,
  startIndex,
  questionCount,
  totalQuestions,
  existingQuestions = [],
  onProgress = null,
}) {
  let lastError = null
  let modelUsed = null
  let provider = null

  for (let index = 0; index < TEST_GENERATION_ATTEMPTS.length; index += 1) {
    const attempt = TEST_GENERATION_ATTEMPTS[index]
    const prompt = buildAIQuestionOnlyPrompt(
      {
        ...config,
        questionCount,
      },
      content,
      attempt.promptOptions,
      {
        excludedQuestions: existingQuestions.map((question) => question?.question).filter(Boolean),
        chunkDescriptor: {
          startIndex,
          questionCount,
          totalQuestions,
        },
      }
    )

    onProgress?.({
      type: 'mock-question-generation-progress',
      message: buildMockQuestionProgressMessage(startIndex, questionCount, totalQuestions),
      startIndex,
      endIndex: Math.min(totalQuestions, startIndex + questionCount),
      totalQuestions,
      availableQuestions: existingQuestions.length,
    })

    try {
      const generated = await generateTextFromAI({
        systemPrompt: 'Return ONLY valid JSON. Do not include any extra text, markdown, comments, or backticks. The final response must be a JSON array.',
        userPrompt: prompt,
        temperature: 0.2,
        maxTokens: getMockQuestionGenerationMaxTokens(questionCount, attempt.maxTokens),
      })

      const candidateQuestions = parseAIQuestionOnlyResponse(generated.text, {
        fallbackDifficulty: config?.difficulty === 'mixed' ? 'medium' : config?.difficulty || 'medium',
      })
      const uniqueQuestions = filterUniqueGeneratedQuestions(candidateQuestions, existingQuestions)

      if (uniqueQuestions.length < questionCount) {
        throw new Error(
          `AI returned only ${uniqueQuestions.length} unique valid questions for ${questionCount} requested questions.`
        )
      }

      return {
        questions: uniqueQuestions.slice(0, questionCount),
        modelUsed: generated.modelUsed || modelUsed,
        provider: generated.provider || provider,
      }
    } catch (error) {
      lastError = error
      modelUsed = modelUsed || error?.modelUsed || null
      provider = provider || error?.provider || null

      if (!isRecoverableMockGenerationError(error) || index === TEST_GENERATION_ATTEMPTS.length - 1) {
        break
      }
    }
  }

  if (questionCount > MIN_MOCK_QUESTION_CHUNK_SIZE && isRecoverableMockGenerationError(lastError)) {
    const midpoint = Math.ceil(questionCount / 2)
    const firstHalf = await generateMockQuestionChunk({
      config,
      content,
      startIndex,
      questionCount: midpoint,
      totalQuestions,
      existingQuestions,
      onProgress,
    })
    const secondHalf = await generateMockQuestionChunk({
      config,
      content,
      startIndex: startIndex + midpoint,
      questionCount: questionCount - midpoint,
      totalQuestions,
      existingQuestions: [...existingQuestions, ...firstHalf.questions],
      onProgress,
    })

    return {
      questions: [...firstHalf.questions, ...secondHalf.questions],
      modelUsed: firstHalf.modelUsed || secondHalf.modelUsed || modelUsed,
      provider: firstHalf.provider || secondHalf.provider || provider,
    }
  }

  throw lastError
}

function createManualInputTest({ config, subjects, userId }) {
  const manualInputText = String(config?.manualInputText || '').trim()
  if (!manualInputText) {
    throw new Error('Paste at least one question before starting Manual Input Mode.')
  }

  const parseResult = parseManualQuestionsWithStats(manualInputText)
  if (parseResult.questions.length === 0) {
    throw new Error('No valid manual questions were found. Each question must include options A, B, C, and D.')
  }

  const linkedSubjects = findSelectedSubjects(config, subjects)
  const primarySubject = linkedSubjects[0] || null
  const normalizedDifficulty = ['easy', 'medium', 'hard'].includes(String(config?.difficulty || '').trim().toLowerCase())
    ? String(config.difficulty).trim().toLowerCase()
    : 'medium'
  const metadata = {
    subjects: buildMetadataSubjects(linkedSubjects),
    topics: [],
    notes: [],
    manualInput: {
      totalBlocks: parseResult.totalBlocks,
      parsedQuestions: parseResult.parsedQuestions,
      skippedBlocks: parseResult.skippedBlocks,
      rejectedIncompleteQuestions: parseResult.rejectedIncompleteQuestions,
    },
    testType: TEST_KIND.MOCK,
  }
  const questions = parseResult.questions.map((question, index) => ({
    id: uid(),
    question: question.question,
    options: ['A', 'B', 'C', 'D'].map((optionId) => ({
      id: optionId.toLowerCase(),
      text: String(question.options?.[optionId] || '').trim(),
    })),
    correctAnswer: null,
    explanation: '',
    difficulty: normalizedDifficulty,
    sourceQuestion: question.sourceQuestion || question.question,
    questionNumber: index + 1,
    sourceSubject: primarySubject?.id || null,
    subjectName: primarySubject?.name || '',
    sourceTopic: null,
    topicName: '',
  }))

  return {
    id: uid(),
    userId,
    title: buildTestTitle(config, metadata),
    config: {
      ...config,
      questionCount: questions.length,
    },
    questions,
    createdAt: new Date().toISOString(),
    metadata,
  }
}

async function generateMockTest({ config, subjects, userId, onProgress = null }) {
  const content = gatherContentForTest(config, subjects)

  if (content.notesContent.length === 0 && content.pdfContent.length === 0) {
    throw new Error('No content found. Please add notes or PDFs to the selected subjects/topics.')
  }

  const generationChunks = buildMockQuestionGenerationChunks(config.questionCount)
  const parsedQuestions = []
  let modelUsed = null
  let provider = null
  let lastError = null

  for (const chunk of generationChunks) {
    try {
      const chunkResult = await generateMockQuestionChunk({
        config,
        content,
        startIndex: chunk.startIndex,
        questionCount: chunk.questionCount,
        totalQuestions: config.questionCount,
        existingQuestions: parsedQuestions,
        onProgress,
      })

      parsedQuestions.push(...chunkResult.questions)
      modelUsed = modelUsed || chunkResult.modelUsed
      provider = provider || chunkResult.provider
    } catch (error) {
      lastError = error
      break
    }
  }

  if (lastError) {
    if (isRetryableGenerationError(lastError)) {
      throw new Error(
        'AI test generation is temporarily overloaded. Please try again in a few seconds or use fewer subjects/topics.'
      )
    }

    throw lastError
  }

  if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
    throw new Error('AI test generation did not return any valid questions. Please try again.')
  }

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
      title: String(config?.examTitle || '').trim() || 'Custom Mock Test',
      sourceLabel: String(config?.sourceLabel || 'Pasted Text').trim() || 'Pasted Text',
      language: config?.language === 'hindi' ? 'hindi' : 'english',
      parsingMode: getExamParsingMode(config),
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

function buildManualExamQuestions({ sourceText, linkedSubjects }) {
  const parseResult = parseQuestionsFromTextWithStats(sourceText)

  return {
    ...parseResult,
    questions: parseResult.questions.map((question, index) =>
      normalizeGeneratedExamQuestion(
        question,
        index,
        question.sourceQuestion || question.question,
        linkedSubjects
      )
    ),
  }
}

async function generateQuestionReviewChunk({
  questions,
  startIndex,
  totalQuestions,
  onProgress,
  allowChunkSplit = true,
}) {
  let lastError = null
  let modelUsed = null
  let provider = null

  for (let attemptIndex = 0; attemptIndex < QUESTION_REVIEW_GENERATION_ATTEMPTS.length; attemptIndex += 1) {
    const attempt = QUESTION_REVIEW_GENERATION_ATTEMPTS[attemptIndex]

    onProgress?.({
      type: 'review-generation-progress',
      message: buildQuestionReviewProgressMessage(startIndex, questions.length, totalQuestions),
      startIndex,
      endIndex: Math.min(totalQuestions, startIndex + questions.length),
      totalQuestions,
    })

    try {
      const generated = await generateTextFromAI({
        systemPrompt: 'Return strict JSON only. No markdown or additional prose.',
        userPrompt: buildQuestionReviewBatchPrompt(questions),
        temperature: 0.2,
        maxTokens: getQuestionReviewMaxTokens(questions.length, attempt.maxTokens),
      })
      const parsedItems = parseQuestionReviewBatchResponse(generated.text)
      const generatedAt = new Date().toISOString()
      const reviewItemsByQuestionId = {}

      parsedItems.forEach((item) => {
        const question = questions[item.questionIndex - 1]
        if (!question?.id) return

        const availableOptions = new Set(
          (Array.isArray(question.options) ? question.options : [])
            .map((option) => String(option?.id || '').trim().toLowerCase())
            .filter(Boolean)
        )
        if (!availableOptions.has(item.correctAnswer)) {
          return
        }

        reviewItemsByQuestionId[question.id] = {
          questionId: question.id,
          correctAnswer: item.correctAnswer,
          userAnswer: null,
          explanation: item.explanation,
          generatedAt,
          modelUsed: generated.modelUsed || null,
          provider: generated.provider || null,
        }
      })

      const resolvedQuestionCount = Object.keys(reviewItemsByQuestionId).length
      if (resolvedQuestionCount === 0) {
        throw new Error('AI review response did not include usable answer keys for this batch.')
      }

      if (
        allowChunkSplit
        && resolvedQuestionCount < questions.length
        && questions.length > MIN_QUESTION_REVIEW_CHUNK_SIZE
      ) {
        throw new Error(
          `AI returned review data for only ${resolvedQuestionCount} of ${questions.length} questions.`
        )
      }

      return {
        reviewItemsByQuestionId,
        modelUsed: generated.modelUsed || modelUsed,
        provider: generated.provider || provider,
      }
    } catch (error) {
      lastError = error
      modelUsed = modelUsed || error?.modelUsed || null
      provider = provider || error?.provider || null

      if (!isRetryableGenerationError(error) || attemptIndex === QUESTION_REVIEW_GENERATION_ATTEMPTS.length - 1) {
        break
      }
    }
  }

  if (
    allowChunkSplit
    && questions.length > MIN_QUESTION_REVIEW_CHUNK_SIZE
    && isChunkableQuestionReviewError(lastError)
  ) {
    const midpoint = Math.ceil(questions.length / 2)
    const firstHalf = await generateQuestionReviewChunk({
      questions: questions.slice(0, midpoint),
      startIndex,
      totalQuestions,
      onProgress,
      allowChunkSplit,
    })
    const secondHalf = await generateQuestionReviewChunk({
      questions: questions.slice(midpoint),
      startIndex: startIndex + midpoint,
      totalQuestions,
      onProgress,
      allowChunkSplit,
    })

    return {
      reviewItemsByQuestionId: {
        ...firstHalf.reviewItemsByQuestionId,
        ...secondHalf.reviewItemsByQuestionId,
      },
      modelUsed: firstHalf.modelUsed || secondHalf.modelUsed || modelUsed,
      provider: firstHalf.provider || secondHalf.provider || provider,
    }
  }

  throw lastError
}

async function ensureQuestionsHaveReviewData({
  questions,
  reviewExplanations = {},
  onProgress = null,
  singleBatch = false,
}) {
  const safeQuestions = Array.isArray(questions) ? questions : []
  const pendingQuestions = getPendingReviewQuestions(safeQuestions)

  if (pendingQuestions.length === 0) {
    return {
      questionUpdatesById: {},
      reviewExplanations: buildStoredReviewExplanations(safeQuestions, reviewExplanations),
      reviewGeneration: null,
    }
  }

  const generatedReviewItemsByQuestionId = {}
  let modelUsed = null
  let provider = null
  const runReviewChunks = async (chunks, { allowChunkSplit }) => {
    for (const chunk of chunks) {
      try {
        const chunkResult = await generateQuestionReviewChunk({
          questions: chunk.questions,
          startIndex: chunk.startIndex,
          totalQuestions: pendingQuestions.length,
          onProgress,
          allowChunkSplit,
        })

        Object.assign(generatedReviewItemsByQuestionId, chunkResult.reviewItemsByQuestionId)
        modelUsed = modelUsed || chunkResult.modelUsed
        provider = provider || chunkResult.provider
      } catch (error) {
        console.error('Failed to prepare answer key and explanations for question batch:', error)
      }
    }
  }

  const initialChunks = singleBatch
    ? [{
        startIndex: 0,
        questions: pendingQuestions,
      }]
    : buildQuestionReviewChunks(pendingQuestions)

  await runReviewChunks(initialChunks, { allowChunkSplit: !singleBatch })

  if (singleBatch) {
    const unresolvedPendingQuestions = pendingQuestions.filter((question) => (
      !generatedReviewItemsByQuestionId[String(question?.id || '').trim()]
    ))

    if (unresolvedPendingQuestions.length > 0) {
      await runReviewChunks(buildQuestionReviewChunks(unresolvedPendingQuestions), { allowChunkSplit: true })
    }
  }

  const questionUpdatesById = Object.entries(generatedReviewItemsByQuestionId).reduce((accumulator, [questionId, reviewItem]) => {
    accumulator[questionId] = {
      correctAnswer: reviewItem.correctAnswer,
      explanation: reviewItem.explanation,
    }
    return accumulator
  }, {})
  const mergedQuestions = safeQuestions.map((question) => {
    const questionId = String(question?.id || '').trim()
    const reviewUpdate = questionUpdatesById[questionId]
    if (!reviewUpdate) return question

    return {
      ...question,
      correctAnswer: hasValidCorrectAnswer(question?.correctAnswer)
        ? String(question.correctAnswer || '').trim().toLowerCase()
        : reviewUpdate.correctAnswer,
      explanation: String(question?.explanation || '').trim() || reviewUpdate.explanation,
    }
  })
  const resolvedQuestionCount = Object.keys(generatedReviewItemsByQuestionId).length
  const statusText = buildReviewGenerationStatus(pendingQuestions.length, resolvedQuestionCount)
  const nextReviewExplanations = buildStoredReviewExplanations(mergedQuestions, {
    ...reviewExplanations,
    ...generatedReviewItemsByQuestionId,
  })

  onProgress?.({
    type: resolvedQuestionCount >= pendingQuestions.length ? 'review-generation-complete' : 'review-generation-partial',
    message: statusText,
    availableQuestions: resolvedQuestionCount,
    totalQuestions: pendingQuestions.length,
  })

  return {
    questionUpdatesById,
    reviewExplanations: nextReviewExplanations,
    reviewGeneration: {
      totalQuestions: pendingQuestions.length,
      availableQuestions: resolvedQuestionCount,
      failedQuestions: Math.max(0, pendingQuestions.length - resolvedQuestionCount),
      isComplete: resolvedQuestionCount >= pendingQuestions.length,
      isAiProcessing: false,
      statusText,
      modelUsed,
      provider,
      error: '',
    },
  }
}

function initializeTestReviewState(test) {
  if (!Array.isArray(test?.questions) || test.questions.length === 0) {
    return test
  }

  const initialReviewGeneration = buildInitialReviewGenerationState(test.questions)

  return {
    ...test,
    reviewExplanations: buildStoredReviewExplanations(test.questions, test.reviewExplanations),
    metadata: {
      ...(test.metadata || {}),
      ...(initialReviewGeneration ? { reviewGeneration: initialReviewGeneration } : {}),
    },
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
        systemPrompt: 'Return ONLY valid JSON. Do not include any extra text, markdown, comments, or backticks. The final response must be a JSON array.',
        userPrompt: prompt,
        temperature: 0.25,
        maxTokens: getGenerationMaxTokens(questionBlocks.length, attempt.maxTokens),
      })

      const parsedQuestions = parseAIResponse(generated.text, {
        fallbackDifficulty: config?.difficulty === 'mixed' ? 'medium' : config?.difficulty || 'medium',
      })
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
  const parsingMode = getExamParsingMode(config)

  if (!sourceText) {
    throw new Error('Add pasted questions or upload a PDF before creating an exam.')
  }

  const linkedSubjects = findSelectedSubjects(config, subjects)
  const testId = uid()
  const createdAt = new Date().toISOString()

  if (parsingMode === MANUAL_EXAM_PARSING_MODE) {
    onProgress?.({
      message: 'Parsing questions locally...',
      type: 'manual-parse-start',
    })

    const manualParseResult = buildManualExamQuestions({
      sourceText,
      linkedSubjects,
    })
    const generatedQuestions = manualParseResult.questions
    const questionBlocks = generatedQuestions.map((question) => question.sourceQuestion || question.question)

    if (generatedQuestions.length === 0) {
      throw new Error(
        manualParseResult.totalBlocks > 0
          ? `Manual parsing detected ${manualParseResult.totalBlocks} question blocks but could not parse any usable questions.`
          : 'No question blocks could be detected. Use numbered questions or clearer PDF text.'
      )
    }

    onProgress?.({
      message: `${manualParseResult.totalBlocks} question blocks detected. ${generatedQuestions.length} valid questions parsed locally.`,
      type: 'manual-parse-complete',
      totalQuestions: generatedQuestions.length,
      availableQuestions: generatedQuestions.length,
      totalBlocksDetected: manualParseResult.totalBlocks,
      skippedBlocks: manualParseResult.skippedBlocks,
    })

    return buildExamTestResult({
      testId,
      userId,
      config,
      createdAt,
      questionBlocks,
      linkedSubjects,
      generatedQuestions,
      modelUsed: 'manual-parser',
      provider: 'local',
    })
  }

  const questionBlocks = extractQuestionBlocksFromText(sourceText)

  if (questionBlocks.length === 0) {
    throw new Error('No questions could be detected. Use numbered questions or clear line-separated questions.')
  }

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
      'AI tests are not enabled in this public build yet. Add a direct OpenRouter key to the build first.'
    )
  }
  let test = null
  if (isManualInputConfig(config)) {
    test = createManualInputTest({ config, subjects, userId })
  } else if (isExamGenerationConfig(config)) {
    test = await generateExamTest({ config, subjects, userId, onProgress })
  } else {
    test = await generateMockTest({ config, subjects, userId, onProgress })
  }

  return initializeTestReviewState(test)
}

export async function generateTestReviewData({ test, onProgress = null }) {
  if (!Array.isArray(test?.questions) || test.questions.length === 0) {
    return {
      questionUpdatesById: {},
      reviewExplanations: {},
      reviewGeneration: null,
    }
  }

  return ensureQuestionsHaveReviewData({
    questions: test.questions,
    reviewExplanations: test.reviewExplanations,
    onProgress,
    singleBatch: !isExamGenerationConfig(test?.config),
  })
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
    scorableQuestions: Number.isFinite(testAttempt.scorableQuestions)
      ? testAttempt.scorableQuestions
      : 0,
    ungradedQuestions: Number.isFinite(testAttempt.ungradedQuestions)
      ? testAttempt.ungradedQuestions
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
    removedQuestionIds: Array.isArray(testAttempt.removedQuestionIds)
      ? testAttempt.removedQuestionIds
      : [],
    removedQuestionsCount: Number.isFinite(testAttempt.removedQuestionsCount)
      ? testAttempt.removedQuestionsCount
      : Array.isArray(testAttempt.removedQuestionIds)
        ? testAttempt.removedQuestionIds.length
        : 0,
    createdAt: testAttempt.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
    reviewExplanations:
      testAttempt?.reviewExplanations && typeof testAttempt.reviewExplanations === 'object'
        ? testAttempt.reviewExplanations
        : {},
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

export async function saveTestReviewData(userId, testAttempt) {
  if (!userId) {
    throw new Error('saveTestReviewData requires an authenticated user id.')
  }

  if (!testAttempt?.id) {
    throw new Error('saveTestReviewData requires a test id.')
  }

  await setDoc(
    userTestDocRef(userId, testAttempt.id),
    {
      questions: Array.isArray(testAttempt.questions) ? testAttempt.questions : [],
      reviewExplanations:
        testAttempt?.reviewExplanations && typeof testAttempt.reviewExplanations === 'object'
          ? testAttempt.reviewExplanations
          : {},
      metadata: {
        ...(testAttempt.metadata || {}),
        testType: testAttempt?.metadata?.testType || (isExamGenerationConfig(testAttempt?.config) ? TEST_KIND.EXAM : TEST_KIND.MOCK),
      },
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
      scorableQuestions: Number.isFinite(testAttempt.scorableQuestions)
        ? testAttempt.scorableQuestions
        : 0,
      ungradedQuestions: Number.isFinite(testAttempt.ungradedQuestions)
        ? testAttempt.ungradedQuestions
        : 0,
      percentage: Number.isFinite(testAttempt.percentage) ? testAttempt.percentage : 0,
      passed: Boolean(testAttempt.passed),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}

export async function deleteTest(userId, testId) {
  if (!userId || !testId) {
    throw new Error('deleteTest requires userId and testId.')
  }

  await deleteDoc(userTestDocRef(userId, testId))
}
