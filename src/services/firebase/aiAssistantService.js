import { httpsCallable } from 'firebase/functions'
import { generateTextFromAI } from '@/utils/aiClient'
import { functions } from './firebaseConfig'
import { isGitHubPagesHost } from '@/utils/runtimeRecovery'

const askStudyAssistantCallable = httpsCallable(functions, 'askStudyAssistant')

const DIRECT_MODE = String(import.meta.env.VITE_AI_ASSISTANT_MODE || '').trim().toLowerCase()
const ALLOW_UNSAFE_DIRECT = String(import.meta.env.VITE_AI_ASSISTANT_ALLOW_UNSAFE_DIRECT || '').trim().toLowerCase() === 'true'
const HAS_FRONTEND_AI_KEY = Boolean(String(import.meta.env.VITE_OPENROUTER_API_KEY || '').trim())

const DIRECT_CACHE_KEY = 'learnledger.ai-assistant.cache.v4'
const DIRECT_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7
const DIRECT_CACHE_MAX_ITEMS = 60
const MAX_QUESTION_CHARS = 400
const MAX_CONTEXT_CHARS = 120
const MAX_REFERENCE_LABEL_CHARS = 120
const MAX_REFERENCE_MATERIAL_CHARS = 3_600
const MAX_OUTPUT_TOKENS = 320
const MAX_DIRECT_GENERATION_ATTEMPTS = 2
const DIRECT_CACHE_VERSION = 'study-assistant-v2'
const DEVANAGARI_REGEX = /[\u0900-\u097F]/g
const LATIN_REGEX = /[A-Za-z]/g

function trimToLength(value, maxChars) {
  return String(value || '').trim().slice(0, maxChars)
}

function normalizeLanguage(rawLanguage) {
  const normalized = String(rawLanguage || 'english').trim().toLowerCase()
  return normalized === 'hindi' ? 'hindi' : 'english'
}

function normalizeRequestPayload(payload) {
  const question = trimToLength(payload?.question, MAX_QUESTION_CHARS)
  if (!question) {
    throw new Error('Question is required.')
  }

  return {
    question,
    subjectId: payload?.subjectId || null,
    subjectName: trimToLength(payload?.subjectName, 140) || null,
    subjectContext: trimToLength(payload?.subjectContext, MAX_CONTEXT_CHARS),
    language: normalizeLanguage(payload?.language),
    referenceId: trimToLength(payload?.referenceId, 160) || null,
    referenceLabel: trimToLength(payload?.referenceLabel, MAX_REFERENCE_LABEL_CHARS),
    referenceMaterial: trimToLength(payload?.referenceMaterial, MAX_REFERENCE_MATERIAL_CHARS),
  }
}

function countMatches(value, pattern) {
  return (String(value || '').match(pattern) || []).length
}

function containsDevanagari(value) {
  return countMatches(value, DEVANAGARI_REGEX) > 0
}

function validateStructuredAnswerLanguage(answer, language) {
  if (!answer || language !== 'hindi') return

  const fields = [
    ['title', answer.title],
    ['explanation', answer.explanation],
    ['example', answer.example],
    ['summary', answer.summary],
    ...answer.keyPoints.map((point, index) => [`keyPoints[${index}]`, point]),
  ]

  for (const [fieldName, value] of fields) {
    if (!containsDevanagari(value)) {
      throw new Error(`AI response field "${fieldName}" must be written in Hindi script.`)
    }
  }

  const combinedText = fields.map(([, value]) => String(value || '')).join(' ')
  const devanagariCount = countMatches(combinedText, DEVANAGARI_REGEX)
  const latinCount = countMatches(combinedText, LATIN_REGEX)

  if (devanagariCount < 24 || latinCount > devanagariCount) {
    throw new Error('AI returned Hindi in English letters. Please try again.')
  }
}

function buildStudyPrompts({ language, subjectContext, question, referenceLabel, referenceMaterial }) {
  const languageLabel = language === 'hindi' ? 'Hindi' : 'English'
  const contextLabel = subjectContext || 'General study context'
  const scriptInstruction = language === 'hindi'
    ? 'For Hindi responses, every value must use Devanagari script. Never write Hindi in Roman or Latin letters. Use English only for unavoidable code, formulas, or proper nouns.'
    : 'Use natural English for every value.'

  return {
    systemPrompt: [
      'You are LearnLedger AI Assistant inside the LearnLedger study platform.',
      'If the student asks who you are, describe yourself as LearnLedger AI Assistant.',
      `Write all fields in ${languageLabel}.`,
      scriptInstruction,
      'Return only one valid JSON object with these exact keys and no extras:',
      '{"title":"", "explanation":"", "keyPoints":[], "example":"", "summary":""}',
      'Keep answers concise and useful for study notes:',
      '- title: <= 12 words',
      '- explanation: <= 120 words',
      '- keyPoints: 3-5 short items',
      '- example: <= 60 words',
      '- summary: <= 30 words',
      'When reference material is provided, prefer it over general knowledge.',
      'If the reference material is insufficient, say so briefly inside the explanation rather than inventing details.',
      'No markdown. No code blocks. No filler text.',
    ].join('\n'),
    userPrompt: [
      `Subject Context: ${contextLabel}`,
      referenceLabel ? `Reference Source: ${referenceLabel}` : '',
      referenceMaterial ? `Reference Material:\n${referenceMaterial}` : '',
      `Student Question: ${question}`,
    ].filter(Boolean).join('\n\n'),
  }
}

function mapAssistantCallableError(error) {
  const code = String(error?.code || '')
  const rawMessage = String(error?.message || '').trim()
  const normalized = rawMessage.toLowerCase()

  if (code === 'functions/unauthenticated') {
    return 'Please login again to use AI assistant.'
  }

  if (code === 'functions/not-found') {
    return 'AI backend is not deployed yet. Deploy Firebase functions first.'
  }

  if (code === 'functions/resource-exhausted') {
    return rawMessage || 'AI request limit reached. Please try again later.'
  }

  if (code === 'functions/failed-precondition') {
    return rawMessage || 'AI backend is not fully configured.'
  }

  if (code === 'functions/internal' && (!rawMessage || normalized === 'internal')) {
    return 'AI backend setup incomplete. Configure and deploy the Firebase Functions backend.'
  }

  return rawMessage || 'Failed to reach AI assistant backend.'
}

function mapDirectAIError(error) {
  const rawMessage = String(error?.message || '').trim()
  const normalized = rawMessage.toLowerCase()

  if (normalized.includes('reported as leaked')) {
    return 'The configured OpenRouter key was blocked as leaked. Replace VITE_OPENROUTER_API_KEY in GitHub secrets and redeploy GitHub Pages.'
  }

  if (normalized.includes('user not found')) {
    return 'The configured OpenRouter key is invalid or revoked. Replace VITE_OPENROUTER_API_KEY and redeploy GitHub Pages.'
  }

  if (normalized.includes('no ai api key configured')) {
    return 'OpenRouter key is missing in this build. Set VITE_OPENROUTER_API_KEY and redeploy GitHub Pages.'
  }

  if (normalized.includes('no auth credentials found') || normalized.includes('unauthorized')) {
    return 'OpenRouter rejected the configured API key. Replace VITE_OPENROUTER_API_KEY and redeploy GitHub Pages.'
  }

  return rawMessage || 'Browser AI request failed.'
}

function extractJsonObject(rawText) {
  const text = String(rawText || '').trim()
  if (!text) {
    throw new Error('AI returned an empty response.')
  }

  const withoutFences = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(withoutFences)
  } catch {
    const firstBrace = withoutFences.indexOf('{')
    const lastBrace = withoutFences.lastIndexOf('}')

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('AI did not return valid JSON.')
    }

    return JSON.parse(withoutFences.slice(firstBrace, lastBrace + 1))
  }
}

function normalizeStructuredAnswer(rawAnswer) {
  if (!rawAnswer || typeof rawAnswer !== 'object') return null

  const title = String(rawAnswer.title || '').trim()
  const explanation = String(rawAnswer.explanation || '').trim()
  const example = String(rawAnswer.example || '').trim()
  const summary = String(rawAnswer.summary || '').trim()

  const keyPoints = Array.isArray(rawAnswer.keyPoints)
    ? rawAnswer.keyPoints
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 5)
    : []

  if (!title || !explanation || !example || !summary || keyPoints.length === 0) {
    return null
  }

  return {
    title,
    explanation,
    keyPoints,
    example,
    summary,
  }
}

function shouldUseDirectFrontendAI() {
  if (DIRECT_MODE === 'functions') return false
  if (DIRECT_MODE === 'direct') {
    return !isGitHubPagesHost() || ALLOW_UNSAFE_DIRECT
  }
  if (isGitHubPagesHost()) return false
  return HAS_FRONTEND_AI_KEY
}

function createCacheKey(payload) {
  return JSON.stringify({
    v: DIRECT_CACHE_VERSION,
    q: payload.question.toLowerCase(),
    c: payload.subjectContext.toLowerCase(),
    l: payload.language,
    r: String(payload.referenceId || payload.referenceLabel || '').toLowerCase(),
  })
}

function readCacheBucket() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {}
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(DIRECT_CACHE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCacheBucket(bucket) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  try {
    window.localStorage.setItem(DIRECT_CACHE_KEY, JSON.stringify(bucket))
  } catch {
    // Ignore quota and storage errors.
  }
}

function readCachedAssistantResponse(payload) {
  const bucket = readCacheBucket()
  const item = bucket[createCacheKey(payload)]
  if (!item) return null

  const ageMs = Date.now() - Number(item.cachedAt || 0)
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > DIRECT_CACHE_TTL_MS) {
    delete bucket[createCacheKey(payload)]
    writeCacheBucket(bucket)
    return null
  }

  return item
}

function writeCachedAssistantResponse(payload, response) {
  const bucket = readCacheBucket()
  const cacheKey = createCacheKey(payload)

  bucket[cacheKey] = {
    answer: response.answer,
    meta: response.meta,
    cachedAt: Date.now(),
  }

  const entries = Object.entries(bucket)
    .sort(([, a], [, b]) => Number(b.cachedAt || 0) - Number(a.cachedAt || 0))
    .slice(0, DIRECT_CACHE_MAX_ITEMS)

  writeCacheBucket(Object.fromEntries(entries))
}

async function askStudyAssistantDirect(payload) {
  const cached = readCachedAssistantResponse(payload)
  if (cached) {
    return {
      answer: cached.answer,
      meta: {
        ...cached.meta,
        cacheHit: true,
      },
    }
  }

  const { systemPrompt, userPrompt } = buildStudyPrompts(payload)
  let lastError = null

  for (let attempt = 0; attempt < MAX_DIRECT_GENERATION_ATTEMPTS; attempt += 1) {
    const effectiveSystemPrompt = attempt === 0
      ? systemPrompt
      : [
          systemPrompt,
          'Regenerate the full JSON now.',
          'If the selected language is Hindi, every field must contain Devanagari script and must not be Romanized.',
        ].join('\n')

    try {
      const generated = await generateTextFromAI({
        systemPrompt: effectiveSystemPrompt,
        userPrompt,
        temperature: 0.2,
        maxTokens: MAX_OUTPUT_TOKENS,
      })

      const parsed = extractJsonObject(generated.text)
      const answer = normalizeStructuredAnswer(parsed)
      if (!answer) {
        throw new Error('AI returned an invalid response format. Please try again.')
      }

      validateStructuredAnswerLanguage(answer, payload.language)

      const response = {
        answer,
        meta: {
          cacheHit: false,
          modelUsed: generated.modelUsed || null,
          provider: generated.provider || 'direct',
        },
      }

      writeCachedAssistantResponse(payload, response)
      return response
    } catch (error) {
      lastError = error
    }
  }

  throw new Error(mapDirectAIError(lastError))
}

async function askStudyAssistantCallableBackend(payload) {
  try {
    const response = await askStudyAssistantCallable(payload)
    return response?.data || {}
  } catch (error) {
    throw new Error(mapAssistantCallableError(error))
  }
}

export async function askStudyAssistant(payload) {
  const normalizedPayload = normalizeRequestPayload(payload)

  if (shouldUseDirectFrontendAI()) {
    return askStudyAssistantDirect(normalizedPayload)
  }

  return askStudyAssistantCallableBackend(normalizedPayload)
}
