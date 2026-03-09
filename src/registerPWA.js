import { registerSW } from 'virtual:pwa-register'

let didRegister = false

export function registerPWA() {
  if (didRegister || typeof window === 'undefined') {
    return
  }

  didRegister = true

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true)
    },
    onRegisterError(error) {
      console.error('PWA service worker registration failed:', error)
    },
  })
}
