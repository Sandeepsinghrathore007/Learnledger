import { HttpsError } from 'firebase-functions/v2/https'
import { APP_CONFIG } from './config.js'
import { normalizeLanguage } from './promptTemplate.js'
import { trimToLength } from './text.js'

function optionalShortString(value, maxChars = 120) {
  if (value == null) return null
  const cleaned = trimToLength(value, maxChars)
  return cleaned || null
}

export function parseAssistantRequestPayload(data) {
  const question = trimToLength(data?.question, APP_CONFIG.maxQuestionChars)
  if (!question) {
    throw new HttpsError('invalid-argument', 'Question is required.')
  }

  const subjectContext = trimToLength(data?.subjectContext, APP_CONFIG.maxContextChars)
  const language = normalizeLanguage(data?.language)

  return {
    question,
    subjectContext,
    language,
    subjectId: optionalShortString(data?.subjectId, 100),
    subjectName: optionalShortString(data?.subjectName, 140),
    referenceId: optionalShortString(data?.referenceId, 160),
    referenceLabel: optionalShortString(data?.referenceLabel, 120),
    referenceMaterial: optionalShortString(data?.referenceMaterial, 3600),
  }
}
