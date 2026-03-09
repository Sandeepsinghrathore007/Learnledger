import crypto from 'node:crypto'

export function compactWhitespace(value = '') {
  return String(value).replace(/\s+/g, ' ').trim()
}

export function trimToLength(value = '', maxChars = 0) {
  const text = compactWhitespace(value)
  if (!maxChars || text.length <= maxChars) return text
  return text.slice(0, maxChars).trim()
}

export function normalizeForHash(value = '') {
  return compactWhitespace(value).toLowerCase()
}

export function buildCacheKey({ question, subjectContext, language, referenceId = '', referenceLabel = '' }) {
  const normalized = [
    normalizeForHash(question),
    normalizeForHash(subjectContext),
    normalizeForHash(language),
    normalizeForHash(referenceId || referenceLabel),
  ].join('|')

  const hash = crypto.createHash('sha256').update(normalized).digest('hex')

  return {
    hash,
    normalizedQuestion: normalizeForHash(question),
    normalizedSubjectContext: normalizeForHash(subjectContext),
    normalizedLanguage: normalizeForHash(language),
    normalizedReference: normalizeForHash(referenceId || referenceLabel),
  }
}

export function estimateTokenCount(text = '') {
  const normalized = compactWhitespace(text)
  if (!normalized) return 0
  return Math.max(1, Math.ceil(normalized.length / 4))
}

export function estimateTokenBundle({ systemPrompt = '', userPrompt = '', outputText = '', usage = null }) {
  const promptFromUsage = Number(usage?.prompt_tokens)
  const completionFromUsage = Number(usage?.completion_tokens)
  const totalFromUsage = Number(usage?.total_tokens)

  if (Number.isFinite(promptFromUsage) && Number.isFinite(completionFromUsage)) {
    return {
      prompt: promptFromUsage,
      completion: completionFromUsage,
      total: promptFromUsage + completionFromUsage,
    }
  }

  if (Number.isFinite(totalFromUsage)) {
    return {
      prompt: estimateTokenCount(`${systemPrompt}\n${userPrompt}`),
      completion: estimateTokenCount(outputText),
      total: totalFromUsage,
    }
  }

  const prompt = estimateTokenCount(`${systemPrompt}\n${userPrompt}`)
  const completion = estimateTokenCount(outputText)

  return {
    prompt,
    completion,
    total: prompt + completion,
  }
}

export function formatStructuredAnswerForStorage(answer) {
  const keyPoints = Array.isArray(answer?.keyPoints)
    ? answer.keyPoints.map((point) => `- ${point}`).join('\n')
    : ''

  return [
    answer?.title || '',
    answer?.explanation || '',
    keyPoints ? `Key Points:\n${keyPoints}` : '',
    answer?.example ? `Example: ${answer.example}` : '',
    answer?.summary ? `Summary: ${answer.summary}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}
