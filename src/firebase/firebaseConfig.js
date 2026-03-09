import { getApp, getApps, initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'appId']
const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key])

if (missingKeys.length > 0) {
  console.warn(
    `Firebase config is missing: ${missingKeys.join(', ')}. ` +
    'Set VITE_FIREBASE_* variables in your .env file.'
  )
}

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = initializeFirestore(app, {
  // Helps in environments where WebChannel streams are blocked by browser/network policies.
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
})
export const functions = getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1')

export const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Failed to set Firebase auth persistence:', error)
})

let analyticsPromise = null

export async function getFirebaseAnalytics() {
  if (typeof window === 'undefined') {
    return null
  }

  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      const { getAnalytics, isSupported } = await import('firebase/analytics')

      if (!(await isSupported())) {
        return null
      }

      return getAnalytics(app)
    })()
  }

  return analyticsPromise
}

export { firebaseConfig }
