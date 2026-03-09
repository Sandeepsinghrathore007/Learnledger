/**
 * SubjectFormModal.jsx — Modal form for creating or editing a subject.
 *
 * Used for both "Create Subject" and "Edit Subject" actions.
 * The mode is inferred from the presence of the editTarget prop.
 *
 * Props:
 *   open        {boolean}        — Whether modal is visible
 *   onClose     {Function}       — Close modal
 *   form        {Object}         — { name, description, icon, color }
 *   setFormField{Function}       — (field, value) update one form field
 *   onSubmit    {Function}       — Called when form is confirmed
 *   isEdit      {boolean}        — true = editing, false = creating
 *
 * State: none (fully controlled by parent via form + setFormField)
 */

import Modal       from '@/components/ui/Modal'
import FormField   from '@/components/ui/FormField'
import IconPicker  from '@/components/ui/IconPicker'
import ColorPicker from '@/components/ui/ColorPicker'
import { ACCENT, ACCENT2, TEXT3 } from '@/constants/theme'

export default function SubjectFormModal({
  open, onClose, form, setFormField, onSubmit, isEdit = false,
}) {
  const canSubmit = form.name.trim().length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Subject' : 'Create Subject'}
    >
      <FormField
        label="Name"
        value={form.name}
        onChange={(v) => setFormField('name', v)}
        placeholder="e.g. Mathematics…"
      />
      <FormField
        label="Description"
        value={form.description}
        onChange={(v) => setFormField('description', v)}
        placeholder="Short description"
      />
      <IconPicker
        value={form.icon}
        onChange={(v) => setFormField('icon', v)}
      />
      <ColorPicker
        value={form.color}
        onChange={(v) => setFormField('color', v)}
      />

      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        style={{
          width: '100%', padding: '12px',
          background: canSubmit
            ? `linear-gradient(135deg,${ACCENT},${ACCENT2})`
            : 'rgba(139,92,246,0.08)',
          border: 'none', borderRadius: '11px',
          color: canSubmit ? '#fff' : TEXT3,
          fontWeight: '700', fontSize: '14px',
          fontFamily: "'DM Sans',sans-serif",
          transition: 'all 0.2s',
        }}
      >
        {isEdit ? 'Save Changes' : 'Create Subject'}
      </button>
    </Modal>
  )
}
