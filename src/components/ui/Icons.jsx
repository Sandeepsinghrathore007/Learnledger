/**
 * Icons.jsx — Inline SVG icon library for Learnledger.
 *
 * All icons are functional components that render inline SVG.
 * They inherit size from parent via width/height, and colour via currentColor.
 *
 * Usage:
 *   import { PlusIcon, TrashIcon } from '@/components/ui/Icons'
 *   <span style={{ width: 14, height: 14 }}><PlusIcon /></span>
 */

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const PlusIcon = () => (
  <svg {...iconProps} strokeWidth="2.2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5"  y1="12" x2="19" y2="12" />
  </svg>
)

export const XIcon = () => (
  <svg {...iconProps} strokeWidth="2.2">
    <line x1="18" y1="6"  x2="6"  y2="18" />
    <line x1="6"  y1="6"  x2="18" y2="18" />
  </svg>
)

export const BackIcon = () => (
  <svg {...iconProps} strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

export const EditIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

export const TrashIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4h6v2" />
  </svg>
)

export const ChevronDownIcon = () => (
  <svg {...iconProps} strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

export const SearchIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

export const NoteIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

export const PdfIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

export const UploadIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
  </svg>
)

export const SaveIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
)

export const EyeIcon = () => (
  <svg {...iconProps} strokeWidth="1.8">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
