/**
 * subjectStats.js — Pure helper functions for computing subject statistics.
 *
 * Separated from components so stats logic can be tested or reused independently.
 */

/**
 * Returns total note count across all topics in a subject.
 *
 * @param {Object} subject
 * @returns {number}
 */
export function getTotalNotes(subject) {
  return subject.topics.reduce((sum, topic) => sum + topic.notes.length, 0)
}

/**
 * Returns total notes across ALL subjects.
 *
 * @param {Object[]} subjects
 * @returns {number}
 */
export function getTotalNotesAll(subjects) {
  return subjects.reduce((sum, s) => sum + getTotalNotes(s), 0)
}

/**
 * Returns total topic count across all subjects.
 *
 * @param {Object[]} subjects
 * @returns {number}
 */
export function getTotalTopics(subjects) {
  return subjects.reduce((sum, s) => sum + s.topics.length, 0)
}

/**
 * Returns total tests attempted across all subjects.
 *
 * @param {Object[]} subjects
 * @returns {number}
 */
export function getTotalTests(subjects) {
  return subjects.reduce((sum, s) => sum + (s.testsAttempted ?? 0), 0)
}
