/**
 * aiClient.js — Shared AI text generation client with provider fallback.
 *
 * Provider priority:
 *  1. OpenRouter (if VITE_OPENROUTER_API_KEY is set)
 *  2. Gemini direct API (if VITE_GEMINI_API_KEY is set)
 */

const OPENROUTER_API_KEY = (import.meta.env.VITE_OPENROUTER_API_KEY || '').trim()
const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || '').trim()

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL_OVERRIDE = (import.meta.env.VITE_OPENROUTER_MODEL || '').trim()
const OPENROUTER_MODELS = Array.from(
  new Set(
    [
      OPENROUTER_MODEL_OVERRIDE,
      'google/gemini-2.0-flash-001',
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-haiku',
    ].filter(Boolean)
  )
)

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_MODEL_OVERRIDE = (import.meta.env.VITE_GEMINI_MODEL || '').trim()
const GEMINI_MODELS = Array.from(
  new Set(
    [
      GEMINI_MODEL_OVERRIDE,
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro',
    ].filter(Boolean)
  )
)

const REQUEST_TIMEOUT_MS = 65_000

function getApiErrorMessage(httpStatus, rawResponseText) {
  try {
    const parsed = JSON.parse(rawResponseText)
    return parsed?.error?.message || parsed?.message || `Request failed with status ${httpStatus}`
  } catch {
    if (rawResponseText) {
      return `Request failed with status ${httpStatus}: ${rawResponseText.slice(0, 220)}`
    }
    return `Request failed with status ${httpStatus}`
  }
}

async function fetchWithTimeout(url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

function extractGeminiText(data) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : []

  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []
    const text = parts
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim()

    if (text) return text
  }

  return ''
}

function extractOpenRouterText(data) {
  const choices = Array.isArray(data?.choices) ? data.choices : []
  const message = choices[0]?.message
  const content = message?.content

  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === 'string') return part
        if (typeof part?.text === 'string') return part.text
        return ''
      })
      .join('')
      .trim()

    if (text) return text
  }

  return ''
}

async function generateWithOpenRouter({ systemPrompt, userPrompt, temperature, maxTokens }) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter key not configured')
  }

  const modelErrors = []

  for (const model of OPENROUTER_MODELS) {
    try {
      const response = await fetchWithTimeout(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: systemPrompt || 'You must return clear and accurate output.',
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      })

      const rawText = await response.text()

      if (!response.ok) {
        modelErrors.push(`[${model}] ${getApiErrorMessage(response.status, rawText)}`)
        continue
      }

      let data = null
      try {
        data = JSON.parse(rawText)
      } catch {
        modelErrors.push(`[${model}] Invalid JSON response from API`)
        continue
      }

      const text = extractOpenRouterText(data)
      if (!text) {
        modelErrors.push(`[${model}] Empty response from AI`)
        continue
      }

      return {
        text,
        modelUsed: model,
        provider: 'openrouter',
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        modelErrors.push(`[${model}] Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)
      } else {
        modelErrors.push(`[${model}] ${error?.message || 'Unknown network error'}`)
      }
    }
  }

  throw new Error(`OpenRouter failed for all models. ${modelErrors.join(' | ')}`)
}

async function generateWithGemini({ userPrompt, temperature, maxTokens }) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured')
  }

  const modelErrors = []

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetchWithTimeout(`${GEMINI_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature,
            topP: 0.9,
            maxOutputTokens: maxTokens,
          },
        }),
      })

      const rawText = await response.text()

      if (!response.ok) {
        modelErrors.push(`[${model}] ${getApiErrorMessage(response.status, rawText)}`)
        continue
      }

      let data = null
      try {
        data = JSON.parse(rawText)
      } catch {
        modelErrors.push(`[${model}] Invalid JSON response from API`)
        continue
      }

      const text = extractGeminiText(data)
      if (!text) {
        modelErrors.push(`[${model}] Empty response from AI`)
        continue
      }

      return {
        text,
        modelUsed: model,
        provider: 'gemini',
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        modelErrors.push(`[${model}] Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)
      } else {
        modelErrors.push(`[${model}] ${error?.message || 'Unknown network error'}`)
      }
    }
  }

  throw new Error(`Gemini failed for all models. ${modelErrors.join(' | ')}`)
}

/**
 * Generate text from configured AI providers.
 */
export async function generateTextFromAI({
  systemPrompt = '',
  userPrompt,
  temperature = 0.5,
  maxTokens = 8192,
}) {
  if (!userPrompt || !String(userPrompt).trim()) {
    throw new Error('AI prompt is empty')
  }

  const providerErrors = []

  // Prefer OpenRouter first.
  if (OPENROUTER_API_KEY) {
    try {
      return await generateWithOpenRouter({
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
      })
    } catch (error) {
      providerErrors.push(error.message)
    }
  }

  if (GEMINI_API_KEY) {
    try {
      return await generateWithGemini({
        userPrompt: systemPrompt
          ? `${systemPrompt}\n\n${userPrompt}`
          : userPrompt,
        temperature,
        maxTokens,
      })
    } catch (error) {
      providerErrors.push(error.message)
    }
  }

  if (!OPENROUTER_API_KEY && !GEMINI_API_KEY) {
    throw new Error('No AI API key configured. Add VITE_OPENROUTER_API_KEY or VITE_GEMINI_API_KEY to your .env file.')
  }

  throw new Error(`AI request failed for all providers. ${providerErrors.join(' | ')}`)
}
