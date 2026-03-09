import {
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { uid } from '@/utils/id'
import { ACTIVITY_TYPES, logActivity } from './analyticsService'
import { userAIChatDocRef, userAIChatsCol } from './firestorePaths'

function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === 'function') return value.toDate()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function toIso(value) {
  return toDate(value)?.toISOString() || null
}

function normalizeAIChat(snapshot) {
  const data = snapshot.data()

  return {
    id: snapshot.id,
    ...data,
    createdAt: toIso(data.createdAt) || data.createdAt || null,
  }
}

export function subscribeToAIChats(userId, onNext, onError) {
  return onSnapshot(
    userAIChatsCol(userId),
    (snapshot) => {
      const items = snapshot.docs
        .map(normalizeAIChat)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))

      onNext(items)
    },
    onError
  )
}

export async function saveAIChat(userId, payload) {
  if (!userId) {
    throw new Error('saveAIChat requires an authenticated user id.')
  }

  if (!payload?.question || !payload?.response) {
    throw new Error('saveAIChat requires both question and response.')
  }

  const chatId = payload.id || uid()
  const chatRef = userAIChatDocRef(userId, chatId)
  const createdAt = payload.createdAt || new Date().toISOString()

  const chatPayload = {
    userId,
    question: String(payload.question).trim(),
    response: String(payload.response).trim(),
    subjectId: payload.subjectId || null,
    subjectName: payload.subjectName || null,
    subjectContext: payload.subjectContext || null,
    language: payload.language || 'english',
    modelUsed: payload.modelUsed || null,
    provider: payload.provider || null,
    createdAt: payload.createdAt || serverTimestamp(),
  }

  await setDoc(chatRef, chatPayload)

  await logActivity(userId, {
    type: ACTIVITY_TYPES.AI_QUESTION,
    timestamp: createdAt,
    subjectId: payload.subjectId || null,
    aiChatId: chatId,
    metadata: {
      language: chatPayload.language,
      subjectContext: chatPayload.subjectContext,
      modelUsed: chatPayload.modelUsed,
      provider: chatPayload.provider,
    },
  })

  return {
    id: chatId,
    ...chatPayload,
    createdAt,
  }
}
