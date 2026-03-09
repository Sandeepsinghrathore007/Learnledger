/**
 * navigation.js — Sidebar navigation configuration.
 *
 * Each entry maps a page id to its display label and emoji icon.
 * The 'comingSoon' flag controls whether the page shows a placeholder.
 */

export const NAV_ITEMS = [
  { id: 'subjects',  label: 'Subjects',     icon: '📚', comingSoon: false },
  { id: 'notes',     label: 'Notes',        icon: '📝', comingSoon: false },
  { id: 'questions', label: 'Mock Tests',   icon: '❓', comingSoon: false },
  { id: 'ai',        label: 'AI Assistant', icon: '🤖', comingSoon: false },
  { id: 'analytics', label: 'Analytics',    icon: '📈', comingSoon: false },
]

// Description text for coming-soon placeholder pages
export const PAGE_DESCRIPTIONS = {
  analytics: 'Track streaks, performance, and AI-driven study progress',
  notes:     'Your notes across all subjects in one place',
  questions: 'AI-generated MCQs from your notes',
  ai:        'Generate questions, summaries, and study plans',
}
