import {
  deleteDoc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  orderBy,
} from 'firebase/firestore'
import {
  userPdfKnowledgeChunkDocRef,
  userPdfKnowledgeChunksCol,
  userPdfKnowledgeDocRef,
} from './firestorePaths'
import {
  buildPdfReferenceMaterial,
  extractPdfKnowledgeFromFile,
  selectRelevantPdfChunks,
} from '@/utils/pdfKnowledge'
import { getPdfBinaryFile } from '@/utils/pdfBinaryStore'

const LOCAL_CACHE_KEY = 'learnledger.pdf-knowledge.cache.v1'
const LOCAL_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7
const LOCAL_CACHE_MAX_ITEMS = 40

function buildLocalCacheId(userId, subjectId, pdfId) {
  return `${userId}:${subjectId}:${pdfId}`
}

function readLocalCacheBucket() {
  if (typeof window === 'undefined' || !window.localStorage) return {}

  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_CACHE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeLocalCacheBucket(bucket) {
  if (typeof window === 'undefined' || !window.localStorage) return

  try {
    window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(bucket))
  } catch {
    // Ignore quota errors.
  }
}

function trimLocalCache(bucket) {
  const entries = Object.entries(bucket)
    .sort(([, left], [, right]) => Number(right.cachedAt || 0) - Number(left.cachedAt || 0))
    .slice(0, LOCAL_CACHE_MAX_ITEMS)

  return Object.fromEntries(entries)
}

function writeLocalKnowledgeCache(userId, subjectId, pdfId, knowledge) {
  const bucket = readLocalCacheBucket()
  bucket[buildLocalCacheId(userId, subjectId, pdfId)] = {
    knowledge,
    cachedAt: Date.now(),
  }
  writeLocalCacheBucket(trimLocalCache(bucket))
}

function readLocalKnowledgeCache(userId, subjectId, pdfId) {
  const bucket = readLocalCacheBucket()
  const cacheId = buildLocalCacheId(userId, subjectId, pdfId)
  const cached = bucket[cacheId]
  if (!cached) return null

  const ageMs = Date.now() - Number(cached.cachedAt || 0)
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > LOCAL_CACHE_TTL_MS) {
    delete bucket[cacheId]
    writeLocalCacheBucket(bucket)
    return null
  }

  return cached.knowledge || null
}

function clearLocalKnowledgeCache(userId, subjectId, pdfId) {
  const bucket = readLocalCacheBucket()
  delete bucket[buildLocalCacheId(userId, subjectId, pdfId)]
  writeLocalCacheBucket(bucket)
}

async function deleteChunkDocuments(userId, subjectId, pdfId) {
  const chunkSnapshot = await getDocs(userPdfKnowledgeChunksCol(userId, subjectId, pdfId))
  if (chunkSnapshot.empty) return

  const refs = chunkSnapshot.docs.map((docSnapshot) => docSnapshot.ref)
  for (let index = 0; index < refs.length; index += 400) {
    const batch = writeBatch(chunkSnapshot.docs[0].ref.firestore)
    refs.slice(index, index + 400).forEach((docRef) => batch.delete(docRef))
    await batch.commit()
  }
}

export async function savePdfKnowledge({ userId, subjectId, pdf, knowledge }) {
  if (!userId || !subjectId || !pdf?.id) {
    throw new Error('savePdfKnowledge requires userId, subjectId, and pdf metadata.')
  }

  await deleteChunkDocuments(userId, subjectId, pdf.id)

  const metaRef = userPdfKnowledgeDocRef(userId, subjectId, pdf.id)
  const nowIso = new Date().toISOString()
  const metadata = {
    userId,
    subjectId,
    pdfId: pdf.id,
    pdfName: pdf.name || 'Untitled PDF',
    pageCount: Number.isFinite(knowledge?.pageCount) ? knowledge.pageCount : 0,
    chunkCount: Array.isArray(knowledge?.chunks) ? knowledge.chunks.length : 0,
    storedCharCount: Number.isFinite(knowledge?.storedCharCount) ? knowledge.storedCharCount : 0,
    fullTextLength: Number.isFinite(knowledge?.fullTextLength) ? knowledge.fullTextLength : 0,
    summary: String(knowledge?.summary || '').trim(),
    preview: String(knowledge?.preview || '').trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  await setDoc(metaRef, metadata, { merge: true })

  const chunks = Array.isArray(knowledge?.chunks) ? knowledge.chunks : []
  for (let index = 0; index < chunks.length; index += 400) {
    const batch = writeBatch(metaRef.firestore)
    chunks.slice(index, index + 400).forEach((chunk) => {
      batch.set(
        userPdfKnowledgeChunkDocRef(userId, subjectId, pdf.id, chunk.id),
        {
          userId,
          subjectId,
          pdfId: pdf.id,
          order: chunk.order,
          text: chunk.text,
          charCount: chunk.charCount,
          updatedAt: serverTimestamp(),
        }
      )
    })
    await batch.commit()
  }

  const cachedKnowledge = {
    userId,
    subjectId,
    pdfId: pdf.id,
    pdfName: pdf.name || 'Untitled PDF',
    pageCount: Number.isFinite(knowledge?.pageCount) ? knowledge.pageCount : 0,
    chunkCount: Array.isArray(knowledge?.chunks) ? knowledge.chunks.length : 0,
    storedCharCount: Number.isFinite(knowledge?.storedCharCount) ? knowledge.storedCharCount : 0,
    fullTextLength: Number.isFinite(knowledge?.fullTextLength) ? knowledge.fullTextLength : 0,
    summary: String(knowledge?.summary || '').trim(),
    preview: String(knowledge?.preview || '').trim(),
    createdAt: nowIso,
    updatedAt: nowIso,
    chunks,
  }
  writeLocalKnowledgeCache(userId, subjectId, pdf.id, cachedKnowledge)

  return cachedKnowledge
}

export async function getPdfKnowledge(userId, subjectId, pdfId) {
  if (!userId || !subjectId || !pdfId) return null

  const cached = readLocalKnowledgeCache(userId, subjectId, pdfId)
  if (cached) return cached

  const metaSnapshot = await getDoc(userPdfKnowledgeDocRef(userId, subjectId, pdfId))
  if (!metaSnapshot.exists()) return null

  const chunkSnapshot = await getDocs(
    query(userPdfKnowledgeChunksCol(userId, subjectId, pdfId), orderBy('order', 'asc'))
  )

  const knowledge = {
    ...metaSnapshot.data(),
    chunks: chunkSnapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data()
      return {
        id: docSnapshot.id,
        order: data.order || 0,
        text: data.text || '',
        charCount: data.charCount || String(data.text || '').length,
      }
    }),
  }

  writeLocalKnowledgeCache(userId, subjectId, pdfId, knowledge)
  return knowledge
}

export async function deletePdfKnowledge(userId, subjectId, pdfId) {
  if (!userId || !subjectId || !pdfId) return

  await deleteChunkDocuments(userId, subjectId, pdfId)
  await deleteDoc(userPdfKnowledgeDocRef(userId, subjectId, pdfId))
  clearLocalKnowledgeCache(userId, subjectId, pdfId)
}

function buildRuntimeKnowledge(pdfId, pdfName, knowledge) {
  return {
    ...knowledge,
    pdfId,
    pdfName: pdfName || 'Attached PDF',
    chunkCount: Array.isArray(knowledge?.chunks) ? knowledge.chunks.length : 0,
  }
}

export async function ensurePdfKnowledge({
  userId,
  subjectId,
  pdfId,
  pdfName = '',
}) {
  if (!subjectId || !pdfId) {
    throw new Error('ensurePdfKnowledge requires subjectId and pdfId.')
  }

  // ✅ FIX: Pehle Firestore se check karo (works on ALL devices)
  if (userId) {
    const existing = await getPdfKnowledge(userId, subjectId, pdfId)
    if (existing) {
      return {
        knowledge: existing,
        preparedNow: false,
      }
    }
  }

  // ✅ FIX: Local binary file try karo (sirf us device pe hogi jahan upload hua)
  const file = await getPdfBinaryFile({ userId, subjectId, pdfId })
  
  // ✅ FIX: Agar file nahi mili (doosra device) to better error message
  if (!file) {
    throw new Error(
      'PDF is not available on this device. ' +
      'The PDF was uploaded from another device. ' +
      'Please re-upload the PDF on this device to use AI features.'
    )
  }

  const extracted = await extractPdfKnowledgeFromFile(file)
  if (!extracted.summary && extracted.chunks.length === 0) {
    throw new Error('No readable text was found in this PDF.')
  }

  if (!userId) {
    return {
      knowledge: buildRuntimeKnowledge(pdfId, pdfName || file.name, extracted),
      preparedNow: true,
    }
  }

  // ✅ FIX: Extract ke baad Firestore mein save karo taaki doosre devices pe bhi mile
  const savedKnowledge = await savePdfKnowledge({
    userId,
    subjectId,
    pdf: {
      id: pdfId,
      name: pdfName || file.name,
    },
    knowledge: extracted,
  })

  return {
    knowledge: savedKnowledge,
    preparedNow: true,
  }
}

export async function getRelevantPdfReferenceMaterial({
  userId,
  subjectId,
  pdfId,
  pdfName = '',
  question,
  extraContext = '',
  prepareIfMissing = false,
}) {
  // ✅ FIX: Seedha Firestore se try karo pehle
  let knowledge = userId ? await getPdfKnowledge(userId, subjectId, pdfId) : null
  let preparedNow = false

  if (!knowledge && prepareIfMissing) {
    try {
      const prepared = await ensurePdfKnowledge({
        userId,
        subjectId,
        pdfId,
        pdfName,
      })
      knowledge = prepared.knowledge
      preparedNow = prepared.preparedNow
    } catch (err) {
      // ✅ FIX: Agar local file nahi hai doosre device pe,
      // to error throw mat karo — gracefully handle karo
      console.warn('PDF binary not available on this device:', err.message)
      return {
        knowledge: null,
        referenceMaterial: '',
        selectedChunks: [],
        preparedNow: false,
        deviceError: true, // UI ko pata chalega
      }
    }
  }

  if (!knowledge) {
    return {
      knowledge: null,
      referenceMaterial: '',
      selectedChunks: [],
      preparedNow,
    }
  }

  const selectedChunks = selectRelevantPdfChunks({
    chunks: knowledge.chunks,
    question,
    extraContext,
  })

  return {
    knowledge,
    selectedChunks,
    preparedNow,
    referenceMaterial: buildPdfReferenceMaterial({
      pdfName: knowledge.pdfName || 'Attached PDF',
      summary: knowledge.summary,
      chunks: selectedChunks,
    }),
  }
}
