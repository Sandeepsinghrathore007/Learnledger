const QUESTION_START_PATTERNS = [
  /(?:^|\n)\s*(?:q(?:uestion)?\s*)?\d{1,3}(?:\s*[\).:\-]\s*|\s+|(?=[A-Za-z]))/gi,
  /(?:^|\n)\s*(?:q(?:uestion)?\s*)?[ivxlcdm]{1,8}(?:\s*[\).:\-]\s*|\s+)(?=[A-Za-z0-9])/gi,
  /(?:^|\n)\s*[A-Z]\d{0,2}(?:\s*[\).:\-]\s*|\s+)(?=[A-Za-z0-9])/g,
]
const BOOKLET_ARABIC_QUESTION_PATTERN = /(?:^|\n|\f)[ \t]{0,4}(\d{1,3})\.\s+/gm
const SEQUENTIAL_ARABIC_QUESTION_PATTERN = /(?:^|\n)\s*(\d{1,3})(?:\s*[\).:\-]\s*|\s+|(?=[A-Za-z]))/gim

function normalizeLineBreaks(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function cleanQuestionBlock(block) {
  const normalized = String(block || '')
    .replace(
      /^\s*(?:q(?:uestion)?\s*)?(?:\d{1,3}|[ivxlcdm]{1,8}|[A-Z]\d{0,2})(?:\s*[\).:\-]\s*|\s+|(?=[A-Za-z]))/i,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim()

  const trailingNoiseMarkers = [
    'SPACE FOR ROUGH WORK',
    'rough work',
    'Answer Sheet',
    'answer sheet',
  ]

  let cutIndex = normalized.length
  trailingNoiseMarkers.forEach((marker) => {
    const markerIndex = normalized.indexOf(marker)
    if (markerIndex !== -1) {
      cutIndex = Math.min(cutIndex, markerIndex)
    }
  })

  return normalized.slice(0, cutIndex).trim()
}

function extractExpectedQuestionCount(text) {
  const match = text.match(
    /\b(?:number\s+of\s+questions(?:\s+in\s+booklet)?|total\s+questions(?:\s+in\s+booklet)?)\s*:\s*(\d{1,3})\b/i
  )

  const count = Number(match?.[1] || 0)
  return Number.isFinite(count) && count > 0 ? count : null
}

function getDigitStartIndex(match) {
  const raw = String(match?.[0] || '')
  const digitIndex = raw.search(/\d/)
  return (match?.index || 0) + Math.max(0, digitIndex)
}

function extractSequentialArabicQuestionBlocks(text, pattern) {
  const matches = Array.from(text.matchAll(pattern))
    .map((match) => ({
      start: getDigitStartIndex(match),
      number: Number(match[1]),
    }))
    .filter((match) => Number.isFinite(match.number))

  if (matches.length < 2) return []

  const matchesWithBoundaries = matches.map((match, index) => ({
    ...match,
    nextStart: matches[index + 1]?.start || text.length,
  }))

  const runs = []
  let currentRun = [matchesWithBoundaries[0]]

  for (let index = 1; index < matchesWithBoundaries.length; index += 1) {
    const previous = matchesWithBoundaries[index - 1]
    const current = matchesWithBoundaries[index]

    if (current.number === previous.number + 1) {
      currentRun.push(current)
      continue
    }

    runs.push(currentRun)
    currentRun = [current]
  }

  if (currentRun.length > 0) {
    runs.push(currentRun)
  }

  const expectedCount = extractExpectedQuestionCount(text)
  const bestRun = runs
    .map((run) => ({
      run,
      startNumber: run[0]?.number || 0,
      length: run.length,
      score:
        run.length * 100
        + (run[0]?.number === 1 ? 50 : 0)
        + (
          expectedCount && run[0]?.number === 1
            ? Math.max(0, 40 - Math.abs(expectedCount - run.length))
            : 0
        ),
    }))
    .sort((left, right) => right.score - left.score)[0]?.run || []

  if (bestRun.length < 2) return []

  const blocks = bestRun
    .map((entry) => text.slice(entry.start, entry.nextStart))
    .map(cleanQuestionBlock)
    .filter((block) => block.length >= 8)

  if (expectedCount && blocks.length >= expectedCount && bestRun[0]?.number === 1) {
    return blocks.slice(0, expectedCount)
  }

  return blocks
}

function sliceQuestionBlocks(text, pattern) {
  const starts = []

  for (const match of text.matchAll(pattern)) {
    starts.push(match.index || 0)
  }

  if (starts.length < 2) return []

  return starts
    .map((start, index) => text.slice(start, starts[index + 1] || text.length))
    .map(cleanQuestionBlock)
    .filter((block) => block.length >= 8)
}

function splitByQuestionMarks(text) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean)

  const collected = []

  paragraphs.forEach((paragraph) => {
    const lines = paragraph
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length === 1 && /\?$/.test(lines[0])) {
      collected.push(cleanQuestionBlock(lines[0]))
      return
    }

    const joined = lines.join(' ')
    if (/\?$/.test(joined)) {
      collected.push(cleanQuestionBlock(joined))
    }
  })

  return collected.filter((entry) => entry.length >= 8)
}

export function extractQuestionBlocksFromText(rawText) {
  const text = normalizeLineBreaks(rawText)
  if (!text) return []

  const bookletBlocks = extractSequentialArabicQuestionBlocks(text, BOOKLET_ARABIC_QUESTION_PATTERN)
  if (bookletBlocks.length >= 2) {
    return bookletBlocks
  }

  const sequentialArabicBlocks = extractSequentialArabicQuestionBlocks(text, SEQUENTIAL_ARABIC_QUESTION_PATTERN)
  if (sequentialArabicBlocks.length >= 2) {
    return sequentialArabicBlocks
  }

  for (const pattern of QUESTION_START_PATTERNS) {
    const blocks = sliceQuestionBlocks(text, pattern)
    if (blocks.length >= 2) return blocks
  }

  const byQuestionMarks = splitByQuestionMarks(text)
  if (byQuestionMarks.length > 0) return byQuestionMarks

  return text
    .split(/\n{2,}/)
    .map(cleanQuestionBlock)
    .filter((block) => block.length >= 12)
}

function buildAllowedTopicLines(subjects) {
  return subjects
    .map((subject) => {
      const topicNames = Array.isArray(subject?.topics)
        ? subject.topics
            .map((topic) => String(topic?.name || '').trim())
            .filter(Boolean)
            .slice(0, 24)
        : []

      return `- ${subject.name}${topicNames.length > 0 ? ` -> ${topicNames.join(', ')}` : ''}`
    })
    .join('\n')
}

export function buildExamPrompt({
  examTitle,
  questionBlocks,
  linkedSubjects = [],
  sourceLabel = 'Pasted Text',
  language = 'english',
}) {
  const totalQuestions = questionBlocks.length
  const normalizedLanguage = language === 'hindi' ? 'hindi' : 'english'
  const languageLabel = normalizedLanguage === 'hindi' ? 'Hindi' : 'English'
  const subjectNames = linkedSubjects
    .map((subject) => String(subject?.name || '').trim())
    .filter(Boolean)
    .join(', ')
  const allowedTopics = buildAllowedTopicLines(linkedSubjects)
  const languageInstruction = normalizedLanguage === 'hindi'
    ? 'Write question, options, and explanation in Hindi using Devanagari script. Do not use Romanized Hindi.'
    : 'Write question, options, and explanation in natural English.'
  const subjectInstruction = linkedSubjects.length > 0
    ? `Choose subjectName and topicName using only the allowed subjects/topics below when they clearly match. Use the exact same spellings as the allowed list. If unsure, keep subjectName and topicName as empty strings.\n\nALLOWED SUBJECTS AND TOPICS:\n${allowedTopics}`
    : 'Infer subjectName and topicName only if they are obvious from the question. Otherwise keep them as empty strings.'

  return `You are converting a user-provided exam/question paper into a solvable MCQ test.

EXAM TITLE: ${String(examTitle || 'Custom Exam').trim() || 'Custom Exam'}
SOURCE TYPE: ${sourceLabel}
TOTAL QUESTIONS: ${totalQuestions}
TARGET LANGUAGE: ${languageLabel}

${subjectInstruction}
${languageInstruction}

TASK:
Convert each extracted question below into exactly one MCQ entry.
Preserve the same order and return exactly ${totalQuestions} questions.
Do not merge questions, split questions, remove questions, or add extra questions.
If an extracted question already includes answer choices, keep the original intent but still normalize the output to 4 options labeled a-d.
If a question is subjective/open-ended, create 4 plausible answer options and mark the best answer.

REQUIREMENTS:
1. Return strict JSON only.
2. Each question must have:
   - question
   - options: 4 items with ids a, b, c, d
   - correctAnswer
   - explanation
   - difficulty: easy, medium, or hard
   - subjectName
   - topicName
3. correctAnswer must be one of "a", "b", "c", "d".
4. explanation should be concise but clear.
5. Keep subjectName/topicName empty when uncertain.

QUESTION LIST:
${questionBlocks.map((question, index) => `${index + 1}. ${question}`).join('\n')}

OUTPUT FORMAT:
[
  {
    "question": "Question text",
    "options": [
      {"id": "a", "text": "Option A"},
      {"id": "b", "text": "Option B"},
      {"id": "c", "text": "Option C"},
      {"id": "d", "text": "Option D"}
    ],
    "correctAnswer": "a",
    "explanation": "Why the answer is correct.",
    "difficulty": "medium",
    "subjectName": "",
    "topicName": ""
  }
]

CRITICAL: Return only the JSON array.`
}
