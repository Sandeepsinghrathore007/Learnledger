import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'
import { generateStructuredAnswerWithModelOrder } from './services/aiProviderService.js'
import { createAssistantCacheIdentity, readCachedAssistantResponse, writeCachedAssistantResponse } from './services/cacheService.js'
import { persistAssistantInteraction } from './services/loggingService.js'
import { enforceAIRateLimit } from './services/rateLimitService.js'
import { APP_CONFIG, OPENROUTER_API_KEY } from './lib/config.js'
import { buildModelOrder } from './lib/modelStrategy.js'
import { buildStudyPrompts } from './lib/promptTemplate.js'
import { estimateTokenBundle } from './lib/text.js'
import { parseAssistantRequestPayload } from './lib/validation.js'

if (getApps().length === 0) {
  initializeApp()
}

const db = getFirestore()

export const askStudyAssistant = onCall(
  {
    region: APP_CONFIG.region,
    timeoutSeconds: 60,
    memory: '256MiB',
    secrets: [OPENROUTER_API_KEY],
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'You must be logged in to use AI assistant.')
    }

    const userId = request.auth.uid
    const payload = parseAssistantRequestPayload(request.data)

    await enforceAIRateLimit({ db, userId })

    const cacheIdentity = createAssistantCacheIdentity(payload)
    const cached = await readCachedAssistantResponse(db, cacheIdentity)

    if (cached) {
      const cachedTokens = { prompt: 0, completion: 0, total: 0 }

      try {
        await persistAssistantInteraction({
          db,
          userId,
          question: payload.question,
          subjectId: payload.subjectId,
          subjectName: payload.subjectName,
          subjectContext: payload.subjectContext,
          language: payload.language,
          answer: cached.answer,
          cacheKey: cacheIdentity.hash,
          cacheHit: true,
          modelUsed: cached.modelUsed,
          provider: cached.provider,
          tokenEstimate: cachedTokens,
        })
      } catch (error) {
        logger.error('Failed to persist cached AI interaction', {
          userId,
          error: error?.message || String(error),
        })
      }

      return {
        answer: cached.answer,
        meta: {
          cacheHit: true,
          modelUsed: cached.modelUsed || null,
          provider: cached.provider || 'openrouter',
          tokenEstimate: cachedTokens,
        },
      }
    }

    const apiKey = OPENROUTER_API_KEY.value()
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'OPENROUTER_API_KEY secret is not configured.')
    }

    const { systemPrompt, userPrompt } = buildStudyPrompts(payload)
    const modelOrder = buildModelOrder(APP_CONFIG, payload.question, payload.subjectContext)

    if (modelOrder.length === 0) {
      throw new HttpsError('failed-precondition', 'No AI model is configured for assistant requests.')
    }

    try {
      const generated = await generateStructuredAnswerWithModelOrder({
        apiKey,
        modelOrder,
        systemPrompt,
        userPrompt,
        language: payload.language,
        maxOutputTokens: APP_CONFIG.maxOutputTokens,
        timeoutMs: APP_CONFIG.requestTimeoutMs,
      })

      const tokenEstimate = estimateTokenBundle({
        systemPrompt,
        userPrompt,
        outputText: generated.rawText,
        usage: generated.usage,
      })

      await writeCachedAssistantResponse({
        db,
        cacheIdentity,
        answer: generated.answer,
        provider: generated.provider,
        modelUsed: generated.modelUsed,
        tokenEstimate,
      })

      let persistence = {
        chatId: null,
        usageLogId: null,
      }

      try {
        persistence = await persistAssistantInteraction({
          db,
          userId,
          question: payload.question,
          subjectId: payload.subjectId,
          subjectName: payload.subjectName,
          subjectContext: payload.subjectContext,
          language: payload.language,
          answer: generated.answer,
          cacheKey: cacheIdentity.hash,
          cacheHit: false,
          modelUsed: generated.modelUsed,
          provider: generated.provider,
          tokenEstimate,
        })
      } catch (error) {
        logger.error('Failed to persist AI interaction', {
          userId,
          error: error?.message || String(error),
        })
      }

      return {
        answer: generated.answer,
        meta: {
          cacheHit: false,
          modelUsed: generated.modelUsed,
          provider: generated.provider,
          tokenEstimate,
          chatId: persistence.chatId,
          usageLogId: persistence.usageLogId,
        },
      }
    } catch (error) {
      logger.error('askStudyAssistant failed', {
        userId,
        error: error?.message || String(error),
      })

      if (error instanceof HttpsError) {
        throw error
      }

      throw new HttpsError('internal', error?.message || 'Failed to generate AI response.')
    }
  }
)
