/**
 * FormField.jsx — Labelled text input / textarea form field.
 *
 * Props:
 *   label       {string}    — Field label (shown uppercase above input)
 *   value       {string}    — Controlled value
 *   onChange    {Function}  — Called with new string value
 *   placeholder {string}    — Input placeholder text
 *   multi       {boolean}   — If true, renders a <textarea> instead of <input>
 *
 * State: none (fully controlled)
 */

import { BORDER, BORDER2, TEXT1, TEXT3 } from '@/constants/theme'

export default function FormField({ label, value, onChange, placeholder, multi = false }) {
  const Tag = multi ? 'textarea' : 'input'

  const sharedStyle = {
    width: '100%', padding: '10px 14px',
    background: 'rgba(139,92,246,0.04)', border: `1px solid ${BORDER}`,
    borderRadius: '10px', color: TEXT1,
    fontFamily: "'DM Sans','Noto Sans Devanagari',sans-serif",
    fontSize: '13.5px', outline: 'none',
    resize: multi ? 'vertical' : 'none',
    transition: 'border-color 0.2s',
    minHeight: multi ? '72px' : 'auto',
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      {label && (
        <label style={{
          display: 'block', color: TEXT3, fontSize: '11px',
          fontFamily: "'DM Sans',sans-serif", fontWeight: '600',
          marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px',
        }}>
          {label}
        </label>
      )}
      <Tag
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={multi ? 3 : undefined}
        style={sharedStyle}
        onFocus={(e)  => (e.target.style.borderColor = BORDER2)}
        onBlur={(e)   => (e.target.style.borderColor = BORDER)}
      />
    </div>
  )
}
