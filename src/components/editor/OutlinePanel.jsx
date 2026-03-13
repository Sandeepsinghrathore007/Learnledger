import { TEXT1, TEXT3 } from '@/constants/theme'

const PANEL_BACKGROUND = '#0d0b1a'
const PANEL_BORDER = 'rgba(255,255,255,0.08)'
const PANEL_TEXT = '#ede6ff'
const ACTIVE_ACCENT = '#7c3aed'
const LEVEL_BAR_COLORS = {
  1: '#8b5cf6',
  2: '#a78bfa',
  3: '#c4b5fd',
}

function getItemPadding(level) {
  if (level === 1) return '8px 10px'
  if (level === 2) return '7px 10px 7px 22px'
  return '6px 10px 6px 34px'
}

function getItemStyle(level, active) {
  const fontSize = level === 1 ? '13px' : level === 2 ? '12px' : '11px'
  const fontWeight = level === 1 ? '600' : '500'

  return {
    width: '100%',
    border: 'none',
    background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
    color: active ? ACTIVE_ACCENT : PANEL_TEXT,
    borderRadius: '8px',
    textAlign: 'left',
    padding: getItemPadding(level),
    fontFamily: "'DM Sans', sans-serif",
    fontSize,
    fontWeight,
    transition: 'background 0.15s ease, color 0.15s ease',
    opacity: level === 3 && !active ? 0.72 : 1,
  }
}

function OutlineIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '13px', height: '13px' }}
    >
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="8" y1="18" x2="20" y2="18" />
      <line x1="4" y1="6" x2="4.01" y2="6" />
      <line x1="4" y1="12" x2="4.01" y2="12" />
      <line x1="4" y1="18" x2="4.01" y2="18" />
    </svg>
  )
}

export default function OutlinePanel({ items, activeId, onSelect }) {
  return (
    <div
      style={{
        background: PANEL_BACKGROUND,
        border: `1px solid ${PANEL_BORDER}`,
        borderRadius: '12px',
        padding: '12px 10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px', padding: '0 2px' }}>
        <span style={{ color: '#b7abdd', display: 'inline-flex' }}>
          <OutlineIcon />
        </span>
        <h4
          style={{
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            fontWeight: '600',
            margin: 0,
          }}
        >
          Outline
        </h4>
      </div>

      {items.length === 0 ? (
        <p
          style={{
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            lineHeight: 1.6,
            margin: 0,
            padding: '2px 4px 0',
          }}
        >
          Add H1, H2, H3 headings to see outline
        </p>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            maxHeight: '250px',
            overflowY: 'auto',
            paddingRight: '2px',
          }}
        >
          {items.map((item) => {
            const active = item.id === activeId
            const barColor = LEVEL_BAR_COLORS[item.level] || LEVEL_BAR_COLORS[1]

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                style={getItemStyle(item.level, active)}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: 0,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      color: barColor,
                      fontWeight: '700',
                      fontSize: item.level === 3 ? '12px' : '13px',
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    |
                  </span>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.text}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
