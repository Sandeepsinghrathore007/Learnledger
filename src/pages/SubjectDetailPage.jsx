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

import { useEffect, useMemo, useRef, useState } from 'react'
import Editor             from '@/components/editor/Editor'
import TopicAccordion     from '@/components/subjects/TopicAccordion'
import PdfPanel           from '@/components/subjects/PdfPanel'
import Modal              from '@/components/ui/Modal'
import FormField          from '@/components/ui/FormField'
import AiScoreBadge       from '@/components/ui/AiScoreBadge'
import PaginationControls from '@/components/ui/PaginationControls'
import TestConfigModal    from '@/components/tests/TestConfigModal'
import TestTakingView     from '@/components/tests/TestTakingView'
import TestResultsView    from '@/components/tests/TestResultsView'
import { BackIcon, MockTestsIcon, PdfIcon, PlusIcon, TopicsIcon } from '@/components/ui/Icons'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import { uid }            from '@/utils/id'
import { deletePdfKnowledge, savePdfKnowledge } from '@/services/firebase/pdfKnowledgeService'
import { extractPdfKnowledgeFromFile } from '@/utils/pdfKnowledge'
import { deletePdfBinary, MAX_PDF_FILE_BYTES, storePdfBinary } from '@/utils/pdfBinaryStore'
import { uploadPdfToCloudinary, deletePdfFromCloudinary } from '@/services/cloudinaryService'
import { generateTest, saveTestResult, subscribeToTests } from '@/services/firebase/testsService'
import { buildQuestionBankSubjectUpdates } from '@/utils/questionBank'
import { determinePerformanceLevel } from '@/utils/testScoring'
import { resolveTestDisplay } from '@/utils/testDisplay'

const TOPICS_PAGE_SIZE = 15
const SUBJECT_PDFS_PAGE_SIZE = 10
const COMPLETED_TESTS_PAGE_SIZE = 15

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
  allSubjects = [],
  initialOpenNote = null,
  noteLaunchKey = null,
  initialSection = 'topics',
  sectionLaunchKey = null,
  user = null,
  onOpenMockTestsForTopic = null,
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
  const [openTestReview, setOpenTestReview] = useState(null)
  const [selectionTestContext, setSelectionTestContext] = useState(null)
  const [selectionTestGenerating, setSelectionTestGenerating] = useState(false)
  const [activeSelectionTest, setActiveSelectionTest] = useState(null)
  const [selectionTestReview, setSelectionTestReview] = useState(null)
  const [pdfFeedback, setPdfFeedback] = useState(null)
  const [topicsPage, setTopicsPage] = useState(1)
  const [testsPage, setTestsPage] = useState(1)
  const [activeSection, setActiveSection] = useState(
    initialSection === 'materials'
      ? 'materials'
      : initialSection === 'tests'
        ? 'tests'
        : 'topics'
  )

  useEffect(() => {
    subjectRef.current = subject
    setSubj(subject)
  }, [subject])

  useEffect(() => {
    if (initialOpenNote) {
      setOpenNote(initialOpenNote)
      return
    }

    setOpenNote(null)
  }, [initialOpenNote, noteLaunchKey, subject.id])

  useEffect(() => {
    setActiveSection(
      initialSection === 'materials'
        ? 'materials'
        : initialSection === 'tests'
          ? 'tests'
          : 'topics'
    )
  }, [initialSection, sectionLaunchKey, subject.id])

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
          .map((test) => resolveTestDisplay(test, allSubjects))
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
  }, [allSubjects, user?.uid, subj?.id])

  const subjectTestsForDisplay = useMemo(
    () => subjectTests.map((test) => resolveTestDisplay(test, allSubjects)),
    [allSubjects, subjectTests]
  )
  const topicTotalPages = Math.max(1, Math.ceil(subj.topics.length / TOPICS_PAGE_SIZE))
  const topicPageStart = (topicsPage - 1) * TOPICS_PAGE_SIZE
  const paginatedTopics = useMemo(
    () => subj.topics.slice(topicPageStart, topicPageStart + TOPICS_PAGE_SIZE),
    [subj.topics, topicPageStart]
  )
  const completedTestsTotalPages = Math.max(1, Math.ceil(subjectTestsForDisplay.length / COMPLETED_TESTS_PAGE_SIZE))
  const testsPageStart = (testsPage - 1) * COMPLETED_TESTS_PAGE_SIZE
  const paginatedSubjectTests = useMemo(
    () => subjectTestsForDisplay.slice(testsPageStart, testsPageStart + COMPLETED_TESTS_PAGE_SIZE),
    [subjectTestsForDisplay, testsPageStart]
  )

  useEffect(() => {
    if (!pdfFeedback?.text) return undefined

    const timeoutId = window.setTimeout(() => {
      setPdfFeedback(null)
    }, 4200)

    return () => window.clearTimeout(timeoutId)
  }, [pdfFeedback])

  useEffect(() => {
    setSelectionTestContext(null)
  }, [openNote?.note?.id, openNote?.topicId])

  useEffect(() => {
    setTopicsPage(1)
    setTestsPage(1)
  }, [subject.id])

  useEffect(() => {
    if (topicsPage > topicTotalPages) {
      setTopicsPage(topicTotalPages)
    }
  }, [topicTotalPages, topicsPage])

  useEffect(() => {
    if (testsPage > completedTestsTotalPages) {
      setTestsPage(completedTestsTotalPages)
    }
  }, [completedTestsTotalPages, testsPage])

  /** Push local state up and keep local copy in sync */
  const save = async (updated) => {
    subjectRef.current = updated
    setSubj(updated)
    await onUpdateSubject(updated)
  }

  const appendPdfRecord = async (pdf) => {
    await save({
      ...subjectRef.current,
      pdfs: [...(subjectRef.current.pdfs ?? []), pdf],
    })
  }

  const updatePdfRecord = async (pdfId, updater) => {
    const updatedSubject = {
      ...subjectRef.current,
      pdfs: (subjectRef.current.pdfs ?? []).map((pdf) =>
        pdf.id === pdfId ? updater(pdf) : pdf
      ),
    }

    await save(updatedSubject)
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

  // ── NOTE ACTIONS ──────────────────────────────────────────────────────────
  const handleAddNote = (topicId) => {
    const baseSubject = subjectRef.current
    const now = new Date().toISOString()
    const newNote = {
      id:     uid(),
      title:  'Untitled Note',
      content: '<p></p>',
      blocks: [{ id: uid(), type: 'p', text: '' }],
      tags: [],
      theme: 'midnight',
      fontSize: 'medium',
      isFavorite: false,
      isPinned: false,
      linkedNotes: [],
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    }
    const updated = {
      ...baseSubject,
      topics: baseSubject.topics.map(t =>
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
      theme: typeof updatedNote.theme === 'string' ? updatedNote.theme : 'midnight',
      fontSize: typeof updatedNote.fontSize === 'string' ? updatedNote.fontSize : 'medium',
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
    let uploadedPdfId = null

    try {
      setPdfFeedback({ type: 'info', text: 'Uploading PDF to Cloudinary...' })

      const { url, publicId, resourceType, format, version } = await uploadPdfToCloudinary({
        file,
        userId: user?.uid || 'guest',
        subjectId: subjectRef.current.id,
        pdfId,
      })

      const pendingPdf = {
        id: pdfId,
        name: file.name,
        url,
        publicId,
        resourceType,
        format,
        version,
        size: formatPdfSize(file.size),
        sizeBytes: file.size,
        addedAt: new Date().toISOString(),
        aiStatus: 'processing',
        summary: '',
        preview: '',
        pageCount: 0,
        chunkCount: 0,
        storageType: 'cloudinary',
      }
      uploadedPdfId = pendingPdf.id

      await storePdfBinary({
        userId: user?.uid || null,
        subjectId: subjectRef.current.id,
        pdfId,
        file,
      }).catch((cacheError) => {
        console.warn('Failed to cache PDF locally on this device:', cacheError)
      })

      await appendPdfRecord(pendingPdf)

      setPdfFeedback({ type: 'info', text: 'Extracting AI knowledge and syncing study context...' })

      const extracted = await extractPdfKnowledgeFromFile(file)
      const hasKnowledge = Boolean(
        extracted &&
        (
          String(extracted.summary || '').trim() ||
          (Array.isArray(extracted.chunks) && extracted.chunks.length > 0)
        )
      )

      if (!hasKnowledge) {
        await updatePdfRecord(pdfId, (pdf) => ({
          ...pdf,
          aiStatus: 'not-processed',
        }))

        setPdfFeedback({
          type: 'error',
          text: 'PDF uploaded, but readable text could not be extracted for AI.',
        })
        return
      }

      if (user?.uid) {
        await savePdfKnowledge({
          userId: user.uid,
          subjectId: subjectRef.current.id,
          pdf: { id: pdfId, name: file.name },
          knowledge: extracted,
        })
      }

      await updatePdfRecord(pdfId, (pdf) => ({
        ...pdf,
        aiStatus: 'ready',
        summary: extracted.summary || '',
        preview: extracted.preview || '',
        pageCount: Number.isFinite(extracted.pageCount) ? extracted.pageCount : 0,
        chunkCount: Array.isArray(extracted.chunks) ? extracted.chunks.length : 0,
        aiReadyAt: new Date().toISOString(),
      }))

      setPdfFeedback({
        type: 'info',
        text: user?.uid
          ? 'PDF uploaded and AI knowledge synced for all devices.'
          : 'PDF uploaded and AI study context prepared.',
      })
    } catch (error) {
      console.error('Failed to upload PDF:', error)

      if (uploadedPdfId) {
        await updatePdfRecord(uploadedPdfId, (pdf) => ({
          ...pdf,
          aiStatus: 'not-processed',
        })).catch(() => {})
      }

      setPdfFeedback({
        type: 'error',
        text: error?.message || 'Unable to upload this PDF. Check your internet connection.',
      })
    }
  }

  const handleDeletePdf = async (id) => {
    const pdfToDelete = (subjectRef.current.pdfs ?? []).find((pdf) => pdf.id === id)
    // ✅ Remove from Cloudinary if it was uploaded there
    if (pdfToDelete?.storageType === 'cloudinary' && pdfToDelete?.publicId) {
      await deletePdfFromCloudinary({ publicId: pdfToDelete.publicId }).catch(() => {})
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

    await deletePdfBinary({
      userId: user?.uid || null,
      subjectId: subjectRef.current.id,
      pdfId: id,
    }).catch(() => {})
  }

  const handleOpenSelectionTest = ({ text, noteTitle }) => {
    const selectedText = String(text || '').trim()
    if (!selectedText || !openNote) return

    const topic = subj.topics.find((item) => item.id === openNote.topicId)

    setSelectionTestContext({
      selectedText,
      noteId: openNote.note.id,
      noteTitle: noteTitle || openNote.note.title || 'Untitled Note',
      topicId: topic?.id || openNote.topicId,
      topicName: topic?.name || 'Topic',
      subjectId: subjectRef.current.id,
      subjectName: subjectRef.current.name,
    })
  }

  const handleOpenTopicMockTest = (topic) => {
    if (!topic || !onOpenMockTestsForTopic) return

    onOpenMockTestsForTopic(subjectRef.current, topic)
  }

  const handleGenerateSelectionTest = async (config) => {
    if (!selectionTestContext) return

    setSelectionTestGenerating(true)

    try {
      const generatedTest = await generateTest({
        config,
        subjects: [subjectRef.current],
        userId: user?.uid || null,
      })

      const [updatedSubject] = buildQuestionBankSubjectUpdates([subjectRef.current], generatedTest)
      if (updatedSubject) {
        await save(updatedSubject)
      }

      setSelectionTestContext(null)
      setActiveSelectionTest({
        ...resolveTestDisplay(generatedTest, allSubjects),
        startTime: new Date().toISOString(),
        answers: {},
        bookmarkedQuestions: [],
        hintsUsed: [],
      })
    } catch (error) {
      console.error('Failed to generate test from selected note text:', error)
      window.alert(error?.message || 'Unable to generate a test from the selected text right now.')
    } finally {
      setSelectionTestGenerating(false)
    }
  }

  const handleFinishSelectionTest = async (testAttempt) => {
    if (user?.uid) {
      try {
        await saveTestResult(user.uid, testAttempt)
      } catch (error) {
        console.error('Failed to save selection test result:', error)
      }
    }

    const nextTestsForScore = [...subjectTests, testAttempt].sort((a, b) =>
      (a.completedAt || a.createdAt || '').localeCompare(b.completedAt || b.createdAt || '')
    )
    const nextTestsForDisplay = [...nextTestsForScore].sort((a, b) =>
      (b.completedAt || b.createdAt || '').localeCompare(a.completedAt || a.createdAt || '')
    )

    setSubjectTests(nextTestsForDisplay)

    try {
      await save({
        ...subjectRef.current,
        testsAttempted: nextTestsForScore.length,
        aiScore: determinePerformanceLevel(nextTestsForScore),
      })
    } catch (error) {
      console.error('Failed to refresh subject test stats:', error)
    }

    setActiveSelectionTest(null)
    setSelectionTestReview(testAttempt)
  }

  // ── RENDER EDITOR when a note is open ─────────────────────────────────────
  if (activeSelectionTest) {
    return (
      <TestTakingView
        test={activeSelectionTest}
        onUpdateTest={setActiveSelectionTest}
        onFinish={handleFinishSelectionTest}
        onExit={() => setActiveSelectionTest(null)}
      />
    )
  }

  if (selectionTestReview) {
    return (
      <TestResultsView
        testAttempt={selectionTestReview}
        onClose={() => setSelectionTestReview(null)}
        closeLabel="Back to Note"
      />
    )
  }

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
      <>
        <Editor
          note={openNote.note}
          onBack={() => setOpenNote(null)}
          onSave={(updated) => handleSaveNote(openNote.topicId, updated)}
          onCreateNote={() => handleAddNote(openNote.topicId)}
          onGenerateSelectionTest={handleOpenSelectionTest}
          allNotes={getAllNotes()}
          onAddLinkedNote={handleAddLinkedNote}
          onRemoveLinkedNote={handleRemoveLinkedNote}
          onNavigateToNote={handleNavigateToLinkedNote}
        />
        <TestConfigModal
          open={Boolean(selectionTestContext)}
          onClose={() => setSelectionTestContext(null)}
          subjects={[subjectRef.current]}
          onGenerate={handleGenerateSelectionTest}
          isGenerating={selectionTestGenerating}
          selectionContext={selectionTestContext}
        />
      </>
    )
  }

  // ── SUBJECT DETAIL VIEW ───────────────────────────────────────────────────
  return (
    <div className="animate-fade-in min-w-0">

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap' }}>
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
      </div>

      {/* Banner */}
      <SubjectBanner subject={subj} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          alignItems: 'stretch',
          gap: '8px',
          padding: '6px',
          marginBottom: '18px',
          borderRadius: '16px',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${BORDER}`,
          width: '100%',
          maxWidth: '680px',
        }}
      >
        {[
          {
            id: 'topics',
            label: 'Topics',
            Icon: TopicsIcon,
            count: subj.topics.length,
            iconColor: '#38bdf8',
            iconBackground: 'rgba(56,189,248,0.12)',
          },
          {
            id: 'materials',
            label: 'Study Materials',
            Icon: PdfIcon,
            count: (subj.pdfs ?? []).length,
            iconColor: '#f87171',
            iconBackground: 'rgba(248,113,113,0.12)',
          },
          {
            id: 'tests',
            label: 'Tests Completed',
            Icon: MockTestsIcon,
            count: subjectTests.length,
            iconColor: '#34d399',
            iconBackground: 'rgba(52,211,153,0.12)',
          },
        ].map((section) => {
          const isActive = activeSection === section.id

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                justifyContent: 'center',
                minWidth: 0,
                borderRadius: '12px',
                border: `1px solid ${isActive ? `${subj.color}38` : 'transparent'}`,
                background: isActive ? `${subj.color}18` : 'transparent',
                color: isActive ? TEXT1 : TEXT2,
                fontFamily: "'DM Sans',sans-serif",
                fontSize: '13px',
                fontWeight: '700',
                padding: '10px 8px',
              }}
            >
              <span
                style={{
                  width: '26px',
                  height: '26px',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  color: section.iconColor,
                  background: isActive ? section.iconBackground : 'rgba(255,255,255,0.04)',
                }}
              >
                <span style={{ width: '14px', height: '14px' }}>
                  <section.Icon />
                </span>
              </span>
              <span className="hidden sm:inline" style={{ minWidth: 0, whiteSpace: 'nowrap' }}>
                {section.label}
              </span>
              <span
                style={{
                  borderRadius: '999px',
                  padding: '3px 8px',
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                  color: isActive ? TEXT1 : TEXT3,
                  fontSize: '11px',
                  fontWeight: '700',
                }}
              >
                {section.count}
              </span>
            </button>
          )
        })}
      </div>

      {activeSection === 'topics' ? (
        <>
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
              {paginatedTopics.map(topic => (
                <TopicAccordion
                  key={topic.id}
                  topic={topic}
                  subjectColor={subj.color}
                  onAddNote={handleAddNote}
                  onOpenNote={(note, topicId) => setOpenNote({ note, topicId })}
                  onDeleteNote={handleDeleteNote}
                  onDeleteTopic={handleDeleteTopic}
                  onTakeTest={handleOpenTopicMockTest}
                />
              ))}
            </div>
          )}

          <PaginationControls
            page={topicsPage}
            totalPages={topicTotalPages}
            onPageChange={setTopicsPage}
            label={`Showing ${topicPageStart + 1}-${Math.min(topicPageStart + TOPICS_PAGE_SIZE, subj.topics.length)} of ${subj.topics.length} topics`}
          />

        </>
      ) : activeSection === 'materials' ? (
        <PdfPanel
          pdfs={subj.pdfs ?? []}
          color={subj.color}
          onAdd={handleAddPdf}
          onDelete={handleDeletePdf}
          feedback={pdfFeedback}
          binaryContext={{ userId: user?.uid || null, subjectId: subj.id }}
          showAskAI={false}
          itemsPerPage={SUBJECT_PDFS_PAGE_SIZE}
        />
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ color: TEXT1, fontFamily: "'DM Sans',sans-serif", fontWeight: '700', fontSize: '15px', margin: 0 }}>
              Tests Completed
              <span style={{ color: TEXT3, fontSize: '12px', fontWeight: '400', marginLeft: '6px' }}>
                {subjectTests.length}
              </span>
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

            {!testsLoading && !testsError && subjectTestsForDisplay.length === 0 && (
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

            {!testsLoading && !testsError && subjectTestsForDisplay.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {paginatedSubjectTests.map((test) => (
                  <button
                    key={test.id}
                    type="button"
                    onClick={() => setOpenTestReview(resolveTestDisplay(test, allSubjects))}
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

          <PaginationControls
            page={testsPage}
            totalPages={completedTestsTotalPages}
            onPageChange={setTestsPage}
            label={`Showing ${testsPageStart + 1}-${Math.min(testsPageStart + COMPLETED_TESTS_PAGE_SIZE, subjectTestsForDisplay.length)} of ${subjectTestsForDisplay.length} completed tests`}
          />
        </div>
      )}

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
function SubjectBanner({ subject }) {
  const stats = [
    {
      label: 'Topics',
      value: subject.topics.length,
      icon: TopicsIcon,
      color: '#60a5fa',
    },
    {
      label: 'PDFs',
      value: (subject.pdfs ?? []).length,
      icon: PdfIcon,
      color: '#f87171',
    },
    {
      label: 'Tests Completed',
      value: Number.isFinite(subject.testsAttempted) ? subject.testsAttempted : 0,
      icon: MockTestsIcon,
      color: '#34d399',
    },
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            className="grid w-full gap-3"
            style={{
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '6px',
              padding: '6px',
              borderRadius: '16px',
              background: 'rgba(255,255,255,0.025)',
              border: `1px solid ${subject.color}18`,
            }}
          >
            {stats.map((stat) => {
              return (
                <div
                  key={stat.label}
                  style={{
                    minWidth: 0,
                    minHeight: '74px',
                    padding: '9px 6px 8px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
                    border: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      color: stat.color,
                      fontWeight: '900',
                      fontSize: 'clamp(18px, 4.8vw, 24px)',
                      fontFamily: "'DM Sans',sans-serif",
                      lineHeight: 1,
                      letterSpacing: '-0.6px',
                      textShadow: `0 8px 24px ${stat.color}20`,
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    style={{
                      color: '#7b7394',
                      fontSize: '9px',
                      fontFamily: "'DM Sans',sans-serif",
                      lineHeight: 1.15,
                      marginTop: '8px',
                      maxWidth: '72px',
                      textAlign: 'center',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginLeft: 0 }}>
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
