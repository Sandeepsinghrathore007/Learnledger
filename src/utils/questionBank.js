import { uid } from '@/utils/id'

const DEFAULT_SOURCE_LABELS = {
  manual: 'Manual Entry',
  generated: 'AI Mock Test',
}

function toSafeString(value) {
  return String(value || '').trim()
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : []
}

export function normalizeQuestionBankItem(item, defaults = {}) {
  const now = new Date().toISOString()
  const sourceType = item?.sourceType === 'generated' ? 'generated' : 'manual'

  return {
    id: item?.id || uid(),
    question: toSafeString(item?.question),
    answer: toSafeString(item?.answer),
    explanation: toSafeString(item?.explanation),
    subjectId: item?.subjectId || defaults.subjectId || null,
    topicId: item?.topicId || null,
    topicName: toSafeString(item?.topicName),
    noteId: item?.noteId || null,
    sourceType,
    sourceLabel: toSafeString(item?.sourceLabel) || DEFAULT_SOURCE_LABELS[sourceType],
    testId: item?.testId || null,
    testTitle: toSafeString(item?.testTitle),
    questionNumber: Number.isFinite(item?.questionNumber) ? item.questionNumber : null,
    createdAt: item?.createdAt || now,
    updatedAt: item?.updatedAt || item?.createdAt || now,
  }
}

export function normalizeQuestionBank(items, defaults = {}) {
  return toSafeArray(items)
    .map((item) => normalizeQuestionBankItem(item, defaults))
    .filter((item) => item.question)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
}

export function mergeQuestionBankItems(existingItems, incomingItems, defaults = {}) {
  const merged = new Map()

  normalizeQuestionBank(existingItems, defaults).forEach((item) => {
    merged.set(item.id, item)
  })

  normalizeQuestionBank(incomingItems, defaults).forEach((item) => {
    merged.set(item.id, item)
  })

  return [...merged.values()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
}

export function createManualQuestionBankItem({
  subjectId,
  question,
  answer,
  explanation,
  topicId = null,
  topicName = '',
}) {
  return normalizeQuestionBankItem({
    id: uid(),
    question,
    answer,
    explanation,
    subjectId,
    topicId,
    topicName,
    sourceType: 'manual',
    sourceLabel: DEFAULT_SOURCE_LABELS.manual,
  }, { subjectId })
}

function resolveGeneratedAnswer(question) {
  const options = toSafeArray(question?.options)
  const correctAnswerId = toSafeString(question?.correctAnswer).toLowerCase()

  const matchingOption = options.find((option) => toSafeString(option?.id).toLowerCase() === correctAnswerId)
  if (matchingOption?.text) return toSafeString(matchingOption.text)

  return toSafeString(question?.correctAnswer)
}

export function createGeneratedQuestionBankItems({ subject, test, questions = null }) {
  const testQuestions = toSafeArray(questions ?? test?.questions)
  const createdAt = test?.createdAt || new Date().toISOString()
  const sourceLabel = test?.config?.scope === 'selection' ? 'Selection Test' : DEFAULT_SOURCE_LABELS.generated

  return testQuestions
    .map((question, index) => normalizeQuestionBankItem({
      id: `qb-${test?.id || 'test'}-${subject.id}-${question?.id || index + 1}`,
      question: question?.question,
      answer: resolveGeneratedAnswer(question),
      explanation: question?.explanation,
      subjectId: subject.id,
      topicId: question?.sourceTopic || null,
      topicName: question?.topicName || '',
      sourceType: 'generated',
      sourceLabel,
      testId: test?.id || null,
      testTitle: test?.title || '',
      questionNumber: Number.isFinite(question?.questionNumber) ? question.questionNumber : index + 1,
      createdAt,
      updatedAt: createdAt,
    }, { subjectId: subject.id }))
    .filter((item) => item.question)
}

export function buildQuestionBankSubjectUpdates(subjects, test) {
  const allSubjects = toSafeArray(subjects)
  const questionList = toSafeArray(test?.questions)

  if (allSubjects.length === 0 || questionList.length === 0) {
    return []
  }

  const fallbackSubjectIds = toSafeArray(test?.metadata?.subjects)
    .map((subject) => subject?.id)
    .filter(Boolean)
  const groupedQuestions = new Map()

  questionList.forEach((question) => {
    const subjectId = question?.sourceSubject || null
    if (!subjectId) return

    const existing = groupedQuestions.get(subjectId) || []
    existing.push(question)
    groupedQuestions.set(subjectId, existing)
  })

  if (groupedQuestions.size === 0 && fallbackSubjectIds.length > 0) {
    fallbackSubjectIds.forEach((subjectId) => {
      groupedQuestions.set(subjectId, questionList)
    })
  }

  if (test?.config?.scope === 'multi-subject' && fallbackSubjectIds.length > 0) {
    fallbackSubjectIds.forEach((subjectId) => {
      if (!groupedQuestions.has(subjectId)) {
        groupedQuestions.set(subjectId, questionList)
      }
    })
  }

  return [...groupedQuestions.entries()]
    .map(([subjectId, questionsForSubject]) => {
      const subject = allSubjects.find((item) => item.id === subjectId)
      if (!subject) return null

      return {
        ...subject,
        questionBank: mergeQuestionBankItems(
          subject.questionBank,
          createGeneratedQuestionBankItems({
            subject,
            test,
            questions: questionsForSubject,
          }),
          { subjectId: subject.id }
        ),
      }
    })
    .filter(Boolean)
}
