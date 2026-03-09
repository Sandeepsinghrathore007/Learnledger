/**
 * TopBar.jsx — Sticky header bar shown at the top of the main content area.
 *
 * Displays the current page title and today's date.
 *
 * Props:
 *   pageTitle {string} — Human-readable page title
 *
 * State: none (pure display)
 */

import { BORDER, TEXT1, TEXT3 } from '@/constants/theme'

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '18px', height: '18px' }}
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

export default function TopBar({ pageTitle, showMenuButton = false, onMenuClick = () => {} }) {
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
  })

  return (
    <header className="px-4 sm:px-6 lg:px-7" style={{
      height: '58px',
      background: 'rgba(7,5,16,0.88)',
      backdropFilter: 'blur(20px)',
      borderBottom: `1px solid ${BORDER}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 40,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        {showMenuButton && (
          <button
            type="button"
            className="lg:hidden"
            onClick={onMenuClick}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.03)',
              color: '#c4b5f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </button>
        )}
        <div style={{ minWidth: 0 }}>
        <h1 style={{
          color: TEXT1, fontFamily: "'DM Sans',sans-serif",
          fontWeight: '700', fontSize: '16px',
          margin: 0, letterSpacing: '-0.3px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {pageTitle}
        </h1>
        <p style={{ color: TEXT3, fontSize: '11px', margin: 0, fontFamily: "'DM Sans',sans-serif" }}>
          {today}
        </p>
        </div>
      </div>
    </header>
  )
}
