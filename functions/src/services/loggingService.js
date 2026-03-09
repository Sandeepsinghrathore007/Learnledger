import { FieldValue } from 'firebase-admin/firestore'
import { formatStructuredAnswerForStorage } from '../lib/text.js'

function getDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function persistAssistantInteraction({
  db,
  userId,
  question,
  subjectId,
  subjectName,
  subjectContext,
  language,
  answer,
  cacheKey,
  cacheHit,
  modelUsed,
  provider,
  tokenEstimate,
}) {
  const eventDate = new Date()
  const occurredAt = eventDate.toISOString()

  const chatRef = db.collection('users').doc(userId).collection('aiChats').doc()
  const activityRef = db.collection('users').doc(userId).collection('activity').doc()
  const usageRef = db.collection('aiUsageLogs').doc()

  const responseText = formatStructuredAnswerForStorage(answer)

  const baseMetadata = {
    language,
    subjectContext,
    modelUsed,
    provider,
    cacheHit,
    tokenEstimate,
    cacheKey,
  }

  await Promise.all([
    chatRef.set({
      userId,
      question,
      response: responseText,
      structuredResponse: answer,
      subjectId: subjectId || null,
      subjectName: subjectName || null,
      subjectContext: subjectContext || null,
      language,
      modelUsed,
      provider,
      cacheHit,
      tokenEstimate,
      createdAt: FieldValue.serverTimestamp(),
      occurredAt,
    }),
    activityRef.set({
      userId,
      type: 'ai_question',
      date: getDateKey(eventDate),
      timestamp: FieldValue.serverTimestamp(),
      occurredAt,
      subjectId: subjectId || null,
      topicId: null,
      noteId: null,
      testId: null,
      aiChatId: chatRef.id,
      metadata: baseMetadata,
    }),
    usageRef.set({
      userId,
      question,
      subjectContext,
      subjectId: subjectId || null,
      subjectName: subjectName || null,
      language,
      cacheKey,
      cacheHit,
      modelUsed,
      provider,
      tokenEstimate,
      timestamp: FieldValue.serverTimestamp(),
      occurredAt,
    }),
  ])

  return {
    chatId: chatRef.id,
    usageLogId: usageRef.id,
  }
}
