/**
 * AIAssistantPage.jsx — Study helper chat with note-generation workflow.
 */

import { useEffect, useMemo, useState } from 'react'
import { uid } from '@/utils/id'
import { askStudyAssistant } from '@/services/firebase/aiAssistantService'
import { getRelevantPdfReferenceMaterial } from '@/services/firebase/pdfKnowledgeService'
import { XIcon } from '@/components/ui/Icons'
import { BORDER, SURFACE, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

const LANGUAGE_OPTIONS = [
  { id: 'english', label: 'English' },
  { id: 'hindi', label: 'Hindi' },
]

function escapeHtml(text = '') {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function formatMessageTime(dateString) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getContextLabel(subject, typedContext, pdfContext = null) {
  const parts = [
    subject?.name,
    pdfContext?.pdfName ? `PDF: ${pdfContext.pdfName}` : '',
    typedContext.trim(),
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' • ') : 'General Study'
}

function parseKeyPoints(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 5)
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((line) => line.replace(/^[-•\d.)\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 5)
  }

  return []
}

function normalizeStructuredAnswer(rawAnswer) {
  if (!rawAnswer || typeof rawAnswer !== 'object') return null

  const title = String(rawAnswer.title || '').trim()
  const explanation = String(rawAnswer.explanation || '').trim()
  const keyPoints = parseKeyPoints(rawAnswer.keyPoints)
  const example = String(rawAnswer.example || '').trim()
  const summary = String(rawAnswer.summary || '').trim()

  if (!title || !explanation || keyPoints.length === 0 || !example || !summary) {
    return null
  }

  return {
    title,
    explanation,
    keyPoints,
    example,
    summary,
  }
}

function toStructuredNotePayload(answer) {
  const normalized = normalizeStructuredAnswer(answer)
  if (!normalized) {
    throw new Error('AI response did not include valid structured notes.')
  }

  return {
    topicTitle: normalized.title,
    shortExplanation: normalized.explanation,
    keyPoints: normalized.keyPoints,
    example: normalized.example,
    summary: normalized.summary,
  }
}

function formatStructuredAnswer(answer) {
  const normalized = normalizeStructuredAnswer(answer)
  if (!normalized) return ''

  return [
    normalized.title,
    '',
    normalized.explanation,
    '',
    'Key Points:',
    ...normalized.keyPoints.map((point) => `- ${point}`),
    '',
    `Example: ${normalized.example}`,
    '',
    `Summary: ${normalized.summary}`,
  ].join('\n')
}

function buildStructuredNoteHtml(data) {
  const keyPointsHtml = data.keyPoints
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join('')

  return [
    `<h1>${escapeHtml(data.topicTitle)}</h1>`,
    '<h2>Short Explanation</h2>',
    `<p>${escapeHtml(data.shortExplanation)}</p>`,
    '<h2>Key Points</h2>',
    `<ul>${keyPointsHtml}</ul>`,
    '<h2>Example or Illustration</h2>',
    `<p>${escapeHtml(data.example)}</p>`,
    '<h2>Summary</h2>',
    `<p>${escapeHtml(data.summary)}</p>`,
  ].join('')
}

function buildStructuredBlocks(data) {
  return [
    { id: uid(), type: 'h1', text: data.topicTitle },
    { id: uid(), type: 'h2', text: 'Short Explanation' },
    { id: uid(), type: 'p', text: data.shortExplanation },
    { id: uid(), type: 'h2', text: 'Key Points' },
    { id: uid(), type: 'bullet', text: data.keyPoints.join('\n') },
    { id: uid(), type: 'h2', text: 'Example or Illustration' },
    { id: uid(), type: 'p', text: data.example },
    { id: uid(), type: 'h2', text: 'Summary' },
    { id: uid(), type: 'p', text: data.summary },
  ]
}

function uniqueTopicName(baseName, existingTopics) {
  const normalizedBase = baseName.trim() || 'AI Generated Topic'
  let candidate = normalizedBase
  let counter = 2

  while (existingTopics.some((topic) => topic.name.toLowerCase() === candidate.toLowerCase())) {
    candidate = `${normalizedBase} (${counter})`
    counter += 1
  }

  return candidate
}

export default function AIAssistantPage({ user, subjects, onUpdateSubject, initialContext = null }) {
  const [language, setLanguage] = useState('english')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [typedContext, setTypedContext] = useState('')
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [isAsking, setIsAsking] = useState(false)
  const [savingMessageId, setSavingMessageId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activePdfContext, setActivePdfContext] = useState(null)
  const [appliedLaunchId, setAppliedLaunchId] = useState('')

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId]
  )

  useEffect(() => {
    if (!initialContext?.launchId || initialContext.launchId === appliedLaunchId) return

    setSelectedSubjectId(initialContext.subjectId || '')
    setTypedContext(initialContext.typedContext || '')
    setActivePdfContext(
      initialContext.pdfId
        ? {
            subjectId: initialContext.subjectId || '',
            pdfId: initialContext.pdfId,
            pdfName: initialContext.pdfName || 'Attached PDF',
          }
        : null
    )
    setNotice(
      initialContext.pdfId
        ? `Using stored PDF context from "${initialContext.pdfName}".`
        : 'AI context updated.'
    )
    setError('')
    setAppliedLaunchId(initialContext.launchId)
  }, [appliedLaunchId, initialContext])

  useEffect(() => {
    if (!activePdfContext) return
    if (!selectedSubjectId || activePdfContext.subjectId === selectedSubjectId) return
    setActivePdfContext(null)
  }, [activePdfContext, selectedSubjectId])

  const askQuestion = async () => {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) return

    setError('')
    setNotice('')
    setIsAsking(true)

    const contextLabel = getContextLabel(selectedSubject, typedContext, activePdfContext)
    const userMessage = {
      id: uid(),
      role: 'user',
      text: trimmedQuestion,
      language,
      subjectId: selectedSubject?.id || '',
      contextLabel,
      referenceLabel: activePdfContext?.pdfName ? `PDF: ${activePdfContext.pdfName}` : '',
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setQuestion('')

    try {
      let referenceMaterial = ''
      let referenceLabel = ''
      let referenceId = null

      if (activePdfContext?.pdfId) {
        if (!user?.uid || !selectedSubject?.id) {
          throw new Error('Select the original subject to use this PDF as AI context.')
        }

        const pdfReference = await getRelevantPdfReferenceMaterial({
          userId: user.uid,
          subjectId: selectedSubject.id,
          pdfId: activePdfContext.pdfId,
          question: trimmedQuestion,
          extraContext: typedContext,
        })

        if (!pdfReference.referenceMaterial) {
          throw new Error('This PDF is not AI-ready yet. Wait for indexing or re-upload it.')
        }

        referenceMaterial = pdfReference.referenceMaterial
        referenceLabel = `PDF: ${activePdfContext.pdfName}`
        referenceId = activePdfContext.pdfId
      }

      const response = await askStudyAssistant({
        question: trimmedQuestion,
        subjectId: selectedSubject?.id || null,
        subjectName: selectedSubject?.name || null,
        subjectContext: contextLabel,
        language,
        referenceId,
        referenceLabel,
        referenceMaterial,
      })

      const structured = normalizeStructuredAnswer(response?.answer)
      if (!structured) {
        throw new Error('AI returned an invalid response format. Please try again.')
      }

      const text = formatStructuredAnswer(structured)
      const modelUsed = response?.meta?.modelUsed || null
      const provider = response?.meta?.provider || null
      const cacheHit = Boolean(response?.meta?.cacheHit)

      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          text,
          structured,
          language,
          subjectId: selectedSubject?.id || '',
          contextLabel,
          createdAt: new Date().toISOString(),
          modelUsed,
          provider,
          cacheHit,
          referenceLabel,
        },
      ])
    } catch (err) {
      setError(err.message || 'Failed to get AI response.')
    } finally {
      setIsAsking(false)
    }
  }

  const saveResponseAsNotes = async (assistantMessage) => {
    const targetSubjectId = assistantMessage.subjectId || selectedSubjectId
    if (!targetSubjectId) {
      setError('Select a subject before saving notes.')
      return
    }

    const subject = subjects.find((item) => item.id === targetSubjectId)
    if (!subject) {
      setError('Selected subject was not found.')
      return
    }

    setError('')
    setNotice('')
    setSavingMessageId(assistantMessage.id)

    try {
      const structured = toStructuredNotePayload(assistantMessage.structured)
      const topicName = uniqueTopicName(structured.topicTitle, subject.topics)
      const now = new Date().toISOString()

      const note = {
        id: uid(),
        title: topicName,
        content: buildStructuredNoteHtml(structured),
        blocks: buildStructuredBlocks(structured),
        tags: ['ai-generated'],
        isFavorite: false,
        isPinned: false,
        linkedNotes: [],
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
      }

      const topic = {
        id: uid(),
        name: topicName,
        questionsCount: 0,
        notes: [note],
      }

      onUpdateSubject({
        ...subject,
        topics: [...subject.topics, topic],
      })

      setNotice(`Saved as topic "${topicName}" in ${subject.name}.`)
    } catch (err) {
      setError(err.message || 'Failed to save AI response as notes.')
    } finally {
      setSavingMessageId(null)
    }
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
          <h1
            style={{
              margin: '0 0 6px',
              color: TEXT1,
              fontFamily: "'DM Sans', sans-serif",
            fontSize: '24px',
            fontWeight: '800',
          }}
        >
          LearnLedger AI Assistant
        </h1>
        <p
          style={{
            margin: 0,
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
          }}
        >
          Ask concept doubts, get simple explanations, and save responses as structured notes.
        </p>
      </div>

      {activePdfContext && (
        <div
          style={{
            background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.24)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ color: '#d8ccff', fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: '700' }}>
              PDF AI Context
            </div>
            <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', marginTop: '3px' }}>
              Using stored excerpts from {activePdfContext.pdfName}. Only the most relevant parts are sent to AI.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActivePdfContext(null)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              border: `1px solid ${BORDER}`,
              background: 'rgba(255,255,255,0.03)',
              color: TEXT1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ width: '14px', height: '14px' }}><XIcon /></span>
          </button>
        </div>
      )}

      <div
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: '14px',
          padding: '14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ color: TEXT2, fontSize: '12px', fontWeight: '700', fontFamily: "'DM Sans', sans-serif" }}>
            Response Language
          </span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="learnledger-input"
            style={{ fontSize: '13px' }}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ color: TEXT2, fontSize: '12px', fontWeight: '700', fontFamily: "'DM Sans', sans-serif" }}>
            Subject Context
          </span>
          <select
            value={selectedSubjectId}
            onChange={(event) => setSelectedSubjectId(event.target.value)}
            className="learnledger-input"
            style={{ fontSize: '13px' }}
          >
            <option value="">Select subject (optional for chat)</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.icon} {subject.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ color: TEXT2, fontSize: '12px', fontWeight: '700', fontFamily: "'DM Sans', sans-serif" }}>
            Extra Context (type)
          </span>
          <input
            type="text"
            value={typedContext}
            onChange={(event) => setTypedContext(event.target.value)}
            className="learnledger-input"
            placeholder="e.g. Dynamic Programming, Trees, Scheduling"
            style={{ fontSize: '13px' }}
          />
        </label>
      </div>

      {error && (
        <div
          style={{
            border: '1px solid rgba(239,68,68,0.35)',
            background: 'rgba(239,68,68,0.08)',
            borderRadius: '10px',
            color: '#fca5a5',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            padding: '10px 12px',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {notice && (
        <div
          style={{
            border: '1px solid rgba(34,197,94,0.35)',
            background: 'rgba(34,197,94,0.08)',
            borderRadius: '10px',
            color: '#86efac',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            padding: '10px 12px',
          }}
        >
          ✅ {notice}
        </div>
      )}

      <div
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            borderBottom: `1px solid ${BORDER}`,
            color: TEXT2,
            fontSize: '12px',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Chat Context: {getContextLabel(selectedSubject, typedContext, activePdfContext)}
        </div>

        <div
          style={{
            maxHeight: '430px',
            overflowY: 'auto',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                border: `1px dashed ${BORDER}`,
                borderRadius: '12px',
                padding: '14px',
                color: TEXT3,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
              }}
            >
              Ask your first question to start learning with AI ✨
            </div>
          )}

          {messages.map((message) => {
            const isUser = message.role === 'user'
            return (
              <div
                key={message.id}
                style={{
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  width: isUser ? 'min(80%, 680px)' : 'min(85%, 720px)',
                  border: `1px solid ${isUser ? 'rgba(139,92,246,0.35)' : BORDER}`,
                  background: isUser ? 'rgba(139,92,246,0.14)' : 'rgba(255,255,255,0.02)',
                  borderRadius: '12px',
                  padding: '11px 12px',
                }}
              >
                <div
                  style={{
                    color: isUser ? '#c4b5fd' : TEXT1,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '13px',
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {message.text}
                </div>

                <div
                  style={{
                    marginTop: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    flexWrap: 'wrap',
                    color: TEXT3,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '11px',
                  }}
                >
                  <span>
                    {formatMessageTime(message.createdAt)}
                    {!isUser && message.cacheHit ? ' • cached' : ''}
                    {!isUser && message.referenceLabel ? ` • ${message.referenceLabel}` : ''}
                  </span>

                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => saveResponseAsNotes(message)}
                      disabled={savingMessageId === message.id}
                      style={{
                        border: 'none',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
                        color: '#fff',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '11px',
                        fontWeight: '700',
                        opacity: savingMessageId === message.id ? 0.65 : 1,
                      }}
                    >
                      {savingMessageId === message.id
                        ? 'Saving...'
                        : 'Create Topic & Save as Notes'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div
          className="flex flex-col sm:flex-row"
          style={{
            borderTop: `1px solid ${BORDER}`,
            padding: '12px',
            gap: '10px',
            alignItems: 'flex-end',
          }}
        >
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={language === 'hindi'
              ? 'अपना सवाल लिखें...'
              : 'Ask your study question...'}
            className="learnledger-input"
            rows={3}
            style={{ resize: 'vertical', minHeight: '72px', maxHeight: '170px' }}
          />
          <button
            className="w-full sm:w-auto"
            type="button"
            onClick={askQuestion}
            disabled={isAsking || !question.trim()}
            style={{
              border: 'none',
              borderRadius: '10px',
              padding: '12px 14px',
              minWidth: '110px',
              background: isAsking || !question.trim()
                ? 'rgba(139,92,246,0.4)'
                : 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
              color: '#fff',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: '700',
              opacity: isAsking || !question.trim() ? 0.65 : 1,
            }}
          >
            {isAsking ? 'Thinking...' : 'Ask AI'}
          </button>
        </div>
      </div>
    </div>
  )
}
