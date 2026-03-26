const SECTION_CONFIG = [
  {
    key: 'concept',
    label: 'Concept',
    pattern: /concept(?:\s*\(.*?\))?\s*:/i,
  },
  {
    key: 'whyCorrect',
    label: 'Why Correct',
    pattern: /why\s*correct(?:\s*answer)?\s*:/i,
  },
  {
    key: 'optionsBreakdown',
    label: 'Options Breakdown',
    pattern: /(?:options\s*breakdown|why\s*others\s*wrong)\s*:/i,
  },
  {
    key: 'extraKnowledge',
    label: 'Extra Knowledge',
    pattern: /extra\s*knowledge\s*:/i,
  },
]

const SECTION_HEADING_PATTERN = '(Concept(?:\\s*\\(.*?\\))?\\s*:|Why\\s*Correct(?:\\s*Answer)?\\s*:|Options\\s*Breakdown\\s*:|Why\\s*Others\\s*Wrong\\s*:|Extra\\s*Knowledge\\s*:)'

function normalizeLineBreaks(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeInlineWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getSectionConfig(rawHeading) {
  const heading = String(rawHeading || '').trim()
  return SECTION_CONFIG.find((section) => section.pattern.test(heading)) || null
}

function isKnownHeadingLine(line) {
  const normalizedLine = String(line || '').trim()
  return SECTION_CONFIG.some((section) => normalizedLine.toLowerCase() === `${section.label.toLowerCase()}:`)
}

function formatSectionBody(value) {
  return normalizeLineBreaks(value)
    .split('\n')
    .map((line) => normalizeInlineWhitespace(line))
    .filter(Boolean)
    .join('\n')
}

function formatOptionsBreakdown(value) {
  const normalizedValue = normalizeLineBreaks(value)
  if (!normalizedValue) return ''

  const flattened = normalizeInlineWhitespace(normalizedValue)
  const optionMatches = Array.from(
    flattened.matchAll(/(?:^|\s)([A-D])[\.\)]\s*([\s\S]*?)(?=(?:\s+[A-D][\.\)]\s*)|$)/g)
  )

  if (optionMatches.length > 0) {
    return optionMatches
      .map(([, optionId, optionText]) => `${optionId}. ${normalizeInlineWhitespace(optionText)}`)
      .join('\n')
  }

  return normalizedValue
    .replace(/(?:^|\s)([A-D])[\.\)]\s*/g, '\n$1. ')
    .split('\n')
    .map((line) => normalizeInlineWhitespace(line))
    .filter(Boolean)
    .join('\n')
}

export function normalizeStructuredExplanation(rawExplanation) {
  const explanation = normalizeLineBreaks(rawExplanation)
  if (!explanation) return ''

  const matches = Array.from(explanation.matchAll(new RegExp(SECTION_HEADING_PATTERN, 'ig')))
    .map((match) => {
      const config = getSectionConfig(match[0])
      if (!config) return null

      return {
        key: config.key,
        label: config.label,
        index: match.index || 0,
        endIndex: (match.index || 0) + match[0].length,
      }
    })
    .filter(Boolean)

  if (matches.length === 0) {
    return explanation
  }

  const sections = matches.map((match, index) => {
    const nextIndex = matches[index + 1]?.index ?? explanation.length
    const rawSectionBody = explanation.slice(match.endIndex, nextIndex)
    const body = match.key === 'optionsBreakdown'
      ? formatOptionsBreakdown(rawSectionBody)
      : formatSectionBody(rawSectionBody)

    return body ? `${match.label}:\n${body}` : `${match.label}:`
  })

  return sections.join('\n\n').trim()
}

function extractSectionContent(lines, label) {
  const heading = `${label.toLowerCase()}:`
  const index = lines.findIndex((line) => String(line || '').trim().toLowerCase().startsWith(heading))
  if (index === -1) return ''

  const inlineContent = String(lines[index] || '')
    .replace(new RegExp(`^${label}:\\s*`, 'i'), '')
    .trim()

  if (inlineContent) {
    return inlineContent
  }

  for (let lineIndex = index + 1; lineIndex < lines.length; lineIndex += 1) {
    const line = String(lines[lineIndex] || '').trim()
    if (!line) continue
    if (isKnownHeadingLine(line)) {
      return ''
    }
    return line
  }

  return ''
}

export function extractHintFromExplanation(rawExplanation) {
  const normalized = normalizeStructuredExplanation(rawExplanation)
  if (!normalized) {
    return 'Think about the fundamental concepts.'
  }

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const conceptHint = extractSectionContent(lines, 'Concept')
  if (conceptHint) {
    return conceptHint
  }

  const whyCorrectHint = extractSectionContent(lines, 'Why Correct')
  if (whyCorrectHint) {
    return whyCorrectHint
  }

  const firstContentLine = lines.find((line) => !isKnownHeadingLine(line))
  return firstContentLine || 'Think about the fundamental concepts.'
}
