/**
 * AiScoreBadge.jsx — Displays a coloured AI performance badge.
 *
 * Shows score + band label (Excellent / Good / Fair / Needs Work),
 * or a "No tests yet" placeholder if no tests have been taken.
 *
 * Props:
 *   score  {number|null} — Score 0–100 (null = no tests taken)
 *   tests  {number}      — Number of tests attempted
 *   size   {'normal'|'small'} — Controls padding and font size
 *
 * State: none (pure display)
 */

import { getScoreBand } from '@/utils/aiScore'
import { TEXT3 } from '@/constants/theme'

export default function AiScoreBadge({ score, tests, size = 'normal' }) {
  const small = size === 'small'
  const pad   = small ? '3px 8px'  : '5px 11px'
  const font  = small ? '10px'     : '11px'

  // No tests taken — show muted placeholder
  if (!tests || score === null) {
    return (
      <span style={{
        padding: pad, background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '7px', color: TEXT3,
        fontSize: font, fontFamily: "'DM Sans',sans-serif",
      }}>
        No tests yet
      </span>
    )
  }

  const band = getScoreBand(score)

  return (
    <span style={{
      padding: small ? '3px 9px' : '5px 12px',
      background: `${band.color}12`, border: `1px solid ${band.color}30`,
      borderRadius: '7px', color: band.color,
      fontSize: font, fontFamily: "'DM Sans',sans-serif", fontWeight: '700',
      display: 'inline-flex', alignItems: 'center', gap: '5px',
    }}>
      {/* Glowing dot indicator */}
      <span style={{
        width: '5px', height: '5px', borderRadius: '50%',
        background: band.color, boxShadow: `0 0 5px ${band.color}`,
        flexShrink: 0,
      }} />
      {score}% · {band.label}
    </span>
  )
}
