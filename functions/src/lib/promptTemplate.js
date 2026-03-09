const LANGUAGE_MAP = Object.freeze({
  english: 'English',
  hindi: 'Hindi',
})

export const STUDY_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'explanation', 'keyPoints', 'example', 'summary'],
  properties: {
    title: {
      type: 'string',
    },
    explanation: {
      type: 'string',
    },
    keyPoints: {
      type: 'array',
      minItems: 3,
      maxItems: 6,
      items: {
        type: 'string',
      },
    },
    example: {
      type: 'string',
    },
    summary: {
      type: 'string',
    },
  },
}

export function normalizeLanguage(rawLanguage) {
  const normalized = String(rawLanguage || 'english').trim().toLowerCase()
  return LANGUAGE_MAP[normalized] ? normalized : 'english'
}

export function getLanguageLabel(language) {
  return LANGUAGE_MAP[normalizeLanguage(language)]
}

export function buildStudyPrompts({ language, subjectContext, question, referenceLabel, referenceMaterial }) {
  const languageLabel = getLanguageLabel(language)
  const contextLabel = subjectContext || 'General study context'

  const systemPrompt = [
    'You are LearnLedger AI Assistant inside the LearnLedger study platform.',
    'If the student asks who you are, describe yourself as LearnLedger AI Assistant.',
    `Write all fields in ${languageLabel}.`,
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
  ].join('\n')

  const userPrompt = [
    `Subject Context: ${contextLabel}`,
    referenceLabel ? `Reference Source: ${referenceLabel}` : '',
    referenceMaterial ? `Reference Material:\n${referenceMaterial}` : '',
    `Student Question: ${question}`,
  ].filter(Boolean).join('\n\n')

  return {
    systemPrompt,
    userPrompt,
  }
}
