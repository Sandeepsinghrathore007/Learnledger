import { extractQuestionBlocksFromText } from '@/utils/examGeneration'

const OPTION_IDS = ['a', 'b', 'c', 'd']
const OPTION_SEQUENCE = ['a', 'b', 'c', 'd', 'e']
const QUESTION_PREFIX_REGEX = /^\s*(?:q(?:uestion)?\s*)?(?:\d{1,3}|[ivxlcdm]{1,8}|[A-Z]\d{0,2})(?:\s*[\).:\-]\s*|\s+)/i
const OPTION_MARKER_REGEX = /(^|[^\p{L}\p{N}])(\(?\s*([A-E])\s*\)?)(?=\s*(?:[\).:\-]|\s))/gimu
const OPTION_LEADING_SEPARATOR_REGEX = /^[\s).:\-]+/
const QUESTION_NOT_ATTEMPTED_REGEX = /^question\s+not\s+attempted\b/i
const TRAILING_OPTION_NOISE_REGEX = /\s*\(?E\)?\s*(?:[\).:\-]\s*)?Question\s+not\s+attempted\b[\s\S]*$/i
const MEANINGFUL_ENGLISH_WORD_REGEX = /\b[A-Za-z]{3,}\b/g
const ASCII_LETTER_REGEX = /[A-Za-z]/g
const NON_ASCII_CHAR_REGEX = /[^\x00-\x7F]/g
const SUSPICIOUS_TEXT_CHAR_REGEX = /[^A-Za-z0-9\s,.;:?!'"`~()\-_/\\&%+*=<>\[\]{}#@$|]/g
const SAFE_ASCII_TOKEN_CHAR_REGEX = /[A-Za-z0-9,.;:?!'"`~()\-_/\\&%+*=<>\[\]{}#@$|]/
const MATCH_KEYWORD_REGEX = /\bmatch(?:\s+the\s+following)?\b/i
const LIST_KEYWORD_REGEX = /\blist\b/i
const LIST_I_REGEX = /\blist\s*[-–—]?\s*i\b/i
const LIST_II_REGEX = /\blist\s*[-–—]?\s*ii\b/i
const ROMAN_ITEM_I_REGEX = /\(\s*i\s*\)/i
const ROMAN_ITEM_II_REGEX = /\(\s*ii\s*\)/i
const MATCH_TYPE_PROMPT_REGEX = /match\s+list\s*[-–—]?\s*i\s+with\s+list\s*[-–—]?\s*ii|choose\s+the\s+correct\s+match|codes?\s+given\s+below/i

function countMatches(value, regex) {
  return (String(value || '').match(regex) || []).length
}

function normalizeSourceText(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function cleanInlineText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:?!])/g, '$1')
    .trim()
}

function normalizeQuestionText(value) {
  return cleanInlineText(
    String(value || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' ')
  )
}

function buildMalformedQuestionWarning(blockText, reason) {
  const preview = cleanInlineText(blockText).slice(0, 180)
  console.warn(`Skipping malformed manual question: ${reason}`, preview)
}

function stripQuestionPrefix(value) {
  return normalizeSourceText(value).replace(QUESTION_PREFIX_REGEX, '').trim()
}

function normalizeOptionText(value) {
  return cleanInlineText(
    String(value || '')
      .replace(TRAILING_OPTION_NOISE_REGEX, '')
      .replace(OPTION_LEADING_SEPARATOR_REGEX, '')
  )
}

function hasCompleteOptions(options) {
  return OPTION_IDS.every((optionId) => cleanInlineText(options?.[optionId]))
}

export function isCorruptedText(text) {
  const normalized = cleanInlineText(text)
  if (!normalized) return false

  const visibleLength = normalized.replace(/\s+/g, '').length
  const meaningfulEnglishWords = countMatches(normalized, MEANINGFUL_ENGLISH_WORD_REGEX)
  const asciiLetterCount = countMatches(normalized, ASCII_LETTER_REGEX)
  const nonAsciiCount = countMatches(normalized, NON_ASCII_CHAR_REGEX)
  const suspiciousCharCount = countMatches(normalized, SUSPICIOUS_TEXT_CHAR_REGEX)
  if (visibleLength < 3) {
    return meaningfulEnglishWords === 0 && (nonAsciiCount >= 1 || suspiciousCharCount >= 2)
  }

  const nonAsciiRatio = nonAsciiCount / visibleLength
  const suspiciousRatio = suspiciousCharCount / visibleLength
  const hasMeaningfulEnglish = meaningfulEnglishWords > 0

  if (!hasMeaningfulEnglish && nonAsciiCount >= 2 && nonAsciiRatio >= 0.18) {
    return true
  }

  if (!hasMeaningfulEnglish && suspiciousCharCount >= 3 && suspiciousRatio >= 0.2) {
    return true
  }

  if (
    hasMeaningfulEnglish
    && (nonAsciiRatio >= 0.45 || suspiciousRatio >= 0.5)
    && asciiLetterCount < suspiciousCharCount * 2
  ) {
    return true
  }

  return false
}

export function isMatchTypeQuestion(text) {
  const normalized = normalizeSourceText(text)
  if (!normalized) return false

  const hasMatchAndList = MATCH_KEYWORD_REGEX.test(normalized) && LIST_KEYWORD_REGEX.test(normalized)
  const hasRomanPairs = ROMAN_ITEM_I_REGEX.test(normalized) && ROMAN_ITEM_II_REGEX.test(normalized)
  const hasListPairs = LIST_I_REGEX.test(normalized) && LIST_II_REGEX.test(normalized)

  return hasMatchAndList || hasRomanPairs || hasListPairs || MATCH_TYPE_PROMPT_REGEX.test(normalized)
}

function cleanCorruptedToken(token) {
  const value = String(token || '')
  if (!value.trim()) return value

  if (!/[A-Za-z]/.test(value)) {
    return isCorruptedText(value) ? '' : value
  }

  if (!countMatches(value, SUSPICIOUS_TEXT_CHAR_REGEX)) {
    return value
  }

  const cleaned = Array.from(value)
    .filter((character) => SAFE_ASCII_TOKEN_CHAR_REGEX.test(character))
    .join('')

  return cleanInlineText(cleaned)
}

function buildCleanupSample(label, beforeText, afterText) {
  const before = cleanInlineText(beforeText)
  const after = cleanInlineText(afterText)

  if (!before || before === after) {
    return null
  }

  return {
    label,
    before: before.slice(0, 180),
    after: after.slice(0, 180),
  }
}

function cleanManualLine(line) {
  const normalizedLine = String(line || '').trim()
  if (!normalizedLine) return ''

  const cleanedLine = cleanInlineText(
    normalizedLine
      .split(/(\s+)/)
      .map((segment) => (/\s+/.test(segment) ? segment : cleanCorruptedToken(segment)))
      .join('')
  )

  if (!cleanedLine || isCorruptedText(cleanedLine)) {
    return ''
  }

  return cleanedLine
}

function cleanManualText(value, { fallbackToOriginal = false, sampleLabel = 'text' } = {}) {
  const normalizedValue = normalizeSourceText(value)
  const originalText = normalizeQuestionText(normalizedValue)

  if (!normalizedValue) {
    return {
      text: originalText,
      originalText,
      removedLineCount: 0,
      usedFallback: false,
      sample: null,
    }
  }

  const rawLines = normalizedValue
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  let removedLineCount = 0
  const cleanedLines = []

  rawLines.forEach((line) => {
    const cleanedLine = cleanManualLine(line)

    if (!cleanedLine) {
      removedLineCount += 1
      return
    }

    cleanedLines.push(cleanedLine)
  })
  let cleanedText = normalizeQuestionText(cleanedLines.join('\n'))
  let usedFallback = false

  if (!cleanedText && fallbackToOriginal && originalText) {
    cleanedText = originalText
    usedFallback = true
  }

  return {
    text: cleanedText,
    originalText,
    removedLineCount,
    usedFallback,
    sample: buildCleanupSample(sampleLabel, originalText, cleanedText),
  }
}

function extractOptionMarkers(blockText) {
  const markers = []

  for (const match of blockText.matchAll(OPTION_MARKER_REGEX)) {
    const boundary = String(match[1] || '')
    const rawMarker = String(match[2] || '')
    const optionId = String(match[3] || '').trim().toLowerCase()

    if (!OPTION_SEQUENCE.includes(optionId)) {
      continue
    }

    const start = (match.index || 0) + boundary.length
    const end = start + rawMarker.length

    if (markers[markers.length - 1]?.start === start) {
      continue
    }

    markers.push({
      optionId,
      start,
      end,
    })
  }

  return markers
}

function buildOptionMarkerChain(markers, startIndex) {
  const chain = [markers[startIndex]]
  let lastOrder = OPTION_SEQUENCE.indexOf(markers[startIndex].optionId)

  for (let index = startIndex + 1; index < markers.length; index += 1) {
    const candidate = markers[index]
    const candidateOrder = OPTION_SEQUENCE.indexOf(candidate.optionId)

    if (candidateOrder <= lastOrder) {
      continue
    }

    chain.push(candidate)
    lastOrder = candidateOrder

    if (candidate.optionId === 'e') {
      break
    }
  }

  return chain
}

function parseOptionChain(blockText, markerChain) {
  const firstMarker = markerChain[0]
  if (!firstMarker) return null

  const questionCleanup = cleanManualText(blockText.slice(0, firstMarker.start), {
    fallbackToOriginal: true,
    sampleLabel: 'question',
  })
  const options = {}
  let removedLineCount = questionCleanup.removedLineCount
  let questionFallbackCount = questionCleanup.usedFallback ? 1 : 0
  let cleanupSample = questionCleanup.sample

  markerChain.forEach((marker, index) => {
    if (marker.optionId === 'e' || !OPTION_IDS.includes(marker.optionId) || options[marker.optionId]) {
      return
    }

    const nextMarkerStart = markerChain[index + 1]?.start || blockText.length
    const optionCleanup = cleanManualText(
      normalizeOptionText(blockText.slice(marker.end, nextMarkerStart)),
      { sampleLabel: `option ${marker.optionId.toUpperCase()}` }
    )
    const optionText = optionCleanup.text

    removedLineCount += optionCleanup.removedLineCount
    questionFallbackCount += optionCleanup.usedFallback ? 1 : 0
    cleanupSample = cleanupSample || optionCleanup.sample

    if (!optionText || QUESTION_NOT_ATTEMPTED_REGEX.test(optionText)) {
      return
    }

    options[marker.optionId] = optionText
  })

  return {
    question: questionCleanup.text,
    options,
    isComplete: hasCompleteOptions(options),
    cleaningStats: {
      removedLineCount,
      questionFallbackCount,
      sample: cleanupSample,
    },
  }
}

function scoreParsedCandidate(candidate, startOptionId) {
  const optionCount = Object.keys(candidate?.options || {}).length

  if (!candidate?.question || optionCount === 0) {
    return Number.NEGATIVE_INFINITY
  }

  const shortestOptionLength = Math.min(
    ...Object.values(candidate.options).map((value) => String(value || '').trim().length)
  )

  return (
    optionCount * 100
    + (candidate.isComplete ? 50 : 0)
    + (startOptionId === 'a' ? 25 : 0)
    + Math.min(candidate.question.length, 40)
    + Math.min(shortestOptionLength, 20)
    - (candidate.question.length < 8 ? 80 : 0)
  )
}

function parseQuestionCandidateFromNormalizedBlock(normalizedBlock, sourceBlockText = normalizedBlock) {
  if (!normalizedBlock) {
    buildMalformedQuestionWarning(sourceBlockText, 'empty block after question prefix')
    return null
  }

  const optionMarkers = extractOptionMarkers(normalizedBlock)
  if (optionMarkers.length === 0) {
    buildMalformedQuestionWarning(sourceBlockText, 'options A-D not detected')
    return null
  }

  let bestCandidate = null
  let bestScore = Number.NEGATIVE_INFINITY

  optionMarkers.forEach((marker, index) => {
    if (!OPTION_IDS.includes(marker.optionId)) {
      return
    }

    const candidate = parseOptionChain(normalizedBlock, buildOptionMarkerChain(optionMarkers, index))
    const score = scoreParsedCandidate(candidate, marker.optionId)

    if (score > bestScore) {
      bestCandidate = candidate
      bestScore = score
    }
  })

  if (!bestCandidate) {
    buildMalformedQuestionWarning(sourceBlockText, 'usable question text and options were not found')
    return null
  }

  return {
    ...bestCandidate,
    sourceQuestion: normalizedBlock,
  }
}

function parseQuestionCandidateFromBlock(blockText) {
  return parseQuestionCandidateFromNormalizedBlock(stripQuestionPrefix(blockText), blockText)
}

function buildQuestionObject(parsedQuestion, questionIndex) {
  return {
    question: parsedQuestion.question,
    options: OPTION_IDS
      .filter((optionId) => parsedQuestion.options[optionId])
      .map((optionId) => ({
        id: optionId,
        text: parsedQuestion.options[optionId],
      })),
    correctAnswer: null,
    explanation: '',
    difficulty: 'medium',
    subjectName: '',
    topicName: '',
    sourceQuestion: parsedQuestion.sourceQuestion,
    questionNumber: questionIndex + 1,
    isComplete: Boolean(parsedQuestion.isComplete),
    manualOptions: { ...parsedQuestion.options },
  }
}

export function parseQuestionsFromTextWithStats(rawText) {
  const questionBlocks = extractQuestionBlocksFromText(rawText)
  const parsedCandidates = []
  let skippedBlocks = 0
  let skippedMatchTypeQuestions = 0
  let removedCorruptedLines = 0
  let questionFallbacksUsed = 0
  let cleanupSample = null

  questionBlocks.forEach((blockText) => {
    const normalizedBlock = stripQuestionPrefix(blockText)

    if (isMatchTypeQuestion(normalizedBlock)) {
      skippedBlocks += 1
      skippedMatchTypeQuestions += 1
      console.warn('Skipped match-type question', normalizedBlock)
      return
    }

    const parsedQuestion = parseQuestionCandidateFromNormalizedBlock(normalizedBlock, blockText)

    if (!parsedQuestion) {
      skippedBlocks += 1
      return
    }

    removedCorruptedLines += Number(parsedQuestion.cleaningStats?.removedLineCount || 0)
    questionFallbacksUsed += Number(parsedQuestion.cleaningStats?.questionFallbackCount || 0)
    cleanupSample = cleanupSample || parsedQuestion.cleaningStats?.sample || null
    parsedCandidates.push(parsedQuestion)
  })

  const questions = parsedCandidates.map((parsedQuestion, index) => buildQuestionObject(parsedQuestion, index))
  const stats = {
    totalBlocks: questionBlocks.length,
    skippedBlocks,
    parsedQuestions: questions.length,
    skippedMatchTypeQuestions,
    removedCorruptedLines,
    questionFallbacksUsed,
  }

  console.info('[manualQuestionParser] Parse summary', stats)
  if (cleanupSample) {
    console.info('[manualQuestionParser] Cleanup sample', cleanupSample)
  }

  return {
    questions,
    questionBlocks,
    totalBlocks: stats.totalBlocks,
    skippedBlocks: stats.skippedBlocks,
    parsedQuestions: stats.parsedQuestions,
    skippedMatchTypeQuestions: stats.skippedMatchTypeQuestions,
    removedCorruptedLines: stats.removedCorruptedLines,
    questionFallbacksUsed: stats.questionFallbacksUsed,
  }
}

export function parseQuestionsFromText(rawText) {
  return parseQuestionsFromTextWithStats(rawText).questions
}
