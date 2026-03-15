import { useState } from 'react'
import { LineChart, RankBars } from '@/components/analytics/AnalyticsCharts'
import ExamGroupModal from '@/components/analytics/ExamGroupModal'
import PdfPanel from '@/components/subjects/PdfPanel'
import { ChevronDownIcon, EditIcon, PlusIcon, TrashIcon } from '@/components/ui/Icons'
import { useAnalyticsDashboard } from '@/hooks/useAnalyticsDashboard'
import { uploadPdfToCloudinary, deletePdfFromCloudinary } from '@/services/cloudinaryService'
import { deletePdfKnowledge, savePdfKnowledge } from '@/services/firebase/pdfKnowledgeService'
import { BORDER, SURFACE, SURF2, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import { deletePdfBinary, MAX_PDF_FILE_BYTES, storePdfBinary } from '@/utils/pdfBinaryStore'
import { uid } from '@/utils/id'
import { extractPdfKnowledgeFromFile } from '@/utils/pdfKnowledge'

const overviewIconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function StreakIcon() {
  return (
    <svg {...overviewIconProps} strokeWidth="1.9">
      <path d="M12 2c1.8 2.2 3.3 4.3 3.3 6.8A3.3 3.3 0 0 1 12 12a3.8 3.8 0 0 0-3.8 3.8c0 3.2 2.4 5.2 3.8 6.2 1.6-1.1 4.8-3.5 4.8-7.3a6 6 0 0 0-2.4-4.8" />
      <path d="M9.2 8.8C7.3 10.2 6 12 6 14.7 6 18.3 8.4 20.9 12 22" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg {...overviewIconProps} strokeWidth="1.9">
      <path d="M8 4h8v3a4 4 0 0 1-4 4 4 4 0 0 1-4-4V4Z" />
      <path d="M8 5H5a2 2 0 0 0 2 4h1" />
      <path d="M16 5h3a2 2 0 0 1-2 4h-1" />
      <path d="M12 11v4" />
      <path d="M9 21h6" />
      <path d="M10 15h4v3h-4z" />
    </svg>
  )
}

function SubjectsIcon() {
  return (
    <svg {...overviewIconProps} strokeWidth="1.9">
      <rect x="3" y="4" width="7" height="7" rx="2" />
      <rect x="14" y="4" width="7" height="7" rx="2" />
      <rect x="3" y="13" width="7" height="7" rx="2" />
      <rect x="14" y="13" width="7" height="7" rx="2" />
    </svg>
  )
}

function TopicsIcon() {
  return (
    <svg {...overviewIconProps} strokeWidth="1.9">
      <path d="M4 6.5h16" />
      <path d="M4 12h16" />
      <path d="M4 17.5h10" />
      <circle cx="18" cy="17.5" r="2.5" />
    </svg>
  )
}

function TestsIcon() {
  return (
    <svg {...overviewIconProps} strokeWidth="1.9">
      <path d="M8 3h8" />
      <path d="M9 3v3" />
      <path d="M15 3v3" />
      <rect x="5" y="6" width="14" height="15" rx="3" />
      <path d="m9 14 2 2 4-5" />
    </svg>
  )
}

function AIQuestionsIcon() {
  return (
    <svg {...overviewIconProps} strokeWidth="1.9">
      <path d="M12 4a4 4 0 0 1 4 4v1.2a2.8 2.8 0 0 0 .8 2l.4.4A2 2 0 0 1 15.8 15H8.2a2 2 0 0 1-1.4-3.4l.4-.4a2.8 2.8 0 0 0 .8-2V8a4 4 0 0 1 4-4Z" />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
      <path d="M10 9.5h4" />
      <path d="M12 9.5v3" />
    </svg>
  )
}

function formatValue(value) {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)
}

function formatPercent(value) {
  if (!Number.isFinite(value) || value <= 0) return '0%'
  return `${Math.round(value)}%`
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

function getGroupPdfKnowledgeSubjectId(groupId) {
  return `exam-group-${String(groupId || '').trim()}`
}

function OverviewTile({ label, value, tone = '#8b5cf6', helper, icon: Icon }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${tone}22`,
        borderRadius: '18px',
        padding: '18px',
        minHeight: '116px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '14px',
          background: `${tone}18`,
          border: `1px solid ${tone}30`,
          boxShadow: `0 10px 24px ${tone}18`,
          color: tone,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {typeof Icon === 'function' && (
          <span style={{ width: '20px', height: '20px', display: 'inline-flex' }}>
            <Icon />
          </span>
        )}
      </div>
      <div>
        <div
          style={{
            color: tone,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '30px',
            fontWeight: '800',
            letterSpacing: '-0.6px',
          }}
        >
          {value}
        </div>
        <div
          style={{
            color: TEXT2,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '12px',
            fontWeight: '700',
            marginTop: '3px',
          }}
        >
          {label}
        </div>
        {helper && (
          <div
            style={{
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '11px',
              marginTop: '8px',
              lineHeight: 1.5,
            }}
          >
            {helper}
          </div>
        )}
      </div>
    </div>
  )
}

function SectionCard({ title, subtitle, actions = null, children }) {
  return (
    <section
      style={{
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: '22px',
        padding: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}
    >
      <div
        className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: TEXT1,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '18px',
              fontWeight: '800',
              letterSpacing: '-0.4px',
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              style={{
                margin: '6px 0 0',
                color: TEXT3,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                lineHeight: 1.6,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

function EmptyCard({ title, description, action = null }) {
  return (
    <div
      style={{
        border: `1px dashed ${BORDER}`,
        borderRadius: '18px',
        padding: '28px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: TEXT1,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '15px',
          fontWeight: '700',
        }}
      >
        {title}
      </div>
      <p
        style={{
          color: TEXT3,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '12px',
          lineHeight: 1.7,
          margin: '8px 0 0',
        }}
      >
        {description}
      </p>
      {action && <div style={{ marginTop: '16px' }}>{action}</div>}
    </div>
  )
}

function MetricChip({ label, value, helper = '' }) {
  return (
    <div
      style={{
        borderRadius: '12px',
        border: `1px solid ${BORDER}`,
        background: 'rgba(255,255,255,0.02)',
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          color: TEXT3,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '10.5px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: TEXT1,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '16px',
          fontWeight: '800',
          marginTop: '6px',
        }}
      >
        {value}
      </div>
      {helper ? (
        <div
          style={{
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '10.5px',
            marginTop: '4px',
            lineHeight: 1.4,
          }}
        >
          {helper}
        </div>
      ) : null}
    </div>
  )
}

function SubjectJumpCard({ subject, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(subject)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        minHeight: '88px',
        padding: '14px',
        borderRadius: '16px',
        background: `${subject.color}12`,
        border: `1px solid ${subject.color}2e`,
        color: '#f3edff',
        fontFamily: "'DM Sans', sans-serif",
        textAlign: 'left',
        transition: 'transform 0.16s ease, border-color 0.16s ease, background 0.16s ease',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = 'translateY(-2px)'
        event.currentTarget.style.borderColor = `${subject.color}55`
        event.currentTarget.style.background = `${subject.color}18`
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)'
        event.currentTarget.style.borderColor = `${subject.color}2e`
        event.currentTarget.style.background = `${subject.color}12`
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '14px',
          background: `${subject.color}1c`,
          border: `1px solid ${subject.color}35`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: subject.color,
          fontSize: '22px',
          flexShrink: 0,
        }}
      >
        {subject.icon}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            color: TEXT1,
            fontSize: '13px',
            fontWeight: '800',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {subject.name}
        </div>
        <div
          style={{
            color: TEXT3,
            fontSize: '11px',
            marginTop: '4px',
          }}
        >
          {subject.topics.length} topics
        </div>
        <div
          style={{
            color: subject.color,
            fontSize: '11px',
            fontWeight: '700',
            marginTop: '7px',
          }}
        >
          Open subject
        </div>
      </div>
    </button>
  )
}

function ExamGroupCard({
  group,
  onEdit,
  onDelete,
  onOpenSubject,
  onAddGroupPdf,
  onDeleteGroupPdf,
  onAskGroupPdfAI,
  pdfFeedback = null,
}) {
  const accent = group.subjects[0]?.color || '#22c55e'
  const [materialsOpen, setMaterialsOpen] = useState(true)

  return (
    <div
      style={{
        background: SURF2,
        border: `1px solid ${accent}24`,
        borderRadius: '20px',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        minHeight: '100%',
        boxShadow: `0 18px 42px ${accent}12`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: TEXT1,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '17px',
              fontWeight: '800',
              letterSpacing: '-0.3px',
            }}
          >
            {group.name}
          </div>
          <div
            style={{
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              marginTop: '4px',
            }}
          >
            {group.totalSubjects} subject{group.totalSubjects === 1 ? '' : 's'} grouped
          </div>
        </div>

        {(onEdit || onDelete) && (
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(group)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  border: `1px solid ${BORDER}`,
                  background: 'rgba(255,255,255,0.04)',
                  color: TEXT2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ width: '14px', height: '14px' }}><EditIcon /></span>
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(group)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  border: '1px solid rgba(239,68,68,0.2)',
                  background: 'rgba(239,68,68,0.08)',
                  color: '#fca5a5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ width: '14px', height: '14px' }}><TrashIcon /></span>
              </button>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
        }}
      >
        {group.subjects.map((subject) => (
          <SubjectJumpCard
            key={subject.id}
            subject={subject}
            onOpen={onOpenSubject}
          />
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-3"
          style={{
            padding: '12px 14px',
            borderRadius: '16px',
            background: `${accent}10`,
            border: `1px solid ${accent}22`,
          }}
        >
          <div>
            <div
              style={{
                color: TEXT1,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '14px',
                fontWeight: '800',
              }}
            >
              Group Study Materials
            </div>
            <div
              style={{
                color: TEXT3,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '11px',
                marginTop: '4px',
              }}
            >
              {group.totalPdfs} PDF{group.totalPdfs === 1 ? '' : 's'} for the full {group.name} group
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMaterialsOpen((previous) => !previous)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '34px',
              borderRadius: '10px',
              border: `1px solid ${accent}30`,
              background: `${accent}16`,
              color: accent,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              fontWeight: '700',
              padding: '0 12px',
            }}
          >
            {materialsOpen ? 'Hide PDFs' : 'Show PDFs'}
            <span
              style={{
                width: '14px',
                height: '14px',
                display: 'inline-flex',
                transform: materialsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.18s ease',
              }}
            >
              <ChevronDownIcon />
            </span>
          </button>
        </div>

        {materialsOpen && (
          <PdfPanel
            pdfs={group.pdfs || []}
            color={accent}
            onAdd={(file) => onAddGroupPdf?.(group, file)}
            onDelete={(pdfId) => onDeleteGroupPdf?.(group, pdfId)}
            onAskAI={(pdf) => onAskGroupPdfAI?.(group, pdf)}
            feedback={pdfFeedback}
            binaryContext={{ userId: group.userId || null, subjectId: getGroupPdfKnowledgeSubjectId(group.id) }}
            title="📄 Group Study Materials"
            helperText={`Upload PDFs once for the whole ${group.name} group.`}
            emptyTitle={`Upload PDFs for ${group.name}`}
            emptyDescription="Add syllabus PDFs, exam notes, PYQs, or important material for this entire exam group."
          />
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
        }}
      >
        <MetricChip label="Topics" value={formatValue(group.totalTopics)} />
        <MetricChip label="Total PDFs" value={formatValue(group.totalPdfs)} />
        <MetricChip label="Tests" value={formatValue(group.testsTaken)} />
        <MetricChip label="Avg Score" value={formatPercent(group.averageScore)} />
        <MetricChip
          label="AI Usage"
          value={formatValue(group.aiPracticeUsage)}
          helper="AI chats + solved Qs"
        />
        <MetricChip label="Questions" value={formatValue(group.questionsAttempted)} />
        <MetricChip label="Questions Solved" value={formatValue(group.aiQuestionsAttempted)} />
      </div>
    </div>
  )
}

export default function AnalyticsPage({
  user,
  subjects,
  onOpenSubject = null,
  onOpenAIContext = null,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [groupError, setGroupError] = useState('')
  const [isSavingGroup, setIsSavingGroup] = useState(false)
  const [groupPdfFeedback, setGroupPdfFeedback] = useState({})
  const {
    analytics,
    loading,
    error,
    isAuthenticated,
    saveExamGroup,
    removeExamGroup,
  } = useAnalyticsDashboard({ user, subjects })

  const handleOpenCreate = () => {
    setEditingGroup(null)
    setGroupError('')
    setIsModalOpen(true)
  }

  const handleOpenEdit = (group) => {
    setEditingGroup(group)
    setGroupError('')
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    if (isSavingGroup) return
    setEditingGroup(null)
    setGroupError('')
    setIsModalOpen(false)
  }

  const handleSubmitGroup = async (groupInput) => {
    setIsSavingGroup(true)
    setGroupError('')

    try {
      await saveExamGroup(groupInput)
      setIsModalOpen(false)
      setEditingGroup(null)
    } catch (saveError) {
      console.error('Failed to save exam group:', saveError)
      setGroupError(saveError?.message || 'Unable to save the exam group.')
    } finally {
      setIsSavingGroup(false)
    }
  }

  const setGroupPdfMessage = (groupId, feedback) => {
    setGroupPdfFeedback((previous) => ({
      ...previous,
      [groupId]: feedback,
    }))
  }

  const handleAddGroupPdf = async (group, file) => {
    if (!group?.id || !file || !user?.uid) return

    if (file.size > MAX_PDF_FILE_BYTES) {
      setGroupPdfMessage(group.id, {
        type: 'error',
        text: `PDF must be 20 MB or smaller. "${file.name}" is ${formatPdfSize(file.size)}.`,
      })
      return
    }

    const pdfId = uid()
    const knowledgeSubjectId = getGroupPdfKnowledgeSubjectId(group.id)
    let pendingPdfs = null

    try {
      setGroupPdfMessage(group.id, {
        type: 'info',
        text: `Uploading "${file.name}" for ${group.name}...`,
      })

      const { url, publicId, resourceType, format, version } = await uploadPdfToCloudinary({
        file,
        userId: user.uid,
        subjectId: `exam-group-${group.id}`,
        pdfId,
      })

      pendingPdfs = [
        ...(group.pdfs || []),
        {
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
        },
      ]

      await storePdfBinary({
        userId: user.uid,
        subjectId: knowledgeSubjectId,
        pdfId,
        file,
      }).catch((cacheError) => {
        console.warn('Failed to cache group PDF locally on this device:', cacheError)
      })

      await saveExamGroup({
        id: group.id,
        name: group.name,
        subjectIds: group.subjectIds,
        pdfs: pendingPdfs,
      })

      setGroupPdfMessage(group.id, {
        type: 'info',
        text: `Extracting AI knowledge for "${file.name}"...`,
      })

      const extracted = await extractPdfKnowledgeFromFile(file)
      const hasKnowledge = Boolean(
        extracted &&
        (
          String(extracted.summary || '').trim() ||
          (Array.isArray(extracted.chunks) && extracted.chunks.length > 0)
        )
      )

      if (!hasKnowledge) {
        await saveExamGroup({
          id: group.id,
          name: group.name,
          subjectIds: group.subjectIds,
          pdfs: pendingPdfs.map((pdf) => (
            pdf.id === pdfId
              ? {
                  ...pdf,
                  aiStatus: 'not-processed',
                }
              : pdf
          )),
        })

        setGroupPdfMessage(group.id, {
          type: 'error',
          text: 'PDF uploaded, but readable text could not be extracted for AI.',
        })
        return
      }

      await savePdfKnowledge({
        userId: user.uid,
        subjectId: knowledgeSubjectId,
        pdf: { id: pdfId, name: file.name },
        knowledge: extracted,
      })

      await saveExamGroup({
        id: group.id,
        name: group.name,
        subjectIds: group.subjectIds,
        pdfs: pendingPdfs.map((pdf) => (
          pdf.id === pdfId
            ? {
                ...pdf,
                aiStatus: 'ready',
                summary: extracted.summary || '',
                preview: extracted.preview || '',
                pageCount: Number.isFinite(extracted.pageCount) ? extracted.pageCount : 0,
                chunkCount: Array.isArray(extracted.chunks) ? extracted.chunks.length : 0,
                aiReadyAt: new Date().toISOString(),
              }
            : pdf
        )),
      })

      setGroupPdfMessage(group.id, {
        type: 'info',
        text: `"${file.name}" uploaded and AI is ready for ${group.name}.`,
      })
    } catch (error) {
      console.error('Failed to upload group PDF:', error)

      if (pendingPdfs) {
        await saveExamGroup({
          id: group.id,
          name: group.name,
          subjectIds: group.subjectIds,
          pdfs: pendingPdfs.map((pdf) => (
            pdf.id === pdfId
              ? {
                  ...pdf,
                  aiStatus: 'not-processed',
                }
              : pdf
          )),
        }).catch(() => {})
      }

      setGroupPdfMessage(group.id, {
        type: 'error',
        text: error?.message || 'Unable to upload this group PDF right now.',
      })
    }
  }

  const handleDeleteGroupPdf = async (group, pdfId) => {
    if (!group?.id || !pdfId || !user?.uid) return

    const pdfToDelete = (group.pdfs || []).find((pdf) => pdf.id === pdfId)
    const knowledgeSubjectId = getGroupPdfKnowledgeSubjectId(group.id)

    try {
      if (pdfToDelete?.publicId) {
        await deletePdfFromCloudinary({ publicId: pdfToDelete.publicId }).catch(() => {})
      }

      await saveExamGroup({
        id: group.id,
        name: group.name,
        subjectIds: group.subjectIds,
        pdfs: (group.pdfs || []).filter((pdf) => pdf.id !== pdfId),
      })

      await deletePdfKnowledge(user.uid, knowledgeSubjectId, pdfId).catch(() => {})
      await deletePdfBinary({
        userId: user.uid,
        subjectId: knowledgeSubjectId,
        pdfId,
      }).catch(() => {})

      setGroupPdfMessage(group.id, {
        type: 'info',
        text: 'Group PDF removed.',
      })
    } catch (error) {
      console.error('Failed to delete group PDF:', error)
      setGroupPdfMessage(group.id, {
        type: 'error',
        text: error?.message || 'Unable to remove this group PDF.',
      })
    }
  }

  const handleAskAIForGroupPdf = (group, pdf) => {
    if (!group?.id || !pdf?.id || !onOpenAIContext) return

    onOpenAIContext({
      subjectId: '',
      subjectName: '',
      pdfId: pdf.id,
      pdfName: pdf.name,
      pdfStatus: pdf.aiStatus || 'not-processed',
      pdfKnowledgeSubjectId: getGroupPdfKnowledgeSubjectId(group.id),
      pdfScopeLabel: `${group.name} group`,
      typedContext: `Use the attached PDF "${pdf.name}" as the main study source for the ${group.name} exam group.`,
    })
  }

  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`Delete "${group.name}"?`)) return

    setGroupError('')

    try {
      await Promise.allSettled(
        (group.pdfs || []).map(async (pdf) => {
          if (pdf?.publicId) {
            await deletePdfFromCloudinary({ publicId: pdf.publicId }).catch(() => {})
          }

          if (pdf?.id && user?.uid) {
            await deletePdfKnowledge(user.uid, getGroupPdfKnowledgeSubjectId(group.id), pdf.id).catch(() => {})
            await deletePdfBinary({
              userId: user.uid,
              subjectId: getGroupPdfKnowledgeSubjectId(group.id),
              pdfId: pdf.id,
            }).catch(() => {})
          }
        })
      )
      await removeExamGroup(group.id)
    } catch (deleteError) {
      console.error('Failed to delete exam group:', deleteError)
      setGroupError(deleteError?.message || 'Unable to delete the exam group.')
    }
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {(loading || error || groupError || !isAuthenticated) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading && (
            <div
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.03)',
                color: TEXT2,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                padding: '10px 12px',
              }}
            >
              Loading analytics from Firestore...
            </div>
          )}
          {error && (
            <div
              style={{
                border: '1px solid rgba(239,68,68,0.28)',
                borderRadius: '12px',
                background: 'rgba(239,68,68,0.08)',
                color: '#fca5a5',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                padding: '10px 12px',
              }}
            >
              {error}
            </div>
          )}
          {groupError && (
            <div
              style={{
                border: '1px solid rgba(239,68,68,0.28)',
                borderRadius: '12px',
                background: 'rgba(239,68,68,0.08)',
                color: '#fca5a5',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                padding: '10px 12px',
              }}
            >
              {groupError}
            </div>
          )}
          {!isAuthenticated && (
            <div
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: '12px',
                background: 'rgba(139,92,246,0.08)',
                color: TEXT2,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                padding: '10px 12px',
                lineHeight: 1.7,
              }}
            >
              Login to sync exam groups, streak history, test analytics, and AI activity across devices.
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <OverviewTile
          label="Current Streak"
          value={`${analytics.streak.currentStreak}d`}
          tone="#22c55e"
          icon={StreakIcon}
        />
        <OverviewTile
          label="Longest Streak"
          value={`${analytics.streak.longestStreak}d`}
          tone="#3b82f6"
          icon={TrophyIcon}
        />
        <OverviewTile
          label="Total Subjects"
          value={formatValue(analytics.overview.totalSubjects)}
          tone="#8b5cf6"
          icon={SubjectsIcon}
        />
        <OverviewTile
          label="Total Topics"
          value={formatValue(analytics.overview.totalTopics)}
          tone="#14b8a6"
          icon={TopicsIcon}
        />
        <OverviewTile
          label="Tests Taken"
          value={formatValue(analytics.overview.totalTestsTaken)}
          tone="#f59e0b"
          icon={TestsIcon}
        />
        <OverviewTile
          label="AI Questions Attempted"
          value={formatValue(analytics.overview.totalAIQuestionsAttempted)}
          tone="#06b6d4"
          icon={AIQuestionsIcon}
        />
      </div>

      <SectionCard
        title="Exam And Course Groups"
        subtitle="Create custom labels like GATE CSE or Semester 4 and roll up progress across multiple subjects."
        actions={
          isAuthenticated && subjects.length > 0 ? (
            <button
              type="button"
              onClick={handleOpenCreate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
                borderRadius: '12px',
                background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
                color: '#fff',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '800',
                padding: '11px 15px',
              }}
            >
              <span style={{ width: '14px', height: '14px' }}><PlusIcon /></span>
              New Group
            </button>
          ) : null
        }
      >
        {analytics.examGroups.length === 0 ? (
          <EmptyCard
            title="No exam groups yet"
            description={
              isAuthenticated
                ? 'Bundle related subjects into custom exams or courses so progress is visible at a higher level.'
                : 'Login to create named exam groups and keep them synced in Firestore.'
            }
            action={
              isAuthenticated && subjects.length > 0 ? (
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: '12px',
                    border: `1px solid ${BORDER}`,
                    background: 'rgba(255,255,255,0.04)',
                    color: TEXT2,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '13px',
                    fontWeight: '700',
                    padding: '10px 14px',
                  }}
                >
                  <span style={{ width: '14px', height: '14px' }}><PlusIcon /></span>
                  Create First Group
                </button>
              ) : null
            }
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {analytics.examGroups.map((group) => (
              <ExamGroupCard
                key={group.id}
                group={group}
                onEdit={isAuthenticated ? handleOpenEdit : null}
                onDelete={isAuthenticated ? handleDeleteGroup : null}
              onOpenSubject={onOpenSubject}
              onAddGroupPdf={isAuthenticated ? handleAddGroupPdf : null}
              onDeleteGroupPdf={isAuthenticated ? handleDeleteGroupPdf : null}
              onAskGroupPdfAI={isAuthenticated ? handleAskAIForGroupPdf : null}
              pdfFeedback={groupPdfFeedback[group.id] || null}
            />
          ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="AI Practice Snapshot"
          subtitle="Core AI metrics derived from generated mock tests and saved assistant interactions."
        >
          <div className="grid grid-cols-2 gap-3">
            <MetricChip label="Questions Generated" value={formatValue(analytics.aiPractice.totalQuestionsGenerated)} />
            <MetricChip label="Questions Attempted" value={formatValue(analytics.aiPractice.totalQuestionsAttempted)} />
            <MetricChip label="Mock Tests" value={formatValue(analytics.aiPractice.totalMockTestsCreated)} />
            <MetricChip label="Accuracy" value={formatPercent(analytics.aiPractice.accuracy)} />
          </div>

          <div style={{ marginTop: '18px' }}>
            <div
              style={{
                color: TEXT2,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                fontWeight: '700',
                marginBottom: '10px',
              }}
            >
              Most Practiced Subjects
            </div>
            {analytics.aiPractice.mostPracticedSubjects.length === 0 ? (
              <div
                style={{
                  border: `1px dashed ${BORDER}`,
                  borderRadius: '14px',
                  padding: '16px',
                  color: TEXT3,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '12px',
                }}
              >
                AI practice will appear here after you take mock tests or use the assistant with subject context.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {analytics.aiPractice.mostPracticedSubjects.map((subject) => (
                  <span
                    key={subject.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      borderRadius: '999px',
                      background: `${subject.color}16`,
                      border: `1px solid ${subject.color}32`,
                      color: '#f3edff',
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '12px',
                      fontWeight: '700',
                      padding: '8px 11px',
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: subject.color }} />
                    {subject.label}
                    <span style={{ color: TEXT3 }}>{formatValue(subject.value)} attempted</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Test Score Trend"
          subtitle="Recent test percentages across all AI-generated mock tests."
        >
          <LineChart
            data={analytics.performance.scoreTrend}
            color="#8b5cf6"
            valueSuffix="%"
            emptyLabel="Take a few tests to unlock your score trend."
          />
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="Average Score Per Subject"
          subtitle="Subject-wise performance to identify strong and weak areas quickly."
        >
          <RankBars
            data={analytics.performance.averageScoreBySubject}
            valueSuffix="%"
            emptyLabel="Subject score comparisons appear after completed tests."
          />
        </SectionCard>
        <SectionCard
          title="AI Questions Per Subject"
          subtitle="Attempted volume by subject, with generated count shown beneath each bar."
        >
          <RankBars
            data={analytics.aiPractice.questionsPerSubject}
            emptyLabel="Subject-level AI activity appears once mock tests or AI chats are saved."
          />
        </SectionCard>
      </div>

      <ExamGroupModal
        open={isModalOpen}
        onClose={handleCloseModal}
        subjects={subjects}
        initialGroup={editingGroup}
        onSubmit={handleSubmitGroup}
        isSaving={isSavingGroup}
      />
    </div>
  )
}
