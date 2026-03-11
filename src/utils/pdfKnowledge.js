import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()

const MAX_STORED_TEXT_CHARS = 18_000
const DEFAULT_CHUNK_SIZE = 900
const DEFAULT_CHUNK_OVERLAP = 140
const DEFAULT_REFERENCE_MAX_CHARS = 2_800
const DEFAULT_REFERENCE_MAX_CHUNKS = 3
const LINE_POSITION_ROUNDING = 2

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
  'you',
  'your',
])

const REFERENCE_HEADINGS = new Set([
  'references',
  'reference',
  'bibliography',
  'works cited',
  'sources',
])

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\u0000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeBorderCandidate(text) {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/\b\d+\b/g, '#')
}

function roundLinePosition(value) {
  return Math.round(Number(value || 0) * LINE_POSITION_ROUNDING) / LINE_POSITION_ROUNDING
}

function isPageNumberLine(text) {
  const normalized = normalizeWhitespace(text).toLowerCase()
  if (!normalized) return false

  return (
    /^\d+$/.test(normalized) ||
    /^-?\s*\d+\s*-?$/.test(normalized) ||
    /^page\s+\d+(\s+of\s+\d+)?$/.test(normalized) ||
    /^[ivxlcdm]{1,8}$/.test(normalized)
  )
}

function isReferenceHeading(text) {
  const normalized = normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[:.]+$/, '')

  return REFERENCE_HEADINGS.has(normalized)
}

function dedupeConsecutiveLines(lines) {
  const result = []

  lines.forEach((line) => {
    if (!line || result[result.length - 1] === line) return
    result.push(line)
  })

  return result
}

function extractPageLines(textContent) {
  const rows = new Map()
  const items = Array.isArray(textContent?.items) ? textContent.items : []

  items.forEach((item) => {
    const text = normalizeWhitespace('str' in item ? item.str : '')
    if (!text) return

    const transform = Array.isArray(item.transform) ? item.transform : []
    const x = Number(transform[4] || 0)
    const y = roundLinePosition(transform[5] || 0)
    const key = String(y)
    const row = rows.get(key) || { y, parts: [] }

    row.parts.push({ x, text })
    rows.set(key, row)
  })

  return Array.from(rows.values())
    .sort((left, right) => right.y - left.y)
    .map((row) =>
      normalizeWhitespace(
        row.parts
          .sort((left, right) => left.x - right.x)
          .map((part) => part.text)
          .join(' ')
      )
    )
    .filter(Boolean)
}

function collectRepeatedBorderLines(pageLines) {
  if (pageLines.length < 2) return new Set()

  const counts = new Map()

  pageLines.forEach((lines) => {
    const seen = new Set()
    const borderLines = [...lines.slice(0, 2), ...lines.slice(-2)]

    borderLines.forEach((line) => {
      const normalized = normalizeBorderCandidate(line)
      if (!normalized || normalized.length < 4 || isPageNumberLine(line)) return
      seen.add(normalized)
    })

    seen.forEach((normalized) => {
      counts.set(normalized, (counts.get(normalized) || 0) + 1)
    })
  })

  const minHits = Math.max(2, Math.ceil(pageLines.length * 0.35))

  return new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count >= minHits)
      .map(([normalized]) => normalized)
  )
}

function buildCompressedLines(pageLines) {
  const repeatedBorderLines = collectRepeatedBorderLines(pageLines)

  const cleaned = pageLines.flatMap((lines) =>
    lines.filter((line) => {
      if (!line) return false
      if (isPageNumberLine(line)) return false
      return !repeatedBorderLines.has(normalizeBorderCandidate(line))
    })
  )

  const withoutReferences = (() => {
    const referenceStartIndex = cleaned.findIndex((line, index) => {
      if (index < Math.floor(cleaned.length * 0.6)) return false
      return isReferenceHeading(line)
    })

    if (referenceStartIndex === -1) return cleaned
    return cleaned.slice(0, referenceStartIndex)
  })()

  return dedupeConsecutiveLines(withoutReferences)
}

function buildExtractiveSummary(text, maxChars = 420) {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return ''

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  if (sentences.length === 0) {
    return normalized.slice(0, maxChars)
  }

  const summaryParts = []
  let charCount = 0

  for (const sentence of sentences) {
    const nextLength = charCount + sentence.length + (summaryParts.length > 0 ? 1 : 0)
    if (nextLength > maxChars && summaryParts.length > 0) break
    summaryParts.push(sentence)
    charCount = nextLength
    if (summaryParts.length >= 3) break
  }

  return summaryParts.join(' ').slice(0, maxChars)
}

function splitIntoChunks(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return []

  const chunks = []
  let start = 0
  let order = 0

  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + chunkSize)

    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf(' ', end)
      if (boundary > start + Math.floor(chunkSize * 0.6)) {
        end = boundary
      }
    }

    const chunkText = normalized.slice(start, end).trim()
    if (chunkText) {
      chunks.push({
        id: `chunk-${order + 1}`,
        order,
        text: chunkText,
        charCount: chunkText.length,
      })
      order += 1
    }

    if (end >= normalized.length) break
    start = Math.max(end - overlap, start + 1)
  }

  return chunks
}

function tokenizeSearchText(value) {
  return Array.from(
    new Set(
      normalizeWhitespace(value)
        .toLowerCase()
        .match(/[a-z0-9]{3,}/g) || []
    )
  ).filter((token) => !STOP_WORDS.has(token))
}

function scoreChunk(chunk, searchTerms) {
  if (searchTerms.length === 0) return 0

  const text = String(chunk?.text || '').toLowerCase()
  let score = 0

  searchTerms.forEach((term) => {
    if (!text.includes(term)) return
    score += 1

    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
    const matches = text.match(regex)
    if (matches?.length) {
      score += matches.length
    }
  })

  return score
}

function pickRelevantChunks(chunks, searchTerms, maxChunks, maxChars) {
  if (!Array.isArray(chunks) || chunks.length === 0) return []

  const ranked = chunks
    .map((chunk) => ({
      ...chunk,
      relevanceScore: scoreChunk(chunk, searchTerms),
    }))
    .sort((left, right) => {
      if (right.relevanceScore !== left.relevanceScore) {
        return right.relevanceScore - left.relevanceScore
      }
      return left.order - right.order
    })

  const candidates = ranked.some((item) => item.relevanceScore > 0)
    ? ranked
    : chunks.map((chunk) => ({ ...chunk, relevanceScore: 0 }))

  const selected = []
  let totalChars = 0

  for (const chunk of candidates) {
    if (selected.length >= maxChunks) break
    if (totalChars >= maxChars) break
    selected.push(chunk)
    totalChars += chunk.charCount || chunk.text.length
  }

  return selected.sort((left, right) => left.order - right.order)
}

export async function extractPdfKnowledgeFromFile(file) {
  const buffer = await file.arrayBuffer()
  const documentTask = getDocument({
    data: buffer,
    useWorkerFetch: false,
    isEvalSupported: false,
  })
  const pdfDocument = await documentTask.promise
  const pageLines = []

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const lines = extractPageLines(textContent)

    if (lines.length > 0) {
      pageLines.push(lines)
    }
  }

  const compressedLines = buildCompressedLines(pageLines)
  const compressedText = compressedLines.join('\n')
  const storedText = compressedText.slice(0, MAX_STORED_TEXT_CHARS)
  const chunks = splitIntoChunks(storedText)

  return {
    pageCount: pdfDocument.numPages,
    fullTextLength: compressedText.length,
    storedCharCount: storedText.length,
    summary: buildExtractiveSummary(storedText),
    preview: storedText.slice(0, 700),
    chunks,
  }
}

export function buildPdfReferenceMaterial({
  pdfName,
  summary,
  chunks,
}) {
  const parts = [
    `Reference PDF: ${pdfName}`,
  ]

  if (summary) {
    parts.push(`Compressed Summary: ${summary}`)
  }

  if (Array.isArray(chunks) && chunks.length > 0) {
    parts.push('Relevant PDF Excerpts:')
    chunks.forEach((chunk, index) => {
      parts.push(`[Excerpt ${index + 1}] ${chunk.text}`)
    })
  }

  return parts.join('\n\n')
}

export function selectRelevantPdfChunks({
  chunks,
  question,
  extraContext = '',
  maxChars = DEFAULT_REFERENCE_MAX_CHARS,
  maxChunks = DEFAULT_REFERENCE_MAX_CHUNKS,
}) {
  const searchTerms = tokenizeSearchText(`${question} ${extraContext}`)
  return pickRelevantChunks(chunks, searchTerms, maxChunks, maxChars)
}
