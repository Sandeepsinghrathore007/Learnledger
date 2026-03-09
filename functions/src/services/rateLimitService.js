import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { APP_CONFIG } from '../lib/config.js'

export async function enforceAIRateLimit({ db, userId }) {
  const windowMs = APP_CONFIG.rateLimitWindowSec * 1000
  const windowStartMs = Math.floor(Date.now() / windowMs) * windowMs
  const windowEndMs = windowStartMs + windowMs
  const windowKey = String(windowStartMs)

  const windowRef = db
    .collection('aiRateLimits')
    .doc(userId)
    .collection('windows')
    .doc(windowKey)

  try {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(windowRef)
      const currentCount = snapshot.exists ? Number(snapshot.data()?.count || 0) : 0

      if (currentCount >= APP_CONFIG.rateLimitMaxRequests) {
        throw new HttpsError(
          'resource-exhausted',
          `Rate limit exceeded. You can make up to ${APP_CONFIG.rateLimitMaxRequests} AI requests every ${APP_CONFIG.rateLimitWindowSec} seconds.`
        )
      }

      transaction.set(
        windowRef,
        {
          userId,
          count: currentCount + 1,
          limit: APP_CONFIG.rateLimitMaxRequests,
          windowStart: Timestamp.fromMillis(windowStartMs),
          windowEnd: Timestamp.fromMillis(windowEndMs),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    })
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error
    }

    throw new HttpsError('internal', error?.message || 'Failed to enforce AI rate limit')
  }
}
