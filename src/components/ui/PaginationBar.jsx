import { BackIcon } from '@/components/ui/Icons'
import { BORDER, TEXT2, TEXT3 } from '@/constants/theme'

function buildPageNumbers(totalPages, currentPage) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = [1]
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)

  if (start > 2) pages.push('...')
  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }
  if (end < totalPages - 1) pages.push('...')
  pages.push(totalPages)

  return pages
}

export default function PaginationBar({
  page,
  totalPages,
  onPageChange,
  summaryText = null,
}) {
  if (totalPages <= 1) return null

  const pageNumbers = buildPageNumbers(totalPages, page)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        marginTop: '12px',
      }}
    >
      <span
        style={{
          color: TEXT3,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '12px',
        }}
      >
        {summaryText || `Page ${page} of ${totalPages}`}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            border: `1px solid ${BORDER}`,
            background: 'rgba(255,255,255,0.03)',
            color: TEXT2,
            cursor: page === 1 ? 'not-allowed' : 'pointer',
            opacity: page === 1 ? 0.38 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Previous page"
        >
          <span style={{ width: '11px', height: '11px', display: 'inline-flex' }}>
            <BackIcon />
          </span>
        </button>

        {pageNumbers.map((entry, index) => (
          typeof entry === 'number' ? (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              style={{
                minWidth: '30px',
                height: '30px',
                borderRadius: '8px',
                border: `1px solid ${page === entry ? 'var(--ll-accent-border)' : BORDER}`,
                background: page === entry ? 'var(--ll-accent-soft-strong)' : 'rgba(255,255,255,0.03)',
                color: page === entry ? 'var(--ll-accent)' : TEXT2,
                cursor: 'pointer',
                padding: '0 10px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12px',
                fontWeight: '700',
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
                fontSize: '12px',
                padding: '0 2px',
              }}
            >
              ...
            </span>
          )
        ))}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            border: `1px solid ${BORDER}`,
            background: 'rgba(255,255,255,0.03)',
            color: TEXT2,
            cursor: page === totalPages ? 'not-allowed' : 'pointer',
            opacity: page === totalPages ? 0.38 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Next page"
        >
          <span style={{ width: '11px', height: '11px', display: 'inline-flex', transform: 'rotate(180deg)' }}>
            <BackIcon />
          </span>
        </button>
      </div>
    </div>
  )
}
