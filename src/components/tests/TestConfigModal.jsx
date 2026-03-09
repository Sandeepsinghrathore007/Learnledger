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

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

export default function TestConfigModal({ 
  open, 
  onClose, 
  subjects, 
  onGenerate,
  isGenerating = false,
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

  // ── HANDLE CLOSE ───────────────────────────────────────────────────────────
  const handleClose = () => {
    if (!isGenerating) {
      resetForm()
      onClose()
    }
  }

  // ── HANDLE GENERATE ────────────────────────────────────────────────────────
  const handleGenerate = () => {
    if (selectedSubjects.length === 0) {
      alert('Please select at least one subject')
      return
    }

    if (scope === 'topic' && selectedTopics.length === 0) {
      alert('Please select at least one topic')
      return
    }

    const config = {
      scope,
      subjectIds: selectedSubjects,
      topicIds: scope === 'topic' ? selectedTopics : null,
      questionCount,
      difficulty,
      timeLimit: timeLimit === 'unlimited' ? null : timeLimit,
      timingMode,
      timePerQuestion: timingMode === 'per-question' ? timePerQuestion : null,
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
  const canGenerate = selectedSubjects.length > 0 && 
    (scope !== 'topic' || selectedTopics.length > 0)

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <Modal open={open} onClose={handleClose} title="Create AI Test" width={600}>
      <div className="flex flex-col gap-5 sm:gap-6">
        
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
              { id: 'topic', label: 'Specific Topics' },
              { id: 'multi-subject', label: 'Multiple Subjects' },
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
                  background: scope === option.id ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${scope === option.id ? 'rgba(139,92,246,0.4)' : BORDER}`,
                  borderRadius: '8px',
                  color: scope === option.id ? '#a78bfa' : TEXT2,
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
                    background: isSelected ? `${subject.color}12` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isSelected ? subject.color + '40' : BORDER}`,
                    borderRadius: '8px',
                    color: isSelected ? subject.color : TEXT2,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'left',
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
                  {isSelected && <span>✓</span>}
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
                      background: isSelected ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isSelected ? 'rgba(139,92,246,0.3)' : BORDER}`,
                      borderRadius: '6px',
                      color: isSelected ? '#a78bfa' : TEXT2,
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
                  background: questionCount === count ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${questionCount === count ? 'rgba(139,92,246,0.4)' : BORDER}`,
                  borderRadius: '6px',
                  color: questionCount === count ? '#a78bfa' : TEXT2,
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
                  background: difficulty === level.id ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${difficulty === level.id ? 'rgba(139,92,246,0.4)' : BORDER}`,
                  borderRadius: '6px',
                  color: difficulty === level.id ? '#a78bfa' : TEXT2,
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
                background: timingMode === 'total' ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${timingMode === 'total' ? 'rgba(139,92,246,0.4)' : BORDER}`,
                borderRadius: '6px',
                color: timingMode === 'total' ? '#a78bfa' : TEXT2,
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
                background: timingMode === 'per-question' ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${timingMode === 'per-question' ? 'rgba(139,92,246,0.4)' : BORDER}`,
                borderRadius: '6px',
                color: timingMode === 'per-question' ? '#a78bfa' : TEXT2,
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
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {[10, 15, 20, 30, 'unlimited'].map(time => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setTimeLimit(time)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: timeLimit === time ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${timeLimit === time ? 'rgba(139,92,246,0.4)' : BORDER}`,
                    borderRadius: '6px',
                    color: timeLimit === time ? '#a78bfa' : TEXT2,
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
                    background: timePerQuestion === seconds ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${timePerQuestion === seconds ? 'rgba(139,92,246,0.4)' : BORDER}`,
                    borderRadius: '6px',
                    color: timePerQuestion === seconds ? '#a78bfa' : TEXT2,
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
          {isGenerating ? '🤖 Generating Test with AI...' : '✨ Generate Test with AI'}
        </button>
      </div>
    </Modal>
  )
}
