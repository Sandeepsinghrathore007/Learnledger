/**
 * PdfPanel.jsx — Upload, list, view, and delete PDF study materials per subject.
 *
 * PDFs use object URLs for preview, while the original file is cached locally
 * so AI preparation can be deferred until the student actually asks a question.
 *
 * Props:
 *   pdfs     {Array}    — Array of { id, name, url, size, addedAt, aiStatus, summary }
 *   color    {string}   — Subject accent colour
 *   onAdd    {Function} — (file) called after user selects a file
 *   onDelete {Function} — (id) remove a PDF
 *   onAskAI  {Function} — (pdf) open AI assistant with this PDF as context
 *   feedback {Object}   — Optional inline status message for upload/prep events
 *
 * State:
 *   viewing {Object|null} — Currently open PDF in the full-screen viewer
 */

import { useRef, useState } from 'react'
import { PdfIcon, UploadIcon, TrashIcon, XIcon } from '@/components/ui/Icons'
import Tooltip from '@/components/ui/Tooltip'
import { SURFACE, SURF2, BORDER, BORDER2, TEXT1, TEXT3 } from '@/constants/theme'

function getAiStatusMeta(pdf) {
  if (pdf.aiStatus === 'processing') {
    return {
      label: 'Preparing compressed PDF context...',
      buttonLabel: 'Preparing AI',
      canAsk: false,
    }
  }

  if (pdf.aiStatus === 'ready') {
    return {
      label: `AI ready${pdf.chunkCount ? ` • ${pdf.chunkCount} excerpts` : ''}`,
      buttonLabel: 'Ask AI',
      canAsk: true,
    }
  }

  if (pdf.aiStatus === 'error') {
    return {
      label: 'AI unavailable • re-upload to retry',
      buttonLabel: 'Ask AI',
      canAsk: false,
    }
  }

  return {
    label: 'AI on demand • parsed only when you ask',
    buttonLabel: 'Ask AI',
    canAsk: true,
  }
}

export default function PdfPanel({ pdfs, color, onAdd, onDelete, onAskAI, feedback = null }) {
  const inputRef       = useRef(null)
  const [viewing, setViewing] = useState(null)

  /** Handle file input change — validate PDF and create local object URL */
  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file || file.type !== 'application/pdf') return

    onAdd(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  return (
    <div style={{ marginTop: '28px' }}>
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginBottom: '14px' }}>
        <h3 className="flex flex-wrap items-center gap-2" style={{
          color: TEXT1, fontFamily: "'DM Sans',sans-serif",
          fontWeight: '700', fontSize: '15px',
          margin: 0,
        }}>
          <span style={{ width: '15px', height: '15px', color }}><PdfIcon /></span>
          Study Materials (PDFs)
          <span style={{ color: TEXT3, fontSize: '12px', fontWeight: '400' }}>
            {pdfs.length} {pdfs.length === 1 ? 'file' : 'files'}
          </span>
        </h3>

        <button
          className="w-full justify-center sm:w-auto sm:justify-start"
          onClick={() => inputRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: `${color}16`, border: `1px solid ${color}2e`,
            borderRadius: '10px', padding: '7px 14px',
            color, fontSize: '13px', fontFamily: "'DM Sans',sans-serif", fontWeight: '600',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = `${color}28`)}
          onMouseLeave={(e) => (e.currentTarget.style.background = `${color}16`)}
        >
          <span style={{ width: '13px', height: '13px' }}><UploadIcon /></span>
          Upload PDF
        </button>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>

      {feedback?.text && (
        <div
          style={{
            marginBottom: '12px',
            borderRadius: '10px',
            padding: '10px 12px',
            border: feedback.type === 'error'
              ? '1px solid rgba(239,68,68,0.24)'
              : `1px solid ${color}28`,
            background: feedback.type === 'error'
              ? 'rgba(239,68,68,0.08)'
              : `${color}10`,
            color: feedback.type === 'error' ? '#fca5a5' : TEXT1,
            fontSize: '12px',
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          {feedback.text}
        </div>
      )}

      {/* Empty state */}
      {pdfs.length === 0 ? (
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            border: `1px dashed ${BORDER}`, borderRadius: '12px',
            padding: '28px', textAlign: 'center', cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
          <p style={{ color: TEXT3, fontFamily: "'DM Sans',sans-serif", fontSize: '13px', margin: 0 }}>
            Upload PDFs — textbooks, reference material, past papers
          </p>
          <p style={{ color: TEXT3, fontFamily: "'DM Sans',sans-serif", fontSize: '11px', marginTop: '4px', opacity: 0.6 }}>
            Max 20 MB. Upload once, then prepare AI context only when needed.
          </p>
        </div>
      ) : (
        /* PDF list */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {pdfs.map(pdf => {
            const aiStatus = getAiStatusMeta(pdf)

            return (
              <div
                key={pdf.id}
                className="flex flex-wrap items-start gap-3 sm:flex-nowrap sm:items-center"
                style={{
                  padding: '12px 14px', background: SURFACE,
                  border: `1px solid ${BORDER}`, borderRadius: '11px',
                  transition: 'all 0.18s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = BORDER2; e.currentTarget.style.background = SURF2 }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER;  e.currentTarget.style.background = SURFACE }}
              >
                {/* PDF icon badge */}
                <div style={{
                  width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: '#f87171', fontSize: '14px', fontWeight: '700', fontFamily: 'monospace' }}>
                    PDF
                  </span>
                </div>

                {/* Name + meta */}
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{
                    color: TEXT1, fontFamily: "'DM Sans',sans-serif",
                    fontWeight: '600', fontSize: '13.5px',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {pdf.name}
                  </div>
                  <div style={{ color: TEXT3, fontSize: '11px', fontFamily: "'DM Sans',sans-serif" }}>
                    {pdf.size} · Added {pdf.addedAt}
                  </div>
                  <div style={{ color: aiStatus.canAsk ? color : TEXT3, fontSize: '11px', fontFamily: "'DM Sans',sans-serif", marginTop: '4px' }}>
                    {aiStatus.label}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex w-full justify-end gap-2 sm:w-auto" style={{ flexShrink: 0 }}>
                  <Tooltip label={aiStatus.canAsk ? 'Open AI with this PDF context' : aiStatus.label}>
                    <button
                      onClick={() => aiStatus.canAsk && onAskAI?.(pdf)}
                      disabled={!aiStatus.canAsk}
                      style={{
                        padding: '5px 11px', borderRadius: '7px',
                        background: aiStatus.canAsk ? `${color}14` : 'rgba(255,255,255,0.03)',
                        border: aiStatus.canAsk ? `1px solid ${color}28` : `1px solid ${BORDER}`,
                        color: aiStatus.canAsk ? color : TEXT3,
                        fontSize: '12px',
                        fontFamily: "'DM Sans',sans-serif",
                        fontWeight: '600',
                        opacity: aiStatus.canAsk ? 1 : 0.72,
                      }}
                    >
                      {aiStatus.buttonLabel}
                    </button>
                  </Tooltip>
                  <Tooltip label="View PDF">
                    <button
                      onClick={() => pdf.url && setViewing(pdf)}
                      disabled={!pdf.url}
                      style={{
                        padding: '5px 11px', borderRadius: '7px',
                        background: pdf.url ? `${color}14` : 'rgba(255,255,255,0.03)',
                        border: pdf.url ? `1px solid ${color}28` : `1px solid ${BORDER}`,
                        color: pdf.url ? color : TEXT3,
                        fontSize: '12px', fontFamily: "'DM Sans',sans-serif", fontWeight: '600',
                        opacity: pdf.url ? 1 : 0.72,
                      }}
                    >
                      View
                    </button>
                  </Tooltip>
                  <Tooltip label="Remove PDF">
                    <button
                      onClick={() => onDelete(pdf.id)}
                      style={{
                        width: '28px', height: '28px', borderRadius: '7px',
                        background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.12)',
                        color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <span style={{ width: '12px', height: '12px' }}><TrashIcon /></span>
                    </button>
                  </Tooltip>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Full-screen PDF viewer modal */}
      {viewing && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 700,
          background: 'rgba(3,1,10,0.95)',
          display: 'flex', flexDirection: 'column',
          padding: '20px', gap: '12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: TEXT1, fontFamily: "'DM Sans',sans-serif", fontWeight: '700', fontSize: '15px', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {viewing.name}
            </span>
            <button
              onClick={() => setViewing(null)}
              style={{
                width: '32px', height: '32px', borderRadius: '9px',
                background: 'rgba(139,92,246,0.1)', border: `1px solid ${BORDER2}`,
                color: TEXT1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ width: '14px', height: '14px' }}><XIcon /></span>
            </button>
          </div>
          <iframe
            src={viewing.url}
            title={viewing.name}
            style={{ flex: 1, border: 'none', borderRadius: '12px', width: '100%' }}
          />
        </div>
      )}
    </div>
  )
}
