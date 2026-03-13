/**
 * navigation.js — Sidebar navigation configuration.
 *
 * Each entry maps a page id to its display label and shared icon key.
 * The 'comingSoon' flag controls whether the page shows a placeholder.
 */

export const NAV_ITEMS = [
  {
    id: 'subjects',
    label: 'Subjects',
    icon: 'subjects',
    iconColor: '#38bdf8',
    iconBg: 'rgba(56,189,248,0.14)',
    iconBorder: 'rgba(56,189,248,0.28)',
    comingSoon: false,
  },
  {
    id: 'questions',
    label: 'Mock Tests',
    icon: 'tests',
    iconColor: '#fb7185',
    iconBg: 'rgba(251,113,133,0.14)',
    iconBorder: 'rgba(251,113,133,0.28)',
    comingSoon: false,
  },
  {
    id: 'ai',
    label: 'AI Assistant',
    icon: 'ai',
    iconColor: '#a78bfa',
    iconBg: 'rgba(167,139,250,0.16)',
    iconBorder: 'rgba(167,139,250,0.28)',
    comingSoon: false,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: 'analytics',
    iconColor: '#34d399',
    iconBg: 'rgba(52,211,153,0.14)',
    iconBorder: 'rgba(52,211,153,0.28)',
    comingSoon: false,
  },
]

// Description text for coming-soon placeholder pages
export const PAGE_DESCRIPTIONS = {
  analytics: 'Track streaks, performance, and AI-driven study progress',
  questions: 'AI-generated MCQs from your notes',
  ai:        'Generate questions, summaries, and study plans',
}
