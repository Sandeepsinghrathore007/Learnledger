import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'
import {
  BackIcon,
  ChevronDownIcon,
  EditIcon,
  EyeIcon,
  PlusIcon,
  QuestionBankIcon,
  SearchIcon,
  TrashIcon,
} from '@/components/ui/Icons'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import {
  createManualQuestionBankItem,
  mergeQuestionBankItems,
  normalizeQuestionBank,
  normalizeQuestionBankItem,
} from '@/utils/questionBank'

const PAGE_SIZE = 20
const EXPAND_ANIMATION_MS = 220

const SOURCE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'manual', label: 'Manual' },
  { id: 'generated', label: 'Generated' },
]

const EMPTY_FORM = {
  subjectId: '',
  question: '',
  answer: '',
  explanation: '',
}

function getInputStyle(overrides = {}) {
  return {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${BORDER}`,
    borderRadius: '12px',
    color: TEXT1,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    outline: 'none',
    ...overrides,
  }
}

function getTextareaStyle() {
  return {
    ...getInputStyle(),
    minHeight: '96px',
    resize: 'vertical',
  }
}

function toTimestamp(value) {
  const parsed = new Date(value || '')
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0)
}

function buildPageNumbers(totalPages, currentPage) {
  if (totalPages <= 1) return [1]
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = [1]
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)

  if (start > 2) pages.push('ellipsis-start')

  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }

  if (end < totalPages - 1) pages.push('ellipsis-end')

  pages.push(totalPages)
  return pages
}

function getSourceLabel(source) {
  return source === 'generated' ? 'Generated' : 'Manual'
}

function getSourceColor(source) {
  return source === 'generated' ? '#65ddd2' : '#baabff'
}

function getExpansionStyle(expanded) {
  return {
    display: 'grid',
    gridTemplateRows: expanded ? '1fr' : '0fr',
    opacity: expanded ? 1 : 0,
    transition: `grid-template-rows ${EXPAND_ANIMATION_MS}ms ease, opacity ${EXPAND_ANIMATION_MS}ms ease`,
  }
}

function Label({ children }) {
  return (
    <label
      style={{
        display: 'block',
        color: TEXT3,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '11px',
        fontWeight: '700',
        marginBottom: '7px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      {children}
    </label>
  )
}

function SummaryCard({ label, value, accent, background }) {
  return (
    <div
      style={{
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.06)',
        background,
        padding: '16px',
      }}
    >
      <div
        style={{
          color: accent,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '29px',
          fontWeight: '900',
          letterSpacing: '-0.05em',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: '12px',
          color: TEXT3,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '10px',
          fontWeight: '800',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  )
}

function FilterTab({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: '999px',
        border: `1px solid ${active ? 'rgba(120,88,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
        background: active ? 'rgba(84,62,173,0.44)' : 'rgba(255,255,255,0.03)',
        color: active ? '#efe9ff' : TEXT2,
        padding: '9px 13px',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '11px',
        fontWeight: '700',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function TableActionButton({ expanded, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,0.08)',
        background: expanded ? 'rgba(101,221,210,0.14)' : 'rgba(255,255,255,0.04)',
        color: expanded ? '#aef3ec' : TEXT2,
        padding: '8px 12px',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '11px',
        fontWeight: '700',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        whiteSpace: 'nowrap',
      }}
      aria-expanded={expanded}
    >
      <span style={{ width: '13px', height: '13px', display: 'inline-flex' }}>
        <EyeIcon />
      </span>
      {expanded ? 'Hide Answer' : 'Reveal Answer'}
    </button>
  )
}

function IconButton({ icon: Icon, onClick, label, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '10px',
        border: `1px solid ${danger ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.06)'}`,
        background: danger ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
        color: danger ? '#fda4af' : TEXT2,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span style={{ width: '14px', height: '14px', display: 'inline-flex' }}>
        <Icon />
      </span>
    </button>
  )
}

function EmptyState({ mode, onAdd, onClearFilters }) {
  const title =
    mode === 'setup'
      ? 'Create a subject first'
      : mode === 'filtered'
        ? 'No questions match these filters'
        : 'No question bank entries yet'
  const description =
    mode === 'setup'
      ? 'Question Bank organizes everything subject-wise, so the first step is creating at least one subject.'
      : mode === 'filtered'
        ? 'Try changing the subject or source filter, or clear the search term to see more rows.'
        : 'Add a manual question or generate a test and the bank will start filling automatically.'

  return (
    <div
      style={{
        borderRadius: '16px',
        border: '1px dashed rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.02)',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '54px',
          height: '54px',
          borderRadius: '16px',
          margin: '0 auto 14px',
          background: 'rgba(96,72,170,0.22)',
          border: '1px solid rgba(120,88,255,0.24)',
          color: '#ddd3ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ width: '22px', height: '22px', display: 'inline-flex' }}>
          <QuestionBankIcon />
        </span>
      </div>

      <h3
        style={{
          margin: '0 0 8px',
          color: TEXT1,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '20px',
          fontWeight: '800',
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: '0 auto',
          maxWidth: '560px',
          color: TEXT2,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          lineHeight: 1.7,
        }}
      >
        {description}
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
        {mode !== 'setup' && (
          <button
            type="button"
            onClick={onAdd}
            style={{
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #58c8ff, #2f8eff)',
              color: '#fff',
              padding: '11px 16px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: '800',
            }}
          >
            Add Question
          </button>
        )}
        {mode === 'filtered' && (
          <button
            type="button"
            onClick={onClearFilters}
            style={{
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.03)',
              color: TEXT2,
              padding: '11px 16px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              fontWeight: '700',
            }}
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  )
}

export default function QuestionBankPage({ subjects, onUpdateSubject }) {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [selectedSubjectId, setSelectedSubjectId] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedQuestionId, setExpandedQuestionId] = useState(null)
  const [closingQuestionIds, setClosingQuestionIds] = useState({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    subjectId: subjects[0]?.id || '',
  }))
  const rowRefs = useRef([])
  const collapseTimersRef = useRef({})

  const questionItems = useMemo(() => {
    return subjects
      .flatMap((subject) =>
        normalizeQuestionBank(subject.questionBank, { subjectId: subject.id }).map((item) => ({
          ...item,
          questionText: item.question,
          subject: subject.name,
          subjectIcon: subject.icon,
          subjectColor: subject.color,
          source: item.sourceType,
          sortTime: toTimestamp(item.updatedAt || item.createdAt),
        }))
      )
      .sort((a, b) => b.sortTime - a.sortTime)
  }, [subjects])

  const filteredQuestions = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase()

    return questionItems.filter((item) => {
      if (selectedSubjectId !== 'all' && item.subjectId !== selectedSubjectId) return false
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false

      if (!normalizedSearch) return true

      return [
        item.questionText,
        item.subject,
        item.explanation,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    })
  }, [deferredSearch, questionItems, selectedSubjectId, sourceFilter])

  const summary = useMemo(() => {
    const manualCount = questionItems.filter((item) => item.source === 'manual').length
    const generatedCount = questionItems.filter((item) => item.source === 'generated').length
    const coveredSubjects = new Set(questionItems.map((item) => item.subjectId).filter(Boolean)).size

    return {
      total: questionItems.length,
      manual: manualCount,
      generated: generatedCount,
      subjects: coveredSubjects,
    }
  }, [questionItems])

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE))
  const pageStart = (currentPage - 1) * PAGE_SIZE

  const paginatedQuestions = useMemo(
    () => filteredQuestions.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredQuestions, pageStart]
  )

  const paginationNumbers = buildPageNumbers(totalPages, currentPage)
  const showingFrom = filteredQuestions.length === 0 ? 0 : pageStart + 1
  const showingTo = Math.min(pageStart + PAGE_SIZE, filteredQuestions.length)
  const hasFilters = deferredSearch.trim() || selectedSubjectId !== 'all' || sourceFilter !== 'all'

  const clearCollapseTimer = (questionId) => {
    if (!collapseTimersRef.current[questionId]) return

    window.clearTimeout(collapseTimersRef.current[questionId])
    delete collapseTimersRef.current[questionId]
  }

  const removeClosingState = (questionId) => {
    setClosingQuestionIds((previous) => {
      if (!previous[questionId]) return previous
      const nextState = { ...previous }
      delete nextState[questionId]
      return nextState
    })
  }

  const stopCollapseAnimation = (questionId) => {
    clearCollapseTimer(questionId)
    removeClosingState(questionId)
  }

  const startCollapseAnimation = (questionId) => {
    if (!questionId) return

    clearCollapseTimer(questionId)
    setClosingQuestionIds((previous) => ({ ...previous, [questionId]: true }))

    collapseTimersRef.current[questionId] = window.setTimeout(() => {
      removeClosingState(questionId)
      clearCollapseTimer(questionId)
    }, EXPAND_ANIMATION_MS)
  }

  useEffect(() => {
    return () => {
      Object.values(collapseTimersRef.current).forEach((timerId) => window.clearTimeout(timerId))
      collapseTimersRef.current = {}
    }
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [deferredSearch, selectedSubjectId, sourceFilter])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  useEffect(() => {
    if (!expandedQuestionId) return
    if (paginatedQuestions.some((item) => item.id === expandedQuestionId)) return

    setExpandedQuestionId(null)
  }, [expandedQuestionId, paginatedQuestions])

  useEffect(() => {
    Object.values(collapseTimersRef.current).forEach((timerId) => window.clearTimeout(timerId))
    collapseTimersRef.current = {}
    setClosingQuestionIds({})
    setExpandedQuestionId(null)
  }, [currentPage, deferredSearch, selectedSubjectId, sourceFilter])

  useEffect(() => {
    rowRefs.current = rowRefs.current.slice(0, paginatedQuestions.length)
  }, [paginatedQuestions.length])

  const resetForm = () => {
    setForm({
      ...EMPTY_FORM,
      subjectId: editingQuestion?.subjectId || (selectedSubjectId !== 'all' ? selectedSubjectId : subjects[0]?.id || ''),
    })
    setEditingQuestion(null)
  }

  const openAddModal = () => {
    setEditingQuestion(null)
    setForm({
      ...EMPTY_FORM,
      subjectId: selectedSubjectId !== 'all' ? selectedSubjectId : subjects[0]?.id || '',
    })
    setIsModalOpen(true)
  }

  const openEditModal = (question) => {
    setEditingQuestion(question)
    setForm({
      subjectId: question.subjectId,
      question: question.questionText,
      answer: question.answer,
      explanation: question.explanation,
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
  }

  const clearFilters = () => {
    setSearch('')
    setSelectedSubjectId('all')
    setSourceFilter('all')
    setCurrentPage(1)
  }

  const saveSubjectQuestionBank = async (subjectId, nextQuestionBank) => {
    const subject = subjects.find((item) => item.id === subjectId)
    if (!subject) return

    await onUpdateSubject({
      ...subject,
      questionBank: normalizeQuestionBank(nextQuestionBank, { subjectId }),
    })
  }

  const handleSubmit = async () => {
    const question = form.question.trim()
    const answer = form.answer.trim()
    const explanation = form.explanation.trim()

    if (!form.subjectId || !question || !answer || !explanation) {
      window.alert('Subject, question, answer, and explanation are all required.')
      return
    }

    const targetSubject = subjects.find((item) => item.id === form.subjectId)
    if (!targetSubject) {
      window.alert('Please select a valid subject.')
      return
    }

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
      const nextBank = editingQuestion
        ? normalizeQuestionBank(targetSubject.questionBank, { subjectId: targetSubject.id }).map((item) =>
            item.id === editingQuestion.id ? nextItem : item
          )
        : mergeQuestionBankItems(targetSubject.questionBank, [nextItem], { subjectId: targetSubject.id })

      await saveSubjectQuestionBank(targetSubject.id, nextBank)
    }

    closeModal()
  }

  const handleDeleteQuestion = async (question) => {
    const shouldDelete = window.confirm('Delete this question from the bank?')
    if (!shouldDelete) return

    const subject = subjects.find((item) => item.id === question.subjectId)
    if (!subject) return

    await saveSubjectQuestionBank(
      subject.id,
      normalizeQuestionBank(subject.questionBank, { subjectId: subject.id }).filter((item) => item.id !== question.id)
    )
  }

  const handleToggleExpansion = (questionId) => {
    if (expandedQuestionId === questionId) {
      setExpandedQuestionId(null)
      startCollapseAnimation(questionId)
      return
    }

    if (expandedQuestionId) {
      startCollapseAnimation(expandedQuestionId)
    }

    stopCollapseAnimation(questionId)
    setExpandedQuestionId(questionId)
  }

  const handleRowKeyDown = (event, index, questionId) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      rowRefs.current[Math.min(index + 1, rowRefs.current.length - 1)]?.focus()
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      rowRefs.current[Math.max(index - 1, 0)]?.focus()
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleToggleExpansion(questionId)
    }
  }

  const emptyMode =
    subjects.length === 0
      ? 'setup'
      : questionItems.length === 0
        ? 'empty'
        : filteredQuestions.length === 0
          ? 'filtered'
          : null

  return (
    <div className="animate-fade-in">
      <section
        style={{
          borderRadius: '22px',
          border: '1px solid rgba(255,255,255,0.05)',
          background: 'linear-gradient(180deg, rgba(20,11,35,0.98), rgba(15,9,28,1))',
          boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
          overflow: 'hidden',
        }}
      >
        <div className="flex flex-col gap-5 p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div style={{ minWidth: 0 }}>
              <div className="flex items-center gap-3">
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '14px',
                    background: 'rgba(95,73,171,0.24)',
                    border: '1px solid rgba(120,88,255,0.22)',
                    color: '#ddd2ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ width: '18px', height: '18px', display: 'inline-flex' }}>
                    <QuestionBankIcon />
                  </span>
                </div>

                <div>
                  <h1
                    style={{
                      margin: 0,
                      color: TEXT1,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '28px',
                      fontWeight: '900',
                      letterSpacing: '-0.05em',
                    }}
                  >
                    Question Bank
                  </h1>
                </div>
              </div>

              <p
                style={{
                  margin: '12px 0 0',
                  maxWidth: '760px',
                  color: TEXT2,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '13px',
                  lineHeight: 1.65,
                }}
              >
                Browse large question sets quickly, filter by subject or source, and reveal answers only when you need
                them.
              </p>
            </div>

            <button
              type="button"
              onClick={openAddModal}
              style={{
                alignSelf: 'flex-start',
                border: 'none',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #58c8ff, #2f8eff)',
                color: '#fff',
                padding: '10px 16px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '800',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 16px 28px rgba(42,142,255,0.24)',
              }}
            >
              <span
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.18)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ width: '11px', height: '11px', display: 'inline-flex' }}>
                  <PlusIcon />
                </span>
              </span>
              Add Question
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <SummaryCard
              label="Total Questions"
              value={formatNumber(summary.total)}
              accent="#d28cff"
              background="linear-gradient(135deg, rgba(69,34,120,0.62), rgba(42,22,78,0.95))"
            />
            <SummaryCard
              label="Manual Entries"
              value={formatNumber(summary.manual)}
              accent="#65c6ff"
              background="linear-gradient(135deg, rgba(27,54,109,0.64), rgba(22,33,73,0.95))"
            />
            <SummaryCard
              label="Generated"
              value={formatNumber(summary.generated)}
              accent="#61e1d2"
              background="linear-gradient(135deg, rgba(19,66,82,0.68), rgba(18,36,57,0.95))"
            />
            <SummaryCard
              label="Subjects"
              value={formatNumber(summary.subjects)}
              accent="#efb65d"
              background="linear-gradient(135deg, rgba(70,39,35,0.7), rgba(52,28,30,0.95))"
            />
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex flex-col gap-4 p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.03)',
                  padding: '11px 14px',
                }}
              >
                <span style={{ width: '15px', height: '15px', display: 'inline-flex', color: TEXT3 }}>
                  <SearchIcon />
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by question, subject, or explanation..."
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: TEXT1,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '13px',
                  }}
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row xl:items-center">
                <div style={{ position: 'relative', minWidth: '180px' }}>
                  <select
                    value={selectedSubjectId}
                    onChange={(event) => setSelectedSubjectId(event.target.value)}
                    style={getInputStyle({
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      paddingRight: '36px',
                      background: 'rgba(255,255,255,0.03)',
                    })}
                  >
                    <option value="all">All Subjects</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                  <span
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: '12px',
                      width: '14px',
                      height: '14px',
                      color: TEXT3,
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                    }}
                  >
                    <ChevronDownIcon />
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {SOURCE_FILTERS.map((filter) => (
                    <FilterTab
                      key={filter.id}
                      active={sourceFilter === filter.id}
                      onClick={() => setSourceFilter(filter.id)}
                    >
                      {filter.label}
                    </FilterTab>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div
                style={{
                  color: TEXT3,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '12px',
                }}
              >
                {filteredQuestions.length === 0
                  ? 'No questions found'
                  : `Showing ${showingFrom}-${showingTo} of ${formatNumber(filteredQuestions.length)}`}
              </div>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    alignSelf: 'flex-start',
                    border: 'none',
                    background: 'transparent',
                    color: '#c6b8ff',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '12px',
                    fontWeight: '700',
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            {emptyMode ? (
              <EmptyState mode={emptyMode} onAdd={openAddModal} onClearFilters={clearFilters} />
            ) : (
              <>
                <div
                  className="hidden lg:block"
                  style={{
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.04)',
                    background: 'rgba(255,255,255,0.015)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '56px minmax(0, 3.2fr) minmax(0, 1.2fr) minmax(0, 1fr) 168px',
                      gap: '16px',
                      padding: '14px 18px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      color: TEXT3,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '10px',
                      fontWeight: '800',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <div>No.</div>
                    <div>Question</div>
                    <div>Subject</div>
                    <div>Source</div>
                    <div>Action</div>
                  </div>

                  {paginatedQuestions.map((item, index) => {
                    const questionNumber = pageStart + index + 1
                    const isExpanded = expandedQuestionId === item.id
                    const isClosing = Boolean(closingQuestionIds[item.id])
                    const shouldRenderExpansion = isExpanded || isClosing

                    return (
                      <div
                        key={item.id}
                        className="transition-colors duration-200 hover:bg-white/[0.03] focus-within:bg-white/[0.03]"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      >
                        <div
                          ref={(node) => {
                            rowRefs.current[index] = node
                          }}
                          tabIndex={0}
                          onKeyDown={(event) => handleRowKeyDown(event, index, item.id)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '56px minmax(0, 3.2fr) minmax(0, 1.2fr) minmax(0, 1fr) 168px',
                            gap: '16px',
                            alignItems: 'center',
                            padding: '14px 18px',
                            outline: 'none',
                          }}
                        >
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '999px',
                              background: 'rgba(91,63,186,0.35)',
                              color: '#d9cdff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: '11px',
                              fontWeight: '800',
                            }}
                          >
                            {questionNumber}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              style={{
                                width: '100%',
                                border: 'none',
                                background: 'transparent',
                                padding: 0,
                                textAlign: 'left',
                                color: TEXT1,
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: '13px',
                                fontWeight: '700',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={item.questionText}
                            >
                              {item.questionText}
                            </button>
                          </div>

                          <div
                            style={{
                              color: TEXT2,
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: '12px',
                              fontWeight: '600',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={item.subject}
                          >
                            {item.subject}
                          </div>

                          <div
                            style={{
                              color: getSourceColor(item.source),
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: '12px',
                              fontWeight: '700',
                            }}
                          >
                            {getSourceLabel(item.source)}
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <TableActionButton
                              expanded={isExpanded}
                              onClick={() => handleToggleExpansion(item.id)}
                            />

                            <div className="flex items-center gap-2">
                              <IconButton icon={EditIcon} onClick={() => openEditModal(item)} label="Edit question" />
                              <IconButton
                                icon={TrashIcon}
                                onClick={() => handleDeleteQuestion(item)}
                                label="Delete question"
                                danger
                              />
                            </div>
                          </div>
                        </div>

                        {shouldRenderExpansion && (
                          <div style={getExpansionStyle(isExpanded)}>
                            <div style={{ overflow: 'hidden' }}>
                              <div
                                style={{
                                  margin: '0 18px 16px 74px',
                                  borderRadius: '14px',
                                  border: '1px solid rgba(101,221,210,0.18)',
                                  background: 'rgba(101,221,210,0.07)',
                                  padding: '16px',
                                  display: 'grid',
                                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                                  gap: '16px',
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      color: '#90eae1',
                                      fontFamily: "'DM Sans', sans-serif",
                                      fontSize: '10px',
                                      fontWeight: '800',
                                      letterSpacing: '0.12em',
                                      textTransform: 'uppercase',
                                      marginBottom: '8px',
                                    }}
                                  >
                                    Answer
                                  </div>
                                  <div
                                    style={{
                                      color: '#f3fffd',
                                      fontFamily: "'DM Sans', sans-serif",
                                      fontSize: '13px',
                                      lineHeight: 1.7,
                                      fontWeight: '700',
                                    }}
                                  >
                                    {item.answer || 'No answer stored yet.'}
                                  </div>
                                </div>

                                <div>
                                  <div
                                    style={{
                                      color: '#90eae1',
                                      fontFamily: "'DM Sans', sans-serif",
                                      fontSize: '10px',
                                      fontWeight: '800',
                                      letterSpacing: '0.12em',
                                      textTransform: 'uppercase',
                                      marginBottom: '8px',
                                    }}
                                  >
                                    Explanation
                                  </div>
                                  <div
                                    style={{
                                      color: TEXT2,
                                      fontFamily: "'DM Sans', sans-serif",
                                      fontSize: '13px',
                                      lineHeight: 1.7,
                                    }}
                                  >
                                    {item.explanation || 'No explanation stored yet.'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="flex flex-col gap-3 lg:hidden">
                  {paginatedQuestions.map((item, index) => {
                    const questionNumber = pageStart + index + 1
                    const isExpanded = expandedQuestionId === item.id
                    const isClosing = Boolean(closingQuestionIds[item.id])
                    const shouldRenderExpansion = isExpanded || isClosing

                    return (
                      <div
                        key={item.id}
                        className="transition-colors duration-200 hover:bg-white/[0.03]"
                        style={{
                          borderRadius: '16px',
                          border: '1px solid rgba(255,255,255,0.05)',
                          background: 'rgba(255,255,255,0.02)',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ padding: '14px' }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <div
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '999px',
                                  background: 'rgba(91,63,186,0.35)',
                                  color: '#d9cdff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontFamily: "'DM Sans', sans-serif",
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  flexShrink: 0,
                                }}
                              >
                                {questionNumber}
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(item)}
                                  style={{
                                    width: '100%',
                                    border: 'none',
                                    background: 'transparent',
                                    padding: 0,
                                    textAlign: 'left',
                                    color: TEXT1,
                                    fontFamily: "'DM Sans', sans-serif",
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    lineHeight: 1.55,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {item.questionText}
                                </button>

                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span
                                    style={{
                                      borderRadius: '999px',
                                      background: 'rgba(255,255,255,0.05)',
                                      color: TEXT2,
                                      padding: '6px 10px',
                                      fontFamily: "'DM Sans', sans-serif",
                                      fontSize: '11px',
                                      fontWeight: '700',
                                    }}
                                  >
                                    {item.subject}
                                  </span>
                                  <span
                                    style={{
                                      borderRadius: '999px',
                                      background: 'rgba(255,255,255,0.05)',
                                      color: getSourceColor(item.source),
                                      padding: '6px 10px',
                                      fontFamily: "'DM Sans', sans-serif",
                                      fontSize: '11px',
                                      fontWeight: '700',
                                    }}
                                  >
                                    {getSourceLabel(item.source)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <IconButton icon={EditIcon} onClick={() => openEditModal(item)} label="Edit question" />
                              <IconButton
                                icon={TrashIcon}
                                onClick={() => handleDeleteQuestion(item)}
                                label="Delete question"
                                danger
                              />
                            </div>
                          </div>

                          <div className="mt-4">
                            <TableActionButton
                              expanded={isExpanded}
                              onClick={() => handleToggleExpansion(item.id)}
                            />
                          </div>
                        </div>

                        {shouldRenderExpansion && (
                          <div style={getExpansionStyle(isExpanded)}>
                            <div style={{ overflow: 'hidden' }}>
                              <div
                                style={{
                                  borderTop: '1px solid rgba(255,255,255,0.04)',
                                  background: 'rgba(101,221,210,0.05)',
                                  padding: '14px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '14px',
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      color: '#90eae1',
                                      fontFamily: "'DM Sans', sans-serif",
                                      fontSize: '10px',
                                      fontWeight: '800',
                                      letterSpacing: '0.12em',
                                      textTransform: 'uppercase',
                                      marginBottom: '8px',
                                    }}
                                  >
                                    Answer
                                  </div>
                                  <div
                                    style={{
                                      color: '#f3fffd',
                                      fontFamily: "'DM Sans', sans-serif",
                                      fontSize: '13px',
                                      lineHeight: 1.7,
                                      fontWeight: '700',
                                    }}
                                  >
                                    {item.answer || 'No answer stored yet.'}
                                  </div>
                                </div>

                                <div>
                                  <div
                                    style={{
                                      color: '#90eae1',
                                      fontFamily: "'DM Sans', sans-serif",
                                      fontSize: '10px',
                                      fontWeight: '800',
                                      letterSpacing: '0.12em',
                                      textTransform: 'uppercase',
                                      marginBottom: '8px',
                                    }}
                                  >
                                    Explanation
                                  </div>
                                  <div
                                    style={{
                                      color: TEXT2,
                                      fontFamily: "'DM Sans', sans-serif",
                                      fontSize: '13px',
                                      lineHeight: 1.7,
                                    }}
                                  >
                                    {item.explanation || 'No explanation stored yet.'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-col gap-3 border-t border-white/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div
                      style={{
                        color: TEXT3,
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '12px',
                      }}
                    >
                      Page {currentPage} of {totalPages}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={currentPage === 1}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '10px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          background: 'rgba(255,255,255,0.03)',
                          color: currentPage === 1 ? TEXT3 : TEXT2,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: currentPage === 1 ? 0.55 : 1,
                        }}
                      >
                        <span style={{ width: '13px', height: '13px', display: 'inline-flex' }}>
                          <BackIcon />
                        </span>
                      </button>

                      {paginationNumbers.map((pageNumber) => {
                        if (typeof pageNumber !== 'number') {
                          return (
                            <span
                              key={pageNumber}
                              style={{
                                padding: '0 4px',
                                color: TEXT3,
                                fontFamily: "'DM Sans', sans-serif",
                                fontSize: '12px',
                                fontWeight: '700',
                              }}
                            >
                              ...
                            </span>
                          )
                        }

                        const isActive = currentPage === pageNumber

                        return (
                          <button
                            key={pageNumber}
                            type="button"
                            onClick={() => setCurrentPage(pageNumber)}
                            style={{
                              minWidth: '32px',
                              height: '32px',
                              borderRadius: '9px',
                              border: `1px solid ${isActive ? 'rgba(120,88,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                              background: isActive ? 'rgba(84,62,173,0.44)' : 'rgba(255,255,255,0.03)',
                              color: isActive ? '#efe9ff' : TEXT2,
                              padding: '0 10px',
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: '12px',
                              fontWeight: '700',
                            }}
                          >
                            {pageNumber}
                          </button>
                        )
                      })}

                      <button
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                        disabled={currentPage === totalPages}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '10px',
                          border: '1px solid rgba(255,255,255,0.06)',
                          background: 'rgba(255,255,255,0.03)',
                          color: currentPage === totalPages ? TEXT3 : TEXT2,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: currentPage === totalPages ? 0.55 : 1,
                        }}
                      >
                        <span
                          style={{
                            width: '13px',
                            height: '13px',
                            display: 'inline-flex',
                            transform: 'rotate(180deg)',
                          }}
                        >
                          <BackIcon />
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        title={editingQuestion ? 'Edit Question' : 'Add Manual Question'}
        width={620}
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label>Subject</Label>
            <select
              value={form.subjectId}
              onChange={(event) => setForm((previous) => ({ ...previous, subjectId: event.target.value }))}
              style={getInputStyle()}
            >
              <option value="">Select a subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Question</Label>
            <textarea
              value={form.question}
              onChange={(event) => setForm((previous) => ({ ...previous, question: event.target.value }))}
              placeholder="Write the question prompt..."
              style={getTextareaStyle()}
            />
          </div>

          <div>
            <Label>Answer</Label>
            <textarea
              value={form.answer}
              onChange={(event) => setForm((previous) => ({ ...previous, answer: event.target.value }))}
              placeholder="Add the answer that stays hidden until reveal..."
              style={getTextareaStyle()}
            />
          </div>

          <div>
            <Label>Explanation</Label>
            <textarea
              value={form.explanation}
              onChange={(event) => setForm((previous) => ({ ...previous, explanation: event.target.value }))}
              placeholder="Explain why the answer is correct or what the learner should remember..."
              style={getTextareaStyle()}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeModal}
              style={{
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                color: TEXT2,
                padding: '11px 16px',
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
              style={{
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #58c8ff, #2f8eff)',
                color: '#fff',
                padding: '11px 16px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '800',
              }}
            >
              {editingQuestion ? 'Save Changes' : 'Add to Question Bank'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
