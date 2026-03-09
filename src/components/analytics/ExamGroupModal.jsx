import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'

const EMPTY_FORM = {
  name: '',
  subjectIds: [],
}

export default function ExamGroupModal({
  open,
  onClose,
  subjects,
  initialGroup = null,
  onSubmit,
  isSaving = false,
}) {
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (!open) return

    setForm(
      initialGroup
        ? {
            name: initialGroup.name || '',
            subjectIds: Array.isArray(initialGroup.subjectIds) ? initialGroup.subjectIds : [],
          }
        : EMPTY_FORM
    )
  }, [initialGroup, open])

  const toggleSubject = (subjectId) => {
    setForm((previous) => ({
      ...previous,
      subjectIds: previous.subjectIds.includes(subjectId)
        ? previous.subjectIds.filter((value) => value !== subjectId)
        : [...previous.subjectIds, subjectId],
    }))
  }

  const handleClose = () => {
    if (isSaving) return
    onClose()
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || form.subjectIds.length === 0 || isSaving) return

    await onSubmit({
      id: initialGroup?.id,
      name: form.name.trim(),
      subjectIds: form.subjectIds,
    })
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={initialGroup ? 'Edit Exam Group' : 'Create Exam Group'}
      width={640}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <label
            htmlFor="exam-group-name"
            style={{
              display: 'block',
              color: TEXT2,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              fontWeight: '700',
              marginBottom: '8px',
            }}
          >
            Group Name
          </label>
          <input
            id="exam-group-name"
            className="learnledger-input"
            value={form.name}
            onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
            placeholder="e.g. GATE CSE, Semester 4, DSA Preparation"
            autoFocus
          />
        </div>

        <div>
          <div
            style={{
              color: TEXT2,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              fontWeight: '700',
              marginBottom: '10px',
            }}
          >
            Included Subjects
          </div>

          {subjects.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${BORDER}`,
                borderRadius: '14px',
                padding: '22px',
                color: TEXT3,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                textAlign: 'center',
              }}
            >
              Create subjects first, then group them here.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '10px',
              }}
            >
              {subjects.map((subject) => {
                const isSelected = form.subjectIds.includes(subject.id)

                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => toggleSubject(subject.id)}
                    style={{
                      textAlign: 'left',
                      padding: '14px',
                      borderRadius: '14px',
                      border: `1px solid ${isSelected ? `${subject.color}55` : BORDER}`,
                      background: isSelected ? `${subject.color}16` : 'rgba(255,255,255,0.025)',
                      transition: 'all 0.16s',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '10px',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            color: TEXT1,
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '13px',
                            fontWeight: '700',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {subject.icon} {subject.name}
                        </div>
                        <div
                          style={{
                            color: TEXT3,
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '11px',
                            marginTop: '3px',
                          }}
                        >
                          {subject.topics.length} topics
                        </div>
                      </div>
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: `2px solid ${isSelected ? subject.color : 'rgba(255,255,255,0.16)'}`,
                          background: isSelected ? subject.color : 'transparent',
                          boxShadow: isSelected ? `0 0 18px ${subject.color}35` : 'none',
                          flexShrink: 0,
                        }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            paddingTop: '4px',
          }}
        >
          <div
            style={{
              color: TEXT3,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
            }}
          >
            {form.subjectIds.length} subject{form.subjectIds.length === 1 ? '' : 's'} selected
          </div>

          <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.04)',
                color: TEXT2,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '700',
                padding: '10px 14px',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!form.name.trim() || form.subjectIds.length === 0 || isSaving}
              style={{
                border: 'none',
                borderRadius: '10px',
                background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
                color: '#fff',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                fontWeight: '800',
                padding: '10px 16px',
                opacity: !form.name.trim() || form.subjectIds.length === 0 || isSaving ? 0.5 : 1,
              }}
            >
              {isSaving ? 'Saving...' : initialGroup ? 'Update Group' : 'Create Group'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
