const GITHUB_PAGES_HOST_SUFFIX = 'github.io'
const CACHE_RESET_MARKER = 'learnledger-cache-reset-v1'

function getCurrentHostname() {
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return ''
  }

  return window.location.hostname
}

export function isGitHubPagesHost(hostname = getCurrentHostname()) {
  return String(hostname || '').endsWith(GITHUB_PAGES_HOST_SUFFIX)
}

export async function resetCachedDeployedApp() {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return false
  }

  if (!isGitHubPagesHost()) {
    return false
  }

  if (sessionStorage.getItem(CACHE_RESET_MARKER) === 'done') {
    return false
  }

  sessionStorage.setItem(CACHE_RESET_MARKER, 'done')

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.allSettled(registrations.map((registration) => registration.unregister()))
  }

  if ('caches' in window) {
    const cacheNames = await window.caches.keys()
    await Promise.allSettled(cacheNames.map((cacheName) => window.caches.delete(cacheName)))
  }

  window.location.reload()
  return true
}
