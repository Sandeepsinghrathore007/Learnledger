/**
 * testScoring.js — Utilities for test scoring and performance calculation.
 *
 * Functions:
 *  - calculateScore: Calculate test score and performance metrics
 *  - determinePerformanceLevel: Calculate AI performance score (0-100)
 *  - analyzeWeakAreas: Identify topics where user struggled
 *  - calculateAccuracyByDifficulty: Break down accuracy by difficulty level
 */

/**
 * Calculate the score for a completed test attempt.
 * Returns detailed scoring breakdown.
 */
export function calculateScore(questions, answers) {
  let correct = 0
  let incorrect = 0
  let unanswered = 0

  const results = questions.map(question => {
    const userAnswer = answers[question.id]
    const isCorrect = userAnswer === question.correctAnswer
    
    if (!userAnswer) {
      unanswered++
      return {
        questionId: question.id,
        correct: false,
        unanswered: true,
        userAnswer: null,
      }
    }

    if (isCorrect) {
      correct++
    } else {
      incorrect++
    }

    return {
      questionId: question.id,
      correct: isCorrect,
      unanswered: false,
      userAnswer,
    }
  })

  const totalQuestions = questions.length
  const percentage = Math.round((correct / totalQuestions) * 100)
  const passed = percentage >= 70 // Default pass threshold

  return {
    score: correct,
    correct,
    incorrect,
    unanswered,
    totalQuestions,
    percentage,
    passed,
    results,
  }
}

/**
 * Determine AI performance level based on test history.
 * Returns a score from 0-100.
 * 
 * Algorithm:
 * - Recent tests weighted more heavily (80% weight to last 3 tests)
 * - Average percentage across tests
 * - Bonus for consistency (low variance)
 * - Penalty for incomplete tests
 */
export function determinePerformanceLevel(testHistory) {
  if (!testHistory || testHistory.length === 0) {
    return null // No tests taken yet
  }

  // Get recent tests (last 5)
  const recentTests = testHistory.slice(-5)
  
  // Calculate weighted average
  let weightedSum = 0
  let weightSum = 0
  
  recentTests.forEach((test, index) => {
    // More recent = higher weight
    const weight = index + 1
    weightedSum += test.percentage * weight
    weightSum += weight
  })
  
  const averageScore = Math.round(weightedSum / weightSum)
  
  // Bonus for consistency (low variance)
  const scores = recentTests.map(t => t.percentage)
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length
  const stdDev = Math.sqrt(variance)
  
  // Lower standard deviation = more consistent = bonus points
  const consistencyBonus = Math.max(0, Math.round((20 - stdDev) / 2))
  
  // Final score capped at 100
  const finalScore = Math.min(100, averageScore + consistencyBonus)
  
  return finalScore
}

/**
 * Analyze test results to identify weak areas.
 * Returns topics where user scored below 70%.
 */
export function analyzeWeakAreas(questions, answers, subjectData) {
  const topicPerformance = {}

  questions.forEach(question => {
    const topicId = question.sourceTopic
    if (!topicId) return

    if (!topicPerformance[topicId]) {
      topicPerformance[topicId] = {
        topicId,
        topicName: question.topicName || 'Unknown',
        correct: 0,
        total: 0,
      }
    }

    topicPerformance[topicId].total++
    
    const userAnswer = answers[question.id]
    if (userAnswer === question.correctAnswer) {
      topicPerformance[topicId].correct++
    }
  })

  // Calculate percentages and identify weak areas
  const weakAreas = Object.values(topicPerformance)
    .map(topic => ({
      ...topic,
      percentage: Math.round((topic.correct / topic.total) * 100),
    }))
    .filter(topic => topic.percentage < 70)
    .sort((a, b) => a.percentage - b.percentage) // Worst first

  return {
    weakAreas,
    allTopics: Object.values(topicPerformance).map(topic => ({
      ...topic,
      percentage: Math.round((topic.correct / topic.total) * 100),
    })),
  }
}

/**
 * Calculate accuracy breakdown by difficulty level.
 */
export function calculateAccuracyByDifficulty(questions, answers) {
  const difficultyStats = {
    easy: { correct: 0, total: 0 },
    medium: { correct: 0, total: 0 },
    hard: { correct: 0, total: 0 },
  }

  questions.forEach(question => {
    const difficulty = question.difficulty || 'medium'
    const userAnswer = answers[question.id]
    
    if (difficultyStats[difficulty]) {
      difficultyStats[difficulty].total++
      if (userAnswer === question.correctAnswer) {
        difficultyStats[difficulty].correct++
      }
    }
  })

  // Calculate percentages
  return Object.entries(difficultyStats).reduce((acc, [difficulty, stats]) => {
    acc[difficulty] = {
      ...stats,
      percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
    }
    return acc
  }, {})
}

/**
 * Format time in seconds to readable string.
 */
export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

/**
 * Format time for timer display (MM:SS).
 */
export function formatTimerDisplay(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
