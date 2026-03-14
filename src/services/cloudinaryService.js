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
  formData.append('resource_type', 'raw') // required for PDF
  formData.append('public_id', `learnledger/${userId}/${subjectId}/${pdfId}`)
  formData.append('tags', `userId_${userId},subjectId_${subjectId}`)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`,
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
    url: data.secure_url,
    publicId: data.public_id,
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
