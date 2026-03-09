/**
 * seedData.js — Demo subjects pre-loaded into the app on first run.
 *
 * In a real app this would be replaced by Firestore / API data.
 * Kept separate from constants so it can be swapped out cleanly.
 */

export const SEED_SUBJECTS = [
  {
    id: 's1',
    name: 'Mathematics',
    icon: '∑',
    color: '#8b5cf6',
    description: 'Calculus, Algebra, Statistics & Discrete Math',
    aiScore: 78,
    testsAttempted: 4,
    pdfs: [],
    topics: [
      {
        id: 't1',
        name: 'Calculus',
        questionsCount: 24,
        notes: [
          {
            id: 'n1',
            title: 'Limits & Continuity',
            blocks: [
              { id: 'b1', type: 'h1',     text: 'Limits & Continuity' },
              { id: 'b2', type: 'p',      text: 'A limit describes the value a function approaches as input approaches a point.\n\nlim(x→a) f(x) = L means f(x) gets arbitrarily close to L as x → a.' },
              { id: 'b3', type: 'h2',     text: 'Key Theorems' },
              { id: 'b4', type: 'callout',text: '💡 Continuity at a point requires: f(a) exists, limit exists, and they are equal.' },
            ],
            tags: [],
            isFavorite: true,
            isPinned: true,
            linkedNotes: [], // Array of note IDs this note links to
            createdAt: '2024-03-01T10:00:00Z',
            updatedAt: '2024-03-05T14:30:00Z',
            lastOpenedAt: '2024-03-07T08:15:00Z',
          },
          {
            id: 'n2',
            title: 'अवकलन के नियम (Differentiation)',
            blocks: [
              { id: 'b5', type: 'h1', text: 'अवकलन के नियम' },
              { id: 'b6', type: 'p',  text: "घात नियम (Power Rule): d/dx[xⁿ] = nxⁿ⁻¹\n\nगुणन नियम (Product Rule): d/dx[uv] = u'v + uv'\n\nयह नियम बहुत महत्वपूर्ण हैं।" },
              { id: 'b7', type: 'code', text: '// Chain Rule Example\nf(x) = sin(x²)\nf\'(x) = cos(x²) · 2x' },
            ],
            tags: [],
            isFavorite: false,
            isPinned: false,
            linkedNotes: ['n1'], // Links to Limits & Continuity note
            createdAt: '2024-03-02T11:30:00Z',
            updatedAt: '2024-03-06T16:45:00Z',
            lastOpenedAt: '2024-03-06T16:45:00Z',
          },
        ],
      },
      {
        id: 't2',
        name: 'Linear Algebra',
        questionsCount: 12,
        notes: [
          {
            id: 'n3',
            title: 'Eigenvalues & Eigenvectors',
            blocks: [
              { id: 'b8',  type: 'h1',     text: 'Eigenvalues & Eigenvectors' },
              { id: 'b9',  type: 'p',      text: 'For a square matrix A, λ is an eigenvalue if Av = λv for non-zero vector v.' },
              { id: 'b10', type: 'callout',text: '📌 Find eigenvalues: det(A − λI) = 0' },
            ],
            tags: [],
            isFavorite: false,
            isPinned: false,
            linkedNotes: [],
            createdAt: '2024-02-28T09:00:00Z',
            updatedAt: '2024-03-04T12:20:00Z',
            lastOpenedAt: '2024-03-04T12:20:00Z',
          },
        ],
      },
    ],
  },
  {
    id: 's2',
    name: 'Physics',
    icon: '⚛',
    color: '#3b82f6',
    description: 'Classical Mechanics, Thermodynamics & EM',
    aiScore: 62,
    testsAttempted: 2,
    pdfs: [],
    topics: [
      {
        id: 't3',
        name: 'Classical Mechanics',
        questionsCount: 18,
        notes: [
          {
            id: 'n4',
            title: "Newton's Laws",
            blocks: [
              { id: 'b11', type: 'h1',     text: "Newton's Three Laws of Motion" },
              { id: 'b12', type: 'p',      text: '1st Law: Object remains at rest or uniform motion unless acted on by net force.\n\n2nd Law: F = ma\n\n3rd Law: Every action has equal and opposite reaction.' },
              { id: 'b13', type: 'callout',text: '⚡ F is always the NET force — never a single component.' },
            ],
            tags: [],
            isFavorite: true,
            isPinned: false,
            linkedNotes: [],
            createdAt: '2024-03-03T14:00:00Z',
            updatedAt: '2024-03-07T10:15:00Z',
            lastOpenedAt: '2024-03-07T17:30:00Z',
          },
        ],
      },
    ],
  },
  {
    id: 's3',
    name: 'Computer Science',
    icon: '</>',
    color: '#10b981',
    description: 'Algorithms, Data Structures & System Design',
    aiScore: 91,
    testsAttempted: 7,
    pdfs: [],
    topics: [
      {
        id: 't4',
        name: 'Data Structures',
        questionsCount: 32,
        notes: [
          {
            id: 'n5',
            title: 'Binary Search Trees',
            blocks: [
              { id: 'b14', type: 'h1',  text: 'Binary Search Trees' },
              { id: 'b15', type: 'p',   text: 'BST: left child < parent < right child for every node.\n\nOperations: Search O(h), Insert O(h), Delete O(h)' },
              { id: 'b16', type: 'code',text: 'class Node:\n    def __init__(self, val):\n        self.val = val\n        self.left = self.right = None' },
            ],
            tags: [],
            isFavorite: false,
            isPinned: false,
            linkedNotes: [],
            createdAt: '2024-02-29T13:45:00Z',
            updatedAt: '2024-03-06T09:30:00Z',
            lastOpenedAt: '2024-03-07T11:00:00Z',
          },
        ],
      },
    ],
  },
  {
    id: 's4',
    name: 'Chemistry',
    icon: '⚗',
    color: '#f472b6',
    description: 'Organic, Inorganic & Physical Chemistry',
    aiScore: null,
    testsAttempted: 0,
    pdfs: [],
    topics: [
      {
        id: 't5',
        name: 'Organic Chemistry',
        questionsCount: 14,
        notes: [
          {
            id: 'n6',
            title: 'Functional Groups',
            blocks: [
              { id: 'b17', type: 'h1', text: 'Functional Groups' },
              { id: 'b18', type: 'p',  text: 'Functional groups determine chemical reactions:\n-OH (hydroxyl), C=O (carbonyl), -COOH (carboxyl), -NH₂ (amino)' },
            ],
            tags: [],
            isFavorite: false,
            isPinned: false,
            linkedNotes: [],
            createdAt: '2024-03-04T15:20:00Z',
            updatedAt: '2024-03-04T15:20:00Z',
            lastOpenedAt: '2024-03-04T15:20:00Z',
          },
        ],
      },
    ],
  },
]
