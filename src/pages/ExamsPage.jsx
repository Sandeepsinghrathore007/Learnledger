import { useEffect, useMemo, useRef, useState } from 'react'
import { useAITest } from '@/hooks/useAITest'
import ExamCreationModal from '@/components/tests/ExamCreationModal'
import TestCard from '@/components/tests/TestCard'
import TestTakingView from '@/components/tests/TestTakingView'
import TestResultsView from '@/components/tests/TestResultsView'
import PaginationControls from '@/components/ui/PaginationControls'
import PrimaryCtaButton from '@/components/ui/PrimaryCtaButton'
import { MockTestsIcon, PlusIcon } from '@/components/ui/Icons'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import { subscribeToExamGroups } from '@/services/firebase/examGroupsService'
import { resolveTestDisplay } from '@/utils/testDisplay'
import { isExamTest } from '@/utils/testKinds'

const RECENT_EXAMS_PAGE_SIZE = 10

const examCtaTheme = {
  '--cta-start': '#22c55e',
  '--cta-end': '#0ea5e9',
  '--cta-border': 'rgba(34, 197, 94, 0.28)',
  '--cta-glow': 'rgba(14, 165, 233, 0.34)',
}

function createLiveExamSession(test) {
  return {
    ...test,
    startTime: new Date().toISOString(),
    answers: {},
    bookmarkedQuestions: [],
    hintsUsed: [],
  }
}

function mergeLiveExamSession(previous, nextTest) {
  if (!previous) {
    return createLiveExamSession(nextTest)
  }

  const validQuestionIds = new Set((nextTest.questions || []).map((question) => question.id))
  const filteredAnswers = Object.fromEntries(
    Object.entries(previous.answers || {}).filter(([questionId]) => validQuestionIds.has(questionId))
  )
  const filteredBookmarks = (previous.bookmarkedQuestions || []).filter((questionId) => validQuestionIds.has(questionId))
  const filteredHints = (previous.hintsUsed || []).filter((questionId) => validQuestionIds.has(questionId))

  return {
    ...previous,
    ...nextTest,
    startTime: previous.startTime || new Date().toISOString(),
    answers: filteredAnswers,
    bookmarkedQuestions: filteredBookmarks,
    hintsUsed: filteredHints,
  }
}

export default function ExamsPage({
  subjects,
  onUpdateSubject,
  user,
  initialGroupContext = null,
  groupLaunchKey = null,
  onOpenWeakAreaMockTest = null,
  isActive = true,
}) {
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [activeExam, setActiveExam] = useState(null)
  const [viewingResults, setViewingResults] = useState(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [examGroups, setExamGroups] = useState([])
  const [groupError, setGroupError] = useState('')
  const [launchGroup, setLaunchGroup] = useState(initialGroupContext)
  const progressiveExamIdRef = useRef('')

  const {
    testHistory,
    isGenerating,
    generationStatus,
    error,
    generateTest,
    saveTestResult,
    deleteTest,
  } = useAITest(subjects, onUpdateSubject, user, {
    subscribe: isActive,
    syncSubjectStats: isActive,
  })

  useEffect(() => {
    if (!user?.uid) {
      setExamGroups([])
      setGroupError('')
      return undefined
    }

    if (!isActive) {
      return undefined
    }

    const unsubscribe = subscribeToExamGroups(
      user.uid,
      (items) => {
        setExamGroups(items)
        setGroupError('')
      },
      (subscriptionError) => {
        console.error('Failed to load exam groups:', subscriptionError)
        setGroupError(subscriptionError?.message || 'Unable to load exam groups right now.')
      }
    )

    return () => unsubscribe()
  }, [isActive, user?.uid])

  useEffect(() => {
    if (!groupLaunchKey || !initialGroupContext?.id) return

    setLaunchGroup(initialGroupContext)
    setConfigModalOpen(true)
  }, [groupLaunchKey, initialGroupContext])

  const displayExamHistory = useMemo(
    () => testHistory
      .filter((test) => isExamTest(test))
      .map((test) => resolveTestDisplay(test, subjects))
      .sort((left, right) => (right.completedAt || right.createdAt || '').localeCompare(left.completedAt || left.createdAt || '')),
    [subjects, testHistory]
  )
  const totalTrackedExamQuestions = useMemo(
    () => displayExamHistory.reduce((sum, test) => sum + (Number(test?.totalQuestions) || 0), 0),
    [displayExamHistory]
  )
  const totalHistoryPages = Math.max(1, Math.ceil(displayExamHistory.length / RECENT_EXAMS_PAGE_SIZE))
  const historyPageStart = (historyPage - 1) * RECENT_EXAMS_PAGE_SIZE
  const paginatedHistory = useMemo(
    () => displayExamHistory.slice(historyPageStart, historyPageStart + RECENT_EXAMS_PAGE_SIZE),
    [displayExamHistory, historyPageStart]
  )

  useEffect(() => {
    setHistoryPage(1)
  }, [displayExamHistory.length])

  useEffect(() => {
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages)
    }
  }, [historyPage, totalHistoryPages])

  const handleGenerateExam = async (config) => {
    try {
      const test = await generateTest(config, {
        onProgress: (progress) => {
          const progressType = String(progress?.type || '').trim().toLowerCase()
          if (!progress?.test || !progressType.startsWith('partial-test')) {
            return
          }

          const displayTest = resolveTestDisplay(progress.test, subjects)

          if (progressType === 'partial-test-ready') {
            progressiveExamIdRef.current = displayTest.id
            setConfigModalOpen(false)
            setLaunchGroup(null)
            setActiveExam((previous) => {
              if (previous?.id === displayTest.id) {
                return mergeLiveExamSession(previous, displayTest)
              }

              if (previous) {
                return previous
              }

              return createLiveExamSession(displayTest)
            })
            return
          }

          setActiveExam((previous) => {
            if (!previous || previous.id !== displayTest.id) {
              return previous
            }

            return mergeLiveExamSession(previous, displayTest)
          })
        },
      })

      setConfigModalOpen(false)
      setLaunchGroup(null)

      const displayTest = resolveTestDisplay(test, subjects)
      setActiveExam((previous) => {
        if (previous?.id === displayTest.id) {
          return mergeLiveExamSession(previous, displayTest)
        }

        if (progressiveExamIdRef.current === displayTest.id) {
          return previous
        }

        return createLiveExamSession(displayTest)
      })
      progressiveExamIdRef.current = ''
    } catch (generationError) {
      console.error('Mock test generation failed:', generationError)
      progressiveExamIdRef.current = ''
    }
  }

  const handleFinishExam = (testAttempt) => {
    saveTestResult(testAttempt)
    setActiveExam(null)
    setViewingResults(testAttempt)
  }

  const handleRetakeExam = (test) => {
    const displayTest = resolveTestDisplay(test, subjects)

    setViewingResults(null)
    setActiveExam({
      ...displayTest,
      startTime: new Date().toISOString(),
      answers: {},
      bookmarkedQuestions: [],
      hintsUsed: [],
    })
  }

  const handleOpenCreate = () => {
    setLaunchGroup(null)
    setConfigModalOpen(true)
  }

  const handleCloseModal = () => {
    if (isGenerating) return
    setConfigModalOpen(false)
    setLaunchGroup(null)
  }

  if (activeExam) {
    return (
      <TestTakingView
        test={activeExam}
        onUpdateTest={setActiveExam}
        onFinish={handleFinishExam}
        onExit={() => setActiveExam(null)}
      />
    )
  }

  if (viewingResults) {
    return (
      <TestResultsView
        testAttempt={viewingResults}
        onClose={() => setViewingResults(null)}
        onRetake={() => handleRetakeExam(viewingResults)}
        closeLabel="Back to Mock Tests"
        onTakeWeakAreaMockTest={onOpenWeakAreaMockTest}
      />
    )
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '24px',
            fontWeight: '800',
            margin: '0 0 6px',
          }}>
            Mock Tests
          </h1>
          <p style={{
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            margin: 0,
          }}>
            Paste a question paper or upload a PDF. AI will detect every question and turn it into a scored mock test with explanations and weak-area insights.
          </p>
        </div>

        <PrimaryCtaButton
          className="w-full sm:w-auto"
          onClick={handleOpenCreate}
          icon={MockTestsIcon}
          style={examCtaTheme}
        >
          Create Mock Test
        </PrimaryCtaButton>
      </div>

      {(error || groupError) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
              {error}
            </div>
          )}
          {groupError && (
            <div style={{
              padding: '14px 16px',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.28)',
              borderRadius: '10px',
              color: '#fbbf24',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
            }}>
              {groupError}
            </div>
          )}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
      }}>
        {[
          {
            label: 'Recent Mock Tests',
            value: displayExamHistory.length,
            tone: '#22c55e',
            helper: 'Saved and reviewable attempts',
          },
          {
            label: 'Linked Groups',
            value: examGroups.length,
            tone: '#38bdf8',
            helper: 'Analytics groups available for direct mock test launch',
          },
          {
            label: 'Tracked Questions',
            value: totalTrackedExamQuestions,
            tone: '#a78bfa',
            helper: 'Total questions across recent mock tests',
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              borderRadius: '16px',
              border: `1px solid ${item.tone}22`,
              background: 'rgba(255,255,255,0.02)',
              padding: '18px',
            }}
          >
            <div style={{ color: item.tone, fontSize: '28px', fontWeight: '800', fontFamily: "'DM Sans', sans-serif" }}>
              {item.value}
            </div>
            <div style={{ color: TEXT2, fontSize: '12px', fontWeight: '700', marginTop: '6px', fontFamily: "'DM Sans', sans-serif" }}>
              {item.label}
            </div>
            <div style={{ color: TEXT3, fontSize: '11px', marginTop: '6px', fontFamily: "'DM Sans', sans-serif" }}>
              {item.helper}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 style={{
          color: TEXT1,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '15px',
          fontWeight: '700',
          margin: '0 0 12px',
        }}>
          Recent Mock Tests
          {displayExamHistory.length > 0 && (
            <span style={{
              color: TEXT3,
              fontSize: '13px',
              fontWeight: '400',
              marginLeft: '8px',
            }}>
              ({displayExamHistory.length})
            </span>
          )}
        </h3>

        {displayExamHistory.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '56px 20px',
            background: 'rgba(255,255,255,0.02)',
            border: `1px dashed ${BORDER}`,
            borderRadius: '14px',
          }}>
            <div style={{ fontSize: '46px', marginBottom: '12px' }}>🧾</div>
            <p style={{
              color: TEXT2,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              margin: '0 0 16px',
            }}>
              No mock tests created yet
            </p>
            <PrimaryCtaButton
              onClick={handleOpenCreate}
              icon={PlusIcon}
              style={examCtaTheme}
            >
              Create Your First Mock Test
            </PrimaryCtaButton>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {paginatedHistory.map((test) => (
              <TestCard
                key={test.id}
                test={test}
                onView={() => setViewingResults(resolveTestDisplay(test, subjects))}
                onRetake={() => handleRetakeExam(test)}
                onDelete={() => deleteTest(test.id)}
              />
            ))}

            <PaginationControls
              page={historyPage}
              totalPages={totalHistoryPages}
              onPageChange={setHistoryPage}
              label={`Showing ${historyPageStart + 1}-${Math.min(historyPageStart + RECENT_EXAMS_PAGE_SIZE, displayExamHistory.length)} of ${displayExamHistory.length} mock tests`}
            />
          </div>
        )}
      </div>

      <ExamCreationModal
        open={configModalOpen}
        onClose={handleCloseModal}
        subjects={subjects}
        examGroups={examGroups}
        onGenerate={handleGenerateExam}
        isGenerating={isGenerating}
        generationStatus={generationStatus}
        initialGroupContext={launchGroup}
      />
    </div>
  )
}
