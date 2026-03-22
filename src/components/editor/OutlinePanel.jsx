const DEFAULT_THEME = {
  accent: '#a855f7',
  accentSecondary: '#22d3ee',
  accentTertiary: '#34d399',
  panelBackground: 'linear-gradient(135deg, rgba(11,20,38,0.74), rgba(23,12,42,0.58))',
  panelBorder: 'rgba(148,163,184,0.16)',
  panelShadow: '0 20px 46px rgba(3,10,25,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
  pillBackground: 'rgba(255,255,255,0.04)',
  pillBorder: 'rgba(148,163,184,0.14)',
  pillText: '#d3defa',
  pillActiveBackground: 'linear-gradient(135deg, rgba(34,211,238,0.16), rgba(168,85,247,0.22))',
  pillActiveBorder: 'rgba(103,232,249,0.28)',
  pillActiveText: '#ffffff',
  cssVars: {
    '--note-editor-heading': '#ffffff',
    '--note-editor-text': '#edf3ff',
    '--note-editor-muted': '#9fb1d6',
  },
}

function getPalette(themeStyles) {
  const palette = themeStyles || DEFAULT_THEME

  return {
    ...DEFAULT_THEME,
    ...palette,
    cssVars: {
      ...DEFAULT_THEME.cssVars,
      ...(palette?.cssVars || {}),
    },
  }
}

function getItemPadding(level) {
  if (level === 1) return '9px 12px'
  if (level === 2) return '8px 12px 8px 24px'
  return '7px 12px 7px 36px'
}

function getItemStyle(level, active, palette) {
  const fontSize = level === 1 ? '13px' : level === 2 ? '12px' : '11px'
  const fontWeight = level === 1 ? '700' : '600'

  return {
    width: '100%',
    border: `1px solid ${active ? palette.pillActiveBorder : 'transparent'}`,
    background: active ? palette.pillActiveBackground : 'transparent',
    color: active ? palette.pillActiveText : palette.cssVars['--note-editor-text'],
    borderRadius: '12px',
    textAlign: 'left',
    padding: getItemPadding(level),
    fontFamily: "'DM Sans', sans-serif",
    fontSize,
    fontWeight,
    transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease',
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

export default function OutlinePanel({ items, activeId, onSelect, themeStyles = null }) {
  const palette = getPalette(themeStyles)
  const levelBarColors = {
    1: palette.accent,
    2: palette.accentSecondary,
    3: palette.accentTertiary,
  }

  return (
    <div
      style={{
        background: palette.panelBackground,
        border: `1px solid ${palette.panelBorder}`,
        borderRadius: '18px',
        padding: '14px 12px',
        boxShadow: palette.panelShadow,
        backdropFilter: 'blur(22px) saturate(160%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '0 2px' }}>
        <span style={{ color: palette.accentSecondary, display: 'inline-flex' }}>
          <OutlineIcon />
        </span>
        <h4
          style={{
            color: palette.cssVars['--note-editor-heading'],
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            fontWeight: '700',
            margin: 0,
          }}
        >
          Outline
        </h4>
      </div>

      {items.length === 0 ? (
        <p
          style={{
            color: palette.cssVars['--note-editor-muted'],
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            lineHeight: 1.65,
            margin: 0,
            padding: '4px 6px 2px',
          }}
        >
          Add H1, H2, H3 headings to see outline
        </p>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            maxHeight: '250px',
            overflowY: 'auto',
            paddingRight: '2px',
          }}
        >
          {items.map((item) => {
            const active = item.id === activeId
            const barColor = levelBarColors[item.level] || levelBarColors[1]

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                style={getItemStyle(item.level, active, palette)}
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
