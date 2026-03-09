/**
 * useTestTimer.js — Hook for managing test timers.
 *
 * Supports two modes:
 *  1. Total time limit for entire test
 *  2. Time limit per question
 *
 * Features:
 *  - Countdown timer
 *  - Auto-submit when time expires
 *  - Pause/resume capability
 *  - Time tracking per question (for per-question mode)
 *
 * Returns:
 *  - timeRemaining: Seconds remaining
 *  - isTimeUp: Boolean - time expired
 *  - startTimer: Start the timer
 *  - pauseTimer: Pause the timer
 *  - resumeTimer: Resume the timer
 *  - resetTimer: Reset to initial time
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export function useTestTimer(config, onTimeUp) {
  const { timeLimit, timingMode, timePerQuestion, questionCount } = config

  // Calculate initial time in seconds
  const getInitialTime = useCallback(() => {
    if (timingMode === 'per-question' && timePerQuestion) {
      return timePerQuestion // Current question time
    }
    if (timeLimit) {
      return timeLimit * 60 // Convert minutes to seconds
    }
    return null // No time limit
  }, [timeLimit, timingMode, timePerQuestion])

  const [timeRemaining, setTimeRemaining] = useState(getInitialTime())
  const [isRunning, setIsRunning] = useState(false)
  const [isTimeUp, setIsTimeUp] = useState(false)
  const intervalRef = useRef(null)

  // ── TIMER TICK ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning || timeRemaining === null) {
      return
    }

    intervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up!
          setIsRunning(false)
          setIsTimeUp(true)
          if (onTimeUp) {
            onTimeUp()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, timeRemaining, onTimeUp])

  // ── START TIMER ────────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    setIsRunning(true)
    setIsTimeUp(false)
  }, [])

  // ── PAUSE TIMER ────────────────────────────────────────────────────────────
  const pauseTimer = useCallback(() => {
    setIsRunning(false)
  }, [])

  // ── RESUME TIMER ───────────────────────────────────────────────────────────
  const resumeTimer = useCallback(() => {
    if (!isTimeUp) {
      setIsRunning(true)
    }
  }, [isTimeUp])

  // ── RESET TIMER ────────────────────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    setTimeRemaining(getInitialTime())
    setIsRunning(false)
    setIsTimeUp(false)
  }, [getInitialTime])

  // ── RESET FOR NEXT QUESTION (per-question mode) ───────────────────────────
  const resetForNextQuestion = useCallback(() => {
    if (timingMode === 'per-question' && timePerQuestion) {
      setTimeRemaining(timePerQuestion)
      setIsTimeUp(false)
      // Auto-start for next question
      setIsRunning(true)
    }
  }, [timingMode, timePerQuestion])

  // ── RETURN API ─────────────────────────────────────────────────────────────
  return {
    timeRemaining,
    isRunning,
    isTimeUp,
    hasTimeLimit: timeRemaining !== null,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    resetForNextQuestion,
  }
}
