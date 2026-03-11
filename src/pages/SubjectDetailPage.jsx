/**
 * SubjectDetailPage.jsx — Full detail view for a single subject.
 *
 * Shows: breadcrumb, banner with stats, topics accordion list,
 * add-topic modal, PDF panel. Opens the rich text Editor when a note is clicked.
 *
 * Props:
 *   subject         {Object}   — Live subject object from parent state
 *   onBack          {Function} — Navigate back to subjects grid
 *   onUpdateSubject {Function} — (updatedSubject) persist changes upward
 *
 * State:
 *   subj        {Object}      — Local copy of subject (syncs up on change)
 *   openNote    {Object|null} — { note, topicId } or null — controls editor visibility
 *   addTopicOpen{boolean}     — Controls "Add Topic" modal
 *   newTopicName{string}      — Controlled input for new topic name
 */

import { useEffect, useRef, useState } from 'react'
import Editor             from '@/components/editor/Editor'
import TopicAccordion     from '@/components/subjects/TopicAccordion'
import PdfPanel           from '@/components/subjects/PdfPanel'
import Modal              from '@/components/ui/Modal'
import FormField          from '@/components/ui/FormField'
import AiScoreBadge       from '@/components/ui/AiScoreBadge'
import TestResultsView    from '@/components/tests/TestResultsView'
import { BackIcon, PlusIcon } from '@/components/ui/Icons'
import { BORDER, TEXT1, TEXT3 } from '@/constants/theme'
import { uid }            from '@/utils/id'
import { getTotalNotes }  from '@/utils/subjectStats'
import { deletePdfKnowledge } from '@/services/firebase/pdfKnowledgeService'
import {
  deletePdfBinary,
  MAX_PDF_FILE_BYTES,
  storePdfBinary,
} from '@/utils/pdfBinaryStore'
import { subscribeToTests } from '@/services/firebase/testsService'

function formatTestDateTime(value) {
  const date = new Date(value || '')
  if (Number.isNaN(date.getTime())) return 'Unknown time'

  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isTestCompletedForSubject(test, subjectId) {
  return test?.metadata?.subjects?.some((item) => item.id === subjectId)
}

function formatPdfSize(sizeBytes) {
  const bytes = Number(sizeBytes || 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return '1 KB'
  if (bytes >= 1024 * 1024) {
    const megabytes = bytes / (1024 * 1024)
    return `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function SubjectDetailPage({
  subject,
  onBack,
  onUpdateSubject,
  initialOpenNote = null,
  user = null,
  onOpenAIContext = null,
}) {
  // Local subject state — changes are pushed up via onUpdateSubject
  const [subj, setSubj] = useState(subject)
  const subjectRef = useRef(subject)
  const [openNote, setOpenNote] = useState(initialOpenNote)   // { note, topicId }
  const [addTopicOpen, setAddTopicOpen] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [subjectTests, setSubjectTests] = useState([])
  const [testsLoading, setTestsLoading] = useState(false)
  const [testsError, setTestsError] = useState('')
  const [showCompletedTests, setShowCompletedTests] = useState(false)
  const [openTestReview, setOpenTestReview] = useState(null)
  const [pdfFeedback, setPdfFeedback] = useState(null)

  const totalNotes = getTotalNotes(subj)

  useEffect(() => {
    subjectRef.current = subject
    setSubj(subject)
  }, [subject])

  useEffect(() => {
    if (!user?.uid || !subj?.id) {
      setSubjectTests([])
      setTestsLoading(false)
      setTestsError('')
      return
    }

    setTestsLoading(true)
    setTestsError('')

    const unsubscribe = subscribeToTests(
      user.uid,
      (tests) => {
        const filtered = tests
          .filter((test) => isTestCompletedForSubject(test, subj.id))
          .sort((a, b) => (b.completedAt || b.createdAt || '').localeCompare(a.completedAt || a.createdAt || ''))

        setSubjectTests(filtered)
        setTestsLoading(false)
      },
      (error) => {
        console.error('Failed to load subject tests:', error)
        setTestsError(error?.message || 'Unable to load completed tests.')
        setTestsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user?.uid, subj?.id])

  useEffect(() => {
    if (!pdfFeedback?.text) return undefined

    const timeoutId = window.setTimeout(() => {
      setPdfFeedback(null)
    }, 4200)

    return () => window.clearTimeout(timeoutId)
  }, [pdfFeedback])

  /** Push local state up and keep local copy in sync */
  const save = async (updated) => {
    subjectRef.current = updated
    setSubj(updated)
    await onUpdateSubject(updated)
  }

  // ── TOPIC ACTIONS ─────────────────────────────────────────────────────────
  const handleAddTopic = () => {
    if (!newTopicName.trim()) return
    save({
      ...subj,
      topics: [
        ...subj.topics,
        {
          id: uid(),
          name: newTopicName.trim(),
          questionsCount: 0,
          isCompleted: false,
          completedAt: null,
          notes: [],
        },
      ],
    })
    setNewTopicName('')
    setAddTopicOpen(false)
  }

  const handleDeleteTopic = (topicId) =>
    save({ ...subj, topics: subj.topics.filter(t => t.id !== topicId) })

  const handleToggleTopicComplete = (topicId) => {
    const now = new Date().toISOString()

    save({
      ...subj,
      topics: subj.topics.map((topic) =>
        topic.id !== topicId
          ? topic
          : {
              ...topic,
              isCompleted: !topic.isCompleted,
              completedAt: topic.isCompleted ? null : now,
            }
      ),
    })
  }

  // ── NOTE ACTIONS ──────────────────────────────────────────────────────────
  const handleAddNote = (topicId) => {
    const now = new Date().toISOString()
    const newNote = {
      id:     uid(),
      title:  'Untitled Note',
      content: '<p></p>',
      blocks: [{ id: uid(), type: 'p', text: '' }],
      tags: [],
      isFavorite: false,
      isPinned: false,
      linkedNotes: [],
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    }
    const updated = {
      ...subj,
      topics: subj.topics.map(t =>
        t.id !== topicId ? t : { ...t, notes: [...t.notes, newNote] }
      ),
    }
    save(updated)
    setOpenNote({ note: newNote, topicId })
  }

  const handleSaveNote = (topicId, updatedNote) => {
    const now = new Date().toISOString()
    const noteWithMeta = {
      ...updatedNote,
      tags: Array.isArray(updatedNote.tags) ? updatedNote.tags : [],
      createdAt: updatedNote.createdAt ?? now,
      updatedAt: now,
      lastOpenedAt: now,
    }

    const updatedSubject = {
      ...subj,
      topics: subj.topics.map(t =>
        t.id !== topicId ? t : {
          ...t,
          notes: t.notes.map(n => n.id === updatedNote.id ? noteWithMeta : n),
        }
      ),
    }
    save(updatedSubject)
    setOpenNote(prev =>
      prev && prev.note.id === updatedNote.id
        ? { ...prev, note: noteWithMeta, topicId }
        : prev
    )
  }

  const handleDeleteNote = (topicId, noteId) =>
    save({
      ...subj,
      topics: subj.topics.map(t =>
        t.id !== topicId ? t : { ...t, notes: t.notes.filter(n => n.id !== noteId) }
      ),
    })

  // ── LINKED NOTES ACTIONS ──────────────────────────────────────────────────
  /**
   * Add a linked note reference to the currently open note.
   */
  const handleAddLinkedNote = (targetNoteId) => {
    if (!openNote) return
    
    const updatedSubject = {
      ...subj,
      topics: subj.topics.map(t => {
        if (t.id !== openNote.topicId) return t
        return {
          ...t,
          notes: t.notes.map(n => {
            if (n.id !== openNote.note.id) return n
            const linkedNotes = n.linkedNotes || []
            // Don't add duplicate links
            if (linkedNotes.includes(targetNoteId)) return n
            return { ...n, linkedNotes: [...linkedNotes, targetNoteId] }
          }),
        }
      }),
    }
    save(updatedSubject)
    
    // Update local openNote state
    const updatedNote = updatedSubject.topics
      .find(t => t.id === openNote.topicId)
      ?.notes.find(n => n.id === openNote.note.id)
    
    if (updatedNote) {
      setOpenNote({ ...openNote, note: updatedNote })
    }
  }

  /**
   * Remove a linked note reference from the currently open note.
   */
  const handleRemoveLinkedNote = (targetNoteId) => {
    if (!openNote) return
    
    const updatedSubject = {
      ...subj,
      topics: subj.topics.map(t => {
        if (t.id !== openNote.topicId) return t
        return {
          ...t,
          notes: t.notes.map(n => {
            if (n.id !== openNote.note.id) return n
            const linkedNotes = n.linkedNotes || []
            return { ...n, linkedNotes: linkedNotes.filter(id => id !== targetNoteId) }
          }),
        }
      }),
    }
    save(updatedSubject)
    
    // Update local openNote state
    const updatedNote = updatedSubject.topics
      .find(t => t.id === openNote.topicId)
      ?.notes.find(n => n.id === openNote.note.id)
    
    if (updatedNote) {
      setOpenNote({ ...openNote, note: updatedNote })
    }
  }

  /**
   * Navigate to a linked note.
   * Finds the note across all topics and opens it.
   */
  const handleNavigateToLinkedNote = (linkedNote) => {
    // Find the topic that contains this note
    let targetTopicId = null
    let targetNote = null
    
    for (const topic of subj.topics) {
      const foundNote = topic.notes.find(n => n.id === linkedNote.id)
      if (foundNote) {
        targetTopicId = topic.id
        targetNote = foundNote
        break
      }
    }
    
    if (targetTopicId && targetNote) {
      setOpenNote({ note: targetNote, topicId: targetTopicId })
    }
  }

  /**
   * Get all notes from all topics (for linked notes search).
   */
  const getAllNotes = () => {
    const notes = []
    subj.topics.forEach(topic => {
      topic.notes.forEach(note => {
        notes.push({
          ...note,
          topicId: topic.id,
          topicName: topic.name,
          subjectId: subj.id,
          subjectName: subj.name,
          subjectColor: subj.color,
          subjectIcon: subj.icon,
        })
      })
    })
    return notes
  }

  // ── PDF ACTIONS ───────────────────────────────────────────────────────────
  const handleAddPdf = async (file) => {
    if (!file) return
    setPdfFeedback(null)

    if (file.size > MAX_PDF_FILE_BYTES) {
      setPdfFeedback({
        type: 'error',
        text: `PDF must be 20 MB or smaller. "${file.name}" is ${formatPdfSize(file.size)}.`,
      })
      return
    }

    const pdfId = uid()
    const previewUrl = URL.createObjectURL(file)
    let binaryStored = false

    try {
      await storePdfBinary({
        userId: user?.uid || null,
        subjectId: subjectRef.current.id,
        pdfId,
        file,
      })
      binaryStored = true

      const pendingPdf = {
        id: pdfId,
        name: file.name,
        url: previewUrl,
        size: formatPdfSize(file.size),
        sizeBytes: file.size,
        addedAt: new Date().toLocaleDateString(),
        aiStatus: 'deferred',
        summary: '',
        preview: '',
        pageCount: 0,
        chunkCount: 0,
        storageType: 'indexeddb',
      }

      await save({
        ...subjectRef.current,
        pdfs: [...(subjectRef.current.pdfs ?? []), pendingPdf],
      })
      setPdfFeedback({
        type: 'notice',
        text: 'PDF saved. LearnLedger will clean and prepare it only when you use Ask AI.',
      })
    } catch (error) {
      console.error('Failed to store PDF:', error)

      if (binaryStored) {
        try {
          await deletePdfBinary({
            userId: user?.uid || null,
            subjectId: subjectRef.current.id,
            pdfId,
          })
        } catch (cleanupError) {
          console.error('Failed to clean up cached PDF binary:', cleanupError)
        }
      }

      URL.revokeObjectURL(previewUrl)
      setPdfFeedback({
        type: 'error',
        text: error?.message || 'Unable to save this PDF.',
      })
    }
  }

  const handleDeletePdf = async (id) => {
    const pdfToDelete = (subjectRef.current.pdfs ?? []).find((pdf) => pdf.id === id)
    if (pdfToDelete?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(pdfToDelete.url)
    }

    await save({
      ...subjectRef.current,
      pdfs: (subjectRef.current.pdfs ?? []).filter((pdf) => pdf.id !== id),
    })

    if (user?.uid) {
      try {
        await deletePdfKnowledge(user.uid, subjectRef.current.id, id)
      } catch (error) {
        console.error('Failed to delete PDF knowledge:', error)
      }
    }

    try {
      await deletePdfBinary({
        userId: user?.uid || null,
        subjectId: subjectRef.current.id,
        pdfId: id,
      })
    } catch (error) {
      console.error('Failed to delete cached PDF binary:', error)
    }
  }

  const handleAskAIForPdf = (pdf) => {
    if (!onOpenAIContext) return

    onOpenAIContext({
      subjectId: subjectRef.current.id,
      subjectName: subjectRef.current.name,
      pdfId: pdf.id,
      pdfName: pdf.name,
      pdfStatus: pdf.aiStatus || 'deferred',
      typedContext: `Use the attached PDF "${pdf.name}" as the main study source.`,
    })
  }

  // ── RENDER EDITOR when a note is open ─────────────────────────────────────
  if (openTestReview) {
    return (
      <TestResultsView
        testAttempt={openTestReview}
        onClose={() => setOpenTestReview(null)}
        closeLabel="Back to Subject"
      />
    )
  }

  if (openNote) {
    return (
      <Editor
        note={openNote.note}
        subjectColor={subj.color}
        onBack={() => setOpenNote(null)}
        onSave={(updated) => handleSaveNote(openNote.topicId, updated)}
        allNotes={getAllNotes()}
        onAddLinkedNote={handleAddLinkedNote}
        onRemoveLinkedNote={handleRemoveLinkedNote}
        onNavigateToNote={handleNavigateToLinkedNote}
      />
    )
  }

  // ── SUBJECT DETAIL VIEW ───────────────────────────────────────────────────
  return (
    <div className="animate-fade-in min-w-0">

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '22px', flexWrap: 'wrap' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(139,92,246,0.07)', border: `1px solid ${BORDER}`,
            borderRadius: '9px', padding: '7px 14px',
            color: '#9d8ec4', fontSize: '13px',
            fontFamily: "'DM Sans',sans-serif", fontWeight: '600',
          }}
        >
          <span style={{ width: '14px', height: '14px' }}><BackIcon /></span>
          Subjects
        </button>
        <span style={{ color: '#5a5175', fontSize: '14px' }}>/</span>
        <span style={{ color: subj.color, fontFamily: "'DM Sans',sans-serif", fontWeight: '600', fontSize: '14px', overflowWrap: 'anywhere' }}>
          {subj.name}
        </span>
      </div>

      {/* Banner */}
      <SubjectBanner subject={subj} totalNotes={totalNotes} />

      {/* Topics section header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' }}>
        <h3 style={{ color: TEXT1, fontFamily: "'DM Sans',sans-serif", fontWeight: '700', fontSize: '15px', margin: 0 }}>
          Topics{' '}
          <span style={{ color: TEXT3, fontSize: '12px', fontWeight: '400', marginLeft: '6px' }}>
            {subj.topics.length}
          </span>
        </h3>
        <button
          className="w-full sm:w-auto"
          onClick={() => setAddTopicOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: `${subj.color}16`, border: `1px solid ${subj.color}2e`,
            borderRadius: '10px', padding: '7px 15px',
            color: subj.color, fontSize: '13px',
            fontFamily: "'DM Sans',sans-serif", fontWeight: '600',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = `${subj.color}28`)}
          onMouseLeave={(e) => (e.currentTarget.style.background = `${subj.color}16`)}
        >
          <span style={{ width: '13px', height: '13px' }}><PlusIcon /></span>
          Add Topic
        </button>
      </div>

      {/* Topics list */}
      {subj.topics.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px',
          border: `1px dashed ${BORDER}`, borderRadius: '14px',
        }}>
          <div style={{ fontSize: '30px', marginBottom: '8px' }}>📂</div>
          <p style={{ color: TEXT3, fontFamily: "'DM Sans',sans-serif", fontSize: '13px' }}>
            No topics yet — add your first topic above
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {subj.topics.map(topic => (
            <TopicAccordion
              key={topic.id}
              topic={topic}
              subjectColor={subj.color}
              onAddNote={handleAddNote}
              onOpenNote={(note, topicId) => setOpenNote({ note, topicId })}
              onDeleteNote={handleDeleteNote}
              onDeleteTopic={handleDeleteTopic}
              onToggleComplete={handleToggleTopicComplete}
            />
          ))}
        </div>
      )}

      {/* Completed tests for this subject */}
      <div style={{ marginTop: '22px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h3 style={{ color: TEXT1, fontFamily: "'DM Sans',sans-serif", fontWeight: '700', fontSize: '15px', margin: 0 }}>
            Tests Completed
            <span style={{ color: TEXT3, fontSize: '12px', fontWeight: '400', marginLeft: '6px' }}>
              {subjectTests.length}
            </span>
          </h3>
          <button
            type="button"
            onClick={() => setShowCompletedTests((value) => !value)}
            style={{
              border: `1px solid ${BORDER}`,
              borderRadius: '9px',
              background: 'rgba(255,255,255,0.03)',
              color: TEXT3,
              fontFamily: "'DM Sans',sans-serif",
              fontSize: '12px',
              fontWeight: '600',
              padding: '7px 11px',
            }}
          >
            {showCompletedTests ? 'Hide Tests' : 'View Completed Tests'}
          </button>
        </div>

        {showCompletedTests && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {testsLoading && (
              <div style={{
                border: `1px dashed ${BORDER}`,
                borderRadius: '12px',
                padding: '12px',
                color: TEXT3,
                fontFamily: "'DM Sans',sans-serif",
                fontSize: '12px',
              }}>
                Loading completed tests...
              </div>
            )}

            {!testsLoading && testsError && (
              <div style={{
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '12px',
                padding: '12px',
                background: 'rgba(239,68,68,0.08)',
                color: '#fca5a5',
                fontFamily: "'DM Sans',sans-serif",
                fontSize: '12px',
              }}>
                {testsError}
              </div>
            )}

            {!testsLoading && !testsError && subjectTests.length === 0 && (
              <div style={{
                border: `1px dashed ${BORDER}`,
                borderRadius: '12px',
                padding: '12px',
                color: TEXT3,
                fontFamily: "'DM Sans',sans-serif",
                fontSize: '12px',
              }}>
                No completed tests yet for this subject.
              </div>
            )}

            {!testsLoading && !testsError && subjectTests.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {subjectTests.map((test) => (
                  <button
                    key={test.id}
                    type="button"
                    onClick={() => setOpenTestReview(test)}
                    style={{
                      border: `1px solid ${BORDER}`,
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.02)',
                      color: TEXT1,
                      textAlign: 'left',
                      padding: '11px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: '13px',
                        fontWeight: '700',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {test.title}
                      </div>
                      <div style={{
                        color: TEXT3,
                        fontFamily: "'DM Sans',sans-serif",
                        fontSize: '11px',
                        marginTop: '4px',
                      }}>
                        {formatTestDateTime(test.completedAt || test.createdAt)} • {test.score}/{test.totalQuestions} • {test.percentage}%
                      </div>
                    </div>
                    <span style={{
                      border: `1px solid ${subj.color}35`,
                      borderRadius: '8px',
                      color: subj.color,
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '6px 8px',
                      whiteSpace: 'nowrap',
                    }}>
                      Revise
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PDF section */}
      <PdfPanel
        pdfs={subj.pdfs ?? []}
        color={subj.color}
        onAdd={handleAddPdf}
        onDelete={handleDeletePdf}
        onAskAI={handleAskAIForPdf}
        feedback={pdfFeedback}
      />

      {/* Add Topic modal */}
      <Modal
        open={addTopicOpen}
        onClose={() => setAddTopicOpen(false)}
        title="Add Topic"
        width={400}
      >
        <FormField
          label="Topic Name"
          value={newTopicName}
          onChange={setNewTopicName}
          placeholder="e.g. Calculus, Mechanics, Data Structures…"
        />
        <button
          onClick={handleAddTopic}
          style={{
            width: '100%', padding: '11px',
            background: `linear-gradient(135deg,${subj.color},${subj.color}cc)`,
            border: 'none', borderRadius: '10px',
            color: '#fff', fontWeight: '700', fontSize: '14px',
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          Create Topic
        </button>
      </Modal>
    </div>
  )
}

// ── SUBJECT BANNER (subject header card) ────────────────────────────────────
/**
 * SubjectBanner — Large hero card at the top of the detail view.
 * Shows subject icon, name, description, key stats and AI performance.
 */
function SubjectBanner({ subject, totalNotes }) {
  const stats = [
    { label: 'Topics', value: subject.topics.length },
    { label: 'Notes',  value: totalNotes             },
    { label: 'PDFs',   value: (subject.pdfs ?? []).length },
    { label: 'Tests Completed', value: subject.testsAttempted },
  ]

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5" style={{
      background: `linear-gradient(135deg,${subject.color}12 0%,transparent 65%)`,
      border: `1px solid ${subject.color}1c`,
      borderRadius: '20px', padding: 'clamp(16px,3vw,24px) clamp(16px,4vw,28px)', marginBottom: '26px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Radial glow decoration */}
      <div style={{
        position: 'absolute', right: '-70px', top: '-70px',
        width: '220px', height: '220px', borderRadius: '50%',
        background: `radial-gradient(circle,${subject.color}0d,transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Icon */}
      <div style={{
        width: 'clamp(56px,18vw,68px)', height: 'clamp(56px,18vw,68px)', borderRadius: 'clamp(14px,4vw,17px)', flexShrink: 0,
        background: `linear-gradient(135deg,${subject.color}24,${subject.color}0c)`,
        border: `1px solid ${subject.color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 'clamp(24px,7vw,28px)', color: subject.color,
        boxShadow: `0 8px 26px ${subject.color}20`,
      }}>
        {subject.icon}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
        <h2 style={{
          color: '#ede6ff', fontFamily: "'DM Sans',sans-serif",
          fontWeight: '800', fontSize: 'clamp(19px,5vw,22px)',
          margin: '0 0 3px', letterSpacing: '-0.5px',
          overflowWrap: 'anywhere',
        }}>
          {subject.name}
        </h2>
        <p style={{ color: '#5a5175', fontSize: '13px', fontFamily: "'DM Sans',sans-serif", margin: '0 0 14px' }}>
          {subject.description}
        </p>

        <div className="grid w-full grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:items-center sm:gap-5">
          {stats.map(s => (
            <div key={s.label}>
              <div style={{ color: subject.color, fontWeight: '800', fontSize: '20px', fontFamily: "'DM Sans',sans-serif", letterSpacing: '-0.4px' }}>
                {s.value}
              </div>
              <div style={{ color: '#5a5175', fontSize: '11px', fontFamily: "'DM Sans',sans-serif" }}>
                {s.label}
              </div>
            </div>
          ))}
          <div className="col-span-2 sm:col-span-1" style={{ marginLeft: 0 }}>
            <div style={{ color: '#5a5175', fontSize: '10px', fontFamily: "'DM Sans',sans-serif", marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Performance
            </div>
            <AiScoreBadge score={subject.aiScore} tests={subject.testsAttempted} />
          </div>
        </div>
      </div>
    </div>
  )
}
