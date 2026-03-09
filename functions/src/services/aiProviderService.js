import { OPENROUTER_API_URL } from '../lib/config.js'
import { STUDY_RESPONSE_SCHEMA } from '../lib/promptTemplate.js'
import { parseStructuredStudyResponse } from '../lib/responseParser.js'

function parseErrorMessage(status, rawText) {
  try {
    const parsed = JSON.parse(rawText)
    return parsed?.error?.message || parsed?.message || `Request failed with status ${status}`
  } catch {
    const snippet = String(rawText || '').slice(0, 240)
    return snippet ? `Request failed with status ${status}: ${snippet}` : `Request failed with status ${status}`
  }
}

function extractOpenRouterText(data) {
  const choices = Array.isArray(data?.choices) ? data.choices : []
  const message = choices[0]?.message
  const content = message?.content

  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part
        if (typeof part?.text === 'string') return part.text
        return ''
      })
      .join('')
      .trim()
  }

  return ''
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function callOpenRouter({
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  maxOutputTokens,
  timeoutMs,
  withJsonSchema,
}) {
  const body = {
    model,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    temperature: 0.2,
    max_tokens: maxOutputTokens,
  }

  if (withJsonSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'study_assistant_response',
        strict: true,
        schema: STUDY_RESPONSE_SCHEMA,
      },
    }
  }

  const response = await fetchWithTimeout(
    OPENROUTER_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
    timeoutMs
  )

  const rawText = await response.text()

  if (!response.ok) {
    const message = parseErrorMessage(response.status, rawText)
    const err = new Error(message)
    err.httpStatus = response.status
    err.rawText = rawText
    throw err
  }

  let data
  try {
    data = JSON.parse(rawText)
  } catch {
    throw new Error('Provider returned invalid JSON response')
  }

  const text = extractOpenRouterText(data)
  if (!text) {
    throw new Error('Provider returned empty response')
  }

  return {
    text,
    usage: data?.usage || null,
  }
}

function isSchemaModeUnsupported(error) {
  const message = String(error?.message || '').toLowerCase()
  return (
    message.includes('response_format') ||
    message.includes('json_schema') ||
    message.includes('unsupported')
  )
}

export async function generateStructuredAnswerWithModelOrder({
  apiKey,
  modelOrder,
  systemPrompt,
  userPrompt,
  maxOutputTokens,
  timeoutMs,
}) {
  const errors = []

  for (const model of modelOrder) {
    if (!model) continue

    try {
      let rawResponse

      try {
        rawResponse = await callOpenRouter({
          apiKey,
          model,
          systemPrompt,
          userPrompt,
          maxOutputTokens,
          timeoutMs,
          withJsonSchema: true,
        })
      } catch (error) {
        if (!isSchemaModeUnsupported(error)) {
          throw error
        }

        rawResponse = await callOpenRouter({
          apiKey,
          model,
          systemPrompt,
          userPrompt,
          maxOutputTokens,
          timeoutMs,
          withJsonSchema: false,
        })
      }

      const parsed = parseStructuredStudyResponse(rawResponse.text)

      return {
        answer: parsed,
        modelUsed: model,
        provider: 'openrouter',
        usage: rawResponse.usage,
        rawText: rawResponse.text,
      }
    } catch (error) {
      errors.push(`[${model}] ${error?.message || 'Unknown provider error'}`)
    }
  }

  throw new Error(`AI generation failed for all models. ${errors.join(' | ')}`)
}
