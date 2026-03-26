import { generateTextFromAI } from '@/utils/aiClient'

const DEVANAGARI_REGEX = /[\u0900-\u097F]/g
const LATIN_REGEX = /[A-Za-z]/g
const TRANSLATION_OUTPUT_MAX_TOKENS = 8192

export function normalizeQuestionLanguage(rawLanguage) {
  const normalized = String(rawLanguage || 'english').trim().toLowerCase()
  return normalized === 'hindi' ? 'hindi' : 'english'
}

function tryParseJson(rawText) {
  try {
    return JSON.parse(rawText)
  } catch {
    return null
  }
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

function sanitizeAiResponseText(rawText) {
  return String(rawText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^`+/, '')
    .replace(/`+$/, '')
    .trim()
}

function escapeInvalidJsonStringCharacters(rawText) {
  const text = String(rawText || '')
  if (!text) return text

  let result = ''
  let inString = false
  let isEscaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (!inString) {
      if (char === '"') {
        inString = true
      }
      result += char
      continue
    }

    if (isEscaped) {
      result += char
      isEscaped = false
      continue
    }

    if (char === '\\') {
      result += char
      isEscaped = true
      continue
    }

    if (char === '"') {
      inString = false
      result += char
      continue
    }

    if (char === '\r') {
      if (text[index + 1] === '\n') {
        index += 1
      }
      result += '\\n'
      continue
    }

    if (char === '\n') {
      result += '\\n'
      continue
    }

    if (char === '\t') {
      result += '\\t'
      continue
    }

    result += char
  }

  return result
}

function repairJsonText(rawText) {
  let repaired = String(rawText || '').trim()
  if (!repaired) return repaired

  repaired = repaired
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\bundefined\b/g, 'null')
    .replace(/\bNaN\b/g, 'null')
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')

  repaired = repaired.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_\- ]*)(\s*:)/g, (_, start, key, end) => {
    const safeKey = key.trim().replace(/"/g, '\\"')
    return `${start}"${safeKey}"${end}`
  })

  repaired = repaired.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => {
    const unescaped = inner.replace(/\\'/g, "'")
    return JSON.stringify(unescaped)
  })

  repaired = repaired.replace(/,\s*([}\]])/g, '$1')
  repaired = escapeInvalidJsonStringCharacters(repaired)

  return repaired
}

function extractJsonCandidate(rawText) {
  const text = sanitizeAiResponseText(rawText)
  if (!text) return ''

  if (tryParseJson(text) !== null) {
    return text
  }

  const firstArray = text.indexOf('[')
  const lastArray = text.lastIndexOf(']')
  if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
    return text.slice(firstArray, lastArray + 1).trim()
  }

  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim()
  }

  return text
}

function extractJsonPayload(rawText) {
  const jsonCandidate = extractJsonCandidate(rawText)
  if (!jsonCandidate) {
    throw new Error('AI returned an empty response.')
  }

  const parseCandidates = [
    jsonCandidate,
    escapeInvalidJsonStringCharacters(jsonCandidate),
    repairJsonText(jsonCandidate),
    repairJsonText(escapeInvalidJsonStringCharacters(jsonCandidate)),
  ].filter(Boolean)

  for (const candidate of Array.from(new Set(parseCandidates))) {
    const parsed = tryParseJson(candidate)
    if (parsed !== null) {
      return parsed
    }
  }

  console.error('Raw translation response (invalid JSON):', rawText)
  console.error('Extracted translation JSON candidate:', jsonCandidate)
  throw new Error('AI returned invalid JSON for translation. Please try again.')
}

function normalizeTranslatedQuestion(rawTranslation, originalQuestion) {
  if (!rawTranslation || typeof rawTranslation !== 'object') {
    throw new Error('AI returned an invalid translation payload.')
  }

  const translatedQuestion = String(rawTranslation.question || '').trim()
  const translatedOptionMap = normalizeInlineOptionMap(rawTranslation.options)
  const originalOptions = Array.isArray(originalQuestion?.options) ? originalQuestion.options : []

  if (!translatedQuestion || translatedOptionMap.size !== originalOptions.length) {
    throw new Error('AI returned an incomplete question translation.')
  }

  const options = originalOptions.map((option, index) => {
    const normalizedOptionId = String(option?.id || '').trim().toLowerCase()
    const fallbackOptionId = String.fromCharCode(97 + index)
    const translatedText = (
      translatedOptionMap.get(normalizedOptionId)
      || translatedOptionMap.get(fallbackOptionId)
    )

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
    explanation: String(originalQuestion?.explanation || '').trim(),
    options,
  }
}

function normalizeInlineOptionMap(rawOptions) {
  if (!rawOptions || typeof rawOptions !== 'object') {
    return new Map()
  }

  if (Array.isArray(rawOptions)) {
    return new Map(
      rawOptions.map((option) => [
        String(option?.id || '').trim().toLowerCase(),
        String(option?.text || '').trim(),
      ])
    )
  }

  return new Map(
    Object.entries(rawOptions).map(([optionId, text]) => [
      String(optionId || '').trim().toLowerCase(),
      String(text || '').trim(),
    ])
  )
}

export function getInlineQuestionTranslation(question, targetLanguage) {
  const normalizedTargetLanguage = normalizeQuestionLanguage(targetLanguage)
  const translation = question?.translations?.[normalizedTargetLanguage]
  if (!translation || typeof translation !== 'object') {
    return null
  }

  const translatedQuestion = String(translation.question || '').trim()
  if (!translatedQuestion) {
    return null
  }

  const translatedOptionMap = normalizeInlineOptionMap(translation.options)
  const options = Array.isArray(question?.options)
    ? question.options.map((option) => ({
        ...option,
        text: translatedOptionMap.get(String(option?.id || '').trim().toLowerCase()) || String(option?.text || '').trim(),
      }))
    : []

  if (options.length === 0) {
    return null
  }

  return {
    ...question,
    question: translatedQuestion,
    explanation: String(question?.explanation || '').trim(),
    options,
  }
}

function validateTranslatedLanguage(question, targetLanguage) {
  if (targetLanguage !== 'hindi') return

  const combinedText = [
    question?.question,
    ...(Array.isArray(question?.options) ? question.options.map((option) => option?.text) : []),
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
    return normalizeTranslatedQuestion(rawTranslation, question)
  })
}

function buildTranslationPayloadQuestion(question) {
  const optionEntries = Array.isArray(question?.options)
    ? question.options.map((option, index) => {
        const normalizedOptionId = String(option?.id || '').trim().toUpperCase()
        const optionKey = normalizedOptionId || String.fromCharCode(65 + index)
        return [optionKey, String(option?.text || '').trim()]
      })
    : []

  return {
    question: String(question?.question || '').trim(),
    options: Object.fromEntries(optionEntries),
  }
}

export async function translateQuestionBatch(questions, targetLanguage) {
  const normalizedTargetLanguage = normalizeQuestionLanguage(targetLanguage)
  const languageLabel = normalizedTargetLanguage === 'hindi' ? 'Hindi' : 'English'
  const normalizedQuestions = Array.isArray(questions)
    ? questions.filter((question) => question && Array.isArray(question.options))
    : []
  const translationPayload = normalizedQuestions.map((question) => buildTranslationPayloadQuestion(question))

  if (normalizedQuestions.length === 0) {
    return []
  }
  const maxTokens = Math.min(
    TRANSLATION_OUTPUT_MAX_TOKENS,
    Math.max(900, normalizedQuestions.length * 280)
  )

  const generated = await generateTextFromAI({
    systemPrompt: [
      'You translate quiz questions for a study app in one batch.',
      normalizedTargetLanguage === 'hindi'
        ? 'Translate ONLY the question and options into Hindi.'
        : `Translate ONLY the question and options into ${languageLabel}.`,
      'STRICT RULES:',
      'Return ONLY valid JSON',
      'Do NOT add any explanation or extra text',
      'Do NOT change JSON structure',
      'Do NOT remove any fields',
      'Keep keys exactly same',
      'Do NOT wrap response in markdown',
      'Translate values only. Preserve the same order and number of items.',
      normalizedTargetLanguage === 'hindi'
        ? 'Use Devanagari script for Hindi. Do not use Romanized Hindi.'
        : 'Use natural, readable English.',
      'INPUT FORMAT:',
      '[',
      '{',
      '"question": "...",',
      '"options": {',
      '"A": "...",',
      '"B": "...",',
      '"C": "...",',
      '"D": "..."',
      '}',
      '}',
      ']',
      'OUTPUT FORMAT (MUST MATCH EXACTLY):',
      '[',
      '{',
      '"question": "...",',
      '"options": {',
      '"A": "...",',
      '"B": "...",',
      '"C": "...",',
      '"D": "..."',
      '}',
      '}',
      ']',
    ].join('\n'),
    userPrompt: JSON.stringify(translationPayload, null, 2),
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
