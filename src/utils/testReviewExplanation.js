import { normalizeStructuredExplanation } from '@/utils/explanationFormatting'

const OPTION_IDS = new Set(['a', 'b', 'c', 'd'])

function normalizeJsonEnvelope(rawText) {
  return String(rawText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function extractJsonPayload(rawText) {
  const text = normalizeJsonEnvelope(rawText)
  if (!text) {
    throw new Error('AI returned an empty review response.')
  }

  try {
    return JSON.parse(text)
  } catch {
    const firstBracket = text.indexOf('[')
    const lastBracket = text.lastIndexOf(']')
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return JSON.parse(text.slice(firstBracket, lastBracket + 1))
    }

    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1))
    }

    throw new Error('AI did not return valid JSON for the review batch.')
  }
}

function getJsonArrayPayload(parsed) {
  if (Array.isArray(parsed)) {
    return parsed
  }

  if (Array.isArray(parsed?.items)) {
    return parsed.items
  }

  if (Array.isArray(parsed?.results)) {
    return parsed.results
  }

  if (Array.isArray(parsed?.questions)) {
    return parsed.questions
  }

  throw new Error('AI review response did not contain a JSON array.')
}

function formatQuestionOptions(options = []) {
  return options
    .map((option) => `${String(option?.id || '').trim().toUpperCase()}. ${String(option?.text || '').trim()}`)
    .filter(Boolean)
    .join('\n')
}

function buildPromptQuestionEntry(question, index) {
  return [
    `Question ${index + 1}`,
    `Question text: ${String(question?.question || '').trim()}`,
    `Options:\n${formatQuestionOptions(question?.options)}`,
  ].join('\n')
}

function normalizeCorrectAnswer(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/^option\s+/i, '')
  return normalized.slice(0, 1)
}

export function buildQuestionReviewBatchPrompt(questions) {
  return [
    'Return only one valid JSON array. No markdown. No commentary.',
    'For every question below, choose the single best correct option and generate explanation in STRICT structured format.',
    'Use this exact JSON format:',
    '[{"questionIndex":1,"correctAnswer":"A","explanation":"Concept:\\n...\\n\\nWhy Correct:\\n...\\n\\nOptions Breakdown:\\nA. ...\\nB. ...\\nC. ...\\nD. ...\\n\\nExtra Knowledge:\\n..."}]',
    'Rules:',
    '- Return one item for every question.',
    '- questionIndex must match the numbering shown below.',
    '- correctAnswer must be a single uppercase letter from the provided options only.',
    '- Generate explanation in Hinglish style but written in Hindi (Devanagari script).',
    '- Use Hindi script (Devanagari) for the explanation body.',
    '- Use a simple conversational teacher tone.',
    '- Common English words like option, concept, rule, formula, logic, process, law, method are allowed when they fit naturally.',
    '- Avoid pure English sentences. Avoid overly formal Hindi.',
    '- explanation must be specific to the question. Do not use generic lines. Do not merge everything into one paragraph.',
    '- explanation length should usually be 5 to 10 readable lines.',
    '- explanation must use these exact headings with explicit \\n line breaks: Concept:, Why Correct:, Options Breakdown:, Extra Knowledge:.',
    '- Under Concept, explain the core concept in 2 to 3 lines in simple Devanagari Hinglish.',
    '- Under Why Correct, explain clearly why the correct option fits the question.',
    '- Under Options Breakdown, write EACH option on a NEW LINE using A., B., C., D.',
    '- Under Options Breakdown, explain every option based on the question context. Example: if the topic is river, explain all options as rivers. If the topic is king, explain all options as kings. If the topic is polity, explain the options conceptually within polity context.',
    '- For wrong options, include what that option actually represents and the important exam-related fact linked to it.',
    '- Under Extra Knowledge, add 1 or 2 useful facts or recall points related to the topic.',
    '- If the wording is imperfect, still infer the best answer from the available options.',
    '- Style example:',
    'Concept:\\nयह question river-location concept पर based है।\\nयहाँ river की identity और उससे जुड़े static facts याद होने चाहिए।',
    'Why Correct:\\nNarmada west-flowing river है, इसलिए यहाँ correct option वही होगा जो इस fact और asked context से match करे।',
    'Options Breakdown:\\nA. Godavari -> South India की major river है और Bay of Bengal में गिरती है\\nB. Krishna -> Maharashtra, Karnataka और Andhra Pradesh में flow करती है\\nC. Tapi -> Central India की west-flowing river है, लेकिन asked fact से match नहीं करती\\nD. Narmada -> West-flowing river है और asked context इसी से linked है',
    'Extra Knowledge:\\nNarmada Vindhya और Satpura के बीच flow करती है। West-flowing rivers exam में frequently पूछी जाती हैं।',
    '',
    ...questions.map((question, index) => buildPromptQuestionEntry(question, index)),
  ].join('\n\n')
}

export function parseQuestionReviewBatchResponse(rawText) {
  const parsed = extractJsonPayload(rawText)
  const items = getJsonArrayPayload(parsed)
  const normalizedItems = []

  items.forEach((item) => {
    const questionIndex = Number.parseInt(
      item?.questionIndex ?? item?.index ?? item?.questionNumber,
      10
    )
    const correctAnswer = normalizeCorrectAnswer(item?.correctAnswer)
    const explanation = normalizeStructuredExplanation(item?.explanation)

    if (!Number.isInteger(questionIndex) || questionIndex < 1) {
      return
    }

    if (!OPTION_IDS.has(correctAnswer)) {
      return
    }

    if (!explanation) {
      return
    }

    normalizedItems.push({
      questionIndex,
      correctAnswer,
      explanation,
    })
  })

  if (normalizedItems.length === 0) {
    throw new Error('AI review response did not include any valid answer keys or explanations.')
  }

  return normalizedItems
}
