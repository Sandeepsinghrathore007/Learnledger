/**
 * cloudinaryService.js — Upload and delete PDFs via Cloudinary.
 *
 * Add these to your .env file:
 *   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
 *   VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
 *
 * How to create upload preset in Cloudinary:
 *   Dashboard → Settings → Upload → Add upload preset
 *   Set: Signing Mode = Unsigned, Resource type = Auto
 *   Copy the preset name → paste in .env
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const CLOUDINARY_BASE_URL = CLOUD_NAME
  ? `https://res.cloudinary.com/${CLOUD_NAME}`
  : ''

function normalizePublicId(publicId) {
  return String(publicId || '').replace(/^\/+|\/+$/g, '')
}

function normalizeFormat(format) {
  const normalized = String(format || 'pdf').replace(/^\./, '').trim().toLowerCase()
  return normalized || 'pdf'
}

function extractPublicIdFromDeliveryUrl(url = '') {
  const normalizedUrl = String(url || '').trim()
  const uploadMarker = '/upload/'
  const markerIndex = normalizedUrl.indexOf(uploadMarker)

  if (markerIndex === -1) return ''

  const trailingPath = normalizedUrl.slice(markerIndex + uploadMarker.length)
  const segments = trailingPath
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length === 0) return ''

  if (segments[0]?.includes(',') || segments[0]?.startsWith('t_')) {
    segments.shift()
  }

  if (/^v\d+$/.test(segments[0] || '')) {
    segments.shift()
  }

  if (segments.length === 0) return ''

  const lastSegment = segments.pop()
  const normalizedLastSegment = String(lastSegment || '').replace(/\.[^.?#/]+(?:[?#].*)?$/, '')

  return [...segments, normalizedLastSegment].filter(Boolean).join('/')
}

export function getCloudinaryPdfUrl({ url = '', publicId = '', version = null, resourceType = '', format = 'pdf' }) {
  const normalizedPublicId = normalizePublicId(publicId)
  const normalizedFormat = normalizeFormat(format)
  const normalizedUrl = String(url || '').trim()

  if (!normalizedUrl && !normalizedPublicId) return ''

  const inferredResourceType = resourceType
    || (normalizedUrl.includes('/raw/upload/') ? 'raw' : normalizedUrl.includes('/image/upload/') ? 'image' : 'image')

  if (normalizedPublicId && CLOUDINARY_BASE_URL) {
    const versionSegment = version ? `/v${version}` : ''
    return `${CLOUDINARY_BASE_URL}/${inferredResourceType}/upload${versionSegment}/${normalizedPublicId}.${normalizedFormat}`
  }

  if (normalizedUrl.includes('res.cloudinary.com') && !normalizedUrl.toLowerCase().includes('.pdf')) {
    return `${normalizedUrl}.pdf`
  }

  return normalizedUrl
}

export function getCloudinaryPdfPageImageUrl({
  url = '',
  publicId = '',
  version = null,
  page = 1,
  width = 1400,
  format = 'png',
}) {
  const normalizedPublicId = normalizePublicId(publicId || extractPublicIdFromDeliveryUrl(url))
  const normalizedFormat = normalizeFormat(format)

  if (!normalizedPublicId || !CLOUDINARY_BASE_URL) return ''

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const safeWidth = Number.isFinite(width) && width > 0 ? Math.floor(width) : 1400
  const versionSegment = version ? `/v${version}` : ''

  return `${CLOUDINARY_BASE_URL}/image/upload/pg_${safePage},w_${safeWidth},c_limit,f_${normalizedFormat}${versionSegment}/${normalizedPublicId}.${normalizedFormat}`
}

/**
 * Upload a PDF file to Cloudinary.
 * Returns { url, publicId } on success.
 */
export async function uploadPdfToCloudinary({ file, userId, subjectId, pdfId }) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Cloudinary not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your .env file.'
    )
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('public_id', `learnledger/${userId}/${subjectId}/${pdfId}`)
  formData.append('filename_override', file.name)
  formData.append('tags', `userId_${userId},subjectId_${subjectId}`)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData?.error?.message || 'Cloudinary upload failed.')
  }

  const data = await response.json()

  return {
    url: getCloudinaryPdfUrl({
      publicId: data.public_id,
      version: data.version,
      resourceType: data.resource_type || 'image',
      format: data.format || 'pdf',
    }),
    publicId: data.public_id,
    resourceType: data.resource_type || 'image',
    format: data.format || 'pdf',
    version: data.version || null,
    bytes: data.bytes,
    uploadedAt: data.created_at,
  }
}

/**
 * Delete a PDF from Cloudinary.
 * Note: Deletion from frontend requires unsigned delete to be enabled
 * in Cloudinary settings, OR use a backend/Firebase function.
 * For now we just log — actual file stays in Cloudinary free tier (no cost).
 */
export async function deletePdfFromCloudinary({ publicId }) {
  // Cloudinary unsigned delete requires special setup.
  // Files are cheap to keep — we just remove from Firestore metadata.
  // If you want hard delete, set up a Firebase Cloud Function.
  console.log('PDF removed from app. Cloudinary file:', publicId)
}
