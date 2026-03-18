/**
 * TestConfigModal.jsx — Modal for configuring a new AI-generated test.
 *
 * Configuration options:
 *  - Test scope (subject, topic, multi-subject)
 *  - Subject selection
 *  - Topic selection (if scope is topic)
 *  - Number of questions
 *  - Difficulty level
 *  - Time limit
 *  - Timing mode (total vs per-question)
 *
 * Props:
 *  open            {boolean}  — Modal open state
 *  onClose         {Function} — Close modal
 *  subjects        {Array}    — All subjects
 *  onGenerate      {Function} — (config) => void - Generate test callback
 *  isGenerating    {boolean}  — Loading state during generation
 */

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { ACCENT_BORDER, ACCENT_SOFT, BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

function truncatePreview(value, maxLength = 240) {
  const text = String(value || '').trim()
  if (!text || text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`
}

const INACTIVE_OPTION_BACKGROUND = 'rgba(255,255,255,0.045)'
const INACTIVE_OPTION_BORDER = 'rgba(148,163,184,0.3)'

function getOptionTone(isSelected) {
  return {
    background: isSelected ? ACCENT_SOFT : INACTIVE_OPTION_BACKGROUND,
    border: `1px solid ${isSelected ? ACCENT_BORDER : INACTIVE_OPTION_BORDER}`,
    color: TEXT1,
  }
}

export default function TestConfigModal({ 
  open, 
  onClose, 
  subjects, 
  onGenerate,
  isGenerating = false,
  selectionContext = null,
  allowTopicScope = true,
  presetTopicContext = null,
}) {
  // ── FORM STATE ─────────────────────────────────────────────────────────────
  const [scope, setScope] = useState('subject') // 'subject' | 'topic' | 'multi-subject'
  const [selectedSubjects, setSelectedSubjects] = useState([])
  const [selectedTopics, setSelectedTopics] = useState([])
  const [questionCount, setQuestionCount] = useState(10)
  const [difficulty, setDifficulty] = useState('mixed')
  const [timeLimit, setTimeLimit] = useState(15) // minutes, null for unlimited
  const [timingMode, setTimingMode] = useState('total') // 'total' | 'per-question'
  const [timePerQuestion, setTimePerQuestion] = useState(60) // seconds
  const isSelectionMode = Boolean(String(selectionContext?.selectedText || '').trim())
  const isPresetTopicMode = Boolean(presetTopicContext?.subjectId && presetTopicContext?.topicId)
  const selectionSubjectId = selectionContext?.subjectId || null
  const selectionTopicId = selectionContext?.topicId || null

  // ── Get available topics based on selected subjects ───────────────────────
  const availableTopics = selectedSubjects.length > 0
    ? subjects
        .filter(s => selectedSubjects.includes(s.id))
        .flatMap(s => s.topics.map(t => ({ ...t, subjectId: s.id, subjectName: s.name })))
    : []

  // ── RESET FORM ─────────────────────────────────────────────────────────────
  const resetForm = () => {
    setScope('subject')
    setSelectedSubjects([])
    setSelectedTopics([])
    setQuestionCount(10)
    setDifficulty('mixed')
    setTimeLimit(15)
    setTimingMode('total')
    setTimePerQuestion(60)
  }

  useEffect(() => {
    if (!open || !isSelectionMode) return

    setScope('selection')
    setSelectedSubjects(selectionSubjectId ? [selectionSubjectId] : [])
    setSelectedTopics(selectionTopicId ? [selectionTopicId] : [])
  }, [isSelectionMode, open, selectionSubjectId, selectionTopicId])

  useEffect(() => {
    if (!open || !isPresetTopicMode) return

    setScope('topic')
    setSelectedSubjects([presetTopicContext.subjectId])
    setSelectedTopics([presetTopicContext.topicId])
  }, [isPresetTopicMode, open, presetTopicContext])

  useEffect(() => {
    if (!open || isSelectionMode || isPresetTopicMode || allowTopicScope || scope !== 'topic') return

    setScope('subject')
    setSelectedTopics([])
  }, [allowTopicScope, isPresetTopicMode, isSelectionMode, open, scope])

  // ── HANDLE CLOSE ───────────────────────────────────────────────────────────
  const handleClose = () => {
    if (!isGenerating) {
      resetForm()
      onClose()
    }
  }

  // ── HANDLE GENERATE ────────────────────────────────────────────────────────
  const handleGenerate = () => {
    const effectiveScope = isSelectionMode
      ? 'selection'
      : isPresetTopicMode
        ? 'topic'
        : scope
    const effectiveSubjectIds = isSelectionMode
      ? (selectionSubjectId ? [selectionSubjectId] : [])
      : isPresetTopicMode
        ? [presetTopicContext.subjectId]
        : selectedSubjects
    const effectiveTopicIds = effectiveScope === 'topic'
      ? (
          isPresetTopicMode
            ? [presetTopicContext.topicId]
            : selectedTopics
        )
      : effectiveScope === 'selection' && selectionTopicId
        ? [selectionTopicId]
        : null

    if (effectiveSubjectIds.length === 0) {
      alert('Please select at least one subject')
      return
    }

    if (effectiveScope === 'topic' && effectiveTopicIds.length === 0) {
      alert('Please select at least one topic')
      return
    }

    if (effectiveScope === 'selection' && !isSelectionMode) {
      alert('Please select some note text first')
      return
    }

    const config = {
      scope: effectiveScope,
      subjectIds: effectiveSubjectIds,
      topicIds: effectiveTopicIds,
      questionCount,
      difficulty,
      timeLimit: timeLimit === 'unlimited' ? null : timeLimit,
      timingMode,
      timePerQuestion: timingMode === 'per-question' ? timePerQuestion : null,
      ...(isSelectionMode
        ? {
            selectedText: selectionContext.selectedText,
            selectionSource: {
              noteId: selectionContext.noteId || null,
              noteTitle: selectionContext.noteTitle || 'Selected Note',
              topicId: selectionContext.topicId || null,
              topicName: selectionContext.topicName || '',
              subjectId: selectionContext.subjectId || null,
              subjectName: selectionContext.subjectName || '',
            },
          }
        : {}),
    }

    onGenerate(config)
  }

  // ── TOGGLE SUBJECT SELECTION ───────────────────────────────────────────────
  const toggleSubject = (subjectId) => {
    if (scope === 'multi-subject') {
      // Multi-select
      setSelectedSubjects(prev =>
        prev.includes(subjectId)
          ? prev.filter(id => id !== subjectId)
          : [...prev, subjectId]
      )
    } else {
      // Single select
      setSelectedSubjects([subjectId])
      setSelectedTopics([]) // Reset topics when subject changes
    }
  }

  // ── TOGGLE TOPIC SELECTION ─────────────────────────────────────────────────
  const toggleTopic = (topicId) => {
    setSelectedTopics(prev =>
      prev.includes(topicId)
        ? prev.filter(id => id !== topicId)
        : [...prev, topicId]
    )
  }

  // ── VALIDATION ─────────────────────────────────────────────────────────────
  const canGenerate = isSelectionMode
    ? Boolean(selectionSubjectId && String(selectionContext?.selectedText || '').trim())
    : isPresetTopicMode
      ? true
      : selectedSubjects.length > 0 && (scope !== 'topic' || selectedTopics.length > 0)

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isSelectionMode ? 'Create Test From Selection' : 'Create AI Test'}
      width={600}
    >
      <div className="flex flex-col gap-5 sm:gap-6">
        {isSelectionMode ? (
          <div>
            <label style={{
              display: 'block',
              color: TEXT1,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '10px',
            }}>
              Selected Text Source
            </label>
            <div style={{
              borderRadius: '12px',
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.03)',
              padding: '14px',
            }}>
              <div style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: '700' }}>
                {selectionContext.noteTitle || 'Selected Note'}
              </div>
              <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', marginTop: '5px' }}>
                {selectionContext.topicName || 'Topic'} • {selectionContext.subjectName || 'Subject'}
              </div>
              <div
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(139,92,246,0.18)',
                  background: 'rgba(139,92,246,0.08)',
                  color: TEXT2,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '12px',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {truncatePreview(selectionContext.selectedText)}
              </div>
            </div>
          </div>
        ) : isPresetTopicMode ? (
          <div>
            <label style={{
              display: 'block',
              color: TEXT1,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '10px',
            }}>
              Topic Source
            </label>
            <div style={{
              borderRadius: '12px',
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.03)',
              padding: '14px',
            }}>
              <div style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: '700' }}>
                {presetTopicContext.topicName || 'Selected Topic'}
              </div>
              <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', marginTop: '5px' }}>
                {presetTopicContext.subjectName || 'Selected Subject'}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── TEST SCOPE ─────────────────────────────────────────────────── */}
            <div>
              <label style={{
                display: 'block',
                color: TEXT1,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '600',
                marginBottom: '10px',
              }}>
                Test Scope
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5">
                {[
                  { id: 'subject', label: 'Whole Subject' },
                  { id: 'multi-subject', label: 'Multiple Subjects' },
                  ...(allowTopicScope ? [{ id: 'topic', label: 'Specific Topics' }] : []),
                ].map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setScope(option.id)
                      setSelectedSubjects([])
                      setSelectedTopics([])
                    }}
                    style={{
                      flex: 1,
                      padding: '10px',
                      ...getOptionTone(scope === option.id),
                      borderRadius: '8px',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── SUBJECT SELECTION ──────────────────────────────────────────── */}
            <div>
              <label style={{
                display: 'block',
                color: TEXT1,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '600',
                marginBottom: '10px',
              }}>
                {scope === 'multi-subject' ? 'Select Subjects (Multiple)' : 'Select Subject'}
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {subjects.map(subject => {
                  const isSelected = selectedSubjects.includes(subject.id)
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => toggleSubject(subject.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        background: isSelected ? `${subject.color}16` : INACTIVE_OPTION_BACKGROUND,
                        border: `1px solid ${isSelected ? `${subject.color}66` : INACTIVE_OPTION_BORDER}`,
                        borderRadius: '8px',
                        color: TEXT1,
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        textAlign: 'left',
                        boxShadow: isSelected ? `inset 0 0 0 1px ${subject.color}20` : 'none',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '18px',
                          color: subject.color,
                          fontWeight: '800',
                          lineHeight: 1,
                          textShadow: `0 0 10px ${subject.color}50`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          flexShrink: 0,
                        }}
                      >
                        {subject.icon}
                      </span>
                      <span style={{ flex: 1 }}>{subject.name}</span>
                      {isSelected && <span style={{ color: subject.color }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── TOPIC SELECTION (if scope is 'topic') ─────────────────────── */}
            {scope === 'topic' && availableTopics.length > 0 && (
              <div>
                <label style={{
                  display: 'block',
                  color: TEXT1,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '13px',
                  fontWeight: '600',
                  marginBottom: '10px',
                }}>
                  Select Topics
                </label>
                <div style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}>
                  {availableTopics.map(topic => {
                    const isSelected = selectedTopics.includes(topic.id)
                    return (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => toggleTopic(topic.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          ...getOptionTone(isSelected),
                          borderRadius: '6px',
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ flex: 1 }}>
                          {topic.name} <span style={{ color: TEXT3, fontSize: '11px' }}>({topic.subjectName})</span>
                        </span>
                        {isSelected && <span>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── NUMBER OF QUESTIONS ────────────────────────────────────────── */}
        <div>
          <label style={{
            display: 'block',
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            fontWeight: '600',
            marginBottom: '10px',
          }}>
            Number of Questions
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[5, 10, 15, 20, 50].map(count => (
              <button
                key={count}
                type="button"
                onClick={() => setQuestionCount(count)}
                style={{
                  flex: 1,
                  padding: '8px',
                  ...getOptionTone(questionCount === count),
                  borderRadius: '6px',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* ── DIFFICULTY ─────────────────────────────────────────────────── */}
        <div>
          <label style={{
            display: 'block',
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            fontWeight: '600',
            marginBottom: '10px',
          }}>
            Difficulty Level
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { id: 'easy', label: 'Easy', emoji: '😊' },
              { id: 'medium', label: 'Medium', emoji: '😐' },
              { id: 'hard', label: 'Hard', emoji: '😰' },
              { id: 'mixed', label: 'Mixed', emoji: '🎯' },
            ].map(level => (
              <button
                key={level.id}
                type="button"
                onClick={() => setDifficulty(level.id)}
                style={{
                  flex: 1,
                  padding: '8px',
                  ...getOptionTone(difficulty === level.id),
                  borderRadius: '6px',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div>{level.emoji}</div>
                <div style={{ fontSize: '11px' }}>{level.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── TIME SETTINGS ──────────────────────────────────────────────── */}
        <div>
          <label style={{
            display: 'block',
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            fontWeight: '600',
            marginBottom: '10px',
          }}>
            Time Limit
          </label>
          
          {/* Timing Mode */}
          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            style={{ marginBottom: '10px' }}
          >
            <button
              type="button"
              onClick={() => setTimingMode('total')}
              style={{
                flex: 1,
                padding: '8px',
                ...getOptionTone(timingMode === 'total'),
                borderRadius: '6px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Total Time
            </button>
            <button
              type="button"
              onClick={() => setTimingMode('per-question')}
              style={{
                flex: 1,
                padding: '8px',
                ...getOptionTone(timingMode === 'per-question'),
                borderRadius: '6px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Per Question
            </button>
          </div>

          {/* Time Options */}
          {timingMode === 'total' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[10, 15, 20, 30, 60, 120, 180, 'unlimited'].map(time => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setTimeLimit(time)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    ...getOptionTone(timeLimit === time),
                    borderRadius: '6px',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  {time === 'unlimited' ? '∞' : `${time}m`}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[30, 60, 90, 120].map(seconds => (
                <button
                  key={seconds}
                  type="button"
                  onClick={() => setTimePerQuestion(seconds)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    ...getOptionTone(timePerQuestion === seconds),
                    borderRadius: '6px',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  {seconds}s
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── GENERATE BUTTON ────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          style={{
            width: '100%',
            padding: '14px',
            background: canGenerate && !isGenerating
              ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
              : 'rgba(139,92,246,0.3)',
            border: 'none',
            borderRadius: '10px',
            color: '#fff',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            fontWeight: '700',
            cursor: canGenerate && !isGenerating ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
            opacity: canGenerate && !isGenerating ? 1 : 0.5,
          }}
        >
          {isGenerating
            ? '🤖 Generating Test with AI...'
            : isSelectionMode
              ? '✨ Generate Test From Selected Text'
              : '✨ Generate Test with AI'}
        </button>
      </div>
    </Modal>
  )
}
