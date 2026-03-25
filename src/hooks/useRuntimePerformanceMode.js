import { useEffect, useMemo, useState } from 'react'

function readRuntimeSnapshot() {
  if (typeof window === 'undefined') {
    return {
      deviceMemory: 0,
      hardwareConcurrency: 0,
      prefersReducedMotion: false,
    }
  }

  const navigation = window.navigator || {}

  return {
    deviceMemory: Number(navigation.deviceMemory || 0),
    hardwareConcurrency: Number(navigation.hardwareConcurrency || 0),
    prefersReducedMotion:
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false,
  }
}

export function useRuntimePerformanceMode({ mobile = false, applyDocumentAttribute = false } = {}) {
  const [snapshot, setSnapshot] = useState(readRuntimeSnapshot)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncSnapshot = () => {
      setSnapshot((previous) => {
        const next = readRuntimeSnapshot()

        if (
          previous.deviceMemory === next.deviceMemory &&
          previous.hardwareConcurrency === next.hardwareConcurrency &&
          previous.prefersReducedMotion === next.prefersReducedMotion
        ) {
          return previous
        }

        return next
      })
    }

    syncSnapshot()

    if (typeof reducedMotionQuery.addEventListener === 'function') {
      reducedMotionQuery.addEventListener('change', syncSnapshot)
      return () => reducedMotionQuery.removeEventListener('change', syncSnapshot)
    }

    reducedMotionQuery.addListener(syncSnapshot)
    return () => reducedMotionQuery.removeListener(syncSnapshot)
  }, [])

  const performanceMode = useMemo(() => {
    const lowMemoryDevice = snapshot.deviceMemory > 0 && snapshot.deviceMemory <= 4
    const lowCpuDevice = snapshot.hardwareConcurrency > 0 && snapshot.hardwareConcurrency <= 6
    const isLowEndDevice = lowMemoryDevice || lowCpuDevice
    const reduceEffects = snapshot.prefersReducedMotion || (mobile && isLowEndDevice)
    const ultraLite = mobile && (snapshot.prefersReducedMotion || lowMemoryDevice)

    return {
      deviceMemory: snapshot.deviceMemory,
      hardwareConcurrency: snapshot.hardwareConcurrency,
      prefersReducedMotion: snapshot.prefersReducedMotion,
      isLowEndDevice,
      reduceEffects,
      ultraLite,
    }
  }, [mobile, snapshot])

  useEffect(() => {
    if (!applyDocumentAttribute) {
      return undefined
    }

    if (typeof document === 'undefined') {
      return undefined
    }

    const root = document.documentElement
    root.dataset.performanceMode = performanceMode.ultraLite ? 'lite' : 'default'

    return () => {
      delete root.dataset.performanceMode
    }
  }, [applyDocumentAttribute, performanceMode.ultraLite])

  return performanceMode
}
