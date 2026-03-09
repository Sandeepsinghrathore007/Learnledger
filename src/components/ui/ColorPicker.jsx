/**
 * ColorPicker.jsx — Palette of colour swatches for subject colour selection.
 *
 * Props:
 *   value    {string}   — Currently selected hex colour
 *   onChange {Function} — Called with new hex colour string
 *
 * State: none (controlled)
 */

import { SUBJECT_COLORS } from '@/constants/theme'
import { TEXT3 } from '@/constants/theme'

export default function ColorPicker({ value, onChange }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <label style={{
        display: 'block', color: TEXT3, fontSize: '11px',
        fontFamily: "'DM Sans',sans-serif", fontWeight: '600',
        marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.8px',
      }}>
        Color
      </label>
      <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
        {SUBJECT_COLORS.map(color => (
          <button
            key={color}
            onClick={() => onChange(color)}
            style={{
              width: '24px', height: '24px', borderRadius: '50%',
              background: color,
              border: value === color ? '2.5px solid #fff' : '2.5px solid transparent',
              transition: 'all 0.14s',
              boxShadow: value === color ? `0 0 10px ${color}80` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  )
}
