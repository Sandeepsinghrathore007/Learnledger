import {
  collectionGroup,
  deleteDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { uid } from '@/utils/id'
import { db } from './firebaseConfig'
import { userNoteDocRef } from './firestorePaths'

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

function normalizeNote(snapshot) {
  const data = snapshot.data()

  return {
    id: snapshot.id,
    userId: data.userId,
    subjectId: data.subjectId,
    topicId: data.topicId,
    title: data.title || 'Untitled Note',
    content: data.content || '<p></p>',
    blocks: Array.isArray(data.blocks) ? data.blocks : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    isFavorite: Boolean(data.isFavorite),
    isPinned: Boolean(data.isPinned),
    linkedNotes: Array.isArray(data.linkedNotes) ? data.linkedNotes : [],
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
    lastOpenedAt: toIso(data.lastOpenedAt),
  }
}

export function subscribeToNotes(userId, onNext, onError) {
  const notesQuery = query(
    collectionGroup(db, 'notes'),
    where('userId', '==', userId)
  )

  return onSnapshot(
    notesQuery,
    (snapshot) => {
      const items = snapshot.docs
        .map(normalizeNote)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))

      onNext(items)
    },
    onError
  )
}

export async function createNote(userId, noteInput) {
  if (!userId) {
    throw new Error('createNote requires an authenticated user id.')
  }

  if (!noteInput?.subjectId || !noteInput?.topicId) {
    throw new Error('createNote requires subjectId and topicId.')
  }

  const nowIso = new Date().toISOString()
  const noteId = noteInput.id || uid()
  const noteRef = userNoteDocRef(userId, noteInput.subjectId, noteInput.topicId, noteId)

  const payload = {
    userId,
    subjectId: noteInput.subjectId,
    topicId: noteInput.topicId,
    title: String(noteInput.title || '').trim() || 'Untitled Note',
    content: noteInput.content || '<p></p>',
    blocks: Array.isArray(noteInput.blocks) ? noteInput.blocks : [],
    tags: Array.isArray(noteInput.tags) ? noteInput.tags : [],
    isFavorite: Boolean(noteInput.isFavorite),
    isPinned: Boolean(noteInput.isPinned),
    linkedNotes: Array.isArray(noteInput.linkedNotes) ? noteInput.linkedNotes : [],
    createdAt: noteInput.createdAt || serverTimestamp(),
    updatedAt: noteInput.updatedAt || serverTimestamp(),
    lastOpenedAt: noteInput.lastOpenedAt || noteInput.updatedAt || serverTimestamp(),
  }

  await setDoc(noteRef, payload)

  return {
    id: noteId,
    ...payload,
    createdAt: noteInput.createdAt || nowIso,
    updatedAt: noteInput.updatedAt || nowIso,
    lastOpenedAt: noteInput.lastOpenedAt || noteInput.updatedAt || nowIso,
  }
}

export async function updateNote(userId, subjectId, topicId, noteId, updates) {
  if (!userId || !subjectId || !topicId || !noteId) {
    throw new Error('updateNote requires userId, subjectId, topicId and noteId.')
  }

  const payload = {
    ...updates,
    updatedAt: updates?.updatedAt || serverTimestamp(),
    lastOpenedAt: updates?.lastOpenedAt || updates?.updatedAt || serverTimestamp(),
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'title')) {
    payload.title = String(payload.title || '').trim() || 'Untitled Note'
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'tags') && !Array.isArray(payload.tags)) {
    payload.tags = []
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'blocks') && !Array.isArray(payload.blocks)) {
    payload.blocks = []
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'linkedNotes') && !Array.isArray(payload.linkedNotes)) {
    payload.linkedNotes = []
  }

  await updateDoc(userNoteDocRef(userId, subjectId, topicId, noteId), payload)
}

export async function deleteNote(userId, subjectId, topicId, noteId) {
  if (!userId || !subjectId || !topicId || !noteId) {
    throw new Error('deleteNote requires userId, subjectId, topicId and noteId.')
  }

  await deleteDoc(userNoteDocRef(userId, subjectId, topicId, noteId))
}
