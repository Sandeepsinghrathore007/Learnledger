import { parseQuestionsFromTextWithStats } from '@/utils/manualQuestionParser'

function toOptionObject(options = []) {
  return (Array.isArray(options) ? options : []).reduce((accumulator, option) => {
    const optionId = String(option?.id || '').trim().toUpperCase()
    const optionText = String(option?.text || '').trim()

    if (optionId && optionText) {
      accumulator[optionId] = optionText
    }

    return accumulator
  }, {})
}

export function parseManualQuestionsWithStats(rawText) {
  const parseResult = parseQuestionsFromTextWithStats(rawText)
  const completeQuestions = (Array.isArray(parseResult?.questions) ? parseResult.questions : [])
    .filter((question) => Array.isArray(question?.options) && question.options.length >= 4)
    .map((question) => ({
      question: String(question?.question || '').trim(),
      options: toOptionObject(question.options),
      sourceQuestion: String(question?.sourceQuestion || question?.question || '').trim(),
    }))
    .filter((question) => (
      question.question
      && ['A', 'B', 'C', 'D'].every((optionId) => String(question.options?.[optionId] || '').trim())
    ))

  const rejectedIncompleteQuestions = Math.max(
    0,
    Number(parseResult?.parsedQuestions || 0) - completeQuestions.length
  )

  return {
    questions: completeQuestions,
    totalBlocks: Number(parseResult?.totalBlocks || 0),
    parsedQuestions: completeQuestions.length,
    skippedBlocks: Number(parseResult?.skippedBlocks || 0) + rejectedIncompleteQuestions,
    skippedMatchTypeQuestions: Number(parseResult?.skippedMatchTypeQuestions || 0),
    rejectedIncompleteQuestions,
  }
}

export function parseManualQuestions(rawText) {
  return parseManualQuestionsWithStats(rawText).questions
}
