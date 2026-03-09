/**
 * Modal.jsx — Generic overlay modal component.
 *
 * Renders a centred dialog with a frosted-glass backdrop.
 * Closes on Escape key or backdrop click.
 *
 * Props:
 *   open     {boolean}    — Whether the modal is visible
 *   onClose  {Function}   — Called when modal should close
 *   title    {string}     — Header title text
 *   width    {number}     — Max width in px (default 480)
 *   children {ReactNode}  — Modal body content
 *
 * State: none (controlled by parent via open/onClose)
 */

import { useEffect } from 'react'
import { XIcon } from './Icons'
import { SURF2, BORDER, BORDER2, TEXT1, TEXT3 } from '@/constants/theme'

export default function Modal({ open, onClose, title, width = 480, children }) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    /* Backdrop — click outside to close */
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(3,1,10,0.9)', backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px',
      }}
    >
      {/* Dialog panel */}
      <div
        className="animate-scale-in"
        style={{
          background: SURF2, border: `1px solid ${BORDER2}`,
          borderRadius: 'clamp(14px, 2.5vw, 20px)',
          padding: 'clamp(16px, 4vw, 28px)',
          width: '100%', maxWidth: `${width}px`,
          boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
          <h2 style={{ color: TEXT1, fontFamily: "'DM Sans',sans-serif", fontWeight: '700', fontSize: '16px', margin: 0 }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: 'rgba(139,92,246,0.08)', border: `1px solid ${BORDER}`,
              color: TEXT3, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ width: '13px', height: '13px' }}><XIcon /></span>
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}
