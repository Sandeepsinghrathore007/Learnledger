/**
 * aiScore.js — Helper utilities for AI performance score display.
 *
 * Converts a numeric score into a labelled colour band.
 * Used in AiScoreBadge component.
 */

import { AI_SCORE_BANDS } from '@/constants/theme'

/**
 * Returns the matching score band for a given numeric score.
 *
 * @param {number|null} score - Score 0–100, or null if no tests taken
 * @returns {{ min, label, color } | null}
 */
export function getScoreBand(score) {
  if (score === null || score === undefined) return null
  return AI_SCORE_BANDS.find(band => score >= band.min) ?? AI_SCORE_BANDS.at(-1)
}
