import Tooltip from '@/components/ui/Tooltip'
import { BORDER, TEXT2, TEXT3 } from '@/constants/theme'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number)
  return new Date(year, month - 1, day)
}

function buildWeekColumns(days) {
  if (!Array.isArray(days) || days.length === 0) return []

  const firstDate = parseDateKey(days[0].date)
  const leadingOffset = (firstDate.getDay() + 6) % 7
  const padded = [...Array.from({ length: leadingOffset }, () => null), ...days]
  const weeks = []

  for (let index = 0; index < padded.length; index += 7) {
    weeks.push(padded.slice(index, index + 7))
  }

  return weeks
}

function buildMonthLabels(weeks) {
  let previousMonth = ''

  return weeks.map((week) => {
    const firstActiveDay = week.find(Boolean)
    if (!firstActiveDay) return ''

    const monthLabel = parseDateKey(firstActiveDay.date).toLocaleDateString('en-IN', {
      month: 'short',
    })

    if (monthLabel === previousMonth) return ''
    previousMonth = monthLabel
    return monthLabel
  })
}

export default function ActivityHeatmap({ heatmap }) {
  const weeks = buildWeekColumns(heatmap?.days || [])
  const monthLabels = buildMonthLabels(weeks)

  if (weeks.length === 0) {
    return (
      <div
        style={{
          minHeight: '180px',
          display: 'grid',
          placeItems: 'center',
          border: `1px dashed ${BORDER}`,
          borderRadius: '16px',
          color: TEXT3,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
        }}
      >
        No study activity yet.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '6px' }}>
      <div style={{ minWidth: `${weeks.length * 18 + 72}px` }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `56px repeat(${weeks.length}, 14px)`,
            columnGap: '4px',
            rowGap: '8px',
            alignItems: 'center',
          }}
        >
          <div />
          {monthLabels.map((label, index) => (
            <div
              key={`${label}-${index}`}
              style={{
                color: TEXT3,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '10px',
                textAlign: 'center',
                width: '14px',
                transform: 'translateX(-4px)',
              }}
            >
              {label}
            </div>
          ))}

          {WEEKDAY_LABELS.map((weekday, rowIndex) => (
            <div key={weekday} style={{ display: 'contents' }}>
              <div
                style={{
                  color: rowIndex % 2 === 0 ? TEXT3 : 'transparent',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '10px',
                  paddingRight: '8px',
                }}
              >
                {rowIndex % 2 === 0 ? weekday : '.'}
              </div>

              {weeks.map((week, columnIndex) => {
                const day = week[rowIndex]

                if (!day) {
                  return <div key={`${weekday}-${columnIndex}`} style={{ width: '14px', height: '14px' }} />
                }

                return (
                  <Tooltip key={day.date} label={day.label}>
                    <div
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '4px',
                        background: day.color,
                        border: `1px solid ${day.count > 0 ? 'transparent' : 'rgba(255,255,255,0.05)'}`,
                        boxShadow: day.count > 0 ? `0 0 16px ${day.color}30` : 'none',
                      }}
                    />
                  </Tooltip>
                )
              })}
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              color: TEXT2,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
            }}
          >
            {heatmap.activeDays} active days in the last {heatmap.days.length} days
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '11px' }}>Less</span>
            {[
              'rgba(148,163,184,0.14)',
              'rgba(74,222,128,0.45)',
              'rgba(34,197,94,0.7)',
              '#15803d',
            ].map((color) => (
              <span
                key={color}
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '4px',
                  background: color,
                  border: `1px solid ${color === 'rgba(148,163,184,0.14)' ? 'rgba(255,255,255,0.05)' : 'transparent'}`,
                }}
              />
            ))}
            <span style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '11px' }}>More</span>
          </div>
        </div>
      </div>
    </div>
  )
}
