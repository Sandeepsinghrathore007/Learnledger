import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { APP_CONFIG } from '../lib/config.js'
import { buildCacheKey } from '../lib/text.js'

export function createAssistantCacheIdentity({ question, subjectContext, language, referenceId, referenceLabel }) {
  return buildCacheKey({ question, subjectContext, language, referenceId, referenceLabel })
}

function toMillis(value) {
  if (!value) return 0
  if (typeof value?.toMillis === 'function') return value.toMillis()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 0
  return parsed.getTime()
}

export async function readCachedAssistantResponse(db, cacheIdentity, now = Date.now()) {
  const cacheRef = db.collection('aiResponses').doc(cacheIdentity.hash)
  const snapshot = await cacheRef.get()

  if (!snapshot.exists) return null

  const data = snapshot.data() || {}
  const expiresAtMs = toMillis(data.expiresAt)

  if (!expiresAtMs || expiresAtMs <= now) {
    return null
  }

  const answer = data.response
  if (!answer || typeof answer !== 'object') {
    return null
  }

  await cacheRef.set(
    {
      lastRequestedAt: FieldValue.serverTimestamp(),
      hitCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  )

  return {
    answer,
    provider: data.provider || 'openrouter',
    modelUsed: data.modelUsed || null,
    tokenEstimate: data.tokenEstimate || null,
    cachedAt: data.createdAt || null,
    expiresAt: data.expiresAt || null,
  }
}

export async function writeCachedAssistantResponse({
  db,
  cacheIdentity,
  answer,
  provider,
  modelUsed,
  tokenEstimate,
}) {
  const cacheRef = db.collection('aiResponses').doc(cacheIdentity.hash)
  const now = Date.now()
  const expiresAt = Timestamp.fromMillis(now + APP_CONFIG.cacheTtlHours * 60 * 60 * 1000)

  await cacheRef.set(
    {
      key: cacheIdentity.hash,
      normalizedQuestion: cacheIdentity.normalizedQuestion,
      normalizedSubjectContext: cacheIdentity.normalizedSubjectContext,
      normalizedLanguage: cacheIdentity.normalizedLanguage,
      normalizedReference: cacheIdentity.normalizedReference || '',
      provider,
      modelUsed,
      response: answer,
      tokenEstimate,
      hitCount: FieldValue.increment(1),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastRequestedAt: FieldValue.serverTimestamp(),
      expiresAt,
    },
    { merge: true }
  )
}
