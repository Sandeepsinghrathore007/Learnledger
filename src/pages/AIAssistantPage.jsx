/**
 * AIAssistantPage.jsx — Study helper chat with note-generation workflow.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { uid } from '@/utils/id'
import { saveAIChat } from '@/services/firebase/aiService'
import { askStudyAssistant } from '@/services/firebase/aiAssistantService'
import { getRelevantPdfReferenceMaterial } from '@/services/firebase/pdfKnowledgeService'
import { XIcon } from '@/components/ui/Icons'

const LANGUAGE_OPTIONS = [
  { id: 'english', label: 'English' },
  { id: 'hindi', label: 'Hindi' },
]

const QUICK_PROMPTS = {
  english: [
    'Explain with example',
    'MCQ banao is topic pe',
    'Hindi mein batao',
    'Summary do',
  ],
  hindi: [
    'Example ke saath explain karo',
    'Is topic par MCQ banao',
    'Hindi mein samjhao',
    'Short summary do',
  ],
}

const SHELL_BG = '#090612'
const PANEL_BG = '#0d0b1a'
const PANEL_BG_SOFT = '#131022'
const PANEL_BORDER = 'rgba(255,255,255,0.08)'
const PANEL_BORDER_STRONG = 'rgba(124,58,237,0.28)'
const TEXT_PRIMARY = '#ede6ff'
const TEXT_SECONDARY = '#b7abdd'
const TEXT_MUTED = '#7f769d'
const ACCENT = '#7c3aed'
const ACCENT_SOFT = 'rgba(124,58,237,0.12)'
const USER_BUBBLE_BG = 'linear-gradient(135deg, rgba(96,39,187,0.96), rgba(73,27,134,0.98))'
const USER_BUBBLE_BORDER = 'rgba(180, 132, 255, 0.34)'
const USER_AVATAR_BG = 'linear-gradient(135deg,#5b2aa9,#31155f)'
const AI_BUBBLE_BG = 'linear-gradient(180deg, rgba(22,18,40,0.98), rgba(14,12,28,0.98))'
const AI_BUBBLE_BORDER = 'rgba(110, 128, 214, 0.22)'
const AI_BADGE_BG = 'linear-gradient(135deg,#4f46e5,#312e81)'
const AI_LABEL_COLOR = '#9fb2ff'
const SUCCESS_BG = 'rgba(34,197,94,0.08)'
const SUCCESS_BORDER = 'rgba(34,197,94,0.28)'
const SUCCESS_TEXT = '#8df0b0'
const ERROR_BG = 'rgba(239,68,68,0.08)'
const ERROR_BORDER = 'rgba(239,68,68,0.26)'
const ERROR_TEXT = '#ffb4b4'
const WARNING_TEXT = '#f59e0b'
const CHAT_CLEAR_HOVER = '#e879f9'
const AI_MASTER_TOPIC_ID = '__ai_master_notes__'
const AI_MASTER_NOTE_ID = '__ai_master_note__'
const DEFAULT_AI_CHAT_STATE = {
  messages: [],
  selectedSubjectId: null,
  extraContext: '',
  language: 'english',
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '13px', height: '13px' }}
    >
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '14px', height: '14px' }}
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ width: '15px', height: '15px' }}
    >
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '12px', height: '12px' }}
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: '12px', height: '12px' }}
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  )
}

function formatFullDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function getUserInitial(user) {
  const source = user?.displayName || user?.email || 'S'
  return source.trim().charAt(0).toUpperCase()
}

function getStructuredAnswerLabels(language = 'english') {
  if (language === 'hindi') {
    return {
      keyPoints: 'मुख्य बिंदु',
      shortExplanation: 'संक्षिप्त व्याख्या',
      example: 'उदाहरण',
      summary: 'सारांश',
    }
  }

  return {
    keyPoints: 'Key Points',
    shortExplanation: 'Short Explanation',
    example: 'Example',
    summary: 'Summary',
  }
}

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
    pdfContext?.scopeLabel,
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

function formatStructuredAnswer(answer, language = 'english') {
  const normalized = normalizeStructuredAnswer(answer)
  if (!normalized) return ''
  const labels = getStructuredAnswerLabels(language)

  return [
    normalized.title,
    '',
    normalized.explanation,
    '',
    `${labels.keyPoints}:`,
    ...normalized.keyPoints.map((point) => `- ${point}`),
    '',
    `${labels.example}: ${normalized.example}`,
    '',
    `${labels.summary}: ${normalized.summary}`,
  ].join('\n')
}

function buildStructuredNoteHtml(data, language = 'english') {
  const labels = getStructuredAnswerLabels(language)
  const keyPointsHtml = data.keyPoints
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join('')

  return [
    `<h1>${escapeHtml(data.topicTitle)}</h1>`,
    `<h2>${escapeHtml(labels.shortExplanation)}</h2>`,
    `<p>${escapeHtml(data.shortExplanation)}</p>`,
    `<h2>${escapeHtml(labels.keyPoints)}</h2>`,
    `<ul>${keyPointsHtml}</ul>`,
    `<h2>${escapeHtml(labels.example)}</h2>`,
    `<p>${escapeHtml(data.example)}</p>`,
    `<h2>${escapeHtml(labels.summary)}</h2>`,
    `<p>${escapeHtml(data.summary)}</p>`,
  ].join('')
}

function buildStructuredBlocks(data, language = 'english') {
  const labels = getStructuredAnswerLabels(language)
  return [
    { id: uid(), type: 'h1', text: data.topicTitle },
    { id: uid(), type: 'h2', text: labels.shortExplanation },
    { id: uid(), type: 'p', text: data.shortExplanation },
    { id: uid(), type: 'h2', text: labels.keyPoints },
    { id: uid(), type: 'bullet', text: data.keyPoints.join('\n') },
    { id: uid(), type: 'h2', text: labels.example },
    { id: uid(), type: 'p', text: data.example },
    { id: uid(), type: 'h2', text: labels.summary },
    { id: uid(), type: 'p', text: data.summary },
  ]
}

function normalizeAiChatState(value) {
  return {
    messages: Array.isArray(value?.messages) ? value.messages : [],
    selectedSubjectId:
      typeof value?.selectedSubjectId === 'string' && value.selectedSubjectId
        ? value.selectedSubjectId
        : '',
    extraContext: typeof value?.extraContext === 'string' ? value.extraContext : '',
    language: value?.language === 'hindi' ? 'hindi' : 'english',
  }
}

function buildInlineTextNode(text) {
  return {
    type: 'text',
    text: String(text || ''),
  }
}

function takeFirstWords(value, limit = 6) {
  const words = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, limit)

  return words.join(' ') || 'AI Note'
}

function buildInlineNoteNode(questionText, structuredData) {
  const content = []

  if (structuredData.shortExplanation) {
    content.push({
      type: 'paragraph',
      content: [buildInlineTextNode(structuredData.shortExplanation)],
    })
  }

  if (structuredData.keyPoints.length > 0) {
    content.push({
      type: 'bulletList',
      content: structuredData.keyPoints.map((point) => ({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: [buildInlineTextNode(point)],
          },
        ],
      })),
    })
  }

  return {
    type: 'inlineNote',
    attrs: {
      title: takeFirstWords(questionText, 6),
      collapsed: false,
    },
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  }
}

function encodeNodeAttribute(value = '') {
  return encodeURIComponent(String(value))
}

function appendHtmlSegment(previousHtml, nextHtml) {
  const current = String(previousHtml || '').trim()
  if (!current || current === '<p></p>') return nextHtml
  return `${current}${nextHtml}`
}

function buildInlineNoteHtml(questionText, structuredData) {
  const title = takeFirstWords(questionText, 6)
  const explanationHtml = structuredData.shortExplanation
    ? `<p>${escapeHtml(structuredData.shortExplanation)}</p>`
    : '<p></p>'
  const keyPointsHtml = structuredData.keyPoints.length > 0
    ? `<ul>${structuredData.keyPoints.map((point) => `<li><p>${escapeHtml(point)}</p></li>`).join('')}</ul>`
    : ''

  return `<div data-type="inline-note" data-title="${encodeNodeAttribute(title)}" data-collapsed="false">${explanationHtml}${keyPointsHtml}</div>`
}

function buildInlineNoteBlock(questionText, structuredData) {
  return {
    id: uid(),
    type: 'callout',
    text: [
      takeFirstWords(questionText, 6),
      structuredData.shortExplanation,
      ...structuredData.keyPoints.map((point) => `• ${point}`),
    ].filter(Boolean).join('\n'),
  }
}

function getSaveFeedbackPalette(tone) {
  if (tone === 'success') return { color: '#10b981' }
  if (tone === 'error') return { color: '#ef4444' }
  return { color: WARNING_TEXT }
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

function buildPreparedSubject(subject, pdfId, knowledge) {
  if (!subject?.id || !pdfId) return null

  const nextPdfs = (subject.pdfs || []).map((pdf) => {
    if (pdf.id !== pdfId) return pdf

    return {
      ...pdf,
      aiStatus: 'ready',
      aiError: null,
      summary: knowledge?.summary || pdf.summary || '',
      preview: knowledge?.preview || pdf.preview || '',
      pageCount: Number.isFinite(knowledge?.pageCount) ? knowledge.pageCount : (pdf.pageCount || 0),
      chunkCount: Array.isArray(knowledge?.chunks)
        ? knowledge.chunks.length
        : (knowledge?.chunkCount || pdf.chunkCount || 0),
      aiReadyAt: pdf.aiReadyAt || new Date().toISOString(),
    }
  })

  return {
    ...subject,
    pdfs: nextPdfs,
  }
}

function FieldBlock({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
      <span
        style={{
          color: TEXT_MUTED,
          fontSize: '10px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: '700',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

function StatusBanner({ tone, children }) {
  const palette = tone === 'error'
    ? { background: ERROR_BG, border: ERROR_BORDER, color: ERROR_TEXT }
    : { background: SUCCESS_BG, border: SUCCESS_BORDER, color: SUCCESS_TEXT }

  return (
    <div
      style={{
        background: palette.background,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        borderRadius: '12px',
        padding: '10px 12px',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '12px',
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  )
}

function UserMessage({ message, userInitial }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'flex-end' }}>
      <div
        style={{
          maxWidth: 'min(78%, 520px)',
          background: USER_BUBBLE_BG,
          border: `1px solid ${USER_BUBBLE_BORDER}`,
          borderRadius: '16px 16px 6px 16px',
          padding: '12px 14px',
          color: '#f5edff',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          lineHeight: 1.65,
          boxShadow: '0 18px 32px rgba(34,14,68,0.32)',
        }}
      >
        <div
          style={{
            color: '#e7d7ff',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '10px',
            fontWeight: '700',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '6px',
            opacity: 0.86,
          }}
        >
          You
        </div>
        {message.text}
      </div>
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '999px',
          background: USER_AVATAR_BG,
          border: '1px solid rgba(196,181,253,0.24)',
          color: '#d9ccff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '11px',
          fontWeight: '700',
          flexShrink: 0,
        }}
      >
        {userInitial}
      </div>
    </div>
  )
}

function AssistantMessage({ message, onSave, isSaving, saveFeedback, onOpenSavedNote }) {
  const labels = getStructuredAnswerLabels(message.language)
  const structured = normalizeStructuredAnswer(message.structured)
  const sectionTitle = structured ? labels.shortExplanation : 'AI Response'
  const keyPointsLabel = labels.keyPoints
  const feedbackPalette = saveFeedback ? getSaveFeedbackPalette(saveFeedback.tone) : null

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '999px',
          background: AI_BADGE_BG,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '11px',
          fontWeight: '700',
          flexShrink: 0,
          marginTop: '2px',
        }}
      >
        AI
      </div>

      <div
        style={{
          width: 'min(100%, 640px)',
          background: AI_BUBBLE_BG,
          border: `1px solid ${AI_BUBBLE_BORDER}`,
          borderRadius: '16px 16px 16px 6px',
          padding: '14px',
          boxShadow: '0 18px 40px rgba(3,6,22,0.3)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: AI_LABEL_COLOR,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '11px',
            fontWeight: '700',
            marginBottom: '12px',
            padding: '6px 9px',
            borderRadius: '999px',
            background: 'rgba(79,70,229,0.12)',
            border: '1px solid rgba(99,102,241,0.18)',
          }}
        >
          <SparkIcon />
          {sectionTitle}
        </div>

        <div
          style={{
            color: TEXT_PRIMARY,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            lineHeight: 1.75,
            whiteSpace: 'pre-wrap',
          }}
        >
          {structured ? structured.explanation : message.text}
        </div>

        {structured && (
          <>
            <div
              style={{
                margin: '14px 0 12px',
                height: '1px',
                background: 'rgba(255,255,255,0.08)',
              }}
            />

            <div
              style={{
                color: TEXT_MUTED,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '10px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: '700',
                marginBottom: '8px',
              }}
            >
              {keyPointsLabel}
            </div>

            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '7px',
              }}
            >
              {structured.keyPoints.map((point) => (
                <li
                  key={point}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    color: TEXT_SECONDARY,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px',
                    lineHeight: 1.6,
                  }}
                >
                  <span style={{ color: '#8b5cf6', fontSize: '14px', lineHeight: 1 }}>&bull;</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            {(structured.example || structured.summary) && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '10px',
                  marginTop: '14px',
                }}
              >
                <div
                  style={{
                    border: `1px solid ${PANEL_BORDER}`,
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '12px',
                    padding: '10px 12px',
                  }}
                >
                  <div
                    style={{
                      color: TEXT_MUTED,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      fontWeight: '700',
                      marginBottom: '6px',
                    }}
                  >
                    {labels.example}
                  </div>
                  <div
                    style={{
                      color: TEXT_SECONDARY,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '12px',
                      lineHeight: 1.65,
                    }}
                  >
                    {structured.example}
                  </div>
                </div>

                <div
                  style={{
                    border: `1px solid ${PANEL_BORDER}`,
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '12px',
                    padding: '10px 12px',
                  }}
                >
                  <div
                    style={{
                      color: TEXT_MUTED,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      fontWeight: '700',
                      marginBottom: '6px',
                    }}
                  >
                    {labels.summary}
                  </div>
                  <div
                    style={{
                      color: TEXT_SECONDARY,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '12px',
                      lineHeight: 1.65,
                    }}
                  >
                    {structured.summary}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            marginTop: '14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              color: TEXT_MUTED,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '11px',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <ClockIcon />
              {formatMessageTime(message.createdAt)}
            </span>
            {message.cacheHit && <span>Cached</span>}
            {message.referenceLabel && <span>{message.referenceLabel}</span>}
          </div>

          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: `1px solid ${PANEL_BORDER_STRONG}`,
              background: ACCENT_SOFT,
              color: '#cdb8ff',
              borderRadius: '8px',
              padding: '7px 10px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '11px',
              fontWeight: '700',
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving && (
              <span
                className="learnledger-ai-dot"
                style={{
                  width: '5px',
                  height: '5px',
                }}
              />
            )}
            <SaveIcon />
            {isSaving ? 'Saving...' : 'Save as Note'}
          </button>
        </div>

        {saveFeedback && (
          <div
            style={{
              marginTop: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div
              style={{
                color: feedbackPalette?.color || TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '11px',
                lineHeight: 1.5,
              }}
            >
              {saveFeedback.text}
            </div>

            {saveFeedback.noteLink && (
              <button
                type="button"
                onClick={() => onOpenSavedNote?.(saveFeedback.noteLink)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  color: '#a78bfa',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '11px',
                  fontWeight: '600',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                Open note &rarr;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '999px',
          background: AI_BADGE_BG,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '11px',
          fontWeight: '700',
          flexShrink: 0,
          marginTop: '2px',
        }}
      >
        AI
      </div>

      <div
        style={{
          background: AI_BUBBLE_BG,
          border: `1px solid ${AI_BUBBLE_BORDER}`,
          borderRadius: '16px 16px 16px 6px',
          padding: '12px 14px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          color: TEXT_SECONDARY,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '12px',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '999px',
            background: '#8b5cf6',
            boxShadow: '12px 0 0 #8b5cf6, 24px 0 0 #8b5cf6',
            marginRight: '22px',
          }}
        />
        Thinking...
      </div>
    </div>
  )
}

export default function AIAssistantPage({
  user,
  subjects,
  onUpdateSubject,
  initialContext = null,
  aiChatState = DEFAULT_AI_CHAT_STATE,
  onAiChatStateChange = null,
  onOpenSavedNote = null,
}) {
  const [question, setQuestion] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [savingMessageId, setSavingMessageId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activePdfContext, setActivePdfContext] = useState(null)
  const [appliedLaunchId, setAppliedLaunchId] = useState('')
  const [pendingSubjectChange, setPendingSubjectChange] = useState(null)
  const [clearChatConfirm, setClearChatConfirm] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState(null)
  const messagesEndRef = useRef(null)

  const chatState = useMemo(
    () => normalizeAiChatState(aiChatState),
    [aiChatState]
  )
  const language = chatState.language
  const selectedSubjectId = chatState.selectedSubjectId
  const typedContext = chatState.extraContext
  const messages = chatState.messages

  const updateAiChatState = (updater) => {
    if (!onAiChatStateChange) return

    onAiChatStateChange((previous) => {
      const normalizedPrevious = normalizeAiChatState(previous)
      const nextValue = typeof updater === 'function'
        ? updater(normalizedPrevious)
        : { ...normalizedPrevious, ...updater }

      return normalizeAiChatState(nextValue)
    })
  }

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId]
  )

  const pageDate = useMemo(() => formatFullDate(new Date()), [])
  const quickPrompts = useMemo(
    () => QUICK_PROMPTS[language] || QUICK_PROMPTS.english,
    [language]
  )
  const contextLabel = useMemo(
    () => getContextLabel(selectedSubject, typedContext, activePdfContext),
    [activePdfContext, selectedSubject, typedContext]
  )
  const userInitial = useMemo(() => getUserInitial(user), [user])

  useEffect(() => {
    if (saveFeedback?.tone !== 'success') return undefined

    const timeoutId = window.setTimeout(() => {
      setSaveFeedback((previous) => (
        previous?.tone === 'success' ? null : previous
      ))
    }, 2000)

    return () => window.clearTimeout(timeoutId)
  }, [saveFeedback])

  useEffect(() => {
    if (!initialContext?.launchId || initialContext.launchId === appliedLaunchId) return

    updateAiChatState((previous) => ({
      ...previous,
      selectedSubjectId: initialContext.subjectId || '',
      extraContext: initialContext.typedContext || '',
    }))
    setActivePdfContext(
      initialContext.pdfId
        ? {
            subjectId: initialContext.subjectId || '',
            knowledgeSubjectId: initialContext.pdfKnowledgeSubjectId || initialContext.subjectId || '',
            scopeLabel: initialContext.pdfScopeLabel || '',
            pdfId: initialContext.pdfId,
            pdfName: initialContext.pdfName || 'Attached PDF',
            pdfStatus: initialContext.pdfStatus || 'not-processed',
          }
        : null
    )
    setNotice(
      initialContext.pdfId
        ? initialContext.pdfStatus === 'ready'
          ? `Using stored PDF context from "${initialContext.pdfName}".`
          : `Using "${initialContext.pdfName}" as PDF context. AI knowledge will be prepared when needed.`
        : 'AI context updated.'
    )
    setError('')
    setAppliedLaunchId(initialContext.launchId)
  }, [appliedLaunchId, initialContext])

  useEffect(() => {
    if (!activePdfContext) return
    if (!activePdfContext.subjectId) return
    if (!selectedSubjectId || activePdfContext.subjectId === selectedSubjectId) return
    setActivePdfContext(null)
  }, [activePdfContext, selectedSubjectId])

  useEffect(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    })
  }, [messages, isAsking])

  const handleLanguageChange = (nextLanguage) => {
    updateAiChatState((previous) => ({
      ...previous,
      language: nextLanguage,
    }))
    setClearChatConfirm(false)
  }

  const handleContextChange = (nextContext) => {
    updateAiChatState((previous) => ({
      ...previous,
      extraContext: nextContext,
    }))
    setClearChatConfirm(false)
  }

  const handleSubjectSelect = (nextSubjectId) => {
    if (nextSubjectId === selectedSubjectId) {
      setPendingSubjectChange(null)
      return
    }

    if (messages.length > 0) {
      setPendingSubjectChange(nextSubjectId)
      return
    }

    updateAiChatState((previous) => ({
      ...previous,
      selectedSubjectId: nextSubjectId,
      messages: [],
    }))
    setClearChatConfirm(false)
    setSaveFeedback(null)
  }

  const confirmSubjectChange = () => {
    if (pendingSubjectChange == null) return

    updateAiChatState((previous) => ({
      ...previous,
      selectedSubjectId: pendingSubjectChange,
      messages: [],
    }))
    setPendingSubjectChange(null)
    setClearChatConfirm(false)
    setSaveFeedback(null)
  }

  const cancelSubjectChange = () => {
    setPendingSubjectChange(null)
  }

  const handleClearChat = () => {
    updateAiChatState((previous) => ({
      ...previous,
      messages: [],
    }))
    setClearChatConfirm(false)
    setPendingSubjectChange(null)
    setSaveFeedback(null)
  }

  const askQuestion = async () => {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) return

    setError('')
    setNotice('')
    setIsAsking(true)

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

    updateAiChatState((previous) => ({
      ...previous,
      messages: [...previous.messages, userMessage],
    }))
    setQuestion('')
    setSaveFeedback(null)
    setClearChatConfirm(false)

    try {
      let referenceMaterial = ''
      let referenceLabel = ''
      let referenceId = null
      let pdfPreparedNotice = ''

      if (activePdfContext?.pdfId) {
        const pdfKnowledgeSubjectId = activePdfContext.knowledgeSubjectId || selectedSubject?.id || ''

        if (!user?.uid || !pdfKnowledgeSubjectId) {
          throw new Error('This PDF context is incomplete. Reopen it from the source screen and try again.')
        }

        const pdfReference = await getRelevantPdfReferenceMaterial({
          userId: user.uid,
          subjectId: pdfKnowledgeSubjectId,
          pdfId: activePdfContext.pdfId,
          pdfName: activePdfContext.pdfName,
          question: trimmedQuestion,
          extraContext: typedContext,
          prepareIfMissing: true,
        })

        if (!pdfReference.referenceMaterial) {
          throw new Error('This PDF could not be prepared for AI. Re-upload it and try again.')
        }

        referenceMaterial = pdfReference.referenceMaterial
        referenceLabel = `PDF: ${activePdfContext.pdfName}`
        referenceId = activePdfContext.pdfId

        if (pdfReference.preparedNow || activePdfContext.pdfStatus !== 'ready') {
          const updatedSubject = selectedSubject?.id === pdfKnowledgeSubjectId
            ? buildPreparedSubject(
                selectedSubject,
                activePdfContext.pdfId,
                pdfReference.knowledge
              )
            : null

          if (updatedSubject) {
            await onUpdateSubject(updatedSubject)
          }

          setActivePdfContext((previous) => (
            previous && previous.pdfId === activePdfContext.pdfId
              ? { ...previous, pdfStatus: 'ready' }
              : previous
          ))

          if (pdfReference.preparedNow) {
            pdfPreparedNotice = `Prepared compressed PDF context for "${activePdfContext.pdfName}". Only relevant excerpts are sent to AI.`
          }
        }
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

      const text = formatStructuredAnswer(structured, language)
      const modelUsed = response?.meta?.modelUsed || null
      const provider = response?.meta?.provider || null
      const cacheHit = Boolean(response?.meta?.cacheHit)
      const createdAt = new Date().toISOString()
      const subjectId = selectedSubject?.id || null
      const subjectName = selectedSubject?.name || null

      updateAiChatState((previous) => ({
        ...previous,
        messages: [
          ...previous.messages,
          {
            id: uid(),
            role: 'assistant',
            text,
            structured,
            questionText: trimmedQuestion,
            language,
            subjectId: subjectId || '',
            contextLabel,
            createdAt,
            modelUsed,
            provider,
            cacheHit,
            referenceLabel,
          },
        ],
      }))

      if (user?.uid) {
        try {
          await saveAIChat(user.uid, {
            question: trimmedQuestion,
            response: text,
            subjectId,
            subjectName,
            subjectContext: contextLabel,
            language,
            modelUsed,
            provider,
            createdAt,
          })
        } catch (saveError) {
          console.warn('Failed to save AI chat:', saveError)
        }
      }

      if (pdfPreparedNotice) {
        setNotice(pdfPreparedNotice)
      }
    } catch (err) {
      setError(err.message || 'Failed to get AI response.')
    } finally {
      setIsAsking(false)
    }
  }

  const handleQuestionKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      askQuestion()
    }
  }

  const saveResponseAsNotes = async (assistantMessage) => {
    const targetSubjectId = assistantMessage.subjectId || selectedSubjectId
    if (!targetSubjectId) {
      setSaveFeedback({
        messageId: assistantMessage.id,
        tone: 'warning',
        text: 'Select a subject first to save notes',
      })
      return
    }

    const subject = subjects.find((item) => item.id === targetSubjectId)
    if (!subject) {
      setSaveFeedback({
        messageId: assistantMessage.id,
        tone: 'error',
        text: '✗ Save failed, try again',
      })
      return
    }

    setError('')
    setNotice('')
    setSavingMessageId(assistantMessage.id)
    setSaveFeedback(null)

    try {
      const structured = toStructuredNotePayload(assistantMessage.structured)
      const questionText = assistantMessage.questionText || assistantMessage.text
      const now = new Date().toISOString()
      const inlineNoteHtml = buildInlineNoteHtml(questionText, structured)
      const inlineNoteBlock = buildInlineNoteBlock(questionText, structured)

      const existingMasterTopic = subject.topics.find((topic) =>
        topic.id === AI_MASTER_TOPIC_ID || String(topic.name || '').trim().toLowerCase() === 'ai notes'
      )
      const existingMasterTopicNotes = Array.isArray(existingMasterTopic?.notes)
        ? existingMasterTopic.notes
        : []
      const existingMasterNote = existingMasterTopicNotes.find((note) =>
        note.id === AI_MASTER_NOTE_ID || String(note.title || '').trim() === `AI Notes — ${subject.name}`
      )

      const nextMasterNote = {
        id: existingMasterNote?.id || AI_MASTER_NOTE_ID,
        title: `AI Notes — ${subject.name}`,
        content: appendHtmlSegment(existingMasterNote?.content, inlineNoteHtml),
        blocks: [
          ...(Array.isArray(existingMasterNote?.blocks) ? existingMasterNote.blocks : []),
          inlineNoteBlock,
        ],
        tags: ['ai-generated'],
        theme: existingMasterNote?.theme || 'midnight',
        fontSize: existingMasterNote?.fontSize || 'medium',
        isFavorite: Boolean(existingMasterNote?.isFavorite),
        isPinned: Boolean(existingMasterNote?.isPinned),
        linkedNotes: Array.isArray(existingMasterNote?.linkedNotes) ? existingMasterNote.linkedNotes : [],
        createdAt: existingMasterNote?.createdAt || now,
        updatedAt: now,
        lastOpenedAt: now,
      }

      const nextMasterTopic = existingMasterTopic
        ? {
            ...existingMasterTopic,
            name: 'AI Notes',
            questionsCount: existingMasterTopic.questionsCount || 0,
            isCompleted: Boolean(existingMasterTopic.isCompleted),
            completedAt: existingMasterTopic.completedAt || null,
            notes: existingMasterTopicNotes.some((note) => note.id === nextMasterNote.id)
              ? existingMasterTopicNotes.map((note) => (
                  note.id === nextMasterNote.id ? nextMasterNote : note
                ))
              : [...existingMasterTopicNotes, nextMasterNote],
          }
        : {
            id: AI_MASTER_TOPIC_ID,
            name: 'AI Notes',
            questionsCount: 0,
            isCompleted: false,
            completedAt: null,
            notes: [nextMasterNote],
          }

      const nextTopics = existingMasterTopic
        ? subject.topics.map((topic) => (
            topic.id === existingMasterTopic.id ? nextMasterTopic : topic
          ))
        : [...subject.topics, nextMasterTopic]

      await onUpdateSubject({
        ...subject,
        topics: nextTopics,
      })

      setSaveFeedback({
        messageId: assistantMessage.id,
        tone: 'success',
        text: `✓ Saved to AI Notes — ${subject.name}`,
        noteLink: {
          subjectId: subject.id,
          noteId: nextMasterNote.id,
          topicId: nextMasterTopic.id,
        },
      })
    } catch (err) {
      setSaveFeedback({
        messageId: assistantMessage.id,
        tone: 'error',
        text: '✗ Save failed, try again',
      })
    } finally {
      setSavingMessageId(null)
    }
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center' }}>
      <section
        style={{
          width: '100%',
          maxWidth: '940px',
          background: SHELL_BG,
          border: `1px solid ${PANEL_BORDER}`,
          borderRadius: '22px',
          overflow: 'hidden',
          boxShadow: '0 28px 80px rgba(2,0,10,0.4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '18px 18px 10px',
            borderBottom: `1px solid ${PANEL_BORDER}`,
          }}
        >
          <div>
            <h1
              style={{
                margin: '0 0 4px',
                color: TEXT_PRIMARY,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '28px',
                fontWeight: '800',
                letterSpacing: '-0.03em',
              }}
            >
              AI Assistant
            </h1>
            <p
              style={{
                margin: 0,
                color: TEXT_MUTED,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
              }}
            >
              {pageDate}
            </p>
          </div>

          <button
            type="button"
            aria-label="More options"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              border: `1px solid ${PANEL_BORDER}`,
              background: 'rgba(255,255,255,0.04)',
              color: TEXT_SECONDARY,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <MoreIcon />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            padding: '12px 18px',
            borderBottom: `1px solid ${PANEL_BORDER}`,
          }}
        >
          <FieldBlock label="Language">
            <select
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value)}
              className="learnledger-input"
              style={{
                background: '#131022',
                borderColor: PANEL_BORDER,
                color: TEXT_PRIMARY,
                fontSize: '13px',
                minHeight: '40px',
              }}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldBlock>

          <FieldBlock label="Subject">
            <select
              value={selectedSubjectId}
              onChange={(event) => handleSubjectSelect(event.target.value)}
              className="learnledger-input"
              style={{
                background: '#131022',
                borderColor: PANEL_BORDER,
                color: TEXT_PRIMARY,
                fontSize: '13px',
                minHeight: '40px',
              }}
            >
              <option value="">Select subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </FieldBlock>

          <FieldBlock label="Topic Context">
            <input
              type="text"
              value={typedContext}
              onChange={(event) => handleContextChange(event.target.value)}
              className="learnledger-input"
              placeholder="Geography, Rivers..."
              style={{
                background: '#131022',
                borderColor: PANEL_BORDER,
                color: TEXT_PRIMARY,
                fontSize: '13px',
                minHeight: '40px',
              }}
            />
          </FieldBlock>
        </div>

        <div style={{ padding: '14px 18px 10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '999px',
                background: 'rgba(35,24,64,0.95)',
                border: `1px solid ${PANEL_BORDER_STRONG}`,
                color: '#cbb8ff',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '11px',
                fontWeight: '600',
              }}
            >
              <SparkIcon />
              {contextLabel}
            </span>

            {activePdfContext && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 12px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${PANEL_BORDER}`,
                  color: TEXT_SECONDARY,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '11px',
                  fontWeight: '600',
                }}
              >
                PDF: {activePdfContext.pdfName}
                {activePdfContext.scopeLabel ? ` • ${activePdfContext.scopeLabel}` : ''}
                <button
                  type="button"
                  onClick={() => setActivePdfContext(null)}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '999px',
                    border: 'none',
                    background: 'rgba(255,255,255,0.04)',
                    color: TEXT_PRIMARY,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  <span style={{ width: '10px', height: '10px' }}>
                    <XIcon />
                  </span>
                </button>
              </span>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                color: TEXT_MUTED,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '10px',
                fontWeight: '600',
                letterSpacing: '0.04em',
              }}
            >
              {`💬 ${messages.length} messages`}
            </span>

            <button
              type="button"
              onClick={() => setClearChatConfirm((previous) => !previous)}
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
                color: '#6b5e8a',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '10px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.color = CHAT_CLEAR_HOVER
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.color = '#6b5e8a'
              }}
            >
              🗑 Clear chat
            </button>
          </div>

          {pendingSubjectChange !== null && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '12px',
                border: `1px solid ${PANEL_BORDER}`,
                background: 'rgba(255,255,255,0.02)',
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '11px',
              }}
            >
              <span>Starting new subject will clear chat. Continue?</span>
              <button
                type="button"
                onClick={confirmSubjectChange}
                style={{
                  border: `1px solid ${PANEL_BORDER_STRONG}`,
                  background: ACCENT_SOFT,
                  color: '#d9c9ff',
                  borderRadius: '999px',
                  padding: '5px 10px',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '10px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Yes, clear
              </button>
              <button
                type="button"
                onClick={cancelSubjectChange}
                style={{
                  border: `1px solid ${PANEL_BORDER}`,
                  background: 'rgba(255,255,255,0.02)',
                  color: TEXT_SECONDARY,
                  borderRadius: '999px',
                  padding: '5px 10px',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '10px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Keep chat
              </button>
            </div>
          )}

          {clearChatConfirm && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '12px',
                border: `1px solid ${PANEL_BORDER}`,
                background: 'rgba(255,255,255,0.02)',
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '11px',
              }}
            >
              <span>Clear all messages?</span>
              <button
                type="button"
                onClick={handleClearChat}
                style={{
                  border: `1px solid ${PANEL_BORDER_STRONG}`,
                  background: ACCENT_SOFT,
                  color: '#d9c9ff',
                  borderRadius: '999px',
                  padding: '5px 10px',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '10px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setClearChatConfirm(false)}
                style={{
                  border: `1px solid ${PANEL_BORDER}`,
                  background: 'rgba(255,255,255,0.02)',
                  color: TEXT_SECONDARY,
                  borderRadius: '999px',
                  padding: '5px 10px',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '10px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                No
              </button>
            </div>
          )}

          {error && <StatusBanner tone="error">{error}</StatusBanner>}
          {notice && <StatusBanner tone="success">{notice}</StatusBanner>}
        </div>

        <div
          style={{
            padding: '0 18px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div
            style={{
              minHeight: '420px',
              maxHeight: '520px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              padding: '10px 0 6px',
            }}
          >
            {messages.length === 0 && !isAsking && (
              <div
                style={{
                  border: `1px dashed ${PANEL_BORDER}`,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
                  borderRadius: '18px',
                  padding: '18px',
                }}
              >
                <div
                  style={{
                    color: TEXT_PRIMARY,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '15px',
                    fontWeight: '700',
                    marginBottom: '8px',
                  }}
                >
                  Ask your first question
                </div>
                <div
                  style={{
                    color: TEXT_MUTED,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '13px',
                    lineHeight: 1.7,
                    maxWidth: '580px',
                  }}
                >
                  Select a subject, add topic context, then ask for explanation, MCQs, summaries, or revision help.
                </div>
              </div>
            )}

            {messages.map((message) =>
              message.role === 'user' ? (
                <UserMessage key={message.id} message={message} userInitial={userInitial} />
              ) : (
                <AssistantMessage
                  key={message.id}
                  message={message}
                  isSaving={savingMessageId === message.id}
                  onSave={() => saveResponseAsNotes(message)}
                  saveFeedback={saveFeedback?.messageId === message.id ? saveFeedback : null}
                  onOpenSavedNote={onOpenSavedNote}
                />
              )
            )}

            {isAsking && <ThinkingBubble />}
            <div ref={messagesEndRef} />
          </div>

          <div
            style={{
              borderTop: `1px solid ${PANEL_BORDER}`,
              paddingTop: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setQuestion(prompt)}
                  style={{
                    border: `1px solid ${PANEL_BORDER}`,
                    background: 'rgba(255,255,255,0.02)',
                    color: '#bfb4df',
                    borderRadius: '999px',
                    padding: '7px 10px',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '11px',
                    fontWeight: '600',
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div
              className="flex flex-col sm:flex-row"
              style={{
                gap: '10px',
                alignItems: 'stretch',
              }}
            >
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleQuestionKeyDown}
                placeholder={
                  language === 'hindi'
                    ? 'Apna sawal likho...'
                    : 'Ask your study question...'
                }
                className="learnledger-input"
                rows={1}
                style={{
                  resize: 'vertical',
                  minHeight: '56px',
                  maxHeight: '170px',
                  background: '#131022',
                  borderColor: PANEL_BORDER,
                  color: TEXT_PRIMARY,
                  fontSize: '13px',
                  lineHeight: 1.6,
                }}
              />

              <button
                className="w-full sm:w-auto"
                type="button"
                onClick={askQuestion}
                disabled={isAsking || !question.trim()}
                style={{
                  minWidth: '120px',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '0 18px',
                  background: isAsking || !question.trim()
                    ? 'rgba(124,58,237,0.45)'
                    : 'linear-gradient(135deg,#7c3aed,#5b21b6)',
                  color: '#fff',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '14px',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: isAsking || !question.trim() ? 0.7 : 1,
                  boxShadow: isAsking || !question.trim()
                    ? 'none'
                    : '0 18px 36px rgba(72, 32, 150, 0.34)',
                }}
              >
                {isAsking ? 'Thinking...' : 'Ask AI'}
                {!isAsking && <ArrowIcon />}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
