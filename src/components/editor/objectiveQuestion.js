/**
 * objectiveQuestion.js
 *
 * Shared command helpers for inserting an objective-question (MCQ) template.
 */

const DEFAULT_QUESTION = 'Write your question here'
const DEFAULT_OPTIONS = ['Option A', 'Option B', 'Option C', 'Option D']
const OPTION_LABELS = ['A', 'B', 'C', 'D']

const MCQ_COLORS = {
  title: '#fbbf24',          // Amber
  questionPrefix: '#fca5a5', // Rose
  questionText: '#f1f5f9',   // Slate-100
  optionPrefix: '#60a5fa',   // Blue
  optionText: '#dbeafe',     // Blue-100
  answerLabel: '#34d399',    // Emerald
  answerText: '#ecfeff',     // Cyan-50
  explanationLabel: '#c4b5fd', // Violet-300
  explanationText: '#ede9fe',  // Violet-100
}

function createTextNode(text, { color, bold = false } = {}) {
  const marks = []

  if (color) marks.push({ type: 'textColor', attrs: { color } })
  if (bold) marks.push({ type: 'bold' })

  return marks.length > 0 ? { type: 'text', text, marks } : { type: 'text', text }
}

function createOptionParagraph(label, optionText) {
  return {
    type: 'paragraph',
    content: [
      createTextNode(`Option ${label} ) `, { color: MCQ_COLORS.optionPrefix, bold: true }),
      createTextNode(optionText, { color: MCQ_COLORS.optionText }),
    ],
  }
}

function buildOptionLines() {
  return OPTION_LABELS.map((label, index) =>
    createOptionParagraph(label, DEFAULT_OPTIONS[index])
  )
}

export function canInsertObjectiveQuestion(editor) {
  if (!editor) return false

  return editor
    .can()
    .chain()
    .focus()
    .insertContent({ type: 'paragraph', content: [{ type: 'text', text: 'Q.' }] })
    .run()
}

export function insertObjectiveQuestionTemplate(editor) {
  if (!editor) return false

  const { from, to } = editor.state.selection
  const selectedText = editor.state.doc.textBetween(from, to, ' ').trim()
  const questionText = selectedText || DEFAULT_QUESTION

  return editor
    .chain()
    .focus()
    .insertContent([
      {
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: [
              createTextNode('Objective Question', { color: MCQ_COLORS.title, bold: true }),
            ],
          },
          {
            type: 'paragraph',
            content: [
              createTextNode('Q ) ', { color: MCQ_COLORS.questionPrefix, bold: true }),
              createTextNode(questionText, { color: MCQ_COLORS.questionText }),
            ],
          },
        ],
      },
      ...buildOptionLines(),
      {
        type: 'paragraph',
        content: [
          createTextNode('Correct Answer: ', { color: MCQ_COLORS.answerLabel, bold: true }),
          createTextNode('Option A', { color: MCQ_COLORS.answerText }),
        ],
      },
      {
        type: 'paragraph',
        content: [
          createTextNode('Explanation: ', { color: MCQ_COLORS.explanationLabel, bold: true }),
          createTextNode('Add a short explanation.', { color: MCQ_COLORS.explanationText }),
        ],
      },
      { type: 'paragraph' },
    ])
    .run()
}
