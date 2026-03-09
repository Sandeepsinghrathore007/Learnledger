import { compactWhitespace, trimToLength } from './text.js'

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

  return repaired
}

function extractJsonBlock(rawText) {
  const trimmed = String(rawText || '').trim()
  if (!trimmed) return ''

  const cleaned = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  if (tryParseJson(cleaned) !== null) return cleaned

  const firstObjectStart = cleaned.indexOf('{')
  const lastObjectEnd = cleaned.lastIndexOf('}')

  if (firstObjectStart !== -1 && lastObjectEnd > firstObjectStart) {
    return cleaned.slice(firstObjectStart, lastObjectEnd + 1)
  }

  return cleaned
}

function limitWords(text, maxWords) {
  const parts = compactWhitespace(text).split(' ')
  if (parts.length <= maxWords) return compactWhitespace(text)
  return parts.slice(0, maxWords).join(' ').trim()
}

function parseKeyPoints(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => compactWhitespace(item))
      .filter(Boolean)
      .slice(0, 5)
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((line) => compactWhitespace(line.replace(/^[-•\d.)\s]+/, '')))
      .filter(Boolean)
      .slice(0, 5)
  }

  return []
}

export function parseStructuredStudyResponse(rawText) {
  const jsonText = extractJsonBlock(rawText)
  const parsed = tryParseJson(jsonText) ?? tryParseJson(repairJsonText(jsonText))

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI returned invalid JSON payload')
  }

  const title = limitWords(trimToLength(parsed.title || parsed.topicTitle || '', 90), 12)
  const explanation = limitWords(trimToLength(parsed.explanation || parsed.shortExplanation || '', 900), 120)
  const keyPoints = parseKeyPoints(parsed.keyPoints || parsed.key_points || parsed.points)
  const example = limitWords(trimToLength(parsed.example || parsed.illustration || '', 420), 60)
  const summary = limitWords(trimToLength(parsed.summary || parsed.conclusion || '', 220), 30)

  if (!title || !explanation || keyPoints.length < 3 || !example || !summary) {
    throw new Error('AI response was incomplete for required note fields')
  }

  return {
    title,
    explanation,
    keyPoints,
    example,
    summary,
  }
}
