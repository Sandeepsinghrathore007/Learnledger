import {
  deleteDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { uid } from '@/utils/id'
import { db } from './firebaseConfig'
import {
  userPdfKnowledgeChunksCol,
  userPdfKnowledgeCol,
  userNotesCol,
  userSubjectDocRef,
  userSubjectsCol,
  userTopicsCol,
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

function normalizeSubject(snapshot) {
  const data = snapshot.data()

  return {
    id: snapshot.id,
    userId: data.userId,
    name: data.name || 'Untitled Subject',
    description: data.description || '',
    icon: data.icon || '📘',
    color: data.color || '#8b5cf6',
    aiScore: data.aiScore ?? null,
    testsAttempted: Number.isFinite(data.testsAttempted) ? data.testsAttempted : 0,
    topicsCount: Number.isFinite(data.topicsCount) ? data.topicsCount : 0,
    notesCount: Number.isFinite(data.notesCount) ? data.notesCount : 0,
    pdfs: Array.isArray(data.pdfs) ? data.pdfs : [],
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

export function subscribeToSubjects(userId, onNext, onError) {
  return onSnapshot(
    userSubjectsCol(userId),
    (snapshot) => {
      const items = snapshot.docs
        .map(normalizeSubject)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))

      onNext(items)
    },
    onError
  )
}

export async function createSubject(userId, subjectInput) {
  if (!userId) {
    throw new Error('createSubject requires an authenticated user id.')
  }

  const subjectId = subjectInput?.id || uid()
  const subjectRef = userSubjectDocRef(userId, subjectId)

  const payload = {
    userId,
    name: String(subjectInput?.name || '').trim() || 'Untitled Subject',
    description: String(subjectInput?.description || '').trim(),
    icon: subjectInput?.icon || '📘',
    color: subjectInput?.color || '#8b5cf6',
    aiScore: subjectInput?.aiScore ?? null,
    testsAttempted: Number.isFinite(subjectInput?.testsAttempted) ? subjectInput.testsAttempted : 0,
    topicsCount: Number.isFinite(subjectInput?.topicsCount) ? subjectInput.topicsCount : 0,
    notesCount: Number.isFinite(subjectInput?.notesCount) ? subjectInput.notesCount : 0,
    pdfs: Array.isArray(subjectInput?.pdfs) ? subjectInput.pdfs : [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  await setDoc(subjectRef, payload)

  return {
    id: subjectId,
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export async function updateSubject(userId, subjectId, updates) {
  if (!userId || !subjectId) {
    throw new Error('updateSubject requires userId and subjectId.')
  }

  const payload = {
    ...updates,
    updatedAt: serverTimestamp(),
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    payload.name = String(payload.name || '').trim() || 'Untitled Subject'
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    payload.description = String(payload.description || '').trim()
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'pdfs') && !Array.isArray(payload.pdfs)) {
    payload.pdfs = []
  }

  await updateDoc(userSubjectDocRef(userId, subjectId), payload)
}

export async function deleteSubject(userId, subjectId) {
  if (!userId || !subjectId) {
    throw new Error('deleteSubject requires userId and subjectId.')
  }

  const pdfKnowledgeSnapshot = await getDocs(userPdfKnowledgeCol(userId, subjectId))
  const topicSnapshot = await getDocs(userTopicsCol(userId, subjectId))
  const refsToDelete = []

  for (const pdfDoc of pdfKnowledgeSnapshot.docs) {
    const chunkSnapshot = await getDocs(userPdfKnowledgeChunksCol(userId, subjectId, pdfDoc.id))
    chunkSnapshot.docs.forEach((chunkDoc) => refsToDelete.push(chunkDoc.ref))
    refsToDelete.push(pdfDoc.ref)
  }

  for (const topicDoc of topicSnapshot.docs) {
    const notesSnapshot = await getDocs(userNotesCol(userId, subjectId, topicDoc.id))
    notesSnapshot.docs.forEach((noteDoc) => refsToDelete.push(noteDoc.ref))
    refsToDelete.push(topicDoc.ref)
  }

  await deleteDocumentsInChunks(refsToDelete)
  await deleteDoc(userSubjectDocRef(userId, subjectId))
}
