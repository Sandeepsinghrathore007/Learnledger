const COMPLEXITY_HINTS = [
  'derive',
  'prove',
  'compare',
  'difference between',
  'algorithm',
  'optimize',
  'case study',
  'numerical',
  'step by step',
]

function countWords(value = '') {
  const words = String(value).trim().split(/\s+/).filter(Boolean)
  return words.length
}

export function isComplexQuestion(question, subjectContext = '') {
  const text = `${question} ${subjectContext}`.toLowerCase()
  const wordCount = countWords(question)

  if (wordCount >= 45) return true
  return COMPLEXITY_HINTS.some((hint) => text.includes(hint))
}

export function buildModelOrder(
  { smallModel, largeModel },
  question,
  subjectContext,
  { hasReferenceMaterial = false } = {}
) {
  const unique = Array.from(new Set([smallModel, largeModel].filter(Boolean)))
  if (unique.length <= 1) return unique

  const complex = isComplexQuestion(question, subjectContext)

  if (complex || hasReferenceMaterial) {
    return [largeModel, smallModel].filter(Boolean)
  }

  return [smallModel, largeModel].filter(Boolean)
}
