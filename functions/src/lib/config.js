import { defineSecret } from 'firebase-functions/params'

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readStringList(value, fallback) {
  const parsed = String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return Object.freeze(parsed.length > 0 ? Array.from(new Set(parsed)) : fallback)
}

export const OPENROUTER_API_KEY = defineSecret('OPENROUTER_API_KEY')
export const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY')

export const APP_CONFIG = Object.freeze({
  region: process.env.FUNCTION_REGION || 'us-central1',
  smallModel: process.env.AI_SMALL_MODEL || 'openai/gpt-4o-mini',
  largeModel: process.env.AI_LARGE_MODEL || 'openai/gpt-4o',
  geminiModels: readStringList(process.env.AI_GEMINI_MODELS, ['gemini-2.5-flash', 'gemini-2.0-flash']),
  maxQuestionChars: readPositiveInt(process.env.AI_MAX_QUESTION_CHARS, 320),
  maxContextChars: readPositiveInt(process.env.AI_MAX_CONTEXT_CHARS, 180),
  maxOutputTokens: readPositiveInt(process.env.AI_MAX_OUTPUT_TOKENS, 420),
  rateLimitWindowSec: readPositiveInt(process.env.AI_RATE_LIMIT_WINDOW_SEC, 3600),
  rateLimitMaxRequests: readPositiveInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS, 30),
  cacheTtlHours: readPositiveInt(process.env.AI_CACHE_TTL_HOURS, 720),
  requestTimeoutMs: readPositiveInt(process.env.AI_REQUEST_TIMEOUT_MS, 30000),
})

export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
