import { registerSW } from 'virtual:pwa-register'

let didRegister = false

export function registerPWA() {
  if (didRegister || typeof window === 'undefined') {
    return
  }

  didRegister = true

  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.error('PWA service worker registration failed:', error)
    },
  })
}
