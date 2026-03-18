/**
 * theme.js — Design system tokens and app theme presets for Learnledger.
 *
 * The exported visual tokens below intentionally point at CSS variables so
 * existing inline styles can react to runtime theme switches without each
 * component needing its own refactor.
 */

export const THEME_STORAGE_KEY = 'learnledger-theme'
export const DEFAULT_THEME_ID = 'neo-dark'

export const APP_THEME_OPTIONS = [
  {
    id: 'neo-dark',
    label: 'Neo Dark',
    shortLabel: 'Neo',
    description: 'Clean + premium SaaS',
  },
  {
    id: 'glass-dark',
    label: 'Glass Dark',
    shortLabel: 'Glass',
    description: 'Modern frosted glass',
  },
  {
    id: 'minimal-dark',
    label: 'Minimal Dark',
    shortLabel: 'Minimal',
    description: 'Linear-style focus mode',
  },
]

export const APP_THEMES = {
  'neo-dark': {
    id: 'neo-dark',
    tokens: {
      'page-background': 'radial-gradient(circle at top right, rgba(6,182,212,0.10), transparent 24%), radial-gradient(circle at top left, rgba(124,58,237,0.14), transparent 26%), #0B0F1A',
      bg: '#0B0F1A',
      surface: '#111827',
      'surface-2': '#0F172A',
      border: 'rgba(148,163,184,0.18)',
      'border-strong': 'rgba(124,58,237,0.34)',
      'text-1': '#E5E7EB',
      'text-2': '#CBD5E1',
      'text-3': '#9CA3AF',
      accent: '#7C3AED',
      'accent-2': '#06B6D4',
      secondary: '#06B6D4',
      'accent-soft': 'rgba(124,58,237,0.14)',
      'accent-soft-strong': 'rgba(124,58,237,0.24)',
      'accent-border': 'rgba(124,58,237,0.36)',
      'topbar-bg': 'rgba(11,15,26,0.86)',
      'control-bg': 'rgba(255,255,255,0.035)',
      'control-border': 'rgba(148,163,184,0.18)',
      'button-gradient': 'linear-gradient(135deg, #7C3AED, #06B6D4)',
      'selection-bg': 'rgba(124,58,237,0.36)',
      'shadow-soft': '0 18px 40px rgba(2,6,23,0.26)',
    },
  },
  'glass-dark': {
    id: 'glass-dark',
    tokens: {
      'page-background': 'radial-gradient(circle at top right, rgba(139,92,246,0.22), transparent 24%), radial-gradient(circle at top left, rgba(56,189,248,0.16), transparent 22%), #050816',
      bg: '#050816',
      surface: 'rgba(255,255,255,0.05)',
      'surface-2': 'rgba(15,23,42,0.72)',
      border: 'rgba(255,255,255,0.10)',
      'border-strong': 'rgba(139,92,246,0.26)',
      'text-1': '#F8FAFC',
      'text-2': '#D8DEF7',
      'text-3': '#94A3B8',
      accent: '#8B5CF6',
      'accent-2': '#38BDF8',
      secondary: '#38BDF8',
      'accent-soft': 'rgba(139,92,246,0.14)',
      'accent-soft-strong': 'rgba(139,92,246,0.22)',
      'accent-border': 'rgba(139,92,246,0.34)',
      'topbar-bg': 'rgba(5,8,22,0.72)',
      'control-bg': 'rgba(255,255,255,0.04)',
      'control-border': 'rgba(255,255,255,0.12)',
      'button-gradient': 'linear-gradient(135deg, rgba(139,92,246,0.95), rgba(56,189,248,0.95))',
      'selection-bg': 'rgba(139,92,246,0.34)',
      'shadow-soft': '0 20px 50px rgba(2,6,23,0.24)',
    },
  },
  'minimal-dark': {
    id: 'minimal-dark',
    tokens: {
      'page-background': '#0A0A0A',
      bg: '#0A0A0A',
      surface: '#111111',
      'surface-2': '#161616',
      border: '#1F2937',
      'border-strong': '#374151',
      'text-1': '#F9FAFB',
      'text-2': '#D1D5DB',
      'text-3': '#9CA3AF',
      accent: '#6366F1',
      'accent-2': '#4F46E5',
      secondary: '#818CF8',
      'accent-soft': 'rgba(99,102,241,0.12)',
      'accent-soft-strong': 'rgba(99,102,241,0.18)',
      'accent-border': 'rgba(99,102,241,0.32)',
      'topbar-bg': 'rgba(10,10,10,0.92)',
      'control-bg': 'rgba(255,255,255,0.03)',
      'control-border': 'rgba(31,41,55,0.9)',
      'button-gradient': 'linear-gradient(135deg, #6366F1, #4F46E5)',
      'selection-bg': 'rgba(99,102,241,0.32)',
      'shadow-soft': '0 10px 20px rgba(0,0,0,0.14)',
    },
  },
}

export function getAppTheme(themeId = DEFAULT_THEME_ID) {
  return APP_THEMES[themeId] || APP_THEMES[DEFAULT_THEME_ID]
}

export function readStoredAppThemeId() {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID

  const storedThemeId = window.localStorage.getItem(THEME_STORAGE_KEY)
  return APP_THEMES[storedThemeId] ? storedThemeId : DEFAULT_THEME_ID
}

export function applyAppTheme(themeId = DEFAULT_THEME_ID) {
  const theme = getAppTheme(themeId)

  if (typeof document === 'undefined') {
    return theme
  }

  const root = document.documentElement
  root.dataset.appTheme = theme.id

  Object.entries(theme.tokens).forEach(([token, value]) => {
    root.style.setProperty(`--ll-${token}`, value)
  })

  return theme
}

// ── BACKGROUND & SURFACE ──────────────────────────────────────────────────────
export const BG = 'var(--ll-bg)'
export const SURFACE = 'var(--ll-surface)'
export const SURF2 = 'var(--ll-surface-2)'

// ── BORDER ────────────────────────────────────────────────────────────────────
export const BORDER = 'var(--ll-border)'
export const BORDER2 = 'var(--ll-border-strong)'

// ── TEXT ──────────────────────────────────────────────────────────────────────
export const TEXT1 = 'var(--ll-text-1)'
export const TEXT2 = 'var(--ll-text-2)'
export const TEXT3 = 'var(--ll-text-3)'

// ── ACCENT ────────────────────────────────────────────────────────────────────
export const ACCENT = 'var(--ll-accent)'
export const ACCENT2 = 'var(--ll-accent-2)'
export const SECONDARY = 'var(--ll-secondary)'
export const ACCENT_SOFT = 'var(--ll-accent-soft)'
export const ACCENT_SOFT_STRONG = 'var(--ll-accent-soft-strong)'
export const ACCENT_BORDER = 'var(--ll-accent-border)'
export const TOPBAR_BG = 'var(--ll-topbar-bg)'
export const CONTROL_BG = 'var(--ll-control-bg)'
export const CONTROL_BORDER = 'var(--ll-control-border)'
export const BUTTON_GRADIENT = 'var(--ll-button-gradient)'
export const SHADOW_SOFT = 'var(--ll-shadow-soft)'

// ── SUBJECT PALETTE (12 accent colours for subject cards) ────────────────────
export const SUBJECT_COLORS = [
  '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4',
  '#10b981', '#84cc16', '#f59e0b', '#ef4444',
  '#f472b6', '#f97316', '#a855f7', '#14b8a6',
]

// ── SUBJECT ICONS (30 emoji/symbol options) ───────────────────────────────────
export const SUBJECT_ICONS = [
  { v: '∑', l: 'Sigma' }, { v: '⚛', l: 'Atom' },
  { v: '⚗', l: 'Flask' }, { v: '🧬', l: 'DNA' },
  { v: '🔭', l: 'Telescope' }, { v: '🧪', l: 'Test Tube' },
  { v: '📐', l: 'Ruler' }, { v: '∞', l: 'Infinity' },
  { v: 'π', l: 'Pi' }, { v: 'Δ', l: 'Delta' },
  { v: 'Ω', l: 'Omega' }, { v: '</>', l: 'Code' },
  { v: '💻', l: 'Laptop' }, { v: '🤖', l: 'AI' },
  { v: '📖', l: 'Book' }, { v: '✍', l: 'Write' },
  { v: '🗺', l: 'Map' }, { v: '🏛', l: 'Architecture' },
  { v: '⚖', l: 'Law' }, { v: '🎵', l: 'Music' },
  { v: '🌍', l: 'Earth' }, { v: '💡', l: 'Idea' },
  { v: '🔬', l: 'Microscope' }, { v: '📊', l: 'Chart' },
  { v: '🧠', l: 'Brain' }, { v: '⚡', l: 'Electric' },
  { v: '🔥', l: 'Fire' }, { v: '🌊', l: 'Wave' },
  { v: '🎯', l: 'Target' }, { v: '🧩', l: 'Puzzle' },
]

// ── AI SCORE THRESHOLDS ───────────────────────────────────────────────────────
export const AI_SCORE_BANDS = [
  { min: 85, label: 'Excellent', color: '#10b981' },
  { min: 70, label: 'Good', color: '#f59e0b' },
  { min: 50, label: 'Fair', color: '#f97316' },
  { min: 0, label: 'Needs Work', color: '#ef4444' },
]
