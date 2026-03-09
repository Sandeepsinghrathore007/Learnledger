import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

function EmptyState({ label }) {
  return (
    <div
      style={{
        minHeight: '220px',
        display: 'grid',
        placeItems: 'center',
        border: `1px dashed ${BORDER}`,
        borderRadius: '14px',
        color: TEXT3,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '13px',
      }}
    >
      {label}
    </div>
  )
}

function formatValue(value, suffix = '') {
  if (!Number.isFinite(value)) return `0${suffix}`
  return `${Math.round(value)}${suffix}`
}

export function LineChart({
  data,
  color = '#8b5cf6',
  valueSuffix = '',
  emptyLabel = 'No data available yet.',
}) {
  if (!Array.isArray(data) || data.length === 0 || data.every((item) => item.value === 0)) {
    return <EmptyState label={emptyLabel} />
  }

  const width = 560
  const height = 220
  const padding = { top: 18, right: 16, bottom: 34, left: 18 }
  const maxValue = Math.max(...data.map((item) => item.value), 1)
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const points = data.map((item, index) => {
    const x = padding.left + (chartWidth * index) / Math.max(1, data.length - 1)
    const y = padding.top + chartHeight - (item.value / maxValue) * chartHeight
    return {
      ...item,
      x,
      y,
    }
  })

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '220px', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`line-fill-${color.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = padding.top + chartHeight - chartHeight * step

          return (
            <line
              key={step}
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          )
        })}

        <path d={areaPath} fill={`url(#line-fill-${color.replace('#', '')})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((point) => (
          <g key={point.id || point.label}>
            <circle cx={point.x} cy={point.y} r="4.5" fill={color} />
            <title>{`${point.label}: ${formatValue(point.value, valueSuffix)}`}</title>
          </g>
        ))}
      </svg>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
          gap: '6px',
          marginTop: '-4px',
        }}
      >
        {data.map((item) => (
          <div key={item.id || item.label} style={{ minWidth: 0 }}>
            <div
              style={{
                color: TEXT2,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '11px',
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              {formatValue(item.value, valueSuffix)}
            </div>
            <div
              title={item.label}
              style={{
                color: TEXT3,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '10px',
                textAlign: 'center',
                marginTop: '4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.shortLabel || item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BarChart({
  data,
  color = '#22c55e',
  valueSuffix = '',
  emptyLabel = 'No activity available yet.',
}) {
  if (!Array.isArray(data) || data.length === 0 || data.every((item) => item.value === 0)) {
    return <EmptyState label={emptyLabel} />
  }

  const maxValue = Math.max(...data.map((item) => item.value), 1)

  return (
    <div
      style={{
        minHeight: '220px',
        display: 'grid',
        gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
        gap: '10px',
        alignItems: 'end',
      }}
    >
      {data.map((item) => (
        <div key={item.id || item.label} style={{ minWidth: 0 }}>
          <div
            style={{
              height: '180px',
              borderRadius: '14px',
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.02)',
              padding: '8px 8px 10px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
            title={`${item.label}: ${formatValue(item.value, valueSuffix)}`}
          >
            <div
              style={{
                height: `${Math.max(6, (item.value / maxValue) * 130)}px`,
                borderRadius: '10px',
                background: `linear-gradient(180deg, ${color}, ${color}88)`,
                boxShadow: `0 10px 24px ${color}30`,
              }}
            />
            <div
              style={{
                color: TEXT1,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '11px',
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              {formatValue(item.value, valueSuffix)}
            </div>
          </div>
          <div
            title={item.label}
            style={{
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '10px',
              textAlign: 'center',
              marginTop: '8px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.shortLabel || item.label}
          </div>
        </div>
      ))}
    </div>
  )
}

export function RankBars({
  data,
  valueSuffix = '',
  emptyLabel = 'Nothing to rank yet.',
}) {
  if (!Array.isArray(data) || data.length === 0 || data.every((item) => item.value === 0)) {
    return <EmptyState label={emptyLabel} />
  }

  const maxValue = Math.max(...data.map((item) => item.value), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {data.map((item) => (
        <div key={item.id || item.label}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '12px',
              marginBottom: '6px',
              alignItems: 'baseline',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: TEXT1,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '13px',
                  fontWeight: '700',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.label}
              </div>
              {item.meta && (
                <div
                  style={{
                    color: TEXT3,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '11px',
                    marginTop: '2px',
                  }}
                >
                  {item.meta}
                </div>
              )}
            </div>
            <div
              style={{
                color: item.color || TEXT2,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '800',
                flexShrink: 0,
              }}
            >
              {formatValue(item.value, valueSuffix)}
            </div>
          </div>
          <div
            style={{
              height: '10px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.05)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${item.value > 0 ? Math.max(4, (item.value / maxValue) * 100) : 0}%`,
                height: '100%',
                borderRadius: '999px',
                background: `linear-gradient(90deg, ${item.color || '#8b5cf6'}, ${(item.color || '#8b5cf6')}88)`,
              }}
            />
          </div>
          {Number.isFinite(item.secondaryValue) && item.secondaryValue > 0 && (
            <div
              style={{
                color: TEXT3,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '10.5px',
                marginTop: '5px',
              }}
            >
              Generated: {formatValue(item.secondaryValue, valueSuffix)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
