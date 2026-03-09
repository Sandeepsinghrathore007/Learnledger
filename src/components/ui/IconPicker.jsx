/**
 * IconPicker.jsx — Grid of emoji/symbol icons for subject icon selection.
 *
 * Props:
 *   value    {string}   — Currently selected icon value (e.g. '∑')
 *   onChange {Function} — Called with selected icon value string
 *
 * State: none (controlled)
 */

import { SUBJECT_ICONS, ACCENT, TEXT1, TEXT3 } from '@/constants/theme'

export default function IconPicker({ value, onChange }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{
        display: 'block', color: TEXT3, fontSize: '11px',
        fontFamily: "'DM Sans',sans-serif", fontWeight: '600',
        marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.8px',
      }}>
        Icon
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10,1fr)', gap: '5px' }}>
        {SUBJECT_ICONS.map(ic => (
          <button
            key={ic.v}
            title={ic.l}
            onClick={() => onChange(ic.v)}
            style={{
              height: '34px', borderRadius: '8px',
              background:  value === ic.v ? 'rgba(124,58,237,0.28)' : 'rgba(255,255,255,0.025)',
              border:      value === ic.v ? `1px solid ${ACCENT}60`  : '1px solid rgba(255,255,255,0.05)',
              color: TEXT1, fontSize: '15px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.12s',
            }}
          >
            {ic.v}
          </button>
        ))}
      </div>
    </div>
  )
}
