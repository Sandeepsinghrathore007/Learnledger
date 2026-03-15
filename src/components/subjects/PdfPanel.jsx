/**
 * PdfPanel.jsx — Upload, list, and view PDF study materials per subject.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ExternalLinkIcon,
  PdfIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from '@/components/ui/Icons'
import { getCloudinaryPdfPageImageUrl, getCloudinaryPdfUrl } from '@/services/cloudinaryService'
import { SURFACE, SURF2, BORDER, BORDER2, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import { getPdfBinaryFile } from '@/utils/pdfBinaryStore'

function formatPdfDate(value) {
  if (!value) return 'Just now'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return String(value)
  }

  return parsed.toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatPdfSize(pdf) {
  if (pdf?.size) return String(pdf.size)

  const bytes = Number(pdf?.sizeBytes || 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Unknown size'
  if (bytes >= 1024 * 1024) {
    const megabytes = bytes / (1024 * 1024)
    return `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function isBlobPdfUrl(url) {
  return typeof url === 'string' && url.startsWith('blob:')
}

function getResolvedPdfUrl(pdf) {
  const rawUrl = String(pdf?.url || '').trim()
  if (!rawUrl) return ''
  if (isBlobPdfUrl(rawUrl)) return rawUrl

  if (rawUrl.includes('res.cloudinary.com')) {
    return getCloudinaryPdfUrl({
      url: rawUrl,
      publicId: pdf?.publicId,
      version: pdf?.version,
      resourceType: pdf?.resourceType,
      format: pdf?.format || 'pdf',
    })
  }

  return rawUrl
}

function isCloudinaryPdf(pdf) {
  return Boolean(
    pdf?.publicId
    || String(pdf?.url || '').trim().includes('res.cloudinary.com')
  )
}

function getViewerPageCount(pdf) {
  const pageCount = Number(pdf?.pageCount || 0)
  if (!Number.isFinite(pageCount) || pageCount <= 0) return 1
  return Math.min(Math.floor(pageCount), 80)
}

function getAiStatusMeta(pdf) {
  if (pdf.aiStatus === 'processing') {
    return {
      label: 'Processing',
      tone: {
        color: '#fbbf24',
        background: 'rgba(251,191,36,0.12)',
        border: 'rgba(251,191,36,0.24)',
      },
      canAsk: false,
    }
  }

  if (pdf.aiStatus === 'ready') {
    return {
      label: 'AI Ready',
      tone: {
        color: '#22c55e',
        background: 'rgba(34,197,94,0.12)',
        border: 'rgba(34,197,94,0.24)',
      },
      canAsk: true,
    }
  }

  return {
    label: 'Not processed',
    tone: {
      color: '#a1a1aa',
      background: 'rgba(161,161,170,0.12)',
      border: 'rgba(161,161,170,0.18)',
    },
    canAsk: false,
  }
}

function buildViewerSrc(url, mode = 'direct') {
  if (!url || isBlobPdfUrl(url)) return ''
  if (mode === 'google') {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
  }

  return `${url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`
}

function revokeObjectUrl(url = '') {
  if (!url || typeof window === 'undefined' || !window.URL?.revokeObjectURL) return
  window.URL.revokeObjectURL(url)
}

export default function PdfPanel({
  pdfs,
  color,
  onAdd,
  onDelete,
  onAskAI,
  feedback = null,
  binaryContext = null,
  title = '📄 Study Materials',
  helperText = 'Upload textbooks, notes, and past papers for revision and AI context.',
  emptyTitle = 'Upload PDFs — textbooks, notes, past papers',
  emptyDescription = 'Click anywhere to upload a PDF and prepare it for study sessions across your devices.',
  showAskAI = true,
  showAiStatus = true,
}) {
  const inputRef = useRef(null)
  const localObjectUrlRef = useRef('')
  const viewerRequestRef = useRef(0)
  const [viewing, setViewing] = useState(null)
  const [viewerMode, setViewerMode] = useState('direct')
  const [localViewingUrl, setLocalViewingUrl] = useState('')
  const [isResolvingLocalBinary, setIsResolvingLocalBinary] = useState(false)

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (!file || file.type !== 'application/pdf') return

    onAdd(file)
    event.target.value = ''
  }

  const clearLocalViewingUrl = () => {
    viewerRequestRef.current += 1
    if (localObjectUrlRef.current) {
      revokeObjectUrl(localObjectUrlRef.current)
      localObjectUrlRef.current = ''
    }
    setLocalViewingUrl('')
  }

  const handleOpenViewer = async (pdf) => {
    if (!pdf?.url) return

    clearLocalViewingUrl()
    setViewerMode('direct')
    setViewing(pdf)
    setIsResolvingLocalBinary(true)
    const requestId = viewerRequestRef.current + 1
    viewerRequestRef.current = requestId

    const binarySubjectId = String(binaryContext?.subjectId || '').trim()
    if (!binarySubjectId || !pdf?.id) {
      setIsResolvingLocalBinary(false)
      return
    }

    try {
      const localFile = await getPdfBinaryFile({
        userId: binaryContext?.userId || null,
        subjectId: binarySubjectId,
        pdfId: pdf.id,
      })

      if (localFile && typeof window !== 'undefined' && window.URL?.createObjectURL) {
        const objectUrl = window.URL.createObjectURL(localFile)
        if (viewerRequestRef.current !== requestId) {
          revokeObjectUrl(objectUrl)
          return
        }
        localObjectUrlRef.current = objectUrl
        setLocalViewingUrl(objectUrl)
      }
    } catch (error) {
      console.warn('Unable to load local PDF binary:', error)
    } finally {
      if (viewerRequestRef.current === requestId) {
        setIsResolvingLocalBinary(false)
      }
    }
  }

  const pdfCountLabel = `${pdfs.length} PDF${pdfs.length === 1 ? '' : 's'}`
  const remoteViewingUrl = getResolvedPdfUrl(viewing)
  const resolvedViewingUrl = localViewingUrl || remoteViewingUrl
  const activeViewerSrc = viewerMode === 'google'
    ? buildViewerSrc(remoteViewingUrl, 'google')
    : resolvedViewingUrl
  const viewerUsesLocalBinary = Boolean(localViewingUrl)
  const viewerIsBlob = !viewerUsesLocalBinary && isBlobPdfUrl(remoteViewingUrl)
  const viewerUsesCloudinaryPages = Boolean(
    viewing
    && !viewerUsesLocalBinary
    && !viewerIsBlob
    && isCloudinaryPdf(viewing)
    && String(viewing?.resourceType || 'image').trim().toLowerCase() !== 'raw'
    && !remoteViewingUrl.includes('/raw/upload/')
  )
  const viewerOpenUrl = viewerUsesCloudinaryPages
    ? getCloudinaryPdfPageImageUrl({
        url: viewing?.url,
        publicId: viewing?.publicId,
        version: viewing?.version,
        page: 1,
      })
    : resolvedViewingUrl
  const viewerPages = viewerUsesCloudinaryPages
    ? Array.from({ length: getViewerPageCount(viewing) }, (_, index) => index + 1)
    : []
  useEffect(() => {
    if (!viewing) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        clearLocalViewingUrl()
        setViewing(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewing])

  useEffect(() => () => {
    if (localObjectUrlRef.current) {
      revokeObjectUrl(localObjectUrlRef.current)
    }
  }, [])

  return (
    <section
      style={{
        width: '100%',
        minWidth: 0,
        background: 'linear-gradient(180deg, rgba(124,58,237,0.08), rgba(13,11,26,0.98) 22%)',
        border: `1px solid ${BORDER2}`,
        borderRadius: '22px',
        padding: 'clamp(18px, 4vw, 24px)',
        boxShadow: '0 24px 50px rgba(0,0,0,0.22)',
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ marginBottom: '16px', minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div className="flex flex-wrap items-center gap-3">
            <h3 style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '18px', fontWeight: '800', margin: 0 }}>
              {title}
            </h3>
            <span
              style={{
                borderRadius: '999px',
                padding: '5px 10px',
                background: 'rgba(124,58,237,0.12)',
                border: '1px solid rgba(124,58,237,0.22)',
                color: '#c4b5fd',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '11px',
                fontWeight: '700',
              }}
            >
              {pdfCountLabel}
            </span>
          </div>
          <p style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', margin: '6px 0 0' }}>
            {helperText}
          </p>
        </div>

        <button
          type="button"
          className="w-full justify-center sm:w-auto"
          onClick={() => inputRef.current?.click()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            borderRadius: '12px',
            border: `1px solid ${color}40`,
            background: `${color}18`,
            color,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            fontWeight: '700',
            padding: '10px 14px',
          }}
        >
          <span style={{ width: '14px', height: '14px' }}><UploadIcon /></span>
          Upload PDF
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>

      {feedback?.text && (
        <div
          style={{
            marginBottom: '14px',
            borderRadius: '12px',
            padding: '10px 12px',
            border: feedback.type === 'error'
              ? '1px solid rgba(239,68,68,0.24)'
              : `1px solid ${color}30`,
            background: feedback.type === 'error'
              ? 'rgba(239,68,68,0.08)'
              : `${color}10`,
            color: feedback.type === 'error' ? '#fca5a5' : TEXT2,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            lineHeight: 1.6,
          }}
        >
          {feedback.text}
        </div>
      )}

      {pdfs.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            width: '100%',
            border: `1px dashed ${BORDER2}`,
            borderRadius: '18px',
            background: 'rgba(255,255,255,0.015)',
            padding: '34px 18px',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              margin: '0 auto 14px',
              background: 'rgba(124,58,237,0.14)',
              border: '1px solid rgba(124,58,237,0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c4b5fd',
            }}
          >
            <span style={{ width: '24px', height: '24px' }}><UploadIcon /></span>
          </div>
          <div style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '15px', fontWeight: '700' }}>
            {emptyTitle}
          </div>
          <p style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', margin: '8px 0 0', lineHeight: 1.7 }}>
            {emptyDescription}
          </p>
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          {pdfs.map((pdf) => {
            const aiStatus = getAiStatusMeta(pdf)
            const resolvedPdfUrl = getResolvedPdfUrl(pdf)
            const blobUrl = isBlobPdfUrl(resolvedPdfUrl)

            return (
              <article
                key={pdf.id}
                style={{
                  minWidth: 0,
                  padding: '14px',
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                  borderRadius: '16px',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.borderColor = BORDER2
                  event.currentTarget.style.background = SURF2
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.borderColor = BORDER
                  event.currentTarget.style.background = SURFACE
                }}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between" style={{ minWidth: 0 }}>
                  <div className="flex min-w-0 gap-3">
                    <div
                      className="hidden sm:flex"
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        flexShrink: 0,
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.22)',
                        color: '#f87171',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ width: '18px', height: '18px' }}><PdfIcon /></span>
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          color: TEXT1,
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '14px',
                          fontWeight: '700',
                          lineHeight: 1.4,
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                        }}
                        title={pdf.name}
                      >
                        {pdf.name}
                      </div>
                      <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '11px', marginTop: '5px' }}>
                        {formatPdfSize(pdf)} • Uploaded {formatPdfDate(pdf.addedAt || pdf.createdAt)}
                      </div>
                      {showAiStatus && (
                        <div style={{ marginTop: '10px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              borderRadius: '999px',
                              padding: '5px 9px',
                              background: aiStatus.tone.background,
                              border: `1px solid ${aiStatus.tone.border}`,
                              color: aiStatus.tone.color,
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: '11px',
                              fontWeight: '700',
                            }}
                          >
                            {aiStatus.label}
                          </span>
                        </div>
                      )}
                      {blobUrl && (
                        <div style={{ color: '#fca5a5', fontFamily: "'DM Sans', sans-serif", fontSize: '11px', marginTop: '8px', lineHeight: 1.6 }}>
                          This PDF was uploaded on another device. Please re-upload to view it here.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap sm:justify-end">
                    {showAskAI && (
                      <button
                        type="button"
                        className="flex-1 sm:flex-none"
                        onClick={() => aiStatus.canAsk && onAskAI?.(pdf)}
                        disabled={!aiStatus.canAsk}
                        style={{
                          minWidth: '88px',
                          height: '34px',
                          borderRadius: '10px',
                          border: aiStatus.canAsk ? `1px solid ${color}3a` : `1px solid ${BORDER}`,
                          background: aiStatus.canAsk ? `${color}18` : 'rgba(255,255,255,0.03)',
                          color: aiStatus.canAsk ? color : TEXT3,
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: aiStatus.canAsk ? 'pointer' : 'not-allowed',
                          opacity: aiStatus.canAsk ? 1 : 0.72,
                        }}
                      >
                        Ask AI
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex-1 sm:flex-none"
                      onClick={() => handleOpenViewer(pdf)}
                      disabled={!resolvedPdfUrl}
                      style={{
                        minWidth: '76px',
                        height: '34px',
                        borderRadius: '10px',
                        border: resolvedPdfUrl ? `1px solid ${color}3a` : `1px solid ${BORDER}`,
                        background: resolvedPdfUrl ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.03)',
                        color: resolvedPdfUrl ? TEXT2 : TEXT3,
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: resolvedPdfUrl ? 'pointer' : 'not-allowed',
                        opacity: resolvedPdfUrl ? 1 : 0.72,
                      }}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(pdf.id)}
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '10px',
                        border: '1px solid rgba(239,68,68,0.2)',
                        background: 'rgba(239,68,68,0.08)',
                        color: '#f87171',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                      aria-label={`Delete ${pdf.name}`}
                    >
                      <span style={{ width: '14px', height: '14px' }}><TrashIcon /></span>
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {viewing && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => {
            clearLocalViewingUrl()
            setViewing(null)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 5000,
            background: 'rgba(3,1,10,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(12px, 2vw, 20px)',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(1240px, calc(100vw - 24px))',
              maxWidth: '1240px',
              margin: '0 auto',
              height: 'min(92vh, calc(100vh - 24px))',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: '22px',
              border: `1px solid ${BORDER2}`,
              background: 'linear-gradient(180deg, rgba(13,11,26,0.98), rgba(8,6,18,0.98))',
              boxShadow: '0 32px 80px rgba(0,0,0,0.42)',
            }}
          >
            <div
              style={{
                flexShrink: 0,
                padding: '14px 16px',
                borderBottom: `1px solid ${BORDER}`,
                background: 'rgba(9,7,18,0.94)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ minWidth: 0, paddingRight: '4px' }}>
                  <div
                    style={{
                      color: TEXT1,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '15px',
                      fontWeight: '700',
                      lineHeight: 1.4,
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      paddingLeft: '2px',
                    }}
                  >
                    {viewing.name}
                  </div>
                  <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '11px', marginTop: '4px' }}>
                    {formatPdfSize(viewing)} • Uploaded {formatPdfDate(viewing.addedAt || viewing.createdAt)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!viewerIsBlob && resolvedViewingUrl && viewerUsesCloudinaryPages && (
                    <div
                      style={{
                        borderRadius: '999px',
                        border: `1px solid ${color}30`,
                        background: `${color}14`,
                        color,
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '7px 10px',
                      }}
                    >
                      Image preview mode
                    </div>
                  )}

                  {!viewerIsBlob && resolvedViewingUrl && !viewerUsesCloudinaryPages && (
                    <>
                      <button
                        type="button"
                        onClick={() => setViewerMode('direct')}
                        style={{
                          height: '34px',
                          borderRadius: '10px',
                          border: viewerMode === 'direct' ? `1px solid ${color}42` : `1px solid ${BORDER2}`,
                          background: viewerMode === 'direct' ? `${color}18` : 'rgba(255,255,255,0.04)',
                          color: viewerMode === 'direct' ? color : TEXT2,
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '12px',
                          fontWeight: '700',
                          padding: '0 12px',
                        }}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewerMode('google')}
                        style={{
                          height: '34px',
                          borderRadius: '10px',
                          border: viewerMode === 'google' ? `1px solid ${color}42` : `1px solid ${BORDER2}`,
                          background: viewerMode === 'google' ? `${color}18` : 'rgba(255,255,255,0.04)',
                          color: viewerMode === 'google' ? color : TEXT2,
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '12px',
                          fontWeight: '700',
                          padding: '0 12px',
                        }}
                      >
                        Google
                      </button>
                    </>
                  )}

                  {!viewerIsBlob && viewerOpenUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(viewerOpenUrl, '_blank', 'noopener,noreferrer')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        height: '34px',
                        borderRadius: '10px',
                        border: `1px solid ${BORDER2}`,
                        background: 'rgba(255,255,255,0.04)',
                        color: TEXT2,
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '12px',
                        fontWeight: '700',
                        padding: '0 12px',
                      }}
                    >
                      <span style={{ width: '13px', height: '13px' }}><ExternalLinkIcon /></span>
                      ↗ Open
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      clearLocalViewingUrl()
                      setViewing(null)
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '7px',
                      minWidth: '92px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(139,92,246,0.14)',
                      border: `1px solid ${BORDER2}`,
                      color: TEXT1,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '12px',
                      fontWeight: '700',
                      padding: '0 12px',
                    }}
                    aria-label="Close PDF viewer"
                  >
                    <span style={{ width: '14px', height: '14px' }}><XIcon /></span>
                    Close
                  </button>
                </div>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                padding: '14px',
                overflow: 'hidden',
              }}
            >
              {viewerIsBlob ? (
                <div
                  style={{
                    height: '100%',
                    borderRadius: '16px',
                    border: '1px dashed rgba(239,68,68,0.26)',
                    background: 'rgba(239,68,68,0.08)',
                    display: 'grid',
                    placeItems: 'center',
                    padding: '24px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ maxWidth: '420px' }}>
                    <div style={{ fontSize: '34px', marginBottom: '10px' }}>📄</div>
                    <div style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '16px', fontWeight: '700' }}>
                      This PDF was uploaded on another device.
                    </div>
                    <p style={{ color: TEXT2, fontFamily: "'DM Sans', sans-serif", fontSize: '13px', lineHeight: 1.7, margin: '8px 0 0' }}>
                      Please re-upload to view it here.
                    </p>
                  </div>
                </div>
              ) : viewerUsesCloudinaryPages ? (
                <div
                  style={{
                    height: '100%',
                    borderRadius: '16px',
                    background: '#090712',
                    border: `1px solid ${BORDER}`,
                    overflowY: 'auto',
                    padding: '14px',
                  }}
                >
                  <div
                    style={{
                      color: TEXT3,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '11px',
                      marginBottom: '12px',
                    }}
                  >
                    Showing Cloudinary page preview so this PDF can be viewed across devices even when direct PDF delivery is blocked.
                  </div>
                  <div
                    style={{
                      width: 'min(100%, 960px)',
                      margin: '0 auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    {viewerPages.map((pageNumber) => {
                      const pageImageUrl = getCloudinaryPdfPageImageUrl({
                        url: viewing?.url,
                        publicId: viewing?.publicId,
                        version: viewing?.version,
                        page: pageNumber,
                      })

                      return (
                        <div
                          key={`${viewing.id}-page-${pageNumber}`}
                          style={{
                            borderRadius: '14px',
                            overflow: 'hidden',
                            background: 'rgba(255,255,255,0.02)',
                            border: `1px solid ${BORDER}`,
                          }}
                        >
                          <div
                            style={{
                              color: TEXT3,
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: '11px',
                              padding: '8px 12px',
                              borderBottom: `1px solid ${BORDER}`,
                            }}
                          >
                            Page {pageNumber}
                          </div>
                          <img
                            src={pageImageUrl}
                            alt={`${viewing.name} page ${pageNumber}`}
                            loading="lazy"
                            style={{
                              display: 'block',
                              width: '100%',
                              height: 'auto',
                              background: '#ffffff',
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', height: '100%', flexDirection: 'column', gap: '10px' }}>
                  <div
                    style={{
                      color: TEXT3,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '11px',
                    }}
                  >
                    {isResolvingLocalBinary
                      ? 'Checking for the original PDF on this device...'
                      : viewerUsesLocalBinary
                        ? 'Showing the original PDF from this device cache.'
                        : viewerMode === 'direct'
                          ? 'Inline preview mode. If your browser blocks the PDF, use Google Drive or Open.'
                          : 'Google viewer mode. If it still fails, switch back to Preview or use Open.'}
                  </div>
                  <iframe
                    key={`${viewing.id}-${viewerMode}`}
                    src={activeViewerSrc}
                    title={viewing.name}
                    style={{
                      flex: 1,
                      width: '100%',
                      border: 'none',
                      borderRadius: '16px',
                      background: '#090712',
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  )
}
