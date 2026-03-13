export default function InlineNoteSlashMenu({ open, top, left, onInsert }) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 18,
        width: '220px',
        background: '#110d1f',
        border: '1px solid rgba(124,58,237,0.18)',
        borderRadius: '10px',
        boxShadow: '0 18px 40px rgba(0,0,0,0.42)',
        padding: '6px',
      }}
    >
      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault()
          onInsert()
        }}
        style={{
          width: '100%',
          border: 'none',
          background: 'rgba(124,58,237,0.12)',
          borderRadius: '8px',
          padding: '9px 10px',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            color: '#ede6ff',
            fontSize: '12px',
            fontWeight: '600',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          /note
        </div>
        <div
          style={{
            marginTop: '3px',
            color: '#9d8ec4',
            fontSize: '10.5px',
            lineHeight: 1.45,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Insert a Notion-style inline note block. Press Enter to use.
        </div>
      </button>
    </div>
  )
}
