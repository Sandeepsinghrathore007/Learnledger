import { useCallback, useEffect, useMemo, useState } from 'react'

function checkStandaloneMode() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export function usePWAInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null)
  const [isInstalled, setIsInstalled] = useState(checkStandaloneMode)
  const [lastOutcome, setLastOutcome] = useState('idle')

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(display-mode: standalone)')

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setPromptEvent(event)
      setLastOutcome('ready')
    }

    const handleInstalled = () => {
      setPromptEvent(null)
      setIsInstalled(true)
      setLastOutcome('installed')
    }

    const handleDisplayModeChange = (event) => {
      if (event.matches) {
        setIsInstalled(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    mediaQuery.addEventListener?.('change', handleDisplayModeChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      mediaQuery.removeEventListener?.('change', handleDisplayModeChange)
    }
  }, [])

  const installApp = useCallback(async () => {
    if (!promptEvent) {
      return { outcome: 'unavailable' }
    }

    promptEvent.prompt()
    const choiceResult = await promptEvent.userChoice
    const outcome = choiceResult?.outcome || 'dismissed'

    setLastOutcome(outcome)

    if (outcome === 'accepted') {
      setPromptEvent(null)
    }

    return { outcome }
  }, [promptEvent])

  return useMemo(
    () => ({
      canInstall: Boolean(promptEvent) && !isInstalled,
      installApp,
      isInstalled,
      lastOutcome,
    }),
    [installApp, isInstalled, lastOutcome, promptEvent]
  )
}
