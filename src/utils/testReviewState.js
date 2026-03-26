import { calculateScore } from '@/utils/testScoring'

function toObject(value) {
  return value && typeof value === 'object' ? value : {}
}

export function finalizeTestAttemptWithStoredAnswers(testAttempt) {
  const questions = Array.isArray(testAttempt?.questions) ? testAttempt.questions : []
  const answers = toObject(testAttempt?.answers)
  const scoreResult = calculateScore(questions, answers)
  const hintsUsedCount = Array.isArray(testAttempt?.hintsUsed) ? testAttempt.hintsUsed.length : 0
  const hintPenalty = hintsUsedCount * 5
  const finalPercentage = Math.max(0, scoreResult.percentage - hintPenalty)
  const hasScorableQuestions = Number(scoreResult.scorableQuestions || 0) > 0

  return {
    ...testAttempt,
    ...scoreResult,
    percentage: finalPercentage,
    passed: hasScorableQuestions && finalPercentage >= 70,
  }
}

export function applyReviewPatchToTest(test, reviewPatch) {
  const questionUpdatesById = toObject(reviewPatch?.questionUpdatesById)
  const nextQuestions = (Array.isArray(test?.questions) ? test.questions : []).map((question) => {
    const questionId = String(question?.id || '').trim()
    const update = questionUpdatesById[questionId]

    if (!update) {
      return question
    }

    return {
      ...question,
      correctAnswer: String(question?.correctAnswer || '').trim() || String(update.correctAnswer || '').trim(),
      explanation: String(question?.explanation || '').trim() || String(update.explanation || '').trim(),
    }
  })

  const nextMetadata = {
    ...toObject(test?.metadata),
    ...(reviewPatch?.reviewGeneration !== undefined ? { reviewGeneration: reviewPatch.reviewGeneration } : {}),
  }
  const mergedTest = {
    ...test,
    questions: nextQuestions,
    reviewExplanations:
      reviewPatch?.reviewExplanations && typeof reviewPatch.reviewExplanations === 'object'
        ? reviewPatch.reviewExplanations
        : toObject(test?.reviewExplanations),
    metadata: nextMetadata,
  }

  if (!mergedTest?.completedAt && !mergedTest?.endTime) {
    return mergedTest
  }

  return finalizeTestAttemptWithStoredAnswers(mergedTest)
}
