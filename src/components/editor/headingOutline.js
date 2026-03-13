export function slugifyHeadingText(text = '') {
  const normalized = String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return normalized || 'section'
}

function createHeadingIdRegistry() {
  const seenIds = new Map()

  return (text) => {
    const baseId = slugifyHeadingText(text)
    const count = seenIds.get(baseId) || 0
    seenIds.set(baseId, count + 1)
    return count === 0 ? baseId : `${baseId}-${count + 1}`
  }
}

function extractTextFromJsonNode(node) {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  if (!Array.isArray(node.content)) return ''
  return node.content.map(extractTextFromJsonNode).join('')
}

export function extractHeadingsFromJson(jsonDoc) {
  const createHeadingId = createHeadingIdRegistry()
  const headings = []

  const visit = (nodes) => {
    if (!Array.isArray(nodes)) return

    nodes.forEach((node) => {
      if (node.type === 'heading') {
        const level = Number(node.attrs?.level) || 1

        if (level >= 1 && level <= 3) {
          const text = extractTextFromJsonNode(node).trim() || 'Untitled section'
          headings.push({
            id: createHeadingId(text),
            text,
            level,
          })
        }
      }

      if (Array.isArray(node.content) && node.content.length > 0) {
        visit(node.content)
      }
    })
  }

  visit(jsonDoc?.content)
  return headings
}

export function buildHeadingIdFromText(text, registry) {
  return registry(text?.trim() || 'Untitled section')
}

export function createHeadingIdGenerator() {
  return createHeadingIdRegistry()
}
