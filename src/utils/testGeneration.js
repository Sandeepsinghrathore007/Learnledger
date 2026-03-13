/**
 * testGeneration.js — Utilities for gathering content to generate AI tests.
 *
 * Functions:
 *  - gatherContentForTest: Collect notes/PDFs based on test scope
 *  - buildAIPrompt: Create prompt for Gemini API
 *  - parseAIResponse: Parse and validate AI-generated questions
 */

const OPTION_IDS = ['a', 'b', 'c', 'd']
const DEFAULT_PROMPT_OPTIONS = {
  maxNotes: 8,
  maxPdfs: 4,
  noteCharLimit: 1000,
  pdfCharLimit: 900,
  totalContextChars: 9000,
}

function truncateText(value, maxChars) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text || !Number.isFinite(maxChars) || maxChars <= 0) return ''
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`
}

function clampPositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

/**
 * Strip HTML tags from content to get plain text.
 */
function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Convert legacy note blocks into plain text.
 */
function blocksToText(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return ''

  return blocks
    .map((block) => {
      if (typeof block?.text !== 'string') return ''
      return block.text.trim()
    })
    .filter(Boolean)
    .join('\n')
}

/**
 * Get searchable plain text from a note.
 * Supports both TipTap HTML (`content`) and legacy block format (`blocks`).
 */
function getNotePlainText(note) {
  const htmlText = stripHtml(note?.content || '')
  if (htmlText) return htmlText
  return blocksToText(note?.blocks)
}

/**
 * Gather content from notes and PDFs based on test configuration.
 *
 * @param {Object} config - Test configuration
 * @param {Array} subjects - All subjects array
 * @returns {Object} - { notesContent, pdfContent, metadata }
 */
export function gatherContentForTest(config, subjects) {
  const { scope, subjectIds, topicIds } = config

  const notesContent = []
  const pdfContent = []
  const metadata = {
    subjects: [],
    topics: [],
  }

  // Filter subjects based on scope
  const selectedSubjects = subjects.filter((s) => subjectIds.includes(s.id))

  selectedSubjects.forEach((subject) => {
    metadata.subjects.push({
      id: subject.id,
      name: subject.name,
      color: subject.color,
      icon: subject.icon,
    })

    // Determine which topics to include
    let topicsToInclude = subject.topics

    if (scope === 'topic' && topicIds && topicIds.length > 0) {
      // Only specific topics
      topicsToInclude = subject.topics.filter((t) => topicIds.includes(t.id))
    }

    topicsToInclude.forEach((topic) => {
      metadata.topics.push({
        id: topic.id,
        name: topic.name,
        subjectId: subject.id,
        subjectName: subject.name,
      })

      // Gather notes content
      topic.notes.forEach((note) => {
        const noteText = getNotePlainText(note)
        if (noteText) {
          notesContent.push({
            title: note.title,
            content: noteText,
            topicId: topic.id,
            topicName: topic.name,
            subjectId: subject.id,
            subjectName: subject.name,
          })
        }
      })
    })

    // Gather PDF content (summaries)
    if (subject.pdfs && subject.pdfs.length > 0) {
      subject.pdfs.forEach((pdf) => {
        if (pdf.summary) {
          pdfContent.push({
            title: pdf.title || pdf.name || 'Attached PDF',
            summary: pdf.summary,
            subjectId: subject.id,
            subjectName: subject.name,
          })
        }
      })
    }
  })

  return {
    notesContent,
    pdfContent,
    metadata,
  }
}

/**
 * Build AI prompt for Gemini API to generate test questions.
 *
 * @param {Object} config - Test configuration
 * @param {Object} content - Gathered content from gatherContentForTest
 * @returns {String} - Formatted prompt for AI
 */
export function buildAIPrompt(config, content, promptOptions = {}) {
  const { questionCount, difficulty } = config
  const { notesContent, pdfContent, metadata } = content
  const options = {
    ...DEFAULT_PROMPT_OPTIONS,
    ...(promptOptions && typeof promptOptions === 'object' ? promptOptions : {}),
  }
  const maxNotes = clampPositiveInteger(options.maxNotes, DEFAULT_PROMPT_OPTIONS.maxNotes)
  const maxPdfs = clampPositiveInteger(options.maxPdfs, DEFAULT_PROMPT_OPTIONS.maxPdfs)
  const noteCharLimit = clampPositiveInteger(options.noteCharLimit, DEFAULT_PROMPT_OPTIONS.noteCharLimit)
  const pdfCharLimit = clampPositiveInteger(options.pdfCharLimit, DEFAULT_PROMPT_OPTIONS.pdfCharLimit)
  let remainingBudget = clampPositiveInteger(
    options.totalContextChars,
    DEFAULT_PROMPT_OPTIONS.totalContextChars
  )

  // Build context from notes
  let notesContext = ''
  if (notesContent.length > 0) {
    notesContext = 'NOTES CONTENT:\n\n'

    notesContent.slice(0, maxNotes).forEach((note, index) => {
      if (remainingBudget <= 0) return

      const noteHeader = `--- Note ${index + 1}: ${note.title} (${note.subjectName} - ${note.topicName}) ---\n`
      const availableChars = Math.max(180, remainingBudget - noteHeader.length)
      const trimmedContent = truncateText(note.content, Math.min(noteCharLimit, availableChars))
      if (!trimmedContent) return

      notesContext += `${noteHeader}${trimmedContent}\n\n`
      remainingBudget -= noteHeader.length + trimmedContent.length
    })
  }

  // Build context from PDFs
  let pdfContext = ''
  if (pdfContent.length > 0 && remainingBudget > 0) {
    pdfContext = 'PDF SUMMARIES:\n\n'

    pdfContent.slice(0, maxPdfs).forEach((pdf, index) => {
      if (remainingBudget <= 0) return

      const pdfHeader = `--- PDF ${index + 1}: ${pdf.title} (${pdf.subjectName}) ---\n`
      const availableChars = Math.max(140, remainingBudget - pdfHeader.length)
      const trimmedSummary = truncateText(pdf.summary, Math.min(pdfCharLimit, availableChars))
      if (!trimmedSummary) return

      pdfContext += `${pdfHeader}${trimmedSummary}\n\n`
      remainingBudget -= pdfHeader.length + trimmedSummary.length
    })
  }

  // Build subject/topic info
  const subjectNames = metadata.subjects.map((s) => s.name).join(', ')
  const topicNames = metadata.topics.map((t) => `${t.name} (${t.subjectName})`).join(', ')

  // Difficulty description
  let difficultyGuide = ''
  switch (difficulty) {
    case 'easy':
      difficultyGuide = 'Focus on basic definitions, fundamental concepts, and straightforward recall questions.'
      break
    case 'medium':
      difficultyGuide = 'Include application-based questions, problem-solving, and conceptual understanding.'
      break
    case 'hard':
      difficultyGuide = 'Create challenging questions requiring deep analysis, critical thinking, and complex problem-solving.'
      break
    case 'mixed':
      difficultyGuide = `Create a balanced mix: ${Math.ceil(questionCount * 0.3)} easy, ${Math.ceil(questionCount * 0.5)} medium, and ${Math.floor(questionCount * 0.2)} hard questions.`
      break
    default:
      difficultyGuide = 'Use a balanced mix of concept, application, and reasoning questions.'
      break
  }

  return `You are an expert educator creating a ${difficulty} difficulty test for students.

SUBJECT(S): ${subjectNames}
TOPIC(S): ${topicNames}

${notesContext}

${pdfContext}

TASK:
Generate exactly ${questionCount} multiple-choice questions based ONLY on the content provided above.

DIFFICULTY LEVEL: ${difficulty}
${difficultyGuide}

REQUIREMENTS:
1. Each question MUST have exactly 4 options labeled A, B, C, D.
2. Only ONE option should be correct.
3. Questions should test understanding, application, and critical thinking.
4. Include variety: definitions, calculations, applications, analysis.
5. Make incorrect options plausible but clearly wrong.
6. Provide a concise explanation (1-2 short sentences) for why the correct answer is right.
7. Base ALL questions on the actual content provided - do not add external information.
8. For mixed difficulty, mark each question's difficulty level.
9. correctAnswer must be one of: "a", "b", "c", "d" (lowercase).

OUTPUT FORMAT (Strict JSON):
Return ONLY a valid JSON array with this exact structure:

[
  {
    "question": "What is the derivative of f(x) = x²?",
    "options": [
      {"id": "a", "text": "2x"},
      {"id": "b", "text": "x"},
      {"id": "c", "text": "2"},
      {"id": "d", "text": "x²"}
    ],
    "correctAnswer": "a",
    "explanation": "Using the power rule d/dx[xⁿ] = nxⁿ⁻¹, we get d/dx[x²] = 2x¹ = 2x. The power rule is fundamental in calculus for finding derivatives of polynomial functions.",
    "difficulty": "easy"
  }
]

CRITICAL: Return ONLY the JSON array, no additional text, no markdown formatting, no code blocks.`
}

function tryParseJson(rawText) {
  try {
    return JSON.parse(rawText)
  } catch {
    return null
  }
}

function repairJsonText(rawText) {
  let repaired = String(rawText || '').trim()
  if (!repaired) return repaired

  // Normalize smart quotes.
  repaired = repaired
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")

  // Replace JS-style literals with JSON-safe values.
  repaired = repaired
    .replace(/\bundefined\b/g, 'null')
    .replace(/\bNaN\b/g, 'null')
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')

  // Quote unquoted object keys: { question: ... } -> { "question": ... }
  repaired = repaired.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_\- ]*)(\s*:)/g, (_, start, key, end) => {
    const safeKey = key.trim().replace(/"/g, '\\"')
    return `${start}"${safeKey}"${end}`
  })

  // Convert single-quoted strings to double-quoted strings.
  repaired = repaired.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => {
    const unescaped = inner.replace(/\\'/g, "'")
    return JSON.stringify(unescaped)
  })

  // Remove trailing commas before } or ]
  repaired = repaired.replace(/,\s*([}\]])/g, '$1')

  return repaired
}

function extractJsonString(rawText) {
  const trimmed = String(rawText || '').trim()
  if (!trimmed) return ''

  // Remove common markdown fences.
  const cleaned = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  if (tryParseJson(cleaned) !== null) {
    return cleaned
  }

  // Try extracting JSON array first.
  const firstArrayStart = cleaned.indexOf('[')
  const lastArrayEnd = cleaned.lastIndexOf(']')
  if (firstArrayStart !== -1 && lastArrayEnd > firstArrayStart) {
    const arrayCandidate = cleaned.slice(firstArrayStart, lastArrayEnd + 1)
    if (tryParseJson(arrayCandidate) !== null) {
      return arrayCandidate
    }
  }

  // Try extracting JSON object wrapper.
  const firstObjectStart = cleaned.indexOf('{')
  const lastObjectEnd = cleaned.lastIndexOf('}')
  if (firstObjectStart !== -1 && lastObjectEnd > firstObjectStart) {
    const objectCandidate = cleaned.slice(firstObjectStart, lastObjectEnd + 1)
    if (tryParseJson(objectCandidate) !== null) {
      return objectCandidate
    }
  }

  return cleaned
}

function extractQuestionsArray(parsedPayload) {
  if (Array.isArray(parsedPayload)) return parsedPayload
  if (Array.isArray(parsedPayload?.questions)) return parsedPayload.questions
  if (Array.isArray(parsedPayload?.data?.questions)) return parsedPayload.data.questions
  throw new Error('Response JSON does not contain a questions array')
}

function normalizeDifficulty(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'easy' || normalized === 'medium' || normalized === 'hard') {
    return normalized
  }
  return 'medium'
}

function normalizeOptionText(option) {
  if (typeof option === 'string') return option.trim()
  if (typeof option?.text === 'string') return option.text.trim()
  return ''
}

function normalizeOptionsFromObject(optionsObject) {
  if (!optionsObject || typeof optionsObject !== 'object' || Array.isArray(optionsObject)) {
    return []
  }

  const texts = OPTION_IDS.map((id, index) => {
    const upper = id.toUpperCase()
    return normalizeOptionText(
      optionsObject[id]
      ?? optionsObject[upper]
      ?? optionsObject[`option${upper}`]
      ?? optionsObject[`option_${id}`]
      ?? optionsObject[String(index + 1)]
    )
  })

  if (texts.some((text) => !text)) return []

  return texts.map((text, index) => ({
    id: OPTION_IDS[index],
    text,
  }))
}

function normalizeOptionsFromString(optionsText) {
  if (typeof optionsText !== 'string') return []

  const lines = optionsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  const optionsById = {}
  lines.forEach((line) => {
    const match = line.match(/^[\-\*\d\.\)\s]*([A-Da-d])[)\].:\-]\s*(.+)$/)
    if (!match) return
    const id = match[1].toLowerCase()
    optionsById[id] = match[2].trim()
  })

  if (OPTION_IDS.some((id) => !optionsById[id])) return []

  return OPTION_IDS.map((id) => ({
    id,
    text: optionsById[id],
  }))
}

function normalizeOptionsFromLegacyFields(question) {
  const texts = OPTION_IDS.map((id) => {
    const upper = id.toUpperCase()
    return normalizeOptionText(
      question?.[`option${upper}`]
      ?? question?.[`option_${id}`]
      ?? question?.[`option_${upper}`]
    )
  })

  if (texts.some((text) => !text)) return []

  return texts.map((text, index) => ({
    id: OPTION_IDS[index],
    text,
  }))
}

function getNormalizedOptions(question, questionIndex) {
  // Preferred: options array
  if (Array.isArray(question?.options) && question.options.length >= 4) {
    return question.options.slice(0, 4).map((option, optionIndex) => {
      const text = normalizeOptionText(option)
      if (!text) {
        throw new Error(`Question ${questionIndex + 1}, option ${optionIndex + 1} missing text`)
      }
      return {
        id: OPTION_IDS[optionIndex],
        text,
      }
    })
  }

  // options object map
  const fromObject = normalizeOptionsFromObject(question?.options)
  if (fromObject.length === 4) return fromObject

  // options plain string block
  const fromString = normalizeOptionsFromString(question?.options)
  if (fromString.length === 4) return fromString

  // optionA/optionB/... legacy fields
  const fromLegacyFields = normalizeOptionsFromLegacyFields(question)
  if (fromLegacyFields.length === 4) return fromLegacyFields

  throw new Error(`Question ${questionIndex + 1} must include 4 valid options`)
}

function resolveCorrectIndex(correctAnswer, options) {
  if (typeof correctAnswer === 'number' && Number.isInteger(correctAnswer)) {
    return correctAnswer >= 0 && correctAnswer < 4 ? correctAnswer : -1
  }

  const raw = String(correctAnswer || '').trim().toLowerCase()
  if (!raw) return -1

  // Supports "a", "A", "option a", "a)", "(a)".
  const letterMatch = raw.match(/[a-d]/)
  if (letterMatch) {
    const index = OPTION_IDS.indexOf(letterMatch[0])
    if (index !== -1) return index
  }

  // Supports exact option text as correctAnswer.
  const textIndex = options.findIndex((opt) => opt.text.trim().toLowerCase() === raw)
  if (textIndex !== -1) return textIndex

  return -1
}

/**
 * Parse and validate AI response from Gemini.
 *
 * @param {String} responseText - Raw response from Gemini API
 * @returns {Array} - Validated array of questions
 */
export function parseAIResponse(responseText) {
  try {
    const jsonText = extractJsonString(responseText)
    const parsedPayload = tryParseJson(jsonText) ?? tryParseJson(repairJsonText(jsonText))

    if (parsedPayload === null) {
      throw new Error('Response is not valid JSON')
    }

    const questions = extractQuestionsArray(parsedPayload)

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Response does not contain questions')
    }

    const validated = questions.map((question, index) => {
      if (!question?.question || typeof question.question !== 'string') {
        throw new Error(`Question ${index + 1} missing or invalid question text`)
      }
      if (!question?.explanation || typeof question.explanation !== 'string') {
        throw new Error(`Question ${index + 1} missing explanation`)
      }
      const normalizedOptions = getNormalizedOptions(question, index)

      const correctIndex = resolveCorrectIndex(question.correctAnswer, normalizedOptions)
      if (correctIndex === -1) {
        throw new Error(`Question ${index + 1} has invalid correctAnswer`)
      }

      return {
        question: question.question.trim(),
        options: normalizedOptions,
        correctAnswer: OPTION_IDS[correctIndex],
        explanation: question.explanation.trim(),
        difficulty: normalizeDifficulty(question.difficulty),
      }
    })

    return validated
  } catch (error) {
    console.error('Failed to parse AI response:', error)
    throw new Error(`Failed to parse AI-generated questions: ${error.message}`)
  }
}
