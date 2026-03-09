/**
 * MockTestsPage.jsx — Main page for AI-powered mock tests.
 *
 * Features:
 *  - Create new test button
 *  - Test history list
 *  - Quick start buttons for each subject
 *  - Test taking interface
 *  - Results display
 *
 * Props:
 *  subjects        {Array}    — All subjects
 *  onUpdateSubject {Function} — Update subject callback
 */

import { useState } from 'react'
import { useAITest } from '@/hooks/useAITest'
import TestConfigModal from '@/components/tests/TestConfigModal'
import TestTakingView from '@/components/tests/TestTakingView'
import TestResultsView from '@/components/tests/TestResultsView'
import TestCard from '@/components/tests/TestCard'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

/**
 * Plus icon for create button
 */
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '18px', height: '18px' }}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export default function MockTestsPage({ subjects, onUpdateSubject, user }) {
  // ── STATE ──────────────────────────────────────────────────────────────────
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [activeTest, setActiveTest] = useState(null) // Currently taking test
  const [viewingResults, setViewingResults] = useState(null) // Viewing results

  // ── AI TEST HOOK ───────────────────────────────────────────────────────────
  const {
    testHistory,
    isGenerating,
    error,
    generateTest,
    saveTestResult,
    deleteTest,
  } = useAITest(subjects, onUpdateSubject, user)

  // ── HANDLE GENERATE TEST ──────────────────────────────────────────────────
  const handleGenerateTest = async (config) => {
    try {
      const test = await generateTest(config)
      setConfigModalOpen(false)
      
      // Start test immediately
      setActiveTest({
        ...test,
        startTime: new Date().toISOString(),
        answers: {},
        bookmarkedQuestions: [],
        hintsUsed: [],
      })
    } catch (err) {
      // Error already handled in hook
      console.error('Test generation failed:', err)
    }
  }

  // ── HANDLE QUICK START ─────────────────────────────────────────────────────
  const handleQuickStart = (subjectId) => {
    setConfigModalOpen(true)
    // You can pre-fill config here if needed
  }

  // ── HANDLE FINISH TEST ─────────────────────────────────────────────────────
  const handleFinishTest = (testAttempt) => {
    saveTestResult(testAttempt)
    setActiveTest(null)
    setViewingResults(testAttempt)
  }

  // ── HANDLE RETAKE TEST ─────────────────────────────────────────────────────
  const handleRetakeTest = (test) => {
    setViewingResults(null)
    setActiveTest({
      ...test,
      startTime: new Date().toISOString(),
      answers: {},
      bookmarkedQuestions: [],
      hintsUsed: [],
    })
  }

  // ── RENDER: ACTIVE TEST ────────────────────────────────────────────────────
  if (activeTest) {
    return (
      <TestTakingView
        test={activeTest}
        onUpdateTest={setActiveTest}
        onFinish={handleFinishTest}
        onExit={() => setActiveTest(null)}
      />
    )
  }

  // ── RENDER: RESULTS VIEW ───────────────────────────────────────────────────
  if (viewingResults) {
    return (
      <TestResultsView
        testAttempt={viewingResults}
        onClose={() => setViewingResults(null)}
        onRetake={() => handleRetakeTest(viewingResults)}
      />
    )
  }

  // ── RENDER: MAIN PAGE ──────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '24px',
            fontWeight: '800',
            margin: '0 0 6px',
          }}>
            AI Mock Tests
          </h1>
          <p style={{
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            margin: 0,
          }}>
            AI-powered tests from your notes and materials
          </p>
        </div>

        <button
          className="w-full sm:w-auto"
          type="button"
          onClick={() => setConfigModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 20px',
            color: '#fff',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'transform 0.15s',
            boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          <PlusIcon />
          Create New Test
        </button>
      </div>

      {/* ── ERROR DISPLAY ───────────────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: '14px 16px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '10px',
          color: '#ef4444',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── QUICK START SECTION ─────────────────────────────────────────── */}
      {subjects.length > 0 && (
        <div>
          <h3 style={{
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '15px',
            fontWeight: '700',
            margin: '0 0 12px',
          }}>
            Quick Start
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '12px',
          }}>
            {subjects.map(subject => (
              <button
                key={subject.id}
                type="button"
                onClick={() => handleQuickStart(subject.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: `${subject.color}08`,
                  border: `1px solid ${subject.color}20`,
                  borderRadius: '12px',
                  padding: '14px 16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${subject.color}12`
                  e.currentTarget.style.borderColor = `${subject.color}40`
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `${subject.color}08`
                  e.currentTarget.style.borderColor = `${subject.color}20`
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div style={{
                  fontSize: '34px',
                  lineHeight: 1,
                  color: subject.color,
                  fontWeight: '800',
                  textShadow: `0 0 14px ${subject.color}55`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: `${subject.color}16`,
                  border: `1px solid ${subject.color}2e`,
                  flexShrink: 0,
                }}>
                  {subject.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: TEXT1,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '14px',
                    fontWeight: '700',
                    marginBottom: '2px',
                  }}>
                    {subject.name}
                  </div>
                  <div style={{
                    color: TEXT3,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '11px',
                  }}>
                    {subject.topics.length} topics
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── TEST HISTORY ────────────────────────────────────────────────── */}
      <div>
        <h3 style={{
          color: TEXT1,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '15px',
          fontWeight: '700',
          margin: '0 0 12px',
        }}>
          Recent Tests
          {testHistory.length > 0 && (
            <span style={{
              color: TEXT3,
              fontSize: '13px',
              fontWeight: '400',
              marginLeft: '8px',
            }}>
              ({testHistory.length})
            </span>
          )}
        </h3>

        {testHistory.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'rgba(255,255,255,0.02)',
            border: `1px dashed ${BORDER}`,
            borderRadius: '14px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📝</div>
            <p style={{
              color: TEXT2,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              margin: '0 0 16px',
            }}>
              No tests taken yet
            </p>
            <button
              type="button"
              onClick={() => setConfigModalOpen(true)}
              style={{
                background: 'rgba(139,92,246,0.12)',
                border: '1px solid rgba(139,92,246,0.3)',
                borderRadius: '8px',
                padding: '8px 16px',
                color: '#a78bfa',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Create Your First Test
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {testHistory
              .slice()
              .reverse() // Show newest first
              .map(test => (
                <TestCard
                  key={test.id}
                  test={test}
                  onView={() => setViewingResults(test)}
                  onRetake={() => handleRetakeTest(test)}
                  onDelete={() => deleteTest(test.id)}
                />
              ))}
          </div>
        )}
      </div>

      {/* ── CONFIG MODAL ────────────────────────────────────────────────── */}
      <TestConfigModal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        subjects={subjects}
        onGenerate={handleGenerateTest}
        isGenerating={isGenerating}
      />
    </div>
  )
}
