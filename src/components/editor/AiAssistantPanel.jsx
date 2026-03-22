import { useEffect, useMemo, useRef, useState } from 'react'
import { generateTextFromAI } from '@/utils/aiClient'
import { XIcon } from '@/components/ui/Icons'

const SYSTEM_PROMPT = `You are a concise study assistant.
Reply with a short explanation and 3-5 key points.
Format your response as JSON:
{ "explanation": string, "keyPoints": string[] }`

const QUICK_ACTIONS = [
  { id: 'explain', label: 'Explain', prompt: 'Explain this clearly in simple study language.' },
  { id: 'summarize', label: 'Summarize', prompt: 'Summarize this into quick revision points.' },
  { id: 'mcq', label: 'Make MCQ', prompt: 'Create one MCQ from this and mention the correct answer briefly.' },
]

const DEFAULT_THEME = {
  accent: '#a855f7',
  accentSecondary: '#22d3ee',
  panelBackground: 'linear-gradient(135deg, rgba(11,20,38,0.74), rgba(23,12,42,0.58))',
  panelBorder: 'rgba(148,163,184,0.16)',
  panelShadow: '0 20px 46px rgba(3,10,25,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
  titleInputBackground: 'rgba(8,17,35,0.56)',
  titleInputBorder: 'rgba(148,163,184,0.18)',
  titleInputText: '#f8fbff',
  pillBackground: 'rgba(255,255,255,0.04)',
  pillBorder: 'rgba(148,163,184,0.14)',
  pillText: '#d3defa',
  pillActiveBackground: 'linear-gradient(135deg, rgba(34,211,238,0.16), rgba(168,85,247,0.22))',
  pillActiveBorder: 'rgba(103,232,249,0.28)',
  pillActiveText: '#ffffff',
  actionBackground: 'linear-gradient(135deg, rgba(34,211,238,0.34), rgba(168,85,247,0.34) 58%, rgba(52,211,153,0.24))',
  actionBorder: 'rgba(125,211,252,0.42)',
  actionText: '#f7fbff',
  floatingBackground: 'linear-gradient(180deg, rgba(10,16,33,0.96), rgba(9,11,26,0.92))',
  floatingBorder: 'rgba(148,163,184,0.18)',
  floatingText: '#dbe7ff',
  cssVars: {
    '--note-editor-heading': '#ffffff',
    '--note-editor-text': '#edf3ff',
    '--note-editor-muted': '#9fb1d6',
  },
}

function getPalette(themeStyles) {
  const palette = themeStyles || DEFAULT_THEME

  return {
    ...DEFAULT_THEME,
    ...palette,
    cssVars: {
      ...DEFAULT_THEME.cssVars,
      ...(palette?.cssVars || {}),
    },
  }
}

function parseAiJsonResponse(rawText) {
  const cleaned = String(rawText || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  const candidates = [cleaned]
  const objectMatch = cleaned.match(/\{[\s\S]*\}/)
  if (objectMatch) candidates.push(objectMatch[0])

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      const explanation = String(parsed?.explanation || '').trim()
      const keyPoints = Array.isArray(parsed?.keyPoints)
        ? parsed.keyPoints.map((item) => String(item || '').trim()).filter(Boolean)
        : []

      if (explanation || keyPoints.length > 0) {
        return {
          explanation: explanation || 'No explanation returned.',
          keyPoints: keyPoints.slice(0, 5),
        }
      }
    } catch {
      // Try next candidate
    }
  }

  return {
    explanation: cleaned || 'No explanation returned.',
    keyPoints: [],
  }
}

function LoadingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0' }}>
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="learnledger-ai-dot"
          style={{
            animationDelay: `${index * 0.14}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function AiAssistantPanel({ open, selectedText, onClose, onInsert, themeStyles = null }) {
  const textareaRef = useRef(null)
  const [showFullQuote, setShowFullQuote] = useState(false)
  const [question, setQuestion] = useState('')
  const [status, setStatus] = useState('idle')
  const [response, setResponse] = useState(null)
  const [error, setError] = useState('')
  const palette = getPalette(themeStyles)

  useEffect(() => {
    if (!open) return

    setShowFullQuote(false)
    setQuestion('')
    setStatus('idle')
    setResponse(null)
    setError('')

    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }, [open, selectedText])

  const shouldShowToggle = useMemo(() => selectedText.trim().length > 180, [selectedText])

  const runAskAi = async (nextQuestion) => {
    const trimmedQuestion = String(nextQuestion || '').trim()
    if (!trimmedQuestion) return

    setQuestion(trimmedQuestion)
    setStatus('loading')
    setError('')
    setResponse(null)

    try {
      const result = await generateTextFromAI({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: `Selected text: ${selectedText}\n\nQuestion: ${trimmedQuestion}`,
        temperature: 0.35,
        maxTokens: 900,
      })

      setResponse(parseAiJsonResponse(result.text))
      setStatus('success')
    } catch (nextError) {
      setStatus('error')
      setError(nextError?.message || 'Unable to get a response right now.')
    }
  }

  if (!open) return null

  return (
    <div
      style={{
        background: palette.panelBackground,
        border: `1px solid ${palette.panelBorder}`,
        borderRadius: '18px',
        padding: '14px',
        boxShadow: palette.panelShadow,
        backdropFilter: 'blur(22px) saturate(160%)',
        '--learnledger-ai-dot': palette.accent,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          marginBottom: '12px',
        }}
      >
        <span
          style={{
            color: palette.accentSecondary,
            fontSize: '11px',
            fontWeight: '700',
            fontFamily: "'DM Sans', sans-serif",
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          ✦ AI Assistant
        </span>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '18px',
            height: '18px',
            border: 'none',
            borderRadius: '999px',
            background: 'transparent',
            color: palette.cssVars['--note-editor-muted'],
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <span style={{ width: '10px', height: '10px' }}>
            <XIcon />
          </span>
        </button>
      </div>

      <div
        style={{
          background: palette.pillBackground,
          border: `1px solid ${palette.pillBorder}`,
          borderLeft: `2px solid ${palette.accentSecondary}`,
          borderRadius: '0 10px 10px 0',
          padding: '10px 10px 10px 12px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            color: palette.cssVars['--note-editor-muted'],
            fontStyle: 'italic',
            fontSize: '11px',
            lineHeight: 1.6,
            fontFamily: "'DM Sans', sans-serif",
            whiteSpace: 'pre-wrap',
            display: showFullQuote ? 'block' : '-webkit-box',
            overflow: 'hidden',
            WebkitLineClamp: showFullQuote ? 'unset' : 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {selectedText}
        </div>

        {shouldShowToggle && (
          <button
            type="button"
            onClick={() => setShowFullQuote((previous) => !previous)}
            style={{
              marginTop: '6px',
              border: 'none',
              background: 'transparent',
              padding: 0,
              color: palette.accentSecondary,
              fontSize: '11px',
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            {showFullQuote ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      <textarea
        ref={textareaRef}
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Ask about this..."
        style={{
          width: '100%',
          minHeight: '74px',
          resize: 'vertical',
          borderRadius: '12px',
          background: palette.titleInputBackground,
          border: `1px solid ${palette.titleInputBorder}`,
          color: palette.titleInputText,
          fontSize: '12px',
          lineHeight: 1.55,
          fontFamily: "'DM Sans', sans-serif",
          padding: '10px 11px',
          outline: 'none',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      />

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => runAskAi(action.prompt)}
            disabled={status === 'loading'}
            style={{
              borderRadius: '999px',
              border: `1px solid ${palette.pillBorder}`,
              background: palette.pillBackground,
              color: palette.pillText,
              fontSize: '10px',
              fontWeight: '600',
              fontFamily: "'DM Sans', sans-serif",
              padding: '4px 9px',
              cursor: status === 'loading' ? 'default' : 'pointer',
              opacity: status === 'loading' ? 0.6 : 1,
            }}
          >
            {action.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => runAskAi(question)}
        disabled={status === 'loading' || !question.trim()}
        style={{
          width: '100%',
          marginTop: '10px',
          borderRadius: '12px',
          border: `1px solid ${palette.actionBorder}`,
          background: palette.actionBackground,
          color: palette.actionText,
          fontSize: '12px',
          fontWeight: '700',
          fontFamily: "'DM Sans', sans-serif",
          padding: '10px 12px',
          cursor: status === 'loading' || !question.trim() ? 'default' : 'pointer',
          opacity: status === 'loading' || !question.trim() ? 0.6 : 1,
          boxShadow: '0 14px 32px rgba(8,18,38,0.28)',
        }}
      >
        Ask AI
      </button>

      <div style={{ marginTop: '12px' }}>
        {status === 'loading' && <LoadingDots />}

        {status === 'error' && (
          <div
            style={{
              color: '#fca5a5',
              fontSize: '11px',
              lineHeight: 1.6,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {error}
          </div>
        )}

        {status === 'success' && response && (
          <div
            style={{
              borderRadius: '14px',
              background: palette.floatingBackground,
              border: `1px solid ${palette.floatingBorder}`,
              padding: '12px',
              boxShadow: '0 16px 32px rgba(3,10,26,0.22)',
            }}
          >
            <div
              style={{
                color: palette.cssVars['--note-editor-text'],
                fontSize: '12px',
                lineHeight: 1.65,
                fontFamily: "'DM Sans', sans-serif",
                whiteSpace: 'pre-wrap',
              }}
            >
              {response.explanation}
            </div>

            {response.keyPoints.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '10px' }}>
                {response.keyPoints.map((point, index) => (
                  <div
                    key={`${index}-${point.slice(0, 12)}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      color: palette.floatingText,
                      fontSize: '11px',
                      lineHeight: 1.55,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '999px',
                        background: palette.accentSecondary,
                        marginTop: '5px',
                        flexShrink: 0,
                      }}
                    />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => onInsert(response)}
              style={{
                marginTop: '12px',
                borderRadius: '10px',
                border: `1px solid ${palette.pillActiveBorder}`,
                background: palette.pillActiveBackground,
                color: palette.pillActiveText,
                fontSize: '11px',
                fontWeight: '600',
                fontFamily: "'DM Sans', sans-serif",
                padding: '7px 10px',
                cursor: 'pointer',
              }}
            >
              Insert into Note
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
