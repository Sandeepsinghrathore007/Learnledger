/**
 * ComingSoonPage.jsx — Placeholder page for features not yet built.
 *
 * Shown for all pages other than Subjects (Phases 3–8).
 *
 * Props:
 *   pageId {string} — Navigation page id (e.g. 'timer', 'analytics')
 *
 * State: none
 */

import { NAV_ITEMS, PAGE_DESCRIPTIONS } from '@/constants/navigation'
import { BORDER } from '@/constants/theme'

export default function ComingSoonPage({ pageId }) {
  const navItem = NAV_ITEMS.find(n => n.id === pageId) ?? { icon: '🚧', label: pageId }
  const description = PAGE_DESCRIPTIONS[pageId] ?? ''

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '60vh', textAlign: 'center',
    }}>
      {/* Icon card */}
      <div style={{
        width: '78px', height: '78px', borderRadius: '20px',
        background: 'linear-gradient(135deg,rgba(124,58,237,0.16),rgba(79,70,229,0.08))',
        border: '1px solid rgba(124,58,237,0.22)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '34px', marginBottom: '18px',
      }}>
        {navItem.icon}
      </div>

      <h2 style={{
        color: '#ede6ff', fontFamily: "'DM Sans',sans-serif",
        fontWeight: '800', fontSize: '20px',
        margin: '0 0 8px', letterSpacing: '-0.4px',
      }}>
        {navItem.label}
      </h2>

      <p style={{
        color: '#5a5175', fontFamily: "'DM Sans',sans-serif",
        fontSize: '14px', maxWidth: '320px', lineHeight: '1.6',
        margin: '0 0 20px',
      }}>
        {description}
      </p>

      {/* Coming soon badge */}
      <div style={{
        background: 'rgba(124,58,237,0.07)',
        border: `1px dashed rgba(124,58,237,0.22)`,
        borderRadius: '9px', padding: '8px 16px',
        color: '#5a5175', fontSize: '12.5px',
        fontFamily: "'DM Sans',sans-serif",
      }}>
        🚧 Coming in a future phase
      </div>
    </div>
  )
}
