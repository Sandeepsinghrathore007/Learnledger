import {
  collectionGroup,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { uid } from '@/utils/id'
import { db } from './firebaseConfig'
import { userNoteDocRef, userTopicDocRef } from './firestorePaths'

const AI_MASTER_TOPIC_ID = '__ai_master_notes__'
const AI_MASTER_NOTE_ID = '__ai_master_note__'
const EMPTY_TIPTAP_DOC = {
  type: 'doc',
  content: [],
}

function normalizeContentJson(value) {
  if (!value || typeof value !== 'object') return EMPTY_TIPTAP_DOC
  if (value.type !== 'doc' || !Array.isArray(value.content)) return EMPTY_TIPTAP_DOC

  return {
    type: 'doc',
    content: value.content,
  }
}

function escapeHtml(text = '') {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function encodeHtmlAttribute(value = '') {
  return encodeURIComponent(String(value))
}

function appendHtmlContent(previousHtml, nextHtml) {
  const current = String(previousHtml || '').trim()
  if (!current || current === '<p></p>') return nextHtml
  return `${current}${nextHtml}`
}

function extractInlineNotePreviewText(node) {
  if (!node || node.type !== 'inlineNote') return ''

  const title = String(node.attrs?.title || '').trim() || 'Untitled Note'
  const lines = []

  ;(node.content || []).forEach((child) => {
    if (child.type === 'paragraph') {
      const text = (child.content || [])
        .map((item) => String(item?.text || '').trim())
        .filter(Boolean)
        .join('')

      if (text) lines.push(text)
      return
    }

    if (child.type === 'bulletList') {
      child.content?.forEach((listItem) => {
        const point = listItem?.content?.[0]?.content
          ?.map((item) => String(item?.text || '').trim())
          .filter(Boolean)
          .join('')

        if (point) lines.push(`• ${point}`)
      })
    }
  })

  return [title, ...lines].filter(Boolean).join('\n')
}

function buildBlocksFromContentJson(contentJson) {
  return (contentJson.content || [])
    .filter((node) => node?.type === 'inlineNote')
    .map((node) => ({
      id: uid(),
      type: 'callout',
      text: extractInlineNotePreviewText(node),
    }))
}

function renderNodeToHtml(node) {
  if (!node || typeof node !== 'object') return ''

  if (node.type === 'text') {
    return escapeHtml(node.text || '')
  }

  if (node.type === 'hardBreak') {
    return '<br />'
  }

  if (node.type === 'paragraph') {
    const content = (node.content || []).map(renderNodeToHtml).join('')
    return `<p>${content}</p>`
  }

  if (node.type === 'bulletList') {
    const items = (node.content || []).map(renderNodeToHtml).join('')
    return `<ul>${items}</ul>`
  }

  if (node.type === 'listItem') {
    const items = (node.content || []).map(renderNodeToHtml).join('')
    return `<li>${items}</li>`
  }

  if (node.type === 'inlineNote') {
    const title = String(node.attrs?.title || '')
    const collapsed = String(Boolean(node.attrs?.collapsed))
    const content = (node.content || []).map(renderNodeToHtml).join('') || '<p></p>'

    return `<div data-type="inline-note" data-title="${encodeHtmlAttribute(title)}" data-collapsed="${collapsed}">${content}</div>`
  }

  return (node.content || []).map(renderNodeToHtml).join('')
}

async function ensureAIMasterTopic(userId, subjectId) {
  await setDoc(
    userTopicDocRef(userId, subjectId, AI_MASTER_TOPIC_ID),
    {
      userId,
      subjectId,
      name: 'AI Notes',
      questionsCount: 0,
      notesCount: 1,
      isCompleted: false,
      completedAt: null,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  )
}

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
    contentJson: normalizeContentJson(data.contentJson),
    blocks: Array.isArray(data.blocks) ? data.blocks : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    theme: typeof data.theme === 'string' ? data.theme : 'midnight',
    fontSize: typeof data.fontSize === 'string' ? data.fontSize : 'medium',
    isFavorite: Boolean(data.isFavorite),
    isPinned: Boolean(data.isPinned),
    isAIMaster: Boolean(data.isAIMaster),
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
    theme: typeof noteInput.theme === 'string' ? noteInput.theme : 'midnight',
    fontSize: typeof noteInput.fontSize === 'string' ? noteInput.fontSize : 'medium',
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

  if (Object.prototype.hasOwnProperty.call(payload, 'theme') && typeof payload.theme !== 'string') {
    payload.theme = 'midnight'
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'fontSize') && typeof payload.fontSize !== 'string') {
    payload.fontSize = 'medium'
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

export async function findOrCreateAIMasterNote(userId, subjectId, subjectName) {
  if (!userId || !subjectId || !subjectName) {
    throw new Error('findOrCreateAIMasterNote requires userId, subjectId, and subjectName.')
  }

  const masterTitle = `AI Notes — ${subjectName}`
  const masterNoteRef = userNoteDocRef(userId, subjectId, AI_MASTER_TOPIC_ID, AI_MASTER_NOTE_ID)

  await ensureAIMasterTopic(userId, subjectId)

  const existingSnapshot = await getDoc(masterNoteRef)
  if (existingSnapshot.exists()) {
    const existingNote = normalizeNote(existingSnapshot)

    if (existingNote.title !== masterTitle || !existingNote.isAIMaster) {
      await updateDoc(masterNoteRef, {
        title: masterTitle,
        isAIMaster: true,
        updatedAt: serverTimestamp(),
        lastOpenedAt: serverTimestamp(),
      })
    }

    return {
      ...existingNote,
      title: masterTitle,
      isAIMaster: true,
    }
  }

  const nowIso = new Date().toISOString()
  const payload = {
    userId,
    subjectId,
    topicId: AI_MASTER_TOPIC_ID,
    title: masterTitle,
    content: '<p></p>',
    contentJson: EMPTY_TIPTAP_DOC,
    blocks: [],
    tags: ['ai-generated'],
    theme: 'midnight',
    fontSize: 'medium',
    isFavorite: false,
    isPinned: false,
    linkedNotes: [],
    isAIMaster: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastOpenedAt: serverTimestamp(),
  }

  await setDoc(masterNoteRef, payload)

  return {
    id: AI_MASTER_NOTE_ID,
    ...payload,
    contentJson: EMPTY_TIPTAP_DOC,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastOpenedAt: nowIso,
  }
}

export async function appendInlineNoteToAIMasterNote(userId, subjectId, subjectName, inlineNoteNode) {
  if (!inlineNoteNode || inlineNoteNode.type !== 'inlineNote') {
    throw new Error('appendInlineNoteToAIMasterNote requires a valid inlineNote node.')
  }

  const masterNote = await findOrCreateAIMasterNote(userId, subjectId, subjectName)
  const existingContentJson = normalizeContentJson(masterNote.contentJson)
  const nextContentJson = {
    type: 'doc',
    content: [...existingContentJson.content, inlineNoteNode],
  }
  const inlineNoteHtml = renderNodeToHtml(inlineNoteNode)
  const nextContent = appendHtmlContent(masterNote.content, inlineNoteHtml)
  const nextBlocks = [
    ...(Array.isArray(masterNote.blocks) ? masterNote.blocks : []),
    {
      id: uid(),
      type: 'callout',
      text: extractInlineNotePreviewText(inlineNoteNode),
    },
  ]
  const nowIso = new Date().toISOString()

  await ensureAIMasterTopic(userId, subjectId)
  await updateDoc(userNoteDocRef(userId, subjectId, masterNote.topicId, masterNote.id), {
    title: masterNote.title,
    content: nextContent,
    contentJson: nextContentJson,
    blocks: nextBlocks,
    isAIMaster: true,
    updatedAt: serverTimestamp(),
    lastOpenedAt: serverTimestamp(),
  })

  return {
    ...masterNote,
    content: nextContent,
    contentJson: nextContentJson,
    blocks: nextBlocks,
    updatedAt: nowIso,
    lastOpenedAt: nowIso,
  }
}
