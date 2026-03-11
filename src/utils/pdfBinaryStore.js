const PDF_BINARY_DB_NAME = 'learnledger-pdf-binary'
const PDF_BINARY_STORE_NAME = 'pdf-files'

export const MAX_PDF_FILE_BYTES = 20 * 1024 * 1024

const memoryFallbackStore = new Map()

function resolveOwnerId(userId) {
  return String(userId || 'guest')
}

export function buildPdfBinaryCacheId({ userId = null, subjectId, pdfId }) {
  if (!subjectId || !pdfId) {
    throw new Error('buildPdfBinaryCacheId requires subjectId and pdfId.')
  }

  return `${resolveOwnerId(userId)}:${subjectId}:${pdfId}`
}

function openBinaryDatabase() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null)
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(PDF_BINARY_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PDF_BINARY_STORE_NAME)) {
        db.createObjectStore(PDF_BINARY_STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Failed to open PDF binary cache.'))
  })
}

function wrapRequest(request, db) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      db?.close()
      resolve(request.result)
    }
    request.onerror = () => {
      db?.close()
      reject(request.error || new Error('PDF binary cache request failed.'))
    }
  })
}

function toStoredFile(record) {
  if (!record?.file) return null
  if (record.file instanceof File) return record.file
  if (!(record.file instanceof Blob)) return null

  return new File(
    [record.file],
    record.name || 'study-material.pdf',
    {
      type: record.type || record.file.type || 'application/pdf',
      lastModified: Number(record.updatedAt || Date.now()),
    }
  )
}

export async function storePdfBinary({ userId = null, subjectId, pdfId, file }) {
  if (!file || !(file instanceof Blob)) {
    throw new Error('storePdfBinary requires a PDF file blob.')
  }

  const cacheId = buildPdfBinaryCacheId({ userId, subjectId, pdfId })
  const now = Date.now()
  const record = {
    id: cacheId,
    file,
    name: file.name || 'study-material.pdf',
    type: file.type || 'application/pdf',
    size: Number(file.size || 0),
    updatedAt: now,
  }

  const db = await openBinaryDatabase()
  if (!db) {
    memoryFallbackStore.set(cacheId, record)
    return { id: cacheId }
  }

  const transaction = db.transaction(PDF_BINARY_STORE_NAME, 'readwrite')
  const store = transaction.objectStore(PDF_BINARY_STORE_NAME)
  await wrapRequest(store.put(record), db)

  return { id: cacheId }
}

export async function getPdfBinaryFile({ userId = null, subjectId, pdfId }) {
  const cacheId = buildPdfBinaryCacheId({ userId, subjectId, pdfId })

  const db = await openBinaryDatabase()
  if (!db) {
    return toStoredFile(memoryFallbackStore.get(cacheId))
  }

  const transaction = db.transaction(PDF_BINARY_STORE_NAME, 'readonly')
  const store = transaction.objectStore(PDF_BINARY_STORE_NAME)
  const record = await wrapRequest(store.get(cacheId), db)

  return toStoredFile(record)
}

export async function deletePdfBinary({ userId = null, subjectId, pdfId }) {
  const cacheId = buildPdfBinaryCacheId({ userId, subjectId, pdfId })
  memoryFallbackStore.delete(cacheId)

  const db = await openBinaryDatabase()
  if (!db) return

  const transaction = db.transaction(PDF_BINARY_STORE_NAME, 'readwrite')
  const store = transaction.objectStore(PDF_BINARY_STORE_NAME)
  await wrapRequest(store.delete(cacheId), db)
}
