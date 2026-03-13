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

export default function AiAssistantPanel({ open, selectedText, onClose, onInsert }) {
  const textareaRef = useRef(null)
  const [showFullQuote, setShowFullQuote] = useState(false)
  const [question, setQuestion] = useState('')
  const [status, setStatus] = useState('idle')
  const [response, setResponse] = useState(null)
  const [error, setError] = useState('')

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
        background: '#0d0b1a',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '12px',
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
            color: '#a78bfa',
            fontSize: '11px',
            fontWeight: '500',
            fontFamily: "'DM Sans', sans-serif",
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
            color: 'rgba(237,230,255,0.62)',
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
          background: 'rgba(124,58,237,0.06)',
          borderLeft: '2px solid #7c3aed',
          borderRadius: '0 4px 4px 0',
          padding: '9px 0 9px 8px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            color: '#9d8ec4',
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
              color: '#7c3aed',
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
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.04)',
          border: '0.5px solid rgba(255,255,255,0.1)',
          color: '#ede6ff',
          fontSize: '12px',
          lineHeight: 1.55,
          fontFamily: "'DM Sans', sans-serif",
          padding: '10px 11px',
          outline: 'none',
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
              border: '0.5px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: '#b7abdd',
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
          borderRadius: '8px',
          border: 'none',
          background: '#7c3aed',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: '700',
          fontFamily: "'DM Sans', sans-serif",
          padding: '10px 12px',
          cursor: status === 'loading' || !question.trim() ? 'default' : 'pointer',
          opacity: status === 'loading' || !question.trim() ? 0.6 : 1,
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
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '11px',
            }}
          >
            <div
              style={{
                color: '#ede6ff',
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
                      color: '#d8cbff',
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
                        background: '#7c3aed',
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
                borderRadius: '7px',
                border: '0.5px solid rgba(124,58,237,0.3)',
                background: 'rgba(124,58,237,0.15)',
                color: '#a78bfa',
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
