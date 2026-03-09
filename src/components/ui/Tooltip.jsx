/**
 * Tooltip.jsx — CSS-driven tooltip wrapper component.
 *
 * Wraps any child element and shows a label tooltip above it on hover.
 * Uses the .tip-wrap / .tip-label CSS classes defined in global.css.
 *
 * Props:
 *   label    {string}    — Text shown in the tooltip
 *   children {ReactNode} — The element to wrap
 *
 * State: none (pure CSS hover)
 */

export default function Tooltip({ label, children }) {
  return (
    <span className="tip-wrap">
      {children}
      <span className="tip-label">{label}</span>
    </span>
  )
}
