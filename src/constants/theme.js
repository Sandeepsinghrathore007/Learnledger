/**
 * theme.js — Design system tokens for Learnledger.
 *
 * All colours, spacing, and visual constants live here.
 * Import from this file instead of hardcoding values in components.
 *
 * Usage:
 *   import { COLORS, ACCENT } from '@/constants/theme'
 */

// ── BACKGROUND & SURFACE ──────────────────────────────────────────────────────
export const BG      = '#070510'   // Page background (near-black)
export const SURFACE = '#0d0b1a'   // Card / panel surface
export const SURF2   = '#110f1f'   // Elevated surface (modals, dropdowns)

// ── BORDER ────────────────────────────────────────────────────────────────────
export const BORDER  = 'rgba(139,92,246,0.12)'  // Subtle border
export const BORDER2 = 'rgba(139,92,246,0.24)'  // Stronger border (focused)

// ── TEXT ──────────────────────────────────────────────────────────────────────
export const TEXT1 = '#ede6ff'   // Primary text
export const TEXT2 = '#9d8ec4'   // Secondary text
export const TEXT3 = '#5a5175'   // Muted / placeholder text

// ── ACCENT ────────────────────────────────────────────────────────────────────
export const ACCENT  = '#7c3aed'   // Primary purple
export const ACCENT2 = '#6d28d9'   // Darker purple (gradient end)

// ── SUBJECT PALETTE (12 accent colours for subject cards) ────────────────────
export const SUBJECT_COLORS = [
  '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4',
  '#10b981', '#84cc16', '#f59e0b', '#ef4444',
  '#f472b6', '#f97316', '#a855f7', '#14b8a6',
]

// ── SUBJECT ICONS (30 emoji/symbol options) ───────────────────────────────────
export const SUBJECT_ICONS = [
  { v: '∑',  l: 'Sigma'       }, { v: '⚛',  l: 'Atom'         },
  { v: '⚗',  l: 'Flask'       }, { v: '🧬',  l: 'DNA'          },
  { v: '🔭',  l: 'Telescope'  }, { v: '🧪',  l: 'Test Tube'    },
  { v: '📐',  l: 'Ruler'      }, { v: '∞',  l: 'Infinity'      },
  { v: 'π',  l: 'Pi'          }, { v: 'Δ',  l: 'Delta'         },
  { v: 'Ω',  l: 'Omega'       }, { v: '</>', l: 'Code'          },
  { v: '💻',  l: 'Laptop'     }, { v: '🤖',  l: 'AI'           },
  { v: '📖',  l: 'Book'       }, { v: '✍',  l: 'Write'         },
  { v: '🗺',  l: 'Map'        }, { v: '🏛',  l: 'Architecture'  },
  { v: '⚖',  l: 'Law'         }, { v: '🎵',  l: 'Music'        },
  { v: '🌍',  l: 'Earth'      }, { v: '💡',  l: 'Idea'          },
  { v: '🔬',  l: 'Microscope' }, { v: '📊',  l: 'Chart'        },
  { v: '🧠',  l: 'Brain'      }, { v: '⚡',  l: 'Electric'     },
  { v: '🔥',  l: 'Fire'       }, { v: '🌊',  l: 'Wave'         },
  { v: '🎯',  l: 'Target'     }, { v: '🧩',  l: 'Puzzle'       },
]

// ── AI SCORE THRESHOLDS ───────────────────────────────────────────────────────
export const AI_SCORE_BANDS = [
  { min: 85, label: 'Excellent',  color: '#10b981' },
  { min: 70, label: 'Good',       color: '#f59e0b' },
  { min: 50, label: 'Fair',       color: '#f97316' },
  { min:  0, label: 'Needs Work', color: '#ef4444' },
]
