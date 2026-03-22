import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'
import {
  BackIcon,
  ChevronDownIcon,
  DownloadIcon,
  EditIcon,
  PlusIcon,
  QuestionBankIcon,
  SearchIcon,
  TrashIcon,
  XIcon,
} from '@/components/ui/Icons'
import { TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import {
  createManualQuestionBankItem,
  mergeQuestionBankItems,
  normalizeQuestionBank,
  normalizeQuestionBankItem,
} from '@/utils/questionBank'

const PAGE_SIZE = 25

const EMPTY_FORM = {
  subjectId: '',
  question: '',
  answer: '',
  explanation: '',
}

const SOURCE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'manual', label: 'Manual' },
  { id: 'generated', label: 'Generated' },
]

function toTimestamp(value) {
  const parsed = new Date(value || '')
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

function fmt(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0)
}

function buildPages(total, current) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const pages = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) pages.push('...')
  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }
  if (end < total - 1) pages.push('...')
  pages.push(total)

  return pages
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function exportQuestionsAsText(questions) {
  const lines = questions.map((question, index) => [
    `Question ${index + 1}: ${question.questionText}`,
    `Answer: ${question.answer || 'No answer available.'}`,
  ].join('\n'))

  downloadTextFile('question-bank.txt', lines.join('\n\n'))
}

function Ic({ children, size = 14 }) {
  return (
    <span style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </span>
  )
}

function Checkbox({ checked, onChange, indeterminate = false }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      style={{
        width: 14,
        height: 14,
        margin: 0,
        cursor: 'pointer',
        accentColor: '#5eead4',
        flexShrink: 0,
      }}
    />
  )
}

function StatCard({ label, value, tint }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 150,
      borderRadius: 14,
      border: `1px solid ${tint}26`,
      background: `linear-gradient(180deg, ${tint}14, rgba(19,16,36,0.92))`,
      padding: '14px 16px',
    }}>
      <div style={{
        color: tint,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 28,
        fontWeight: 900,
        letterSpacing: '-0.05em',
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        marginTop: 8,
        color: TEXT3,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
    </div>
  )
}

function FormLabel({ children }) {
  return (
    <label style={{
      display: 'block',
      marginBottom: 6,
      color: TEXT3,
      fontFamily: "'DM Sans', sans-serif",
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
    }}>
      {children}
    </label>
  )
}

function FieldInput({ value, onChange, placeholder, as = 'input' }) {
  const baseStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: TEXT1,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    outline: 'none',
  }

  if (as === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ ...baseStyle, minHeight: 88, resize: 'vertical' }}
      />
    )
  }

  return <input value={value} onChange={onChange} placeholder={placeholder} style={baseStyle} />
}

function getSelectStyle() {
  return {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 34px 11px 12px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#171327',
    color: '#f4f0ff',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 13,
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    colorScheme: 'dark',
  }
}

function QuestionExpansion({ item, onEdit, onDelete }) {
  return (
    <div style={{
      borderTop: '1px solid rgba(255,255,255,0.05)',
      padding: '14px 16px 16px',
      background: 'rgba(18,15,34,0.84)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        flexWrap: 'wrap',
      }}>
        <div style={{
          color: TEXT3,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          fontWeight: 600,
        }}>
          {item.subject} | {item.source === 'generated' ? 'Generated from Test' : 'Manual Entry'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => onEdit(item)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 9,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: TEXT2,
              cursor: 'pointer',
              padding: '7px 10px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <Ic size={11}><EditIcon /></Ic>
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 9,
              border: '1px solid rgba(248,113,113,0.2)',
              background: 'rgba(248,113,113,0.08)',
              color: '#fca5a5',
              cursor: 'pointer',
              padding: '7px 10px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <Ic size={11}><TrashIcon /></Ic>
            Delete
          </button>
        </div>
      </div>

      <div style={{
        borderRadius: 12,
        border: '1px solid rgba(94,234,212,0.16)',
        background: 'rgba(94,234,212,0.06)',
        padding: '12px 14px',
      }}>
        <div style={{
          color: '#5eead4',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          Answer
        </div>
        <div style={{
          color: TEXT1,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          lineHeight: 1.75,
          whiteSpace: 'pre-wrap',
        }}>
          {item.answer || 'No answer available.'}
        </div>
      </div>

      <div style={{
        borderRadius: 12,
        border: '1px solid rgba(96,165,250,0.16)',
        background: 'rgba(96,165,250,0.05)',
        padding: '12px 14px',
      }}>
        <div style={{
          color: '#60a5fa',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}>
          Explanation
        </div>
        <div style={{
          color: TEXT2,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          lineHeight: 1.75,
          whiteSpace: 'pre-wrap',
        }}>
          {item.explanation || 'No explanation available.'}
        </div>
      </div>
    </div>
  )
}

function TableRow({
  item,
  index,
  expanded,
  selectionMode,
  checked,
  onToggleChecked,
  onToggleExpanded,
  onEdit,
  onDelete,
}) {
  const gridTemplateColumns = selectionMode
    ? '38px 56px minmax(0,1fr) 148px'
    : '56px minmax(0,1fr) 148px'

  const rowStyle = {
    display: 'grid',
    gridTemplateColumns,
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    cursor: 'pointer',
    borderLeft: `2px solid ${expanded ? '#5eead4' : 'transparent'}`,
    background: expanded ? 'rgba(94,234,212,0.06)' : 'transparent',
    transition: 'background 0.16s ease, border-color 0.16s ease',
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggleExpanded()
    }
  }

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={onToggleExpanded}
        style={rowStyle}
        onMouseEnter={(event) => {
          if (!expanded) {
            event.currentTarget.style.background = 'rgba(255,255,255,0.03)'
          }
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = expanded ? 'rgba(94,234,212,0.06)' : 'transparent'
        }}
      >
        {selectionMode && (
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Checkbox checked={checked} onChange={onToggleChecked} />
          </div>
        )}

        <div style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: expanded ? 'rgba(94,234,212,0.16)' : 'rgba(255,255,255,0.05)',
          color: expanded ? '#5eead4' : TEXT3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          fontWeight: 800,
          flexShrink: 0,
        }}>
          {index}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{
            color: TEXT1,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}>
            {item.questionText}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggleExpanded()
            }}
            aria-label={expanded ? 'Collapse answer' : 'Reveal answer'}
            title={expanded ? 'Collapse answer' : 'Reveal answer'}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: `1px solid ${expanded ? 'rgba(94,234,212,0.26)' : 'rgba(255,255,255,0.08)'}`,
              background: expanded ? 'rgba(94,234,212,0.12)' : 'rgba(255,255,255,0.03)',
              color: expanded ? '#a7f3d0' : TEXT2,
              cursor: 'pointer',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.16s ease' }}>
              <Ic size={12}><ChevronDownIcon /></Ic>
            </span>
          </button>
        </div>
      </div>

      <div style={{
        maxHeight: expanded ? 380 : 0,
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.24s ease, opacity 0.18s ease',
      }}>
        {expanded && <QuestionExpansion item={item} onEdit={onEdit} onDelete={onDelete} />}
      </div>
    </div>
  )
}

function MobileRow({
  item,
  index,
  expanded,
  selectionMode,
  checked,
  onToggleChecked,
  onToggleExpanded,
  onEdit,
  onDelete,
}) {
  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${expanded ? 'rgba(94,234,212,0.18)' : 'rgba(255,255,255,0.06)'}`,
      background: expanded ? 'rgba(94,234,212,0.05)' : 'rgba(255,255,255,0.025)',
      overflow: 'hidden',
      transition: 'border-color 0.16s ease, background 0.16s ease',
    }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpanded}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onToggleExpanded()
          }
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '14px',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {selectionMode && (
              <div onClick={(event) => event.stopPropagation()}>
                <Checkbox checked={checked} onChange={onToggleChecked} />
              </div>
            )}
            <div style={{
              minWidth: 28,
              height: 28,
              borderRadius: 8,
              background: expanded ? 'rgba(94,234,212,0.16)' : 'rgba(255,255,255,0.05)',
              color: expanded ? '#5eead4' : TEXT3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              fontWeight: 800,
            }}>
              {index}
            </div>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggleExpanded()
            }}
            aria-label={expanded ? 'Collapse answer' : 'Reveal answer'}
            title={expanded ? 'Collapse answer' : 'Reveal answer'}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: `1px solid ${expanded ? 'rgba(94,234,212,0.26)' : 'rgba(255,255,255,0.08)'}`,
              background: expanded ? 'rgba(94,234,212,0.12)' : 'rgba(255,255,255,0.03)',
              color: expanded ? '#a7f3d0' : TEXT2,
              cursor: 'pointer',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.16s ease' }}>
              <Ic size={12}><ChevronDownIcon /></Ic>
            </span>
          </button>
        </div>

        <div style={{
          color: TEXT1,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.55,
        }}>
          {item.questionText}
        </div>
      </div>

      <div style={{
        maxHeight: expanded ? 440 : 0,
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.24s ease, opacity 0.18s ease',
      }}>
        {expanded && <QuestionExpansion item={item} onEdit={onEdit} onDelete={onDelete} />}
      </div>
    </div>
  )
}

export default function QuestionBankPage({ subjects, onUpdateSubject }) {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [checked, setChecked] = useState({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 860 : false
  )

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleResize = () => setIsMobile(window.innerWidth < 860)
    window.addEventListener('resize', handleResize)

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const allItems = useMemo(
    () => subjects
      .flatMap((subject) =>
        normalizeQuestionBank(subject.questionBank, { subjectId: subject.id }).map((item) => ({
          ...item,
          questionText: item.question,
          subject: subject.name || 'Untitled Subject',
          source: item.sourceType === 'generated' ? 'generated' : 'manual',
          sortTime: toTimestamp(item.updatedAt || item.createdAt),
        }))
      )
      .sort((left, right) => right.sortTime - left.sortTime),
    [subjects]
  )

  const filteredItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()

    return allItems.filter((item) => {
      if (subjectFilter !== 'all' && item.subjectId !== subjectFilter) return false
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false
      if (!query) return true

      return [
        item.questionText,
        item.subject,
        item.answer,
        item.explanation,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    })
  }, [allItems, deferredSearch, sourceFilter, subjectFilter])

  const summary = useMemo(() => ({
    total: allItems.length,
    manual: allItems.filter((item) => item.source === 'manual').length,
    generated: allItems.filter((item) => item.source === 'generated').length,
    subjects: new Set(allItems.map((item) => item.subjectId).filter(Boolean)).size,
  }), [allItems])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const pageStart = (page - 1) * PAGE_SIZE
  const paginatedItems = useMemo(
    () => filteredItems.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredItems, pageStart]
  )
  const pageNumbers = buildPages(totalPages, page)

  const selectedItems = useMemo(
    () => allItems.filter((item) => checked[item.id]),
    [allItems, checked]
  )
  const checkedCount = selectedItems.length
  const allCheckedOnPage = paginatedItems.length > 0 && paginatedItems.every((item) => checked[item.id])
  const someCheckedOnPage = paginatedItems.some((item) => checked[item.id])

  useEffect(() => {
    setPage(1)
  }, [deferredSearch, sourceFilter, subjectFilter])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  useEffect(() => {
    if (expandedId && !filteredItems.some((item) => item.id === expandedId)) {
      setExpandedId(null)
    }
  }, [expandedId, filteredItems])

  useEffect(() => {
    const validIds = new Set(allItems.map((item) => item.id))
    setChecked((previous) => {
      const next = Object.fromEntries(
        Object.entries(previous).filter(([id, value]) => value && validIds.has(id))
      )

      if (Object.keys(next).length === Object.keys(previous).length) {
        return previous
      }

      return next
    })
  }, [allItems])

  const showingFrom = filteredItems.length === 0 ? 0 : pageStart + 1
  const showingTo = Math.min(pageStart + PAGE_SIZE, filteredItems.length)
  const hasFilters = Boolean(search.trim()) || sourceFilter !== 'all' || subjectFilter !== 'all'

  const openAdd = () => {
    setEditingQuestion(null)
    setForm({
      ...EMPTY_FORM,
      subjectId: subjects[0]?.id || '',
    })
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditingQuestion(item)
    setForm({
      subjectId: item.subjectId || '',
      question: item.questionText || '',
      answer: item.answer || '',
      explanation: item.explanation || '',
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingQuestion(null)
  }

  const saveSubjectQuestionBank = async (subjectId, nextQuestionBank) => {
    const subject = subjects.find((item) => item.id === subjectId)
    if (!subject || !onUpdateSubject) return

    await onUpdateSubject({
      ...subject,
      questionBank: normalizeQuestionBank(nextQuestionBank, { subjectId }),
    })
  }

  const handleSubmit = async () => {
    const question = form.question.trim()
    const answer = form.answer.trim()
    const explanation = form.explanation.trim()

    if (!form.subjectId || !question) {
      window.alert('Subject and question are required.')
      return
    }

    const targetSubject = subjects.find((item) => item.id === form.subjectId)
    if (!targetSubject) return

    const nextItem = editingQuestion
      ? normalizeQuestionBankItem({
          ...editingQuestion,
          subjectId: form.subjectId,
          question,
          answer,
          explanation,
          updatedAt: new Date().toISOString(),
        }, { subjectId: form.subjectId })
      : createManualQuestionBankItem({
          subjectId: form.subjectId,
          question,
          answer,
          explanation,
        })

    if (editingQuestion && editingQuestion.subjectId !== form.subjectId) {
      const previousSubject = subjects.find((item) => item.id === editingQuestion.subjectId)

      if (previousSubject) {
        await saveSubjectQuestionBank(
          previousSubject.id,
          normalizeQuestionBank(previousSubject.questionBank, { subjectId: previousSubject.id }).filter(
            (item) => item.id !== editingQuestion.id
          )
        )
      }

      await saveSubjectQuestionBank(
        targetSubject.id,
        mergeQuestionBankItems(targetSubject.questionBank, [nextItem], { subjectId: targetSubject.id })
      )
    } else {
      const nextQuestionBank = editingQuestion
        ? normalizeQuestionBank(targetSubject.questionBank, { subjectId: targetSubject.id }).map((item) =>
            item.id === editingQuestion.id ? nextItem : item
          )
        : mergeQuestionBankItems(targetSubject.questionBank, [nextItem], { subjectId: targetSubject.id })

      await saveSubjectQuestionBank(targetSubject.id, nextQuestionBank)
    }

    closeModal()
  }

  const handleDeleteQuestion = async (item) => {
    if (!window.confirm('Delete this question?')) return

    const subject = subjects.find((subjectItem) => subjectItem.id === item.subjectId)
    if (!subject) return

    await saveSubjectQuestionBank(
      subject.id,
      normalizeQuestionBank(subject.questionBank, { subjectId: subject.id }).filter(
        (entry) => entry.id !== item.id
      )
    )

    setExpandedId((previous) => (previous === item.id ? null : previous))
    setChecked((previous) => {
      const next = { ...previous }
      delete next[item.id]
      return next
    })
  }

  const handleDeleteSelected = async () => {
    const ids = selectedItems.map((item) => item.id)
    if (ids.length === 0) return

    if (!window.confirm(`Delete ${ids.length} selected question(s)?`)) return

    const questionsBySubject = {}
    selectedItems.forEach((item) => {
      if (!questionsBySubject[item.subjectId]) {
        questionsBySubject[item.subjectId] = []
      }
      questionsBySubject[item.subjectId].push(item.id)
    })

    for (const [subjectId, questionIds] of Object.entries(questionsBySubject)) {
      const subject = subjects.find((item) => item.id === subjectId)
      if (!subject) continue

      await saveSubjectQuestionBank(
        subjectId,
        normalizeQuestionBank(subject.questionBank, { subjectId }).filter(
          (item) => !questionIds.includes(item.id)
        )
      )
    }

    setChecked({})
    setSelectionMode(false)
    if (expandedId && ids.includes(expandedId)) {
      setExpandedId(null)
    }
  }

  const handleExportSelected = () => {
    if (selectedItems.length === 0) return
    exportQuestionsAsText(selectedItems)
  }

  const toggleSelectionMode = () => {
    setSelectionMode((previous) => {
      const nextMode = !previous
      if (!nextMode) {
        setChecked({})
      }
      return nextMode
    })
  }

  const toggleChecked = (id) => {
    setChecked((previous) => ({
      ...previous,
      [id]: !previous[id],
    }))
  }

  const togglePageSelection = () => {
    setChecked((previous) => {
      const next = { ...previous }

      if (allCheckedOnPage) {
        paginatedItems.forEach((item) => {
          delete next[item.id]
        })
        return next
      }

      paginatedItems.forEach((item) => {
        next[item.id] = true
      })
      return next
    })
  }

  const clearFilters = () => {
    setSearch('')
    setSubjectFilter('all')
    setSourceFilter('all')
    setPage(1)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            border: '1px solid rgba(94,234,212,0.18)',
            background: 'rgba(94,234,212,0.08)',
            color: '#5eead4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Ic size={17}><QuestionBankIcon /></Ic>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              color: TEXT1,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: '-0.04em',
            }}>
              Question Bank
            </h1>
            <p style={{
              margin: '4px 0 0',
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
            }}>
              Browse reusable questions, reveal answers inline, and manage manual plus generated entries.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={toggleSelectionMode}
            style={{
              borderRadius: 11,
              border: `1px solid ${selectionMode ? 'rgba(94,234,212,0.26)' : 'rgba(255,255,255,0.08)'}`,
              background: selectionMode ? 'rgba(94,234,212,0.12)' : 'rgba(255,255,255,0.03)',
              color: selectionMode ? '#a7f3d0' : TEXT2,
              cursor: 'pointer',
              padding: '10px 14px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {selectionMode ? 'Cancel Select' : 'Select'}
          </button>

          <button
            type="button"
            onClick={openAdd}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
              color: '#f8fdff',
              cursor: 'pointer',
              padding: '11px 16px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              fontWeight: 800,
              boxShadow: '0 10px 24px rgba(14,165,233,0.22)',
            }}
          >
            <Ic size={12}><PlusIcon /></Ic>
            Add Question
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard label="Total Questions" value={fmt(summary.total)} tint="#a855f7" />
        <StatCard label="Manual Entries" value={fmt(summary.manual)} tint="#38bdf8" />
        <StatCard label="Generated" value={fmt(summary.generated)} tint="#34d399" />
        <StatCard label="Subjects Covered" value={fmt(summary.subjects)} tint="#fb923c" />
      </div>

      <div style={{
        borderRadius: 18,
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(16,13,30,0.82)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(0,1.2fr) minmax(180px,220px)',
            gap: 12,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(255,255,255,0.03)',
              padding: '11px 12px',
            }}>
              <Ic size={13}><SearchIcon /></Ic>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: TEXT1,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: TEXT3,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    padding: 0,
                  }}
                >
                  <Ic size={11}><XIcon /></Ic>
                </button>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <select
                value={subjectFilter}
                onChange={(event) => setSubjectFilter(event.target.value)}
                style={getSelectStyle()}
              >
                <option value="all" style={{ backgroundColor: '#171327', color: '#f4f0ff' }}>
                  All Subjects
                </option>
                {subjects.map((subject) => (
                  <option
                    key={subject.id}
                    value={subject.id}
                    style={{ backgroundColor: '#171327', color: '#f4f0ff' }}
                  >
                    {subject.name}
                  </option>
                ))}
              </select>
              <span style={{
                position: 'absolute',
                top: '50%',
                right: 12,
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#c4b5fd',
              }}>
                <Ic size={12}><ChevronDownIcon /></Ic>
              </span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <div style={{
              display: 'inline-flex',
              gap: 8,
              padding: 4,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.025)',
              flexWrap: 'wrap',
            }}>
              {SOURCE_TABS.map((tab) => {
                const active = sourceFilter === tab.id

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSourceFilter(tab.id)}
                    style={{
                      borderRadius: 999,
                      border: 'none',
                      background: active ? 'linear-gradient(135deg, rgba(94,234,212,0.24), rgba(56,189,248,0.16))' : 'transparent',
                      color: active ? '#d1fae5' : TEXT3,
                      cursor: 'pointer',
                      padding: '8px 14px',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              justifyContent: isMobile ? 'flex-start' : 'flex-end',
            }}>
              <span style={{
                color: TEXT3,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
              }}>
                {filteredItems.length === 0 ? 'No results' : `Showing ${showingFrom}-${showingTo} of ${fmt(filteredItems.length)}`}
              </span>

              {selectionMode && (
                <>
                  <span style={{
                    color: checkedCount > 0 ? '#d1fae5' : TEXT3,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    {checkedCount} selected
                  </span>

                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={checkedCount === 0}
                    style={{
                      borderRadius: 10,
                      border: '1px solid rgba(248,113,113,0.18)',
                      background: checkedCount === 0 ? 'rgba(248,113,113,0.04)' : 'rgba(248,113,113,0.08)',
                      color: checkedCount === 0 ? 'rgba(252,165,165,0.45)' : '#fca5a5',
                      cursor: checkedCount === 0 ? 'not-allowed' : 'pointer',
                      padding: '8px 12px',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Delete Selected
                  </button>

                  <button
                    type="button"
                    onClick={handleExportSelected}
                    disabled={checkedCount === 0}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: checkedCount === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                      color: checkedCount === 0 ? 'rgba(226,232,240,0.38)' : TEXT2,
                      cursor: checkedCount === 0 ? 'not-allowed' : 'pointer',
                      padding: '8px 12px',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    <Ic size={11}><DownloadIcon /></Ic>
                    Export Text
                  </button>
                </>
              )}

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: TEXT3,
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: 0,
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div style={{
            padding: '54px 20px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>Q</div>
            <p style={{
              margin: 0,
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
            }}>
              {allItems.length === 0
                ? 'No questions in the bank yet.'
                : 'Nothing matches the current filters.'}
            </p>
          </div>
        ) : (
          <>
            {!isMobile && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: selectionMode
                  ? '38px 56px minmax(0,1fr) 148px'
                  : '56px minmax(0,1fr) 148px',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: 'rgba(255,255,255,0.02)',
              }}>
                {selectionMode && (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Checkbox
                      checked={allCheckedOnPage}
                      indeterminate={someCheckedOnPage && !allCheckedOnPage}
                      onChange={togglePageSelection}
                    />
                  </div>
                )}
                <div style={{
                  color: TEXT3,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}>
                  No.
                </div>
                <div style={{
                  color: TEXT3,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}>
                  Question
                </div>
                <div style={{
                  color: TEXT3,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  textAlign: 'right',
                }}>
                  Action
                </div>
              </div>
            )}

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? 12 : 0,
              padding: isMobile ? 12 : 0,
            }}>
              {paginatedItems.map((item, index) => {
                const rowNumber = pageStart + index + 1
                const expanded = expandedId === item.id

                if (isMobile) {
                  return (
                    <MobileRow
                      key={item.id}
                      item={item}
                      index={rowNumber}
                      expanded={expanded}
                      selectionMode={selectionMode}
                      checked={Boolean(checked[item.id])}
                      onToggleChecked={() => toggleChecked(item.id)}
                      onToggleExpanded={() => setExpandedId((previous) => previous === item.id ? null : item.id)}
                      onEdit={openEdit}
                      onDelete={handleDeleteQuestion}
                    />
                  )
                }

                return (
                  <TableRow
                    key={item.id}
                    item={item}
                    index={rowNumber}
                    expanded={expanded}
                    selectionMode={selectionMode}
                    checked={Boolean(checked[item.id])}
                    onToggleChecked={() => toggleChecked(item.id)}
                    onToggleExpanded={() => setExpandedId((previous) => previous === item.id ? null : item.id)}
                    onEdit={openEdit}
                    onDelete={handleDeleteQuestion}
                  />
                )
              })}
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div style={{
            padding: '14px 16px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <span style={{
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
            }}>
              Page {page} of {totalPages}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                disabled={page === 1}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  color: TEXT2,
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  opacity: page === 1 ? 0.38 : 1,
                }}
              >
                <Ic size={11}><BackIcon /></Ic>
              </button>

              {pageNumbers.map((entry, index) => (
                typeof entry === 'number' ? (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setPage(entry)}
                    style={{
                      minWidth: 30,
                      height: 30,
                      borderRadius: 8,
                      border: `1px solid ${page === entry ? 'rgba(94,234,212,0.25)' : 'rgba(255,255,255,0.08)'}`,
                      background: page === entry ? 'rgba(94,234,212,0.14)' : 'rgba(255,255,255,0.03)',
                      color: page === entry ? '#d1fae5' : TEXT2,
                      cursor: 'pointer',
                      padding: '0 10px',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {entry}
                  </button>
                ) : (
                  <span
                    key={`gap-${index}`}
                    style={{
                      color: TEXT3,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 12,
                      padding: '0 2px',
                    }}
                  >
                    ...
                  </span>
                )
              ))}

              <button
                type="button"
                onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                disabled={page === totalPages}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  color: TEXT2,
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  opacity: page === totalPages ? 0.38 : 1,
                  transform: 'rotate(180deg)',
                }}
              >
                <Ic size={11}><BackIcon /></Ic>
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={closeModal} title={editingQuestion ? 'Edit Question' : 'Add Question'} width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <FormLabel>Subject</FormLabel>
            <div style={{ position: 'relative' }}>
              <select
                value={form.subjectId}
                onChange={(event) => setForm((previous) => ({ ...previous, subjectId: event.target.value }))}
                style={getSelectStyle()}
              >
                <option value="" style={{ backgroundColor: '#171327', color: '#f4f0ff' }}>
                  Select subject
                </option>
                {subjects.map((subject) => (
                  <option
                    key={subject.id}
                    value={subject.id}
                    style={{ backgroundColor: '#171327', color: '#f4f0ff' }}
                  >
                    {subject.name}
                  </option>
                ))}
              </select>
              <span style={{
                position: 'absolute',
                top: '50%',
                right: 12,
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#c4b5fd',
              }}>
                <Ic size={12}><ChevronDownIcon /></Ic>
              </span>
            </div>
          </div>

          <div>
            <FormLabel>Question</FormLabel>
            <FieldInput
              as="textarea"
              value={form.question}
              onChange={(event) => setForm((previous) => ({ ...previous, question: event.target.value }))}
              placeholder="Write the question..."
            />
          </div>

          <div>
            <FormLabel>Answer (Optional)</FormLabel>
            <FieldInput
              as="textarea"
              value={form.answer}
              onChange={(event) => setForm((previous) => ({ ...previous, answer: event.target.value }))}
              placeholder="Write the answer..."
            />
          </div>

          <div>
            <FormLabel>Explanation (Optional)</FormLabel>
            <FieldInput
              as="textarea"
              value={form.explanation}
              onChange={(event) => setForm((previous) => ({ ...previous, explanation: event.target.value }))}
              placeholder="Explain why this answer is correct..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={closeModal}
              style={{
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                color: TEXT2,
                cursor: 'pointer',
                padding: '10px 16px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              style={{
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #7c5af6, #5a2fd4)',
                color: '#fff',
                cursor: 'pointer',
                padding: '10px 18px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                fontWeight: 800,
                boxShadow: '0 10px 24px rgba(124,90,246,0.24)',
              }}
            >
              {editingQuestion ? 'Save Changes' : 'Add to Bank'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
