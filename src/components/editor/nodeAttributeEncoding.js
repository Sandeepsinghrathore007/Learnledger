export function encodeNodeAttribute(value = '') {
  return encodeURIComponent(String(value))
}

export function decodeNodeAttribute(value = '') {
  if (typeof value !== 'string' || value.length === 0) return ''

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function encodeNodeJson(value, fallback) {
  try {
    return encodeURIComponent(JSON.stringify(value ?? fallback))
  } catch {
    return encodeURIComponent(JSON.stringify(fallback))
  }
}

export function decodeNodeJson(value, fallback) {
  if (typeof value !== 'string' || value.length === 0) return fallback

  try {
    return JSON.parse(decodeURIComponent(value))
  } catch {
    return fallback
  }
}
