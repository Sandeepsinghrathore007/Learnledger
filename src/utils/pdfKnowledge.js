import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()

const MAX_STORED_TEXT_CHARS = 24_000
const DEFAULT_CHUNK_SIZE = 1_100
const DEFAULT_CHUNK_OVERLAP = 180
const DEFAULT_REFERENCE_MAX_CHARS = 3_600
const DEFAULT_REFERENCE_MAX_CHUNKS = 4

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

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\u0000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildExtractiveSummary(text, maxChars = 520) {
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

  const pageTexts = []

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const pageText = normalizeWhitespace(
      textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
    )

    if (pageText) {
      pageTexts.push(pageText)
    }
  }

  const fullText = pageTexts.join('\n\n')
  const storedText = fullText.slice(0, MAX_STORED_TEXT_CHARS)
  const chunks = splitIntoChunks(storedText)

  return {
    pageCount: pdfDocument.numPages,
    fullTextLength: fullText.length,
    storedCharCount: storedText.length,
    summary: buildExtractiveSummary(storedText),
    preview: storedText.slice(0, 800),
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
    parts.push(`Stored Summary: ${summary}`)
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
