/**
 * PerformanceChart.jsx — Visual performance analytics with weak areas highlighted.
 */

import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

export default function PerformanceChart({ accuracyByDifficulty, topicPerformance, weakAreas }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${BORDER}`,
      borderRadius: '14px',
      padding: '20px',
      marginBottom: '24px',
    }}>
      <h3 style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '16px', fontWeight: '700', margin: '0 0 20px' }}>
        📊 Performance Analytics
      </h3>

      {/* Difficulty Breakdown */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ color: TEXT2, fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: '700', margin: '0 0 12px' }}>
          Accuracy by Difficulty
        </h4>
        <div style={{ display: 'flex', gap: '12px' }}>
          {Object.entries(accuracyByDifficulty).map(([difficulty, stats]) => (
            <div key={difficulty} style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', textTransform: 'capitalize' }}>
                  {difficulty}
                </span>
                <span style={{ color: TEXT2, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: '700' }}>
                  {stats.percentage}%
                </span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${stats.percentage}%`,
                  background: stats.percentage >= 70 ? '#22c55e' : stats.percentage >= 50 ? '#fbbf24' : '#ef4444',
                  transition: 'width 0.5s',
                }} />
              </div>
              <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '11px', marginTop: '4px' }}>
                {stats.correct}/{stats.total} correct
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Topic Performance */}
      {topicPerformance.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ color: TEXT2, fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: '700', margin: '0 0 12px' }}>
            Topic-wise Performance
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topicPerformance.map(topic => (
              <div key={topic.topicId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: TEXT2, fontFamily: "'DM Sans', sans-serif", fontSize: '12px' }}>
                    {topic.topicName}
                  </span>
                  <span style={{ 
                    color: topic.percentage >= 70 ? '#22c55e' : topic.percentage >= 50 ? '#fbbf24' : '#ef4444',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px',
                    fontWeight: '700',
                  }}>
                    {topic.percentage}%
                  </span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${topic.percentage}%`,
                    background: topic.percentage >= 70 ? '#22c55e' : topic.percentage >= 50 ? '#fbbf24' : '#ef4444',
                    transition: 'width 0.5s',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weak Areas */}
      {weakAreas.length > 0 && (
        <div>
          <h4 style={{ color: '#ef4444', fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: '700', margin: '0 0 12px' }}>
            ⚠️ Areas for Improvement (Below 70%)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {weakAreas.map(area => (
              <div
                key={area.topicId}
                style={{
                  padding: '10px 12px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: TEXT2, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: '600' }}>
                  {area.topicName}
                </span>
                <span style={{ color: '#ef4444', fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: '700' }}>
                  {area.percentage}% ({area.correct}/{area.total})
                </span>
              </div>
            ))}
          </div>
          <p style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '11px', margin: '12px 0 0', fontStyle: 'italic' }}>
            💡 Tip: Review notes and practice more questions on these topics to improve your score.
          </p>
        </div>
      )}
    </div>
  )
}
