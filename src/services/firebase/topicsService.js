import {
  collectionGroup,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { uid } from '@/utils/id'
import { db } from './firebaseConfig'
import {
  userNoteDocRef,
  userNotesCol,
  userTopicDocRef,
} from './firestorePaths'

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

function normalizeTopic(snapshot) {
  const data = snapshot.data()

  return {
    id: snapshot.id,
    userId: data.userId,
    subjectId: data.subjectId,
    name: data.name || 'Untitled Topic',
    questionsCount: Number.isFinite(data.questionsCount) ? data.questionsCount : 0,
    notesCount: Number.isFinite(data.notesCount) ? data.notesCount : 0,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  }
}

async function deleteDocumentsInChunks(documentRefs, chunkSize = 450) {
  if (documentRefs.length === 0) return

  for (let index = 0; index < documentRefs.length; index += chunkSize) {
    const chunk = documentRefs.slice(index, index + chunkSize)
    const batch = writeBatch(db)

    chunk.forEach((documentRef) => batch.delete(documentRef))
    await batch.commit()
  }
}

export function subscribeToTopics(userId, onNext, onError) {
  const topicsQuery = query(
    collectionGroup(db, 'topics'),
    where('userId', '==', userId)
  )

  return onSnapshot(
    topicsQuery,
    (snapshot) => {
      const items = snapshot.docs
        .map(normalizeTopic)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))

      onNext(items)
    },
    onError
  )
}

export async function createTopic(userId, topicInput) {
  if (!userId) {
    throw new Error('createTopic requires an authenticated user id.')
  }

  if (!topicInput?.subjectId) {
    throw new Error('createTopic requires a subjectId.')
  }

  const topicId = topicInput.id || uid()
  const topicRef = userTopicDocRef(userId, topicInput.subjectId, topicId)

  const payload = {
    userId,
    subjectId: topicInput.subjectId,
    name: String(topicInput.name || '').trim() || 'Untitled Topic',
    questionsCount: Number.isFinite(topicInput.questionsCount) ? topicInput.questionsCount : 0,
    notesCount: Number.isFinite(topicInput.notesCount) ? topicInput.notesCount : 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  await setDoc(topicRef, payload)

  return {
    id: topicId,
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export async function updateTopic(userId, subjectId, topicId, updates) {
  if (!userId || !subjectId || !topicId) {
    throw new Error('updateTopic requires userId, subjectId and topicId.')
  }

  const payload = {
    ...updates,
    updatedAt: serverTimestamp(),
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    payload.name = String(payload.name || '').trim() || 'Untitled Topic'
  }

  await updateDoc(userTopicDocRef(userId, subjectId, topicId), payload)
}

export async function deleteTopic(userId, subjectId, topicId, options = {}) {
  if (!userId || !subjectId || !topicId) {
    throw new Error('deleteTopic requires userId, subjectId and topicId.')
  }

  const shouldDeleteNotes = options.deleteNotes !== false

  if (shouldDeleteNotes) {
    const notesSnapshot = await getDocs(userNotesCol(userId, subjectId, topicId))
    const noteRefs = notesSnapshot.docs.map((noteDoc) =>
      userNoteDocRef(userId, subjectId, topicId, noteDoc.id)
    )

    await deleteDocumentsInChunks(noteRefs)
  }

  await deleteDoc(userTopicDocRef(userId, subjectId, topicId))
}
