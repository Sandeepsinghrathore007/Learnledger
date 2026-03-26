import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import { extractQuestionBlocksFromText } from '@/utils/examGeneration'
import { parseQuestionsFromTextWithStats } from '@/utils/manualQuestionParser'
import { extractPdfKnowledgeFromFile } from '@/utils/pdfKnowledge'

function buildInitialState(initialGroupContext) {
  return {
    examTitle: initialGroupContext?.name || '',
    sourceType: 'text',
    questionText: '',
    pdfFile: null,
    parsingMode: 'ai',
    language: 'english',
    selectedSubjectIds: Array.isArray(initialGroupContext?.subjectIds) ? initialGroupContext.subjectIds : [],
    selectedGroupId: initialGroupContext?.id || '',
    timeLimit: 30,
    timingMode: 'total',
    timePerQuestion: 60,
  }
}

function buildInitialDetectionState() {
  return {
    loading: false,
    sourceText: '',
    questionCount: 0,
    blockCount: 0,
    skippedBlocks: 0,
    error: '',
    detected: false,
  }
}

const DARK_SELECT_STYLE = {
  background: '#111827',
  color: '#e5e7eb',
}

const DARK_SELECT_OPTION_STYLE = {
  background: '#111827',
  color: '#e5e7eb',
}

const EXAM_LANGUAGE_OPTIONS = [
  { id: 'english', label: 'English' },
  { id: 'hindi', label: 'Hindi' },
]

export default function ExamCreationModal({
  open,
  onClose,
  subjects,
  examGroups = [],
  onGenerate,
  isGenerating = false,
  generationStatus = '',
  initialGroupContext = null,
}) {
  const [form, setForm] = useState(() => buildInitialState(initialGroupContext))
  const [detection, setDetection] = useState(() => buildInitialDetectionState())
  const detectRunRef = useRef(0)

  useEffect(() => {
    if (!open) return
    detectRunRef.current += 1
    setForm(buildInitialState(initialGroupContext))
    setDetection(buildInitialDetectionState())
  }, [initialGroupContext, open])

  const selectedGroup = useMemo(() => {
    if (!form.selectedGroupId) return null

    return examGroups.find((group) => group.id === form.selectedGroupId)
      || (initialGroupContext?.id === form.selectedGroupId ? initialGroupContext : null)
      || null
  }, [examGroups, form.selectedGroupId, initialGroupContext])

  const detectedQuestionCount = detection.questionCount
  const detectedBlockCount = detection.blockCount
  const sourceText = detection.sourceText
  const isManualMode = form.parsingMode === 'manual'
  const canGenerate = Boolean(
    !isGenerating
    && detection.detected
    && !detection.loading
    && sourceText.trim()
    && detectedQuestionCount > 0
  )

  const setField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }))
    if (field === 'questionText' || field === 'pdfFile' || field === 'sourceType' || field === 'parsingMode') {
      detectRunRef.current += 1
      setDetection(buildInitialDetectionState())
    }
  }

  const handleToggleSubject = (subjectId) => {
    if (selectedGroup) return

    setForm((previous) => ({
      ...previous,
      selectedSubjectIds: previous.selectedSubjectIds.includes(subjectId)
        ? previous.selectedSubjectIds.filter((id) => id !== subjectId)
        : [...previous.selectedSubjectIds, subjectId],
    }))
  }

  const handleSelectGroup = (groupId) => {
    const nextGroup = examGroups.find((group) => group.id === groupId) || null

    setForm((previous) => ({
      ...previous,
      selectedGroupId: groupId,
      selectedSubjectIds: nextGroup ? nextGroup.subjectIds : previous.selectedSubjectIds,
      examTitle: previous.examTitle || nextGroup?.name || '',
    }))
  }

  const handleSubmit = () => {
    if (!canGenerate) return

    onGenerate({
      scope: 'exam-source',
      examTitle: form.examTitle,
      sourceText: sourceText.trim(),
      sourceLabel: form.sourceType === 'pdf'
        ? form.pdfFile?.name || 'Question PDF'
        : 'Pasted Questions',
      parsingMode: form.parsingMode === 'manual' ? 'manual' : 'ai',
      language: form.language,
      subjectIds: form.selectedSubjectIds,
      groupId: selectedGroup?.id || null,
      groupName: selectedGroup?.name || '',
      questionCount: detectedQuestionCount,
      difficulty: 'mixed',
      timeLimit: form.timeLimit === 'unlimited' ? null : form.timeLimit,
      timingMode: form.timingMode,
      timePerQuestion: form.timingMode === 'per-question' ? form.timePerQuestion : null,
    })
  }

  const buildManualDetection = (text) => {
    const manualParseResult = parseQuestionsFromTextWithStats(text)

    return {
      questionCount: manualParseResult.parsedQuestions,
      blockCount: manualParseResult.totalBlocks,
      skippedBlocks: manualParseResult.skippedBlocks,
    }
  }

  const handleDetectQuestions = async () => {
    const runId = detectRunRef.current + 1
    detectRunRef.current = runId

    if (form.sourceType === 'text') {
      const questionText = String(form.questionText || '').trim()
      if (!questionText) {
        setDetection({
          loading: false,
          sourceText: '',
          questionCount: 0,
          blockCount: 0,
          skippedBlocks: 0,
          error: 'Paste your questions first, then click Detect Questions.',
          detected: false,
        })
        return
      }

      const manualDetection = isManualMode ? buildManualDetection(questionText) : null
      const questionCount = isManualMode
        ? manualDetection.questionCount
        : extractQuestionBlocksFromText(questionText).length
      setDetection({
        loading: false,
        sourceText: questionText,
        questionCount,
        blockCount: isManualMode ? manualDetection.blockCount : questionCount,
        skippedBlocks: isManualMode ? manualDetection.skippedBlocks : 0,
        error: questionCount > 0
          ? ''
          : isManualMode
            ? (
              manualDetection.blockCount > 0
                ? `${manualDetection.blockCount} question blocks detected, but no valid questions were parsed.`
                : 'No question blocks were detected. Use numbering like 1., 2., Q1.'
            )
            : 'Questions could not be detected. Put each question on a new line or use numbering like 1., 2., Q1.',
        detected: questionCount > 0,
      })
      return
    }

    if (!form.pdfFile) {
      setDetection({
        loading: false,
        sourceText: '',
        questionCount: 0,
        blockCount: 0,
        skippedBlocks: 0,
        error: 'Choose a PDF file first, then click Detect Questions.',
        detected: false,
      })
      return
    }

    setDetection({
      loading: true,
      sourceText: '',
      questionCount: 0,
      blockCount: 0,
      skippedBlocks: 0,
      error: '',
      detected: false,
    })

    try {
      const knowledge = await extractPdfKnowledgeFromFile(form.pdfFile)
      if (detectRunRef.current !== runId) return

      const pdfText = String(knowledge?.fullText || knowledge?.text || knowledge?.preview || '').trim()
      const manualDetection = isManualMode ? buildManualDetection(pdfText) : null
      const questionCount = isManualMode
        ? manualDetection.questionCount
        : extractQuestionBlocksFromText(pdfText).length

      setDetection({
        loading: false,
        sourceText: pdfText,
        questionCount,
        blockCount: isManualMode ? manualDetection.blockCount : questionCount,
        skippedBlocks: isManualMode ? manualDetection.skippedBlocks : 0,
        error: pdfText
          ? (questionCount > 0
              ? ''
              : isManualMode
                ? (
                  manualDetection.blockCount > 0
                    ? `${manualDetection.blockCount} question blocks detected, but no valid questions were parsed from this PDF.`
                    : 'PDF text was extracted, but no question blocks were detected clearly.'
                )
                : 'PDF text was read, but questions could not be detected clearly.')
          : 'Readable text could not be extracted from this PDF.',
        detected: questionCount > 0,
      })
    } catch (error) {
      if (detectRunRef.current !== runId) return

      setDetection({
        loading: false,
        sourceText: '',
        questionCount: 0,
        blockCount: 0,
        skippedBlocks: 0,
        error: error?.message || 'Unable to read this PDF right now.',
        detected: false,
      })
    }
  }

  const detectButtonLabel = detection.loading
    ? 'Detecting...'
    : detection.detected
      ? 'Detect Again'
      : 'Detect Questions'

  const canRunDetection = form.sourceType === 'pdf'
    ? Boolean(form.pdfFile) && !detection.loading
    : Boolean(String(form.questionText || '').trim()) && !detection.loading

  return (
    <Modal
      open={open}
      onClose={() => !isGenerating && onClose()}
      title="Create AI Mock Test"
      width={720}
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <label style={{ display: 'block', color: TEXT1, fontSize: '12px', fontWeight: '700', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
              Mock Test Title
            </label>
            <input
              value={form.examTitle}
              onChange={(event) => setField('examTitle', event.target.value)}
              placeholder="Semester Midterm, Unit Test, PYQ Set..."
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '10px',
                border: `1px solid ${BORDER}`,
                background: 'rgba(255,255,255,0.03)',
                color: TEXT1,
                padding: '0 12px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: TEXT1, fontSize: '12px', fontWeight: '700', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
              Link Mock Test Group
            </label>
            <select
              value={form.selectedGroupId}
              onChange={(event) => handleSelectGroup(event.target.value)}
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '10px',
                border: `1px solid ${BORDER}`,
                background: 'rgba(255,255,255,0.03)',
                color: TEXT1,
                padding: '0 12px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                outline: 'none',
                colorScheme: 'dark',
                ...DARK_SELECT_STYLE,
              }}
            >
              <option value="" style={DARK_SELECT_OPTION_STYLE}>No linked group</option>
              {examGroups.map((group) => (
                <option key={group.id} value={group.id} style={DARK_SELECT_OPTION_STYLE}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div style={{ color: TEXT1, fontSize: '12px', fontWeight: '700', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
            Question Source
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'text', label: 'Paste Text' },
              { id: 'pdf', label: 'Upload PDF' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setField('sourceType', option.id)}
                style={{
                  height: '40px',
                  borderRadius: '10px',
                  border: `1px solid ${form.sourceType === option.id ? 'rgba(139,92,246,0.36)' : BORDER}`,
                  background: form.sourceType === option.id ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                  color: form.sourceType === option.id ? '#c4b5fd' : TEXT2,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '13px',
                  fontWeight: '700',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ color: TEXT1, fontSize: '12px', fontWeight: '700', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
            Parsing Mode
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'ai', label: 'AI Mode' },
              { id: 'manual', label: 'Manual Mode (No AI)' },
            ].map((option) => {
              const isSelected = form.parsingMode === option.id

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setField('parsingMode', option.id)}
                  style={{
                    height: '40px',
                    borderRadius: '10px',
                    border: `1px solid ${isSelected ? 'rgba(14,165,233,0.36)' : BORDER}`,
                    background: isSelected ? 'rgba(14,165,233,0.12)' : 'rgba(255,255,255,0.03)',
                    color: isSelected ? '#dbeafe' : TEXT2,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          <div style={{ color: TEXT3, fontSize: '11px', marginTop: '8px', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
            Manual = faster, no API | AI = smarter parsing
          </div>
        </div>

        {!isManualMode && (
          <div>
            <div style={{ color: TEXT1, fontSize: '12px', fontWeight: '700', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
              Mock Test Language
            </div>
            <div className="grid grid-cols-2 gap-2">
              {EXAM_LANGUAGE_OPTIONS.map((option) => {
                const isSelected = form.language === option.id

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setField('language', option.id)}
                    style={{
                      height: '40px',
                      borderRadius: '10px',
                      border: `1px solid ${isSelected ? 'rgba(14,165,233,0.36)' : BORDER}`,
                      background: isSelected ? 'rgba(14,165,233,0.12)' : 'rgba(255,255,255,0.03)',
                      color: isSelected ? '#dbeafe' : TEXT2,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {form.sourceType === 'text' ? (
          <div>
            <label style={{ display: 'block', color: TEXT1, fontSize: '12px', fontWeight: '700', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
              Questions Text
            </label>
            <textarea
              value={form.questionText}
              onChange={(event) => setField('questionText', event.target.value)}
              placeholder={'1. Define operating system.\n2. Explain demand-supply equilibrium.\n3. Solve the given circuit...'}
              rows={8}
              style={{
                width: '100%',
                borderRadius: '12px',
                border: `1px solid ${BORDER}`,
                background: 'rgba(255,255,255,0.03)',
                color: TEXT1,
                padding: '12px 14px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>
        ) : (
          <div>
            <label style={{ display: 'block', color: TEXT1, fontSize: '12px', fontWeight: '700', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
              Upload Question PDF
            </label>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                minHeight: '150px',
                borderRadius: '12px',
                border: `1px dashed ${BORDER}`,
                background: 'rgba(255,255,255,0.02)',
                color: TEXT2,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                textAlign: 'center',
                padding: '18px',
                cursor: 'pointer',
              }}
            >
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setField('pdfFile', event.target.files?.[0] || null)}
                style={{ display: 'none' }}
              />
              <div>{form.pdfFile ? form.pdfFile.name : 'Click to choose a PDF file'}</div>
              <div style={{ color: TEXT3, fontSize: '11px' }}>
                After upload, click Detect Questions. Mock test generation will start only when you press Create Mock Test.
              </div>
            </label>
          </div>
        )}

        <div
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderRadius: '12px',
            border: `1px solid ${BORDER}`,
            background: 'rgba(255,255,255,0.02)',
            padding: '12px 14px',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ color: TEXT1, fontSize: '12px', fontWeight: '700', fontFamily: "'DM Sans', sans-serif" }}>
              Question Detection
            </div>
            {detection.error ? (
              <div style={{ color: '#fca5a5', fontSize: '11px', marginTop: '8px', fontFamily: "'DM Sans', sans-serif" }}>
                {detection.error}
              </div>
            ) : detection.detected ? (
              <div style={{ color: '#86efac', fontSize: '11px', marginTop: '8px', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
                {isManualMode ? (
                  <>
                    <div>{detectedBlockCount} question block{detectedBlockCount === 1 ? '' : 's'} detected</div>
                    <div>{detectedQuestionCount} valid question{detectedQuestionCount === 1 ? '' : 's'} parsed</div>
                    {detection.skippedBlocks > 0 && (
                      <div>{detection.skippedBlocks} block{detection.skippedBlocks === 1 ? '' : 's'} skipped</div>
                    )}
                  </>
                ) : (
                  <div>{detectedQuestionCount} question{detectedQuestionCount === 1 ? '' : 's'} detected.</div>
                )}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleDetectQuestions}
            disabled={!canRunDetection}
            style={{
              minWidth: '160px',
              height: '42px',
              padding: '0 16px',
              borderRadius: '10px',
              border: `1px solid ${canRunDetection ? 'rgba(14,165,233,0.34)' : BORDER}`,
              background: canRunDetection ? 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(14,165,233,0.18))' : 'rgba(255,255,255,0.04)',
              color: canRunDetection ? '#e0f2fe' : TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              fontWeight: '800',
              cursor: canRunDetection ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            {detectButtonLabel}
          </button>
        </div>

        <div>
          <div style={{ color: TEXT1, fontSize: '12px', fontWeight: '700', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
            Link Subjects For Weak-Area Insights
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {subjects.map((subject) => {
              const isSelected = form.selectedSubjectIds.includes(subject.id)
              const isLockedByGroup = Boolean(selectedGroup && selectedGroup.subjectIds.includes(subject.id))

              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => handleToggleSubject(subject.id)}
                  disabled={Boolean(selectedGroup)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: `1px solid ${isSelected ? `${subject.color}44` : BORDER}`,
                    background: isSelected ? `${subject.color}12` : 'rgba(255,255,255,0.03)',
                    color: isSelected ? subject.color : TEXT2,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px',
                    fontWeight: '700',
                    opacity: selectedGroup && !isLockedByGroup ? 0.65 : 1,
                    cursor: selectedGroup ? 'default' : 'pointer',
                  }}
                >
                  <span>{subject.name}</span>
                  {isSelected ? <span>✓</span> : null}
                </button>
              )
            })}
          </div>
          <div style={{ color: TEXT3, fontSize: '11px', marginTop: '8px', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
            Linking subjects helps AI identify weak subjects/topics and suggest a follow-up test. If you launch from an exam group, those subjects are preselected.
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label style={{ display: 'block', color: TEXT1, fontSize: '12px', fontWeight: '700', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
              {isManualMode ? 'Valid Questions Parsed' : 'Detected Questions'}
            </label>
            <div style={{
              height: '42px',
              borderRadius: '10px',
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.03)',
              color: TEXT1,
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: '700',
            }}>
              {detectedQuestionCount || 0}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: TEXT1, fontSize: '12px', fontWeight: '700', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
              Time Limit
            </label>
            <select
              value={String(form.timeLimit)}
              onChange={(event) => setField('timeLimit', event.target.value === 'unlimited' ? 'unlimited' : Number(event.target.value))}
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '10px',
                border: `1px solid ${BORDER}`,
                background: 'rgba(255,255,255,0.03)',
                color: TEXT1,
                padding: '0 12px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                outline: 'none',
                colorScheme: 'dark',
                ...DARK_SELECT_STYLE,
              }}
            >
              {[15, 30, 45, 60, 180].map((minutes) => (
                <option key={minutes} value={minutes} style={DARK_SELECT_OPTION_STYLE}>{minutes} min</option>
              ))}
              <option value="unlimited" style={DARK_SELECT_OPTION_STYLE}>Unlimited</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', color: TEXT1, fontSize: '12px', fontWeight: '700', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
              Timer Mode
            </label>
            <select
              value={form.timingMode}
              onChange={(event) => setField('timingMode', event.target.value)}
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '10px',
                border: `1px solid ${BORDER}`,
                background: 'rgba(255,255,255,0.03)',
                color: TEXT1,
                padding: '0 12px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                outline: 'none',
                colorScheme: 'dark',
                ...DARK_SELECT_STYLE,
              }}
            >
              <option value="total" style={DARK_SELECT_OPTION_STYLE}>Whole Mock Test</option>
              <option value="per-question" style={DARK_SELECT_OPTION_STYLE}>Per Question</option>
            </select>
          </div>
        </div>

        {form.timingMode === 'per-question' && (
          <div>
            <label style={{ display: 'block', color: TEXT1, fontSize: '12px', fontWeight: '700', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
              Seconds Per Question
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[30, 45, 60, 90].map((seconds) => (
                <button
                  key={seconds}
                  type="button"
                  onClick={() => setField('timePerQuestion', seconds)}
                  style={{
                    height: '38px',
                    borderRadius: '10px',
                    border: `1px solid ${form.timePerQuestion === seconds ? 'rgba(139,92,246,0.36)' : BORDER}`,
                    background: form.timePerQuestion === seconds ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                    color: form.timePerQuestion === seconds ? '#c4b5fd' : TEXT2,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px',
                    fontWeight: '700',
                  }}
                >
                  {seconds}s
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {isGenerating && generationStatus && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(14,165,233,0.2)',
                background: 'rgba(14,165,233,0.08)',
                color: '#bae6fd',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              {generationStatus}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              style={{
                height: '42px',
                padding: '0 16px',
                borderRadius: '10px',
                border: `1px solid ${BORDER}`,
                background: 'rgba(255,255,255,0.04)',
                color: TEXT2,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '700',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canGenerate}
              style={{
                height: '42px',
                padding: '0 18px',
                borderRadius: '10px',
                border: 'none',
                background: canGenerate ? 'linear-gradient(135deg, #22c55e, #0ea5e9)' : 'rgba(255,255,255,0.08)',
                color: canGenerate ? '#fff' : TEXT3,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '800',
                cursor: canGenerate ? 'pointer' : 'not-allowed',
              }}
            >
              {isGenerating ? 'Creating Mock Test...' : 'Create Mock Test'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
