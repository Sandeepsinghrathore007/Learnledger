import { generateTextFromAI } from '@/utils/aiClient'

const DEVANAGARI_REGEX = /[\u0900-\u097F]/g
const LATIN_REGEX = /[A-Za-z]/g
const TRANSLATION_OUTPUT_MAX_TOKENS = 3200

export function normalizeQuestionLanguage(rawLanguage) {
  const normalized = String(rawLanguage || 'english').trim().toLowerCase()
  return normalized === 'hindi' ? 'hindi' : 'english'
}

function countMatches(value, pattern) {
  return (String(value || '').match(pattern) || []).length
}

function containsDevanagari(value) {
  return countMatches(value, DEVANAGARI_REGEX) > 0
}

export function inferQuestionLanguageFromQuestion(question, fallbackLanguage = 'english') {
  const fallback = normalizeQuestionLanguage(fallbackLanguage)
  const text = [
    question?.question,
    ...(Array.isArray(question?.options) ? question.options.map((option) => option?.text) : []),
    question?.explanation,
  ]
    .filter(Boolean)
    .join(' ')

  const devanagariCount = countMatches(text, DEVANAGARI_REGEX)
  const latinCount = countMatches(text, LATIN_REGEX)

  if (devanagariCount > 8 && devanagariCount >= latinCount) {
    return 'hindi'
  }

  return fallback
}

function extractJsonPayload(rawText) {
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
    const firstArray = withoutFences.indexOf('[')
    const lastArray = withoutFences.lastIndexOf(']')
    if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
      return JSON.parse(withoutFences.slice(firstArray, lastArray + 1))
    }

    const firstBrace = withoutFences.indexOf('{')
    const lastBrace = withoutFences.lastIndexOf('}')

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(withoutFences.slice(firstBrace, lastBrace + 1))
    }

    throw new Error('AI did not return valid JSON.')
  }
}

function normalizeTranslatedQuestion(rawTranslation, originalQuestion) {
  if (!rawTranslation || typeof rawTranslation !== 'object') {
    throw new Error('AI returned an invalid translation payload.')
  }

  const translatedQuestion = String(rawTranslation.question || '').trim()
  const translatedExplanation = String(rawTranslation.explanation || '').trim()
  const translatedOptions = Array.isArray(rawTranslation.options) ? rawTranslation.options : []

  if (!translatedQuestion || translatedOptions.length !== (originalQuestion?.options || []).length) {
    throw new Error('AI returned an incomplete question translation.')
  }

  const translatedOptionMap = new Map(
    translatedOptions.map((option) => [
      String(option?.id || '').trim().toLowerCase(),
      String(option?.text || '').trim(),
    ])
  )

  const options = (originalQuestion?.options || []).map((option) => {
    const translatedText = translatedOptionMap.get(String(option.id || '').trim().toLowerCase())

    if (!translatedText) {
      throw new Error('AI translation missed one or more answer options.')
    }

    return {
      ...option,
      text: translatedText,
    }
  })

  return {
    ...originalQuestion,
    question: translatedQuestion,
    explanation: translatedExplanation || String(originalQuestion?.explanation || '').trim(),
    options,
  }
}

function validateTranslatedLanguage(question, targetLanguage) {
  if (targetLanguage !== 'hindi') return

  const combinedText = [
    question?.question,
    ...(Array.isArray(question?.options) ? question.options.map((option) => option?.text) : []),
    question?.explanation,
  ]
    .filter(Boolean)
    .join(' ')

  if (!containsDevanagari(combinedText)) {
    throw new Error('Hindi translation was not returned in Devanagari script.')
  }
}

function normalizeTranslatedQuestionBatch(rawTranslations, originalQuestions) {
  const items = Array.isArray(rawTranslations)
    ? rawTranslations
    : Array.isArray(rawTranslations?.items)
      ? rawTranslations.items
      : null

  if (!items || items.length !== originalQuestions.length) {
    throw new Error('AI returned an incomplete question translation batch.')
  }

  return originalQuestions.map((question, index) => {
    const rawTranslation = items[index]
    const translationId = String(rawTranslation?.id || '').trim()

    if (translationId && translationId !== String(question?.id || '').trim()) {
      throw new Error('AI returned batch translations out of order.')
    }

    return normalizeTranslatedQuestion(rawTranslation, question)
  })
}

export async function translateQuestionBatch(questions, targetLanguage) {
  const normalizedTargetLanguage = normalizeQuestionLanguage(targetLanguage)
  const languageLabel = normalizedTargetLanguage === 'hindi' ? 'Hindi' : 'English'
  const languageInstruction = normalizedTargetLanguage === 'hindi'
    ? 'Translate every question, option, and explanation into Hindi using Devanagari script only. Never use Romanized Hindi.'
    : 'Translate every question, option, and explanation into natural English.'
  const normalizedQuestions = Array.isArray(questions)
    ? questions.filter((question) => question && Array.isArray(question.options))
    : []

  if (normalizedQuestions.length === 0) {
    return []
  }
  const maxTokens = Math.min(
    TRANSLATION_OUTPUT_MAX_TOKENS,
    Math.max(900, normalizedQuestions.length * 280)
  )

  const generated = await generateTextFromAI({
    systemPrompt: [
      'You translate quiz questions for a study app in batches.',
      `Target language: ${languageLabel}.`,
      languageInstruction,
      'Return only one valid JSON array.',
      'Each array item must have these exact keys:',
      '{"id":"","question":"","options":[{"id":"a","text":""}],"explanation":""}',
      'Keep the same order, same number of questions, same number of options, and same option ids.',
      'Do not solve the question. Do not add commentary. Do not remove details.',
    ].join('\n'),
    userPrompt: JSON.stringify(
      normalizedQuestions.map((question) => ({
        id: String(question?.id || '').trim(),
        question: String(question?.question || '').trim(),
        options: Array.isArray(question?.options)
          ? question.options.map((option) => ({
              id: option.id,
              text: String(option?.text || '').trim(),
            }))
          : [],
        explanation: String(question?.explanation || '').trim(),
      })),
      null,
      2
    ),
    temperature: 0.1,
    maxTokens,
  })

  const parsed = extractJsonPayload(generated.text)
  const translatedQuestions = normalizeTranslatedQuestionBatch(parsed, normalizedQuestions)
  translatedQuestions.forEach((question) => {
    validateTranslatedLanguage(question, normalizedTargetLanguage)
  })

  return translatedQuestions
}

export async function translateQuestionContent(question, targetLanguage) {
  const translatedQuestions = await translateQuestionBatch([question], targetLanguage)
  const translatedQuestion = translatedQuestions[0]

  if (!translatedQuestion) {
    throw new Error('Question translation is unavailable right now.')
  }

  return translatedQuestion
}
