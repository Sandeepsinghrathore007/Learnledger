/**
 * MockTestsPage.jsx — Main page for AI-powered mock tests.
 *
 * Features:
 *  - Create new test button
 *  - Test history list
 *  - Test taking interface
 *  - Results display
 *
 * Props:
 *  subjects        {Array}    — All subjects
 *  onUpdateSubject {Function} — Update subject callback
 */

import { useEffect, useMemo, useState } from 'react'
import { useAITest } from '@/hooks/useAITest'
import TestConfigModal from '@/components/tests/TestConfigModal'
import TestTakingView from '@/components/tests/TestTakingView'
import TestResultsView from '@/components/tests/TestResultsView'
import TestCard from '@/components/tests/TestCard'
import PaginationControls from '@/components/ui/PaginationControls'
import PrimaryCtaButton from '@/components/ui/PrimaryCtaButton'
import { MockTestsIcon, PlusIcon } from '@/components/ui/Icons'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import { buildQuestionBankSubjectUpdates } from '@/utils/questionBank'
import { resolveTestDisplay } from '@/utils/testDisplay'
import { isMockTest } from '@/utils/testKinds'

const RECENT_TESTS_PAGE_SIZE = 20

const mockTestCtaTheme = {
  '--cta-start': '#38bdf8',
  '--cta-end': '#7c3aed',
  '--cta-border': 'rgba(125, 211, 252, 0.28)',
  '--cta-glow': 'rgba(56, 189, 248, 0.44)',
}

export default function MockTestsPage({
  subjects,
  onUpdateSubject,
  user,
  initialTopicContext = null,
  topicLaunchKey = null,
  isActive = true,
}) {
  // ── STATE ──────────────────────────────────────────────────────────────────
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [activeTest, setActiveTest] = useState(null) // Currently taking test
  const [viewingResults, setViewingResults] = useState(null) // Viewing results
  const [historyPage, setHistoryPage] = useState(1)
  const [topicPreset, setTopicPreset] = useState(null)

  // ── AI TEST HOOK ───────────────────────────────────────────────────────────
  const {
    testHistory,
    isGenerating,
    error,
    generateTest,
    saveTestResult,
    deleteTest,
  } = useAITest(subjects, onUpdateSubject, user, {
    subscribe: isActive,
    syncSubjectStats: isActive,
  })

  const displayTestHistory = useMemo(
    () => testHistory
      .filter((test) => isMockTest(test))
      .map((test) => resolveTestDisplay(test, subjects))
      .sort((left, right) => (right.completedAt || right.createdAt || '').localeCompare(left.completedAt || left.createdAt || '')),
    [subjects, testHistory]
  )
  const totalHistoryPages = Math.max(1, Math.ceil(displayTestHistory.length / RECENT_TESTS_PAGE_SIZE))
  const historyPageStart = (historyPage - 1) * RECENT_TESTS_PAGE_SIZE
  const paginatedHistory = useMemo(
    () => displayTestHistory.slice(historyPageStart, historyPageStart + RECENT_TESTS_PAGE_SIZE),
    [displayTestHistory, historyPageStart]
  )

  useEffect(() => {
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages)
    }
  }, [historyPage, totalHistoryPages])

  useEffect(() => {
    setHistoryPage(1)
  }, [displayTestHistory.length])

  useEffect(() => {
    if (!topicLaunchKey || !initialTopicContext?.topicId || !initialTopicContext?.subjectId) return

    setTopicPreset({
      subjectId: initialTopicContext.subjectId,
      subjectName: initialTopicContext.subjectName || 'Subject',
      topicId: initialTopicContext.topicId,
      topicName: initialTopicContext.topicName || 'Topic',
    })
    setConfigModalOpen(true)
  }, [initialTopicContext, topicLaunchKey])

  // ── HANDLE GENERATE TEST ──────────────────────────────────────────────────
  const handleGenerateTest = async (config) => {
    try {
      const test = await generateTest(config)

      if (onUpdateSubject) {
        const subjectUpdates = buildQuestionBankSubjectUpdates(subjects, test)

        for (const updatedSubject of subjectUpdates) {
          await onUpdateSubject(updatedSubject)
        }
      }

      setConfigModalOpen(false)
      setTopicPreset(null)
      
      // Start test immediately
      const displayTest = resolveTestDisplay(test, subjects)

      setActiveTest({
        ...displayTest,
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

  // ── HANDLE FINISH TEST ─────────────────────────────────────────────────────
  const handleFinishTest = (testAttempt) => {
    saveTestResult(testAttempt)
    setActiveTest(null)
    setViewingResults(testAttempt)
  }

  // ── HANDLE RETAKE TEST ─────────────────────────────────────────────────────
  const handleRetakeTest = (test) => {
    const displayTest = resolveTestDisplay(test, subjects)

    setViewingResults(null)
    setActiveTest({
      ...displayTest,
      startTime: new Date().toISOString(),
      answers: {},
      bookmarkedQuestions: [],
      hintsUsed: [],
    })
  }

  const handleOpenGeneralConfig = () => {
    setTopicPreset(null)
    setConfigModalOpen(true)
  }

  const handleCloseConfigModal = () => {
    setConfigModalOpen(false)
    setTopicPreset(null)
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
            AI Tests
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

        <PrimaryCtaButton
          className="w-full sm:w-auto"
          onClick={handleOpenGeneralConfig}
          icon={MockTestsIcon}
          style={mockTestCtaTheme}
        >
          Create Test
        </PrimaryCtaButton>
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
          {displayTestHistory.length > 0 && (
            <span style={{
              color: TEXT3,
              fontSize: '13px',
              fontWeight: '400',
              marginLeft: '8px',
            }}>
              ({displayTestHistory.length})
            </span>
          )}
        </h3>

        {displayTestHistory.length === 0 ? (
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
            <PrimaryCtaButton
              onClick={handleOpenGeneralConfig}
              icon={PlusIcon}
              style={mockTestCtaTheme}
            >
              Create Your First Test
            </PrimaryCtaButton>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {paginatedHistory.map(test => (
                <TestCard
                  key={test.id}
                  test={test}
                  onView={() => setViewingResults(resolveTestDisplay(test, subjects))}
                  onRetake={() => handleRetakeTest(test)}
                  onDelete={() => deleteTest(test.id)}
                />
              ))}

            <PaginationControls
              page={historyPage}
              totalPages={totalHistoryPages}
              onPageChange={setHistoryPage}
              label={`Showing ${historyPageStart + 1}-${Math.min(historyPageStart + RECENT_TESTS_PAGE_SIZE, displayTestHistory.length)} of ${displayTestHistory.length}`}
            />
          </div>
        )}
      </div>

      {/* ── CONFIG MODAL ────────────────────────────────────────────────── */}
      <TestConfigModal
        open={configModalOpen}
        onClose={handleCloseConfigModal}
        subjects={subjects}
        onGenerate={handleGenerateTest}
        isGenerating={isGenerating}
        allowTopicScope={false}
        presetTopicContext={topicPreset}
      />
    </div>
  )
}
